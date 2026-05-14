import type { 
  Block, 
  BlockNoteEditor, 
  PartialBlock,
  BlockSchema,
  InlineContentSchema,
  StyleSchema
} from "@blocknote/core";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const resolveImageUrl = (url: string): string => {
  if (url.startsWith("/public/")) return `${API_BASE}${url}`;
  return url;
};

/**
 * Converts markdown text to BlockNote blocks using BlockNote's built-in parser
 * 
 * This function leverages BlockNote's native markdown parser which supports all block types:
 * - paragraph
 * - heading (H1-H6)
 * - bulletListItem (unordered lists with -, *)
 * - numberedListItem (ordered lists with 1., 2., etc.)
 * - checkListItem (task lists with - [ ] or - [x])
 * - codeBlock (fenced code blocks with ```)
 * - quote (blockquotes with >)
 * - divider (horizontal rules with ---, ___, ***)
 * - table (markdown tables)
 * - toggleListItem (collapsible lists)
 * - Plus rich text formatting: **bold**, *italic*, `code`, [links](url), etc.
 * 
 * Note: BlockNote's parser is "lossy" - some advanced markdown features may not be preserved.
 * Media blocks (image, video, audio, file) are not created from markdown and would need
 * separate handling if URLs are detected.
 * 
 * @param markdown The markdown string to convert
 * @param editor Optional BlockNote editor instance for more accurate parsing
 * @returns Array of PartialBlock objects ready to insert into BlockNote
 */
export function markdownToBlocks<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema
>(
  markdown: string, 
  editor?: BlockNoteEditor<BSchema, ISchema, SSchema>
): PartialBlock<BSchema, ISchema, SSchema>[] {
  // Early return for empty input
  if (!markdown || markdown.trim() === '') {
    return [{
      type: "paragraph",
      content: "",
    } as PartialBlock<BSchema, ISchema, SSchema>];
  }

  // Detect if the AI returned a JSON recipe object (structured format)
  const trimmedMarkdown = markdown.trim();
  if ((trimmedMarkdown.startsWith('{') && trimmedMarkdown.endsWith('}')) || trimmedMarkdown.includes('"ingredients"')) {
    try {
      let jsonStr = trimmedMarkdown;
      // Handle potential markdown code fences
      if (jsonStr.includes('```')) {
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}') + 1;
        if (start !== -1 && end !== -1) {
          jsonStr = jsonStr.substring(start, end);
        }
      }

      const recipe = JSON.parse(jsonStr);
      if (recipe.ingredients || recipe.steps || recipe.introduction) {
        return mapRecipeJsonToBlocks(recipe) as PartialBlock<BSchema, ISchema, SSchema>[];
      }
    } catch (e) {
      console.warn("[markdownToBlocks] Failed to parse AI recipe JSON, falling back to markdown parsing:", e);
    }
  }

  // If we have an editor instance, use its built-in markdown parser
  // This ensures compatibility with any custom block types
  if (editor) {
    try {
      const blocks = editor.tryParseMarkdownToBlocks(markdown);
      // Post-process: BlockNote's parser may not handle images, so we need to
      // find any paragraphs that contain only image markdown and convert them
      const processedBlocks = (blocks as PartialBlock<BSchema, ISchema, SSchema>[]).map((block) => {
        if (block.type === "paragraph" && block.content) {
          // Check if content is just an image markdown
          let contentStr = '';
          if (Array.isArray(block.content)) {
            contentStr = block.content.map((c) => {
              if (typeof c === 'string') return c;
              if (c && typeof c === 'object' && 'text' in c) return (c as { text?: string }).text || '';
              return '';
            }).join('');
          } else {
            contentStr = String(block.content);
          }

          const trimmedContent = contentStr.trim();
          const imageMatch = trimmedContent.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);

          if (imageMatch) {
            return {
              type: "image",
              props: { url: resolveImageUrl(imageMatch[2]), caption: imageMatch[1] || '' },
            } as PartialBlock<BSchema, ISchema, SSchema>;
          }
        }
        return block;
      });
      return processedBlocks;
    } catch (error) {
      console.error("BlockNote markdown parsing failed:", error);
      // Fallback to manual parsing
    }
  }

  // Fallback: Manual parsing for common block types
  // This is used when editor instance is not available
  const initialBlocks = parseMarkdownManually(markdown) as PartialBlock<BSchema, ISchema, SSchema>[];
  return postProcessRecipeBlocks(initialBlocks);
}

/**
 * Post-processes blocks to identify Recipe sections and convert lists to custom block types
 */
function postProcessRecipeBlocks<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema
>(blocks: PartialBlock<BSchema, ISchema, SSchema>[]): PartialBlock<BSchema, ISchema, SSchema>[] {
  let inIngredients = false;
  let inInstructions = false;

  return blocks.map((block) => {
    // Detect section headers
    if (block.type === "heading") {
      const text = getBlockText(block).toLowerCase();
      if (text.match(/ingredients|सामग्री/i)) {
        inIngredients = true;
        inInstructions = false;
      } else if (text.match(/steps|instructions|prep|विधि|बनाने/i)) {
        inInstructions = true;
        inIngredients = false;
      } else {
        // Reset state on other headings
        inIngredients = false;
        inInstructions = false;
      }
      return block;
    }

    // Convert list items based on current section
    if (inIngredients && (block.type === "bulletListItem" || block.type === "paragraph")) {
      return {
        ...block,
        type: "recipeIngredient" as any,
        props: { text: getBlockText(block) } as any,
      } as any;
    }

    if (inInstructions && (block.type === "numberedListItem" || block.type === "bulletListItem" || block.type === "paragraph")) {
      return {
        ...block,
        type: "howToStep" as any,
        props: { text: getBlockText(block) } as any,
      } as any;
    }

    return block;
  });
}

