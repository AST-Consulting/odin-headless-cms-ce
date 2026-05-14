export interface LiveUpdate {
  id: string;
  timestamp: string;
  authorName: string;
  authorId: string;
  authorSlug: string;
  contentBlocks: ContentBlock[];
  isPinned: boolean;
  isAlert: boolean;
  status: "active" | "deleted" | "draft" | string;
}

export interface ContentBlock {
  id: string;
  type: string;
  content: InlineContent[];
  props: Record<string, unknown>;
}

export interface InlineContent {
  type: string;
  text?: string;
  styles?: Record<string, boolean>;
  content?: InlineContent[];
  href?: string;
}

export type LiveStatus = "draft" | "live" | "paused" | "ended";
export type ComposeMode = "normal" | "alert";

/**
 * Parse editor document blocks into header blocks + live updates.
 * Updates are grouped by timestamp blocks: each timestamp starts a new update,
 * followed by content blocks until the next timestamp or end of document.
 */
export function parseUpdatesFromBlocks(
  blocks: Array<{ id: string; type: string; content?: unknown[]; props?: Record<string, unknown> }>
): { headerBlocks: typeof blocks; updates: LiveUpdate[] } {
  const headerBlocks: typeof blocks = [];
  const updates: LiveUpdate[] = [];
  let foundFirstTimestamp = false;
  let currentUpdate: LiveUpdate | null = null;

  for (const block of blocks) {
    if (block.type === "timestamp") {
      foundFirstTimestamp = true;
      if (currentUpdate) {
        updates.push(currentUpdate);
      }
      const props = block.props || {};
      currentUpdate = {
        id: block.id,
        timestamp: (props.timestamp as string) || new Date().toISOString(),
        authorName: (props.authorName as string) || "Unknown",
        authorId: (props.authorId as string) || "",
        authorSlug: (props.authorSlug as string) || "",
        contentBlocks: [],
        isPinned: false,
        isAlert: props.isAlert === "true",
        status: (props.status as string) || "active",
      };
    } else if (!foundFirstTimestamp) {
      headerBlocks.push(block);
    } else if (currentUpdate) {
      currentUpdate.contentBlocks.push({
        id: block.id,
        type: block.type,
        content: (block.content as InlineContent[]) || [],
        props: (block.props as Record<string, unknown>) || {},
      });
    }
  }

  if (currentUpdate) {
    updates.push(currentUpdate);
  }

  return { headerBlocks, updates };
}

/**
 * Extract plain text from a content block's inline content array.
 */
export function getBlockText(content: InlineContent[]): string {
  if (!content || !Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (item.type === "text") return item.text || "";
      if (item.type === "link") {
        return item.content?.map((c) => c.text || "").join("") || "";
      }
      return "";
    })
    .join("");
}

/**
 * Get full text content of an update (all content blocks combined).
 */
export function getUpdateText(update: LiveUpdate): string {
  return update.contentBlocks
    .map((block) => getBlockText(block.content))
    .filter(Boolean)
    .join("\n");
}
