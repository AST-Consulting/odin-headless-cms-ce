import type { PartialBlock } from "@blocknote/core";

interface TemplateUser {
  name: string;
  id: string;
  slug: string;
}

function heading(level: 1 | 2 | 3, text: string): PartialBlock {
  return {
    type: "heading",
    content: text ? [{ type: "text", text, styles: {} }] : [],
    props: { level },
  };
}

function paragraph(text?: string, styles?: Record<string, boolean>): PartialBlock {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text, styles: styles || {} }] : [],
  };
}

function bulletListItem(text: string, styles?: Record<string, boolean>): PartialBlock {
  return {
    type: "bulletListItem" as any,
    content: text ? [{ type: "text", text, styles: styles || {} }] : [],
  };
}

function numberedListItem(text: string, styles?: Record<string, boolean>): PartialBlock {
  return {
    type: "numberedListItem" as any,
    content: text ? [{ type: "text", text, styles: styles || {} }] : [],
  };
}

function recipeIngredient(text: string): PartialBlock {
  return {
    type: "recipeIngredient" as any,
    content: text ? [{ type: "text", text, styles: {} }] : [],
  };
}

function howToStep(text: string): PartialBlock {
  return {
    type: "howToStep" as any,
    content: text ? [{ type: "text", text, styles: {} }] : [],
  };
}

function timestamp(user?: TemplateUser | null): PartialBlock {
  return {
    type: "timestamp" as PartialBlock["type"],
    props: {
      timestamp: new Date().toISOString(),
      authorName: user?.name || "",
      authorId: user?.id || "",
      authorSlug: user?.slug || "",
    },
  } as PartialBlock;
}

function featuredImage(): PartialBlock {
  return {
    type: "featuredImage" as PartialBlock["type"],
  } as PartialBlock;
}

function image(): PartialBlock {
  return {
    type: "image",
    props: { url: "" },
  } as PartialBlock;
}

function video(): PartialBlock {
  return {
    type: "videoEmbed",
    props: { url: "", caption: "" },
  } as unknown as PartialBlock;
}

export function getTemplateBlocks(
  articleType: string,
  user?: TemplateUser | null
): PartialBlock[] {
  switch (articleType) {
    case "liveblog":
      return [
        heading(1, ""),
        featuredImage(),
        timestamp(user),
        paragraph(),
      ];

    case "photo_story":
      return [
        heading(1, ""),
        featuredImage(),
      ];

    case "video":
      return [
        heading(1, ""),
        featuredImage(),
        video(),
        heading(2, "Summary"),
        paragraph(),
        heading(2, "Key Points"),
        paragraph(),
      ];

    case "recipe":
      return [
        heading(1, ""),
        featuredImage(),
        paragraph(""),
        heading(2, "Ingredients"),
        recipeIngredient(""),
        heading(2, "Preparation Steps"),
        howToStep(""),
      ];

    case "movie_review":
      return [
        heading(1, ""),
        featuredImage(),
        paragraph("Write a short summary of your movie review here. This will serve as the review description."),
        heading(2, "Storyline"),
        paragraph(),
        heading(2, "Performance & Direction"),
        paragraph(),
        heading(2, "Final Verdict"),
        paragraph(),
        heading(2, "Rating"),
        paragraph("Rating: 4/5", { bold: true }),
      ];

    case "web_story":
      return [
        heading(1, ""),
        featuredImage(),
      ];

    case "article":
    default:
      return [
        heading(1, ""),
        featuredImage(),
      ];
  }
}

export function getPhotoStorySlideBlocks(url: string, index: number): PartialBlock[] {
  return [
    { type: "image", props: { url } } as PartialBlock,
    paragraph(`Slide ${index} Caption...`, { bold: true }),
    paragraph("Write details here..."),
  ];
}

/**
 * Check if a block content array is effectively empty (no text or substantial content)
 */
function isContentEmpty(content: any): boolean {
  if (!content) return true;
  if (typeof content === "string") return content.trim() === "";
  if (Array.isArray(content)) {
    if (content.length === 0) return true;
    return content.every((c: any) => {
      if (!c) return true;
      if (typeof c === "string") return c.trim() === "";
      if (typeof c === "object" && "text" in c) return !c.text || c.text.trim() === "";
      return false; // Any other object (like an image or link) is NOT empty
    });
  }
  return true;
}

/**
 * Check if editor only has the default empty structure (i.e. user hasn't typed anything of substance)
 */
export function isEditorEmpty(blocks: { type?: string; content?: any }[]): boolean {
  if (!blocks || blocks.length === 0) return true;

  // Single block (usually heading or default paragraph)
  if (blocks.length === 1) {
    const b = blocks[0];
    if (b.type === "heading" || b.type === "paragraph") return isContentEmpty(b.content);
    return false;
  }

  // Multiple blocks - usually heading + placeholders
  if (blocks[0].type === "heading") {
    const hasOnlyPlaceholders = blocks.slice(1).every(b =>
      b.type === "divider" ||
      (b.type === "heading" && (b as any).props?.level === 3) ||
      b.type === "image" ||
      (b.type === "paragraph" && isContentEmpty(b.content)) ||
      (b.type === "bulletListItem" && isContentEmpty(b.content)) ||
      (b.type === "numberedListItem" && isContentEmpty(b.content)) ||
      (b.type === "recipeIngredient" && isContentEmpty(b.content)) ||
      (b.type === "howToStep" && isContentEmpty(b.content)) ||
      b.type === "timestamp" ||
      b.type === "featuredImage"
    );
    // Be generous: if it only has placeholders or empty blocks after the title/heading
    if (hasOnlyPlaceholders) return true;
  }

  return false;
}
