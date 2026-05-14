export interface ArticleStats {
  words: number;
  readingMinutes: number;
}

const TEXT_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
]);

// Industry-standard average reading speed. Works well for English; for Indic
// scripts it's a rough-but-acceptable approximation.
const WORDS_PER_MINUTE = 225;

interface InlineContent {
  text?: string;
}

interface BlockShape {
  type?: string;
  content?: unknown;
  children?: unknown[];
}

function extractPlainText(blocks: unknown[]): string {
  const parts: string[] = [];
  const walk = (arr: unknown[]) => {
    for (const raw of arr) {
      const block = raw as BlockShape;
      if (block.type && TEXT_BLOCK_TYPES.has(block.type)) {
        const content = block.content;
        if (Array.isArray(content)) {
          for (const piece of content) {
            const p = piece as InlineContent;
            if (p && typeof p.text === "string") parts.push(p.text);
          }
        } else if (typeof content === "string") {
          parts.push(content);
        }
      }
      if (Array.isArray(block.children) && block.children.length) walk(block.children);
    }
  };
  walk(blocks);
  return parts.join(" ");
}

export function computeArticleStats(blocks: unknown[]): ArticleStats {
  const text = extractPlainText(blocks).trim();
  const words = text ? text.split(/\s+/).length : 0;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  return { words, readingMinutes };
}
