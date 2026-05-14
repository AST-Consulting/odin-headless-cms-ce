"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Zap, Pin, Image as ImageIcon, Keyboard } from "lucide-react";
import { useCreateBlockNote, getDefaultReactSlashMenuItems, SuggestionMenuController } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { toast } from "sonner";
import { useThemeStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { createEditorSchema } from "../editorSchema";
import { getImagePickerSlashCommand } from "../imagePickerSlashCommand";
import { getFeaturedImageSlashCommand } from "../featuredImageSlashCommand";
import { getTimestampSlashCommand } from "../TimestampBlock";
import { getTwitterSlashCommand, insertTwitterEmbed } from "../twitterSlashCommand";
import { getYouTubeSlashCommand, insertYouTubeEmbed } from "../youtubeSlashCommand";
import { getInstagramSlashCommand, insertInstagramEmbed } from "../instagramSlashCommand";
import { getSoundCloudSlashCommand } from "../soundcloudSlashCommand";
import { getSnapchatSlashCommand } from "../snapchatSlashCommand";
import { extractTweetId } from "../TwitterEmbedBlock";
import { extractYouTubeVideoId } from "../YouTubeEmbedBlock";
import { extractInstagramPostId } from "../InstagramEmbedBlock";
import { insertSoundCloudEmbed, isValidSoundCloudUrl } from "../SoundCloudEmbedBlock";
import { insertSnapchatEmbed, isValidSnapchatUrl } from "../SnapchatEmbedBlock";
import { EmbedUrlDialog } from "../EmbedUrlDialog";
import { AiFormattingToolbar } from "../AiFormattingToolbar";
import "@blocknote/mantine/style.css";
import type { ComposeMode, LiveUpdate } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AuthorSelector } from "../../common/AuthorSelector";
import { AuthorStub } from "@/lib/types";
import { Pencil } from "lucide-react";

type EmbedDialogType = "twitter" | "youtube" | "instagram" | "soundcloud" | "snapchat" | null;

interface LiveComposePanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPost: (blocks: any[], options: { isAlert: boolean; isPinned: boolean; updateId?: string }) => void | Promise<void>;
  onImagePick: () => void;
  composeMode: ComposeMode;
  onComposeModeChange: (mode: ComposeMode) => void;
  isPosting: boolean;
  authorName: string;
  selectedAuthors: AuthorStub[];
  onAuthorChange: (authors: AuthorStub[]) => void;
  editUpdate?: LiveUpdate | null;
  onCancelEdit?: () => void;
}

