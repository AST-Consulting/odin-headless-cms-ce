"use client";

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { TwitterCardBlock } from "./TwitterCardBlock";
import { InstagramCardBlock } from "./InstagramCardBlock";
import { YouTubeCardBlock } from "./YouTubeCardBlock";

// Create schema with custom social media card blocks
export const customBlockSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    twitterCard: TwitterCardBlock(),
    instagramCard: InstagramCardBlock(),
    youtubeCard: YouTubeCardBlock(),
  },
});

// Export the schema type for TypeScript
export type CustomBlockSchema = typeof customBlockSchema;
