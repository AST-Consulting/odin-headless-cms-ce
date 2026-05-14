"use client";

import {
  useBlockNoteEditor,
  useEditorSelectionChange,
  FormattingToolbarController,
  BlockTypeSelect,
  BasicTextStyleButton,
  TextAlignButton,
  ColorStyleButton,
  NestBlockButton,
  UnnestBlockButton,
} from "@blocknote/react";
import { Wand2, Loader2, SendHorizonal, Link2 } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { chatWithAI } from "@/lib/api";
import { markdownToBlocks } from "@/lib/markdown-to-blocks";
import { useEditorStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function AiFormattingToolbar({ onLinkClick }: { onLinkClick?: () => void }) {
  const editor = useBlockNoteEditor();
  const { articleType } = useEditorStore();
  const [selectedText, setSelectedText] = useState("");
  const [isHeadingSelected, setIsHeadingSelected] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  // Snapshot the selected blocks when the dialog opens so we can replace them later
  const selectionSnapshotRef = useRef<{ blocks: NonNullable<ReturnType<typeof editor.getSelection>>["blocks"] } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track selection changes
  useEditorSelectionChange(() => {
    if (!editor) return;

    try {
      const selection = editor.getSelection();
      const cursorBlock = editor.getTextCursorPosition()?.block;

      if (selection) {
        const selectedBlocks = selection.blocks;
        setIsHeadingSelected(
          selectedBlocks.some((b: { type: string }) => b.type === "heading")
        );

        if (selectedBlocks.length > 0) {
          const markdown = editor.blocksToMarkdownLossy(selectedBlocks);
          setSelectedText(markdown.trim());
        } else {
          setSelectedText("");
        }
      } else {
        setIsHeadingSelected(cursorBlock?.type === "heading");
        setSelectedText("");
      }
    } catch {
      setSelectedText("");
    }
  }, editor);

  const handleOpenDialog = () => {
    if (!selectedText) {
      toast.error("Select some text first");
      return;
    }
    // Snapshot the current selection before the dialog steals focus
    const selection = editor.getSelection();
    selectionSnapshotRef.current = selection ? { blocks: [...selection.blocks] } : null;
    setInstruction("");
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (isDialogOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isDialogOpen]);

  const handleApply = async () => {
    const trimmed = instruction.trim();
    if (!trimmed) {
      toast.error("Enter an instruction");
      return;
    }

    if (!selectionSnapshotRef.current) {
      toast.error("Selection lost. Please select text and try again.");
      setIsDialogOpen(false);
      return;
    }

    setIsProcessing(true);

    try {
      const improvedText = await chatWithAI({
        message: `${trimmed}\n\nOriginal Content:\n${selectedText}\n\nIMPORTANT INSTRUCTIONS:\n- Return ONLY the improved content itself, with no code blocks, no markdown fences, no explanations\n- Do NOT wrap the output in \`\`\`markdown or any other code block syntax\n- Use the same markdown formatting as the original (headings with #, lists with -, etc.)\n- Preserve the original heading structure and paragraph breaks\n- Start directly with the content\n- Do not add any preamble like "Here is the improved content:" or similar\n\nReturn the improved content now:`,
      });
      const newBlocks = markdownToBlocks(improvedText, editor);
      editor.replaceBlocks(selectionSnapshotRef.current.blocks, newBlocks);
      toast.success("Changes applied");
      setIsDialogOpen(false);
    } catch {
      toast.error("Failed to apply changes. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <React.Fragment key="ai-formatting-toolbar-root">
      <FormattingToolbarController
        key="formatting-toolbar-controller"
        formattingToolbar={() => (
          <div key="formatting-toolbar-container" className={`flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1.5 ${isDialogOpen ? "invisible" : ""}`}>
            {/* Standard BlockNote formatting buttons */}
            <BlockTypeSelect key="blockTypeSelect" />

            <BasicTextStyleButton basicTextStyle="bold" key="boldStyleButton" />
            <BasicTextStyleButton basicTextStyle="italic" key="italicStyleButton" />
            <BasicTextStyleButton basicTextStyle="underline" key="underlineStyleButton" />
            <BasicTextStyleButton basicTextStyle="strike" key="strikeStyleButton" />

            <TextAlignButton textAlignment="left" key="textAlignLeftButton" />
            <TextAlignButton textAlignment="center" key="textAlignCenterButton" />
            <TextAlignButton textAlignment="right" key="textAlignRightButton" />

            {!isHeadingSelected && <ColorStyleButton key="colorStyleButton" />}

            <button
              key="customLinkButton"
              onClick={onLinkClick || (() => editor.createLink("", ""))}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center justify-center h-8 w-8 rounded hover:bg-accent transition-colors"
              title="Insert Link"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>

            <NestBlockButton key="nestBlockButton" />
            <UnnestBlockButton key="unnestBlockButton" />

            {/* Separator */}
            <div key="separator" className="w-px h-6 bg-border mx-1" />

            {/* AI button */}
            <button
              key="ai-button"
              onClick={handleOpenDialog}
              disabled={!selectedText || articleType !== "article"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded
                hover:bg-accent transition-colors cursor-pointer
                disabled:opacity-40 disabled:cursor-not-allowed"
              title={articleType !== "article" ? "AI features only available for Article type" : "AI: Transform selected text with custom instructions"}
            >
              <Wand2 className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-medium">AI</span>
            </button>
          </div>
        )}
      />

      {/* AI instruction dialog */}
      <Dialog key="ai-instruction-dialog" open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent key="ai-dialog-content" className="sm:max-w-[440px] gap-4">
          <DialogHeader key="ai-dialog-header">
            <DialogTitle key="ai-dialog-title" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple-500" />
              AI Edit
            </DialogTitle>
            <DialogDescription key="ai-dialog-description">
              Describe how you want to change the selected text.
            </DialogDescription>
          </DialogHeader>

          <div key="ai-dialog-body" className="space-y-3">
            {/* Preview of selected text */}
            <div key="ai-selection-preview" className="rounded-md bg-muted p-3 text-xs text-muted-foreground max-h-24 overflow-y-auto leading-relaxed">
              {selectedText.length > 300
                ? selectedText.slice(0, 300) + "..."
                : selectedText}
            </div>

            <Textarea
              key="ai-instruction-input"
              ref={textareaRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g., Make it shorter, rewrite in Hindi, add a stronger opening line, make it sound more formal..."
              rows={3}
              className="resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleApply();
                }
              }}
            />

            <div key="ai-dialog-footer" className="flex items-center justify-between">
              <span key="ai-shortcut-hint" className="text-[11px] text-muted-foreground">
                {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter to apply
              </span>
              <Button
                key="ai-apply-button"
                onClick={handleApply}
                disabled={isProcessing || !instruction.trim()}
                size="sm"
                className="gap-1.5"
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SendHorizonal className="h-3.5 w-3.5" />
                )}
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
}
