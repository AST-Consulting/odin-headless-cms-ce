"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Radio,
  ChevronDown,
  ChevronUp,
  Square,
  X,
  Pin,
} from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { LiveComposePanel } from "./LiveComposePanel";
import { LiveTimeline } from "./LiveTimeline";
import { deleteRichBlock } from "@/lib/api";
import {
  parseUpdatesFromBlocks,
  getUpdateText,
  getBlockText,
  type LiveUpdate,
  type LiveStatus,
  type ComposeMode,
} from "./types";
import { AuthorStub } from "@/lib/types";

const KEY_POINTS_HEADING = "Key Points";

interface LiveBlogEditorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
  embedsReady: boolean;
  onSave: (status?: string) => Promise<void>;
  onImagePick: () => void;
}

// --- Helpers to read/write Key Points as real blocks in the editor ---

/**
 * Find the "Key Points" H2 block in the editor document.
 * Returns { headingBlock, bulletBlocks, lastBulletBlock } or null if not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findKeyPointsSection(blocks: any[]) {
  let headingIndex = -1;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "timestamp") break; // stop at first update
    if (
      b.type === "heading" &&
      b.props?.level === 2 &&
      Array.isArray(b.content) &&
      b.content.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.type === "text" && c.text === KEY_POINTS_HEADING
      )
    ) {
      headingIndex = i;
      break;
    }
  }

  if (headingIndex === -1) return null;

  // Collect consecutive bulletListItem blocks after the heading
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bulletBlocks: any[] = [];
  for (let i = headingIndex + 1; i < blocks.length; i++) {
    if (blocks[i].type === "bulletListItem") {
      bulletBlocks.push(blocks[i]);
    } else {
      break; // end of bullet section
    }
  }

  return {
    headingBlock: blocks[headingIndex],
    bulletBlocks,
    lastBlock: bulletBlocks.length > 0 ? bulletBlocks[bulletBlocks.length - 1] : blocks[headingIndex],
  };
}

/**
 * Extract key point texts from the editor blocks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readKeyPoints(blocks: any[]): string[] {
  const section = findKeyPointsSection(blocks);
  if (!section) return [];
  return section.bulletBlocks
    .map((b: { content: unknown[] }) => getBlockText(b.content as Parameters<typeof getBlockText>[0]))
    .filter(Boolean);
}

export function LiveBlogEditor({ editor, embedsReady, onSave, onImagePick }: LiveBlogEditorProps) {
  const { articleTitle, setArticleTitle, status, currentArticleId } = useEditorStore();
  const { user } = useAuthStore();

  // UI state
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [composeMode, setComposeMode] = useState<ComposeMode>("normal");
  const [keyPointsOpen, setKeyPointsOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [titleDraft, setTitleDraft] = useState(articleTitle);

  // pinnedIds tracks which timeline updates have been pinned as key points
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Editing state
  const [editingUpdate, setEditingUpdate] = useState<LiveUpdate | null>(null);

  // Author state (for new posts)
  const [selectedAuthors, setSelectedAuthors] = useState<AuthorStub[]>([]);

  // Initialize selected author with current user
  useEffect(() => {
    if (user && selectedAuthors.length === 0) {
      setSelectedAuthors([{
        id: user.id,
        name: user.name,
        slug: user.slug || "",
      }]);
    }
  }, [user, selectedAuthors.length]);

  // Derive live status from article status
  const liveStatus: LiveStatus = useMemo(() => {
    if (status === "published") return "live";
    return "draft";
  }, [status]);

  // Parse editor document into updates (re-parse when embedsReady flips to true)
  const updates: LiveUpdate[] = useMemo(() => {
    if (!editor) return [];
    const { updates: parsed } = parseUpdatesFromBlocks(editor.document);
    return parsed.map((u) => ({
      ...u,
      isPinned: pinnedIds.has(u.id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, updateTrigger, pinnedIds, embedsReady]);

  // Read key points from actual editor blocks
  const keyPoints: string[] = useMemo(() => {
    if (!editor) return [];
    return readKeyPoints(editor.document);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, updateTrigger, embedsReady]);

  // Duration timer — use coverageStartTime from store if available, fallback to oldest update
  const coverageStartTime = useEditorStore((s) => s.coverageStartTime);
  const firstTimestamp = coverageStartTime || (updates.length > 0 ? updates[updates.length - 1]?.timestamp : null);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!firstTimestamp || liveStatus !== "live") {
      setElapsed("");
      return;
    }

    const start = new Date(firstTimestamp).getTime();

    const tick = () => {
      const diff = Date.now() - start;
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (days > 0) {
        setElapsed(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setElapsed(`${hours}h ${minutes}m`);
      } else {
        setElapsed(`${minutes}m`);
      }
    };

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [firstTimestamp, liveStatus]);

  // --- Key Points block operations ---

  /** Add a bullet to the Key Points section. Creates the H2 if it doesn't exist. */
  const addKeyPoint = useCallback(
    (text: string) => {
      if (!editor) return;
      const blocks = editor.document;
      const section = findKeyPointsSection(blocks);

      const bullet = {
        type: "bulletListItem",
        content: [{ type: "text", text, styles: {} }],
      };

      if (section) {
        // Insert bullet after last existing bullet (or after heading if no bullets)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([bullet] as any, section.lastBlock, "after");
      } else {
        // Create H2 + first bullet. Insert before the first timestamp.
        let insertAfterBlock = null;
        for (const block of blocks) {
          if (block.type === "timestamp") break;
          insertAfterBlock = block;
        }
        // If no timestamps, insert after last block
        if (!insertAfterBlock && blocks.length > 0) {
          insertAfterBlock = blocks[blocks.length - 1];
        }

        const newBlocks = [
          {
            type: "heading",
            content: [{ type: "text", text: KEY_POINTS_HEADING, styles: {} }],
            props: { level: 2 },
          },
          bullet,
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks(newBlocks as any, insertAfterBlock, "after");
      }

      setKeyPointsOpen(true);
      setUpdateTrigger((c) => c + 1);
    },
    [editor]
  );

  /** Remove a key point bullet by index. If last bullet, also remove the H2. */
  const removeKeyPoint = useCallback(
    (index: number) => {
      if (!editor) return;
      const section = findKeyPointsSection(editor.document);
      if (!section) return;

      const bulletToRemove = section.bulletBlocks[index];
      if (!bulletToRemove) return;

      if (section.bulletBlocks.length === 1) {
        // Last bullet — remove H2 + bullet
        editor.removeBlocks([section.headingBlock, bulletToRemove]);
      } else {
        editor.removeBlocks([bulletToRemove]);
      }

      setUpdateTrigger((c) => c + 1);
    },
    [editor]
  );

  /** Remove a key point by matching text (for unpin). */
  const removeKeyPointByText = useCallback(
    (text: string) => {
      if (!editor) return;
      const section = findKeyPointsSection(editor.document);
      if (!section) return;

      const bulletToRemove = section.bulletBlocks.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (b: any) => getBlockText(b.content) === text
      );
      if (!bulletToRemove) return;

      if (section.bulletBlocks.length === 1) {
        editor.removeBlocks([section.headingBlock, bulletToRemove]);
      } else {
        editor.removeBlocks([bulletToRemove]);
      }

      setUpdateTrigger((c) => c + 1);
    },
    [editor]
  );

  // --- Handlers ---

  const handlePost = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (contentBlocks: any[], options: { isAlert: boolean; isPinned: boolean; updateId?: string }) => {
      if (!editor || !user) return;
      setIsPosting(true);

      const isEdit = !!options.updateId;

      try {
        const blocks = editor.document;

        if (isEdit) {
          // --- UPDATE FLOW ---
          const update = updates.find((u) => u.id === options.updateId);
          if (!update) throw new Error("Update not found");

          // 1. Remove old content blocks
          for (const contentBlock of update.contentBlocks) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const block = blocks.find((b: any) => b.id === contentBlock.id);
            if (block) {
              editor.removeBlocks([block]);
            }
          }

          // 2. Insert new blocks after the timestamp block
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const timestampBlock = editor.document.find((b: any) => b.id === options.updateId);
          if (timestampBlock) {
            const newBlocks = contentBlocks.map((block) => ({
              type: block.type,
              content: block.content,
              props: block.props,
            }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.insertBlocks(newBlocks as any, timestampBlock, "after");
          }

          // 3. Update alert status in timestamp block props
          if (timestampBlock) {
            editor.updateBlock(timestampBlock, {
              ...timestampBlock,
              props: {
                ...timestampBlock.props,
                isAlert: options.isAlert ? "true" : "false",
              },
            });
          }

          setEditingUpdate(null);
        } else {
          // --- CREATE FLOW ---
          // Insert at the END of the document (chronological order: oldest first, newest last)
          const insertAfterBlock = blocks[blocks.length - 1];

          // Create timestamp block + content blocks from compose editor
          const newBlocks = [
            {
              type: "timestamp",
              props: {
                timestamp: new Date().toISOString(),
                authorName: selectedAuthors[0]?.name || user.name,
                authorId: selectedAuthors[0]?.id || user.id,
                authorSlug: selectedAuthors[0]?.slug || user.slug || "",
                isAlert: options.isAlert ? "true" : "false",
              },
            },
            ...contentBlocks.map((block) => ({
              type: block.type,
              content: block.content,
              props: block.props,
            })),
          ];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.insertBlocks(newBlocks as any, insertAfterBlock, "after");

          // Wait for editor to settle, then handle alert/pin
          setTimeout(() => {
            const updatedBlocks = editor.document;
            const insertIndex = insertAfterBlock
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? updatedBlocks.findIndex((b: any) => b.id === insertAfterBlock.id) + 1
              : 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newTimestampBlock = updatedBlocks[insertIndex] as any;

            if (newTimestampBlock?.type === "timestamp" && options.isPinned) {
              setPinnedIds((prev) => new Set(prev).add(newTimestampBlock.id));
              // Get text from first content block for key point
              const firstContentBlock = contentBlocks[0];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const keyPointText = firstContentBlock?.content?.find((c: any) => c.type === "text")?.text || "";
              if (keyPointText) addKeyPoint(keyPointText);
            }

            setUpdateTrigger((c) => c + 1);
          }, 50);
        }

        setUpdateTrigger((c) => c + 1);

        // Auto-save, preserving current status
        await onSave();
        toast.success(isEdit ? "Update updated" : "Update posted");
      } catch (error) {
        console.error("[LiveBlog] Failed to post update:", error);
        toast.error(isEdit ? "Failed to update" : "Failed to post update");
      } finally {
        setIsPosting(false);
      }
    },
    [editor, user, onSave, addKeyPoint, updates, selectedAuthors]
  );

  const handleEdit = useCallback(
    (updateId: string) => {
      const update = updates.find((u) => u.id === updateId);
      if (update) {
        setEditingUpdate(update);
        // Scroll to compose panel
        const composeArea = document.querySelector(".compose-editor");
        if (composeArea) {
          composeArea.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    [updates]
  );

  const handlePin = useCallback(
    (updateId: string) => {
      const update = updates.find((u) => u.id === updateId);
      if (!update) return;

      const text = getUpdateText(update);

      if (pinnedIds.has(updateId)) {
        // Unpin — remove from key points blocks
        setPinnedIds((prev) => {
          const next = new Set(prev);
          next.delete(updateId);
          return next;
        });
        removeKeyPointByText(text);
      } else {
        // Pin — add to key points blocks
        setPinnedIds((prev) => new Set(prev).add(updateId));
        addKeyPoint(text);
      }
    },
    [updates, pinnedIds, addKeyPoint, removeKeyPointByText]
  );

  const handleEditTime = useCallback(
    (updateId: string, newTimestamp: string) => {
      if (!editor) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const timestampBlock = editor.document.find((b: any) => b.id === updateId);
      if (!timestampBlock || timestampBlock.type !== "timestamp") return;

      editor.updateBlock(timestampBlock, {
        type: "timestamp",
        props: {
          ...timestampBlock.props,
          timestamp: newTimestamp,
        },
      });

      setUpdateTrigger((c) => c + 1);
      onSave();
      toast.success("Timestamp updated");
    },
    [editor, onSave]
  );

  const handleEditAuthor = useCallback(
    (updateId: string, author: AuthorStub) => {
      if (!editor) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const timestampBlock = editor.document.find((b: any) => b.id === updateId);
      if (!timestampBlock || timestampBlock.type !== "timestamp") return;

      editor.updateBlock(timestampBlock, {
        type: "timestamp",
        props: {
          ...timestampBlock.props,
          authorName: author.name,
          authorId: author.id,
          authorSlug: author.slug || "",
        },
      });

      setUpdateTrigger((c) => c + 1);
      onSave();
      toast.success("Author updated");
    },
    [editor, onSave]
  );

  const handleDelete = useCallback(
    async (updateId: string) => {
      if (!editor) return;
      const update = updates.find((u) => u.id === updateId);
      if (!update) return;

      try {
        // If pinned, remove from key points first
        if (pinnedIds.has(updateId)) {
          const text = getUpdateText(update);
          removeKeyPointByText(text);
          setPinnedIds((prev) => {
            const next = new Set(prev);
            next.delete(updateId);
            return next;
          });
        }

        // Instead of removing blocks from the editor, we mark the status as deleted
        const timestampBlock = editor.document.find((b: any) => b.id === updateId);
        if (timestampBlock && timestampBlock.type === "timestamp") {
          editor.updateBlock(timestampBlock, {
            type: "timestamp",
            props: {
              ...timestampBlock.props,
              status: "deleted",
            },
          });
        }

        setUpdateTrigger((c) => c + 1);
        onSave();
        toast.success("Update marked as deleted");
      } catch (error) {
        console.error("[LiveBlog] Failed to delete update:", error);
        toast.error("Failed to mark update as deleted");
      }
    },
    [editor, updates, pinnedIds, removeKeyPointByText, onSave]
  );

  const handlePublish = useCallback(
    async (updateId: string) => {
      if (!editor) return;
      const timestampBlock = editor.document.find((b: any) => b.id === updateId);
      if (!timestampBlock || timestampBlock.type !== "timestamp") return;

      try {
        editor.updateBlock(timestampBlock, {
          type: "timestamp",
          props: {
            ...timestampBlock.props,
            status: "active",
          },
        });

        setUpdateTrigger((c) => c + 1);
        onSave();
        toast.success("Update published");
      } catch (error) {
        console.error("[LiveBlog] Failed to publish update:", error);
        toast.error("Failed to publish update");
      }
    },
    [editor, onSave]
  );

  const handleGoLive = useCallback(() => {
    const { coverageStartTime, setCoverageStartTime, setCoverageEndTime } = useEditorStore.getState();
    if (!coverageStartTime) {
      setCoverageStartTime(new Date().toISOString());
    }
    setCoverageEndTime("");
    onSave("published");
  }, [onSave]);

  const handleEndLive = useCallback(() => {
    useEditorStore.getState().setCoverageEndTime(new Date().toISOString());
    onSave("draft");
  }, [onSave]);

  const syncTitle = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setArticleTitle(trimmed);
      if (editor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headingBlock = editor.document.find((b: any) => b.type === "heading");
        if (headingBlock) {
          editor.updateBlock(headingBlock, {
            type: "heading",
            content: [{ type: "text", text: trimmed, styles: {} }],
            props: { level: 1 },
          });
        }
      }
    },
    [setArticleTitle, editor]
  );

  // Keep titleDraft in sync when articleTitle changes externally
  useEffect(() => {
    setTitleDraft(articleTitle);
  }, [articleTitle]);

  const handleRemoveKeyPoint = useCallback(
    (index: number) => {
      removeKeyPoint(index);
    },
    [removeKeyPoint]
  );

  return (
    <div className="flex flex-col h-full">
      {/* === Status Bar === */}
      <div className="border-b bg-muted/30">
        {/* Row 1: Live indicator + status controls */}
        <div className="flex items-center gap-3 px-4 pt-2.5 pb-1.5">
          {elapsed && liveStatus === "live" && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">{elapsed}</span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {liveStatus === "draft" ? (
              <Button
                size="sm"
                className="h-7 px-3 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleGoLive}
              >
                <Radio className="w-3 h-3" />
                Go Live
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs gap-1"
                onClick={handleEndLive}
              >
                <Square className="w-3 h-3" />
                End Live
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Title input */}
        <div className="px-4 pb-2.5">
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => syncTitle(titleDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                syncTitle(titleDraft);
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Enter live blog title..."
            className="h-9 text-base font-semibold border-dashed bg-transparent placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* === Key Points Panel (read from actual blocks) === */}
      {keyPoints.length > 0 && (
        <Collapsible open={keyPointsOpen} onOpenChange={setKeyPointsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-b">
              <Pin className="w-3 h-3" />
              Key Points ({keyPoints.length})
              {keyPointsOpen ? (
                <ChevronUp className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-auto" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-2 border-b border-l-4 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10">
              <ul className="space-y-1.5">
                {keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm group/kp">
                    <span className="text-amber-500 font-bold mt-0.5 text-xs">{index + 1}.</span>
                    <span className="flex-1 leading-snug">{point}</span>
                    <button
                      onClick={() => handleRemoveKeyPoint(index)}
                      className="opacity-0 group-hover/kp:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* === Split Panel: Timeline + Compose === */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_450px] min-h-0 overflow-hidden">
        {/* Left: Timeline */}
        <div className="flex flex-col min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <span className="text-xs font-medium text-muted-foreground">Timeline</span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {updates.length}
            </Badge>
          </div>
          <LiveTimeline
            updates={updates}
            onEdit={handleEdit}
            onEditTime={handleEditTime}
            onEditAuthor={handleEditAuthor}
            onPin={handlePin}
            onDelete={handleDelete}
            onPublish={handlePublish}
          />
        </div>

        {/* Right: Compose */}
        <div className="flex flex-col min-h-0 max-h-[50vh] lg:max-h-none overflow-y-auto">
          <LiveComposePanel
            onPost={handlePost}
            onImagePick={onImagePick}
            composeMode={composeMode}
            onComposeModeChange={setComposeMode}
            isPosting={isPosting}
            authorName={selectedAuthors[0]?.name || user?.name || "Unknown"}
            selectedAuthors={selectedAuthors}
            onAuthorChange={setSelectedAuthors}
            editUpdate={editingUpdate}
            onCancelEdit={() => setEditingUpdate(null)}
          />
        </div>
      </div>
    </div>
  );
}
