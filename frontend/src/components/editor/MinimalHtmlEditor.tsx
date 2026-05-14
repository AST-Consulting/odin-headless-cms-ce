"use client";

import { useEffect, useRef, useState } from "react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from "@blocknote/core";
import { useCreateBlockNote, createReactStyleSpec } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Pencil,
  Highlighter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// A custom inline style that wraps text in <span class="cms-inline-span">.
// Lets users mark spans semantically (toolbar toggle) and gives a visible cue
// in the editor via the scoped <style> block rendered alongside.
const spanStyleSpec = createReactStyleSpec(
  { type: "span", propSchema: "boolean" },
  {
    render: ({ contentRef }) => (
      <span ref={contentRef} className="cms-inline-span" />
    ),
  }
);

// Schema covers the toolbar's blocks plus image / quote / codeBlock so that
// existing CMS content (often imported from WordPress and containing <img>,
// <blockquote>, <pre><code>) hydrates into the editor instead of arriving empty.
// The toolbar exposes no insert UI for the extras — they're "preserve & edit"
// only.
const minimalSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    image: defaultBlockSpecs.image,
    quote: defaultBlockSpecs.quote,
    codeBlock: defaultBlockSpecs.codeBlock,
  },
  inlineContentSpecs: {
    text: defaultInlineContentSpecs.text,
    link: defaultInlineContentSpecs.link,
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
    strike: defaultStyleSpecs.strike,
    span: spanStyleSpec,
  },
});

type MinimalEditor = ReturnType<typeof useCreateBlockNote<{ schema: typeof minimalSchema }>>;

export type MinimalHtmlEditorProps = {
  defaultHtml?: string;
  onChange: (html: string) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  uploadFile?: (file: File) => Promise<string>;
};

type StyleKey = "bold" | "italic" | "underline" | "strike" | "span";

type ToolbarState = {
  styles: Record<StyleKey, boolean>;
  blockType: string;
  headingLevel: number | null;
};

const EMPTY_STATE: ToolbarState = {
  styles: {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    span: false,
  },
  blockType: "paragraph",
  headingLevel: null,
};

type ImageDialogState = {
  blockId: string;
  url: string;
  alt: string;
  caption: string;
  width: string;
};

type ImageOverlay = { id: string; top: number; left: number };

