# Adding Custom Blocks to BlockNote Editor

This guide explains how to add custom blocks to the BlockNote editor in this codebase. Follow these steps to avoid common issues like the "Cannot find node position" error on page refresh.

## Overview

Custom blocks in this codebase require:
1. A block component using `createReactBlockSpec`
2. Registration in the editor schema
3. **Deferred insertion handling** (critical for avoiding errors on refresh)
4. A slash command for insertion
5. Proper block transformation for loading saved blocks

## Step-by-Step Guide

### Step 1: Create the Block Component

Create a new file in `src/components/editor/` for your custom block.

```tsx
// src/components/editor/MyCustomBlock.tsx
"use client";

import { createReactBlockSpec } from "@blocknote/react";
import React from "react";

// Props interface for your render component
interface MyCustomBlockProps {
  myProp: string;
  anotherProp?: string;
}

// Render component - displays the block in the editor
function MyCustomBlockRender({ myProp, anotherProp }: MyCustomBlockProps) {
  return (
    <div
      contentEditable={false}  // IMPORTANT: Prevents editing issues
      style={{ margin: "16px 0" }}
    >
      {/* Your block UI here */}
      <p>My custom content: {myProp}</p>
    </div>
  );
}

// Create the block spec
// IMPORTANT: This is a function that returns the block spec
export const MyCustomBlock = createReactBlockSpec(
  {
    type: "myCustomBlock",  // Unique identifier for the block type
    propSchema: {
      myProp: { default: "" },
      anotherProp: { default: "" },
    },
    content: "none",  // Use "none" for blocks without editable text content
  },
  {
    render: (props) => {
      const { myProp, anotherProp } = props.block.props;
      return <MyCustomBlockRender myProp={myProp} anotherProp={anotherProp} />;
    },
  }
);
```

### Step 2: Register in Editor Schema

Update `src/components/editor/editorSchema.ts`:

```tsx
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { TwitterEmbedBlock } from "./TwitterEmbedBlock";
import { YouTubeEmbedBlock } from "./YouTubeEmbedBlock";
import { InstagramEmbedBlock } from "./InstagramEmbedBlock";
import { TimestampBlock } from "./TimestampBlock";
import { MyCustomBlock } from "./MyCustomBlock";  // ADD THIS

let cachedSchema: any = null;

export function createEditorSchema() {
  if (cachedSchema) {
    return cachedSchema;
  }

  if (!defaultBlockSpecs) {
    console.error("[editorSchema] defaultBlockSpecs is undefined");
    return BlockNoteSchema.create();
  }

  cachedSchema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      twitterEmbed: TwitterEmbedBlock(),
      youtubeEmbed: YouTubeEmbedBlock(),
      instagramEmbed: InstagramEmbedBlock(),
      timestamp: TimestampBlock(),
      myCustomBlock: MyCustomBlock(),  // ADD THIS - Note: call it as a function!
    },
  });

  return cachedSchema;
}

// Update the custom block types set
export const customBlockTypes = new Set([
  "twitterEmbed",
  "youtubeEmbed",
  "instagramEmbed",
  "timestamp",
  "myCustomBlock",  // ADD THIS
]);
```

### Step 3: Add Deferred Insertion Handling (CRITICAL)

This is the most important step. Without deferred insertion, you'll get "Cannot find node position" errors when the page refreshes with saved custom blocks.

Update `src/components/editor/BlockNoteEditor.tsx`:

#### 3a. Add to `noContentTypes` set:

```tsx
const noContentTypes = new Set([
  "image",
  "video",
  "audio",
  "file",
  "twitterEmbed",
  "youtubeEmbed",
  "instagramEmbed",
  "timestamp",
  "myCustomBlock",  // ADD THIS
]);
```

#### 3b. Add to `customBlockTypes` map:

```tsx
const customBlockTypes: Record<string, string> = {
  twitterEmbed: "twitterEmbed",
  twitterCard: "twitterEmbed",  // Legacy type mapping
  youtubeEmbed: "youtubeEmbed",
  youtubeCard: "youtubeEmbed",
  instagramEmbed: "instagramEmbed",
  instagramCard: "instagramEmbed",  // Legacy type mapping
  timestamp: "timestamp",
  myCustomBlock: "myCustomBlock",  // ADD THIS
};
```

#### 3c. Add handling in `transformBlocksForEditor` function:

```tsx
function transformBlocksForEditor(storedBlocks: Block[]): {
  blocks: PartialBlock[];
  deferredEmbeds: DeferredEmbed[];
} {
  // ... existing code ...

  const blocks = storedBlocks.map((block, index) => {
    const blockType = block.type as string;

    if (blockType in customBlockTypes) {
      const customType = customBlockTypes[blockType];
      const props = block.metadata?.props as Record<string, string> | undefined;

      let customProps: Record<string, string> = {};
      let placeholderText = "Loading...";

      // ... existing type handling ...

      // ADD THIS BLOCK:
      else if (customType === "myCustomBlock") {
        const myProp = props?.myProp || "";
        const anotherProp = props?.anotherProp || "";
        customProps = { myProp, anotherProp };
        placeholderText = "Loading custom block...";

        // Optional: Skip invalid blocks
        if (!myProp) {
          return {
            type: "paragraph",
            content: [{ type: "text", text: "[Invalid block - missing data]", styles: {} }],
          } as PartialBlock;
        }
      }

      // Store for deferred insertion
      deferredEmbeds.push({
        index,
        type: customType,
        props: customProps,
      });

      // Return placeholder paragraph
      return {
        type: "paragraph",
        content: [{ type: "text", text: placeholderText, styles: {} }],
      } as PartialBlock;
    }

    // ... rest of function ...
  });
}
```