/**
 * Maps a structured Recipe JSON object to BlockNote blocks
 */
function mapRecipeJsonToBlocks(recipe: any): PartialBlock[] {
  const blocks: PartialBlock[] = [];

  // Add Introduction
  if (recipe.introduction) {
    blocks.push({
      type: "paragraph",
      content: recipe.introduction,
    });
  }

  // Add Ingredients section
  if (recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
    blocks.push({
      type: "heading",
      props: { level: 3 },
      content: "Ingredients",
    });

    recipe.ingredients.forEach((text: string) => {
      blocks.push({
        type: "recipeIngredient" as any,
        props: { text } as any,
      } as any);
    });
  }

  // Add Preparation Steps section
  if (recipe.steps && Array.isArray(recipe.steps) && recipe.steps.length > 0) {
    blocks.push({
      type: "heading",
      props: { level: 3 },
      content: "Preparation Steps",
    });

    recipe.steps.forEach((text: string) => {
      blocks.push({
        type: "howToStep" as any,
        props: { text } as any,
      } as any);
    });
  }

  // If we have other content or title, we could add it here
  // But usually title is handled by the articleTitle state in the editor

  return blocks;
}

/**
 * Helper to get plain text from a block's content
 */
function getBlockText(block: any): string {
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((c: any) => (typeof c === "string" ? c : c.text || ""))
      .join("");
  }
  return "";
}

/**
 * Manual markdown parser as fallback when editor instance is not available
 * Handles the most common markdown syntax
 */
function parseMarkdownManually(markdown: string): PartialBlock[] {
  const blocks: PartialBlock[] = [];
  const lines = markdown.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }
    
    // Headings: # H1, ## H2, etc.
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({
        type: "heading",
        props: { level },
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }
    
    // Blockquote: > quote text
    if (line.trim().startsWith('>')) {
      const content = line.trim().substring(1).trim();
      blocks.push({
        type: "quote",
        content,
      });
      i++;
      continue;
    }
    
    // Horizontal divider: ---, ___, ***
    if (line.trim().match(/^([-_*])\1{2,}$/)) {
      blocks.push({
        type: "divider",
      });
      i++;
      continue;
    }
    
    // Task list items: - [ ] or - [x]
    const taskMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x';
      blocks.push({
        type: "checkListItem",
        props: { checked },
        content: taskMatch[2].trim(),
      });
      i++;
      continue;
    }
    
    // Unordered list items: - item or * item
    const unorderedListMatch = line.match(/^[\-\*]\s+(.+)$/);
    if (unorderedListMatch) {
      blocks.push({
        type: "bulletListItem",
        content: unorderedListMatch[1].trim(),
      });
      i++;
      continue;
    }
    
    // Ordered list items: 1. item, 2. item, etc.
    const orderedListMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedListMatch) {
      blocks.push({
        type: "numberedListItem",
        content: orderedListMatch[1].trim(),
      });
      i++;
      continue;
    }
    
    // Image: ![alt](url)
    const imageMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1] || '';
      const url = resolveImageUrl(imageMatch[2]);
      blocks.push({
        type: "image",
        props: { url, caption: alt },
      });
      i++;
      continue;
    }

    // Code blocks: ```language
    if (line.trim().startsWith('```')) {
      const languageMatch = line.trim().match(/^```(\w+)?/);
      const language = languageMatch?.[1] || '';
      const codeLines: string[] = [];
      i++; // Skip opening ```
      
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      
      if (codeLines.length > 0) {
        blocks.push({
          type: "codeBlock",
          props: { language },
          content: codeLines.join('\n'),
        });
      }
      
      i++; // Skip closing ```
      continue;
    }
    
    // Regular paragraph - collect multiple lines until empty line or special format
    let paragraphContent = line.trim();
    i++;
    
    while (i < lines.length && 
           lines[i].trim() !== '' && 
           !lines[i].match(/^#{1,6}\s/) && 
           !lines[i].match(/^>/) &&
           !lines[i].match(/^[\-\*]\s/) && 
           !lines[i].match(/^\d+\.\s/) &&
           !lines[i].trim().match(/^([-_*])\1{2,}$/) &&
           !lines[i].trim().startsWith('```')) {
      paragraphContent += ' ' + lines[i].trim();
      i++;
    }
    
    if (paragraphContent) {
      blocks.push({
        type: "paragraph",
        content: paragraphContent,
      });
    }
  }
  
  // If no blocks were created, add an empty paragraph
  if (blocks.length === 0) {
    blocks.push({
      type: "paragraph",
      content: markdown,
    });
  }
  
  return blocks;
}