export function MinimalHtmlEditor({
  defaultHtml,
  onChange,
  className,
  disabled,
  ariaLabel,
  uploadFile,
}: MinimalHtmlEditorProps) {
  const uploadFileRef = useRef(uploadFile);
  uploadFileRef.current = uploadFile;

  const editor = useCreateBlockNote({
    schema: minimalSchema,
    placeholders: { default: "", heading: "" },
    uploadFile: uploadFile
      ? async (file: File) => {
          if (!uploadFileRef.current) throw new Error("Upload not configured");
          return uploadFileRef.current(file);
        }
      : undefined,
  });
  const [toolbar, setToolbar] = useState<ToolbarState>(EMPTY_STATE);
  const [imgDialog, setImgDialog] = useState<ImageDialogState | null>(null);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const editorAreaRef = useRef<HTMLDivElement | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const hydratedRef = useRef(false);

  const openImageDialog = (blockId: string) => {
    const block = editor.getBlock(blockId);
    if (!block || block.type !== "image") return;
    const props = block.props as {
      url?: string;
      name?: string;
      caption?: string;
      previewWidth?: number;
    };
    setImgDialog({
      blockId,
      url: props.url ?? "",
      alt: props.name ?? "",
      caption: props.caption ?? "",
      width: props.previewWidth ? String(props.previewWidth) : "",
    });
  };

  const saveImageProps = () => {
    if (!imgDialog) return;
    const widthTrim = imgDialog.width.trim();
    const widthNum = widthTrim ? Number(widthTrim) : NaN;
    editor.updateBlock(imgDialog.blockId, {
      type: "image",
      props: {
        url: imgDialog.url.trim(),
        name: imgDialog.alt,
        caption: imgDialog.caption,
        ...(Number.isFinite(widthNum) && widthNum > 0
          ? { previewWidth: widthNum }
          : {}),
      },
    } as Parameters<typeof editor.updateBlock>[1]);
    setImgDialog(null);
  };

  useEffect(() => {
    if (!editor || hydratedRef.current) return;
    if (!defaultHtml) return;

    // Only hydrate if the editor still holds its default empty paragraph.
    // If the user has already typed, leave their content alone.
    const docs = editor.document;
    const first = docs[0];
    const firstContent = first?.content as unknown;
    const isPristine =
      docs.length === 1 &&
      first?.type === "paragraph" &&
      (!firstContent ||
        (Array.isArray(firstContent) && firstContent.length === 0));

    if (!isPristine) {
      hydratedRef.current = true;
      return;
    }

    hydratedRef.current = true;
    const blocks = editor.tryParseHTMLToBlocks(defaultHtml);
    if (blocks.length > 0) {
      editor.replaceBlocks(editor.document, blocks);
    }
  }, [editor, defaultHtml]);

  useEffect(() => {
    if (!editor) return;
    const unsubscribe = editor.onChange(() => {
      const html = editor.blocksToHTMLLossy(editor.document);
      onChangeRef.current(html);
    });
    return () => {
      unsubscribe?.();
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => {
      const styles = editor.getActiveStyles() as Record<StyleKey, boolean | undefined>;
      const cursor = editor.getTextCursorPosition();
      const block = cursor.block;
      const headingLevel =
        block.type === "heading"
          ? Number((block.props as { level?: number }).level ?? 1)
          : null;
      setToolbar({
        styles: {
          bold: !!styles.bold,
          italic: !!styles.italic,
          underline: !!styles.underline,
          strike: !!styles.strike,
          span: !!styles.span,
        },
        blockType: block.type,
        headingLevel,
      });
    };
    refresh();
    const offChange = editor.onChange(refresh);
    const offSelection = editor.onSelectionChange(refresh);
    return () => {
      offChange?.();
      offSelection?.();
    };
  }, [editor]);

  // Track positions of image blocks so we can render an "edit image" overlay
  // right on top of each one instead of forcing the user to find the toolbar.
  useEffect(() => {
    if (!editor) return;
    const refresh = () => {
      const root = editorAreaRef.current;
      if (!root) {
        setImageOverlays([]);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const imgEls = root.querySelectorAll<HTMLElement>(
        '[data-content-type="image"]'
      );
      const overlays: ImageOverlay[] = [];
      imgEls.forEach((el) => {
        const blockEl = el.closest<HTMLElement>(
          '[data-node-type="blockContainer"]'
        );
        const blockId = blockEl?.getAttribute("data-id");
        if (!blockId) return;
        const r = el.getBoundingClientRect();
        // Skip placeholders (no image yet rendered)
        if (r.width < 40 || r.height < 40) return;
        overlays.push({
          id: blockId,
          top: r.top - rootRect.top + 6,
          left: r.right - rootRect.left - 34,
        });
      });
      setImageOverlays(overlays);
    };
    refresh();
    const off = editor.onChange(refresh);
    const handler = () => refresh();
    window.addEventListener("resize", handler);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && editorAreaRef.current) {
      ro = new ResizeObserver(refresh);
      ro.observe(editorAreaRef.current);
    }
    return () => {
      off?.();
      window.removeEventListener("resize", handler);
      ro?.disconnect();
    };
  }, [editor]);

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background overflow-hidden",
        disabled && "pointer-events-none opacity-60",
        className
      )}
      aria-label={ariaLabel}
    >
      <style>{`.cms-inline-span{background-color:rgba(250,204,21,.18);border-radius:2px;padding:0 2px}`}</style>
      <Toolbar
        editor={editor}
        state={toolbar}
        disabled={disabled}
        hasUpload={!!uploadFile}
        onEditImage={openImageDialog}
      />
      <div ref={editorAreaRef} className="min-h-[120px] py-1 relative">
        <BlockNoteView
          editor={editor}
          editable={!disabled}
          slashMenu={false}
          sideMenu={false}
          emojiPicker={false}
          tableHandles={false}
          formattingToolbar={false}
          theme="light"
        />
        {!disabled && imageOverlays.length > 0 && (
          <div className="pointer-events-none absolute inset-0">
            {imageOverlays.map((ov) => (
              <button
                key={ov.id}
                type="button"
                title="Edit image"
                aria-label="Edit image"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openImageDialog(ov.id)}
                className="pointer-events-auto absolute flex h-7 w-7 items-center justify-center rounded-sm border border-input bg-background/90 text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
                style={{ top: ov.top, left: ov.left }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>
      <Dialog open={!!imgDialog} onOpenChange={(o) => !o && setImgDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Image properties</DialogTitle>
            <DialogDescription>
              Edit the image source, alt text, caption, and display width.
            </DialogDescription>
          </DialogHeader>
          {imgDialog && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="img-url">URL</Label>
                <Input
                  id="img-url"
                  value={imgDialog.url}
                  onChange={(e) =>
                    setImgDialog({ ...imgDialog, url: e.target.value })
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="img-alt">Alt text</Label>
                <Input
                  id="img-alt"
                  value={imgDialog.alt}
                  onChange={(e) =>
                    setImgDialog({ ...imgDialog, alt: e.target.value })
                  }
                  placeholder="Describe the image for screen readers"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="img-caption">Caption</Label>
                <Input
                  id="img-caption"
                  value={imgDialog.caption}
                  onChange={(e) =>
                    setImgDialog({ ...imgDialog, caption: e.target.value })
                  }
                  placeholder="Shown under the image"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="img-width">Width (px)</Label>
                <Input
                  id="img-width"
                  type="number"
                  min={1}
                  value={imgDialog.width}
                  onChange={(e) =>
                    setImgDialog({ ...imgDialog, width: e.target.value })
                  }
                  placeholder="leave blank for auto"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImgDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveImageProps}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toolbar({
  editor,
  state,
  disabled,
  hasUpload,
  onEditImage,
}: {
  editor: MinimalEditor;
  state: ToolbarState;
  disabled?: boolean;
  hasUpload?: boolean;
  onEditImage: (blockId: string) => void;
}) {
  const toggleStyle = (style: StyleKey) => {
    editor.focus();
    editor.toggleStyles({ [style]: true } as Record<StyleKey, true>);
  };

  const toggleBlockType = (type: "paragraph" | "bulletListItem" | "numberedListItem") => {
    editor.focus();
    const cursor = editor.getTextCursorPosition();
    const target = cursor.block.type === type ? "paragraph" : type;
    editor.updateBlock(cursor.block, { type: target } as Parameters<typeof editor.updateBlock>[1]);
  };

  const toggleHeading = (level: 1 | 2 | 3) => {
    editor.focus();
    const cursor = editor.getTextCursorPosition();
    const block = cursor.block;
    const isSame =
      block.type === "heading" &&
      Number((block.props as { level?: number }).level ?? 1) === level;
    if (isSame) {
      editor.updateBlock(block, { type: "paragraph" } as Parameters<typeof editor.updateBlock>[1]);
    } else {
      editor.updateBlock(block, {
        type: "heading",
        props: { level },
      } as Parameters<typeof editor.updateBlock>[1]);
    }
  };

  const insertLink = () => {
    editor.focus();
    const url = window.prompt("Enter URL (https://…)");
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    editor.createLink(trimmed);
  };

  const insertImage = () => {
    editor.focus();
    const cursor = editor.getTextCursorPosition();
    editor.insertBlocks(
      [{ type: "image" } as Parameters<typeof editor.insertBlocks>[0][number]],
      cursor.block,
      "after"
    );
  };

  const editImage = () => {
    editor.focus();
    const cursor = editor.getTextCursorPosition();
    if (cursor.block.type !== "image") return;
    onEditImage(cursor.block.id);
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/40 px-1 py-1">
      <ToolbarButton
        label="Bold"
        active={state.styles.bold}
        disabled={disabled}
        onClick={() => toggleStyle("bold")}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.styles.italic}
        disabled={disabled}
        onClick={() => toggleStyle("italic")}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={state.styles.underline}
        disabled={disabled}
        onClick={() => toggleStyle("underline")}
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={state.styles.strike}
        disabled={disabled}
        onClick={() => toggleStyle("strike")}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Wrap selection in <span>"
        active={state.styles.span}
        disabled={disabled}
        onClick={() => toggleStyle("span")}
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        label="Heading 1"
        active={state.blockType === "heading" && state.headingLevel === 1}
        disabled={disabled}
        onClick={() => toggleHeading(1)}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={state.blockType === "heading" && state.headingLevel === 2}
        disabled={disabled}
        onClick={() => toggleHeading(2)}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={state.blockType === "heading" && state.headingLevel === 3}
        disabled={disabled}
        onClick={() => toggleHeading(3)}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        label="Bullet list"
        active={state.blockType === "bulletListItem"}
        disabled={disabled}
        onClick={() => toggleBlockType("bulletListItem")}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.blockType === "numberedListItem"}
        disabled={disabled}
        onClick={() => toggleBlockType("numberedListItem")}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton label="Insert link" disabled={disabled} onClick={insertLink}>
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label={hasUpload ? "Insert image (upload or URL)" : "Insert image (URL)"}
        disabled={disabled}
        onClick={insertImage}
      >
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Edit image (alt, caption, size)"
        disabled={disabled || state.blockType !== "image"}
        onClick={editImage}
      >
        <Pencil className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}