### Step 4: Create Slash Command

Create a slash command file for easy insertion:

```tsx
// src/components/editor/myCustomBlockSlashCommand.ts
"use client";

import { DefaultReactSuggestionItem } from "@blocknote/react";
import React from "react";
import { Star } from "lucide-react";  // Choose appropriate icon

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;

export function getMyCustomBlockSlashCommand(
  editor: EditorInstance
): DefaultReactSuggestionItem {
  return {
    title: "My Custom Block",
    onItemClick: () => {
      const currentBlock = editor.getTextCursorPosition().block;

      editor.insertBlocks(
        [
          {
            type: "myCustomBlock",
            props: {
              myProp: "default value",
              anotherProp: "",
            },
          },
        ],
        currentBlock,
        "after"
      );

      // Optional: Insert paragraph after and move focus
      setTimeout(() => {
        const blocks = editor.document;
        const currentIndex = blocks.findIndex(
          (b: any) => b.id === currentBlock.id
        );
        if (currentIndex !== -1 && currentIndex + 1 < blocks.length) {
          const customBlock = blocks[currentIndex + 1];
          editor.insertBlocks(
            [{ type: "paragraph", content: "" }],
            customBlock,
            "after"
          );
        }
      }, 10);
    },
    aliases: ["custom", "myblock"],  // What users can type to find this
    group: "Custom",  // Group in the slash menu
    icon: React.createElement(Star, { size: 18 }),
    subtext: "Insert a custom block",
  };
}
```

### Step 5: Register Slash Command

In `BlockNoteEditor.tsx`, add the slash command:

```tsx
// Import
import { getMyCustomBlockSlashCommand } from "./myCustomBlockSlashCommand";

// In the SuggestionMenuController getItems:
<SuggestionMenuController
  triggerCharacter="/"
  getItems={async (query) => {
    const items = [
      ...getDefaultReactSlashMenuItems(editor),
      getImagePickerSlashCommand(() => setIsImagePickerOpen(true)),
      getTimestampSlashCommand(editor),
      getTwitterSlashCommand(handleTwitterEmbed),
      getYouTubeSlashCommand(handleYouTubeEmbed),
      getInstagramSlashCommand(handleInstagramEmbed),
      getMyCustomBlockSlashCommand(editor),  // ADD THIS
    ];
    return items.filter((i) =>
      i.title.toLowerCase().includes(query.toLowerCase())
    );
  }}
/>
```

## Why Deferred Insertion is Necessary

BlockNote initializes its internal document structure asynchronously. When the page refreshes:

1. Stored blocks are loaded from localStorage/database
2. BlockNote creates its editor with these blocks
3. Custom blocks with `content: "none"` don't have standard text nodes
4. BlockNote can't find the node position for these blocks during initialization
5. This causes the "Cannot find node position" error

**The Solution:**
1. On load, replace custom blocks with simple paragraph placeholders
2. Store the custom block data separately (`deferredEmbeds` array)
3. Wait 100ms for editor to fully initialize
4. Use `editor.updateBlock()` to replace placeholders with actual custom blocks

## Common Patterns

### Blocks with Edit Functionality (like Timestamp)

If your block needs an edit button:

```tsx
// 1. Create an event listener system
type EditListener = (blockId: string, currentData: string) => void;
let editListener: EditListener | null = null;

export const setEditListener = (listener: EditListener | null) => {
  editListener = listener;
};

// 2. In render component, call the listener
function MyBlockRender({ blockId, data }: Props) {
  const handleEdit = () => {
    if (editListener) {
      editListener(blockId, data);
    }
  };

  return (
    <div>
      <span>{data}</span>
      <button onClick={handleEdit}>Edit</button>
    </div>
  );
}

// 3. In BlockNoteEditor, set up the listener
useEffect(() => {
  setEditListener((blockId, currentData) => {
    setEditingBlockId(blockId);
    setEditingData(currentData);
    setIsDialogOpen(true);
  });
  return () => setEditListener(null);
}, []);
```

### Blocks with External Scripts (like Twitter/Instagram embeds)

```tsx
useEffect(() => {
  // Check if script already exists
  if (!window.externalLib) {
    const existingScript = document.querySelector('script[src*="external.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://example.com/external.js";
      script.async = true;
      script.onload = () => { /* initialize */ };
      document.head.appendChild(script);  // Use head, not body
    }
  } else {
    // Script already loaded, just initialize
    window.externalLib.init();
  }
}, [deps]);
```

## Checklist for New Custom Blocks

- [ ] Create block component with `createReactBlockSpec`
- [ ] Use `contentEditable={false}` on container div
- [ ] Register in `editorSchema.ts` (call as function!)
- [ ] Add to `customBlockTypes` Set in editorSchema.ts
- [ ] Add to `noContentTypes` Set in BlockNoteEditor.tsx
- [ ] Add to `customBlockTypes` Record in BlockNoteEditor.tsx
- [ ] Add handling in `transformBlocksForEditor` function
- [ ] Create slash command file
- [ ] Register slash command in SuggestionMenuController
- [ ] Run build to verify no errors
- [ ] Test: Insert block, save, refresh page (no errors)
- [ ] Test: Edit functionality (if applicable)

## File Locations Summary

| Purpose | File Path |
|---------|-----------|
| Block Component | `src/components/editor/MyCustomBlock.tsx` |
| Editor Schema | `src/components/editor/editorSchema.ts` |
| Main Editor (deferred loading) | `src/components/editor/BlockNoteEditor.tsx` |
| Slash Command | `src/components/editor/myCustomBlockSlashCommand.ts` |
| Edit Dialog (if needed) | `src/components/editor/MyCustomBlockDialog.tsx` |