export function LiveComposePanel({
  onPost,
  onImagePick,
  composeMode,
  onComposeModeChange,
  isPosting,
  authorName,
  selectedAuthors,
  onAuthorChange,
  editUpdate,
  onCancelEdit,
}: LiveComposePanelProps) {
  const [isAuthorDialogOpen, setIsAuthorDialogOpen] = useState(false);
  const [tempAuthorStub, setTempAuthorStub] = useState<AuthorStub[]>([]);

  useEffect(() => {
    if (isAuthorDialogOpen) {
      setTempAuthorStub(selectedAuthors);
    }
  }, [isAuthorDialogOpen, selectedAuthors]);

  const handleSaveAuthor = useCallback(() => {
    onAuthorChange(tempAuthorStub);
    setIsAuthorDialogOpen(false);
  }, [onAuthorChange, tempAuthorStub]);

  const [pinOnPost, setPinOnPost] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [embedDialogType, setEmbedDialogType] = useState<EmbedDialogType>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useThemeStore();

  // Use the same schema as main editor - all custom blocks available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema = useMemo(() => createEditorSchema() as any, []);

  // Create BlockNote editor with full schema
  const composeEditor = useCreateBlockNote({
    schema,
    placeholders: {
      default: "What's happening now?",
    },
  });

  const isEditorEmpty = useCallback(() => {
    if (!composeEditor) return true;
    const blocks = composeEditor.document;
    if (blocks.length === 0) return true;
    if (blocks.length === 1) {
      const block = blocks[0];
      if (block.type === "paragraph" && (!block.content || (block.content as unknown[]).length === 0)) {
        return true;
      }
      // Check if single paragraph with empty text
      if (block.type === "paragraph" && Array.isArray(block.content)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasText = (block.content as any[]).some((c: any) => c.type === "text" && c.text?.trim());
        return !hasText;
      }
    }
    return false;
  }, [composeEditor]);

  // Handle loading blocks for edit
  useEffect(() => {
    if (editUpdate && composeEditor) {
      // Use setEditorKey to force a re-mount if needed, or just replace blocks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      composeEditor.replaceBlocks(composeEditor.document, editUpdate.contentBlocks.map((b: any) => ({
        type: b.type,
        content: b.content,
        props: b.props,
      })));
      if (editUpdate.isAlert) onComposeModeChange("alert");
      else onComposeModeChange("normal");
    } else if (!editUpdate && composeEditor) {
      composeEditor.replaceBlocks(composeEditor.document, [{ type: "paragraph" }]);
      onComposeModeChange("normal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editUpdate, composeEditor]);

  const handlePost = useCallback(() => {
    if (!composeEditor || isEditorEmpty()) return;

    // Get blocks from compose editor (skip empty paragraphs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks = composeEditor.document.filter((block: any) => {
      if (block.type === "paragraph") {
        if (!block.content || block.content.length === 0) return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return block.content.some((c: any) => c.type === "text" && c.text?.trim());
      }
      return true;
    });

    if (blocks.length === 0) return;

    onPost(blocks, {
      isAlert: composeMode === "alert",
      isPinned: pinOnPost,
      updateId: editUpdate?.id
    });

    // Clear compose editor content
    composeEditor.replaceBlocks(composeEditor.document, [{ type: "paragraph" }]);
    setPinOnPost(false);
    if (composeMode === "alert") onComposeModeChange("normal");
  }, [composeEditor, composeMode, pinOnPost, onPost, onComposeModeChange, isEditorEmpty, editUpdate]);

  // Handle Ctrl+Enter to post
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handlePost();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [handlePost]);

  const isAlertMode = composeMode === "alert";

  // Embed dialog handlers
  const handleTwitterEmbed = useCallback(() => setEmbedDialogType("twitter"), []);
  const handleYouTubeEmbed = useCallback(() => setEmbedDialogType("youtube"), []);
  const handleInstagramEmbed = useCallback(() => setEmbedDialogType("instagram"), []);
  const handleSoundCloudEmbed = useCallback(() => setEmbedDialogType("soundcloud"), []);
  const handleSnapchatEmbed = useCallback(() => setEmbedDialogType("snapchat"), []);

  const handleEmbedUrlSubmit = useCallback(
    (url: string): boolean => {
      if (!embedDialogType || !composeEditor) return false;
      switch (embedDialogType) {
        case "twitter": {
          if (!extractTweetId(url)) { toast.error("Invalid Twitter/X URL"); return false; }
          return insertTwitterEmbed(composeEditor, url) ? (toast.success("Tweet embedded!"), true) : (toast.error("Failed to embed tweet"), false);
        }
        case "youtube": {
          if (!extractYouTubeVideoId(url)) { toast.error("Invalid YouTube URL"); return false; }
          return insertYouTubeEmbed(composeEditor, url) ? (toast.success("YouTube video embedded!"), true) : (toast.error("Failed to embed video"), false);
        }
        case "instagram": {
          if (!extractInstagramPostId(url)) { toast.error("Invalid Instagram URL"); return false; }
          return insertInstagramEmbed(composeEditor, url) ? (toast.success("Instagram post embedded!"), true) : (toast.error("Failed to embed post"), false);
        }
        case "soundcloud": {
          if (!isValidSoundCloudUrl(url)) { toast.error("Invalid SoundCloud URL"); return false; }
          return insertSoundCloudEmbed(composeEditor, url, 166) ? (toast.success("SoundCloud embedded!"), true) : (toast.error("Failed to embed"), false);
        }
        case "snapchat": {
          if (!isValidSnapchatUrl(url)) { toast.error("Invalid Snapchat URL"); return false; }
          return insertSnapchatEmbed(composeEditor, url) ? (toast.success("Snapchat embedded!"), true) : (toast.error("Failed to embed"), false);
        }
        default: return false;
      }
    },
    [composeEditor, embedDialogType]
  );

  const embedDialogConfig: Record<string, { title: string; description: string; placeholder: string }> = {
    twitter: { title: "Embed Twitter/X Post", description: "Paste a Twitter/X post URL", placeholder: "https://twitter.com/..." },
    youtube: { title: "Embed YouTube Video", description: "Paste a YouTube video URL", placeholder: "https://youtube.com/watch?v=..." },
    instagram: { title: "Embed Instagram Post", description: "Paste an Instagram post URL", placeholder: "https://instagram.com/p/..." },
    soundcloud: { title: "Embed SoundCloud Track", description: "Paste a SoundCloud URL", placeholder: "https://soundcloud.com/..." },
    snapchat: { title: "Embed Snapchat Spotlight", description: "Paste a Snapchat Spotlight URL", placeholder: "https://snapchat.com/..." },
  };

  return (
    <div className="flex flex-col h-full overflow-visible">
      {/* Author indicator/selection */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          {editUpdate ? "Editing update" : "Posting as"}{" "}
          <span className="font-medium text-foreground">{authorName}</span>
          <button
            onClick={() => setIsAuthorDialogOpen(true)}
            className="hover:text-foreground transition-colors p-0.5"
            title="Change author"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </p>
        {editUpdate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onCancelEdit}
          >
            Cancel Edit
          </Button>
        )}
      </div>

      <Dialog open={isAuthorDialogOpen} onOpenChange={setIsAuthorDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Author</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 font-sans">
            <Label>Select Author</Label>
            <AuthorSelector
              selected={tempAuthorStub}
              onChange={setTempAuthorStub}
              placeholder="Search and select author..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuthorDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAuthor}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose area - stretches to fill available space */}
      <div className="flex-1 px-4 pb-2 min-h-0 overflow-hidden" ref={containerRef}>
        <div
          className={`relative rounded-lg border-2 transition-colors h-full flex flex-col overflow-hidden ${isAlertMode
              ? "border-red-400 bg-red-50/50 dark:border-red-500/50 dark:bg-red-950/20"
              : "border-border focus-within:border-primary/50"
            }`}
        >
          {isAlertMode && (
            <div className="flex items-center gap-1.5 px-3 pt-2 text-xs font-semibold text-red-600 dark:text-red-400">
              <Zap className="w-3 h-3 fill-current" />
              BREAKING UPDATE
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <BlockNoteView
              key={editorKey}
              editor={composeEditor}
              theme={theme === "dark" ? "dark" : "light"}
              className="compose-editor h-full [&_.bn-editor]:min-h-full [&_.bn-editor]:p-2"
              sideMenu={false}
              slashMenu={false}
              formattingToolbar={false}
            >
              <SuggestionMenuController
                key="suggestion-menu"
                triggerCharacter="/"
                getItems={async (query) => {
                  const { user } = useAuthStore.getState();
                  const items = [
                    ...getDefaultReactSlashMenuItems(composeEditor).filter(
                      (item) => item.title !== "Image" && item.title !== "Video"
                    ),
                    getImagePickerSlashCommand(onImagePick),
                    getTimestampSlashCommand(composeEditor, user ? { id: user.id, name: user.name, slug: user.slug ?? "" } : null),
                    getTwitterSlashCommand(handleTwitterEmbed),
                    getYouTubeSlashCommand(handleYouTubeEmbed),
                    getInstagramSlashCommand(handleInstagramEmbed),
                    getSoundCloudSlashCommand(handleSoundCloudEmbed),
                    getSnapchatSlashCommand(handleSnapchatEmbed),
                  ];
                  return items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()));
                }}
              />
              <AiFormattingToolbar key="ai-formatting" />
            </BlockNoteView>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 pb-3 border-t pt-3">
        <div className="flex items-center gap-2 mb-3">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isAlertMode ? "destructive" : "outline"}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => onComposeModeChange(isAlertMode ? "normal" : "alert")}
                >
                  <Zap className={`w-3 h-3 ${isAlertMode ? "fill-current" : ""}`} />
                  Alert
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Post as breaking/alert update</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={pinOnPost ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => setPinOnPost(!pinOnPost)}
                >
                  <Pin className={`w-3 h-3 ${pinOnPost ? "fill-current" : ""}`} />
                  Key Point
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Also add to Key Points summary</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Post button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePost}
            disabled={isPosting}
            className={`flex-1 gap-2 ${isAlertMode
                ? "bg-red-600 hover:bg-red-700 text-white"
                : ""
              }`}
            size="sm"
          >
            <Send className="w-3.5 h-3.5" />
            {isPosting ? "Posting..." : editUpdate ? "Update Post" : isAlertMode ? "Post Alert" : "Post Update"}
          </Button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Keyboard className="w-3 h-3" />
            <span className="hidden sm:inline">{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter</span>
          </div>
        </div>
      </div>

      {/* Embed URL Dialog */}
      {embedDialogType && (
        <EmbedUrlDialog
          open={!!embedDialogType}
          onOpenChange={(open) => { if (!open) setEmbedDialogType(null); }}
          onSubmit={handleEmbedUrlSubmit}
          title={embedDialogConfig[embedDialogType].title}
          description={embedDialogConfig[embedDialogType].description}
          placeholder={embedDialogConfig[embedDialogType].placeholder}
        />
      )}
    </div>
  );
}
