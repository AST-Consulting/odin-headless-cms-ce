"use client";

import { DefaultReactSuggestionItem } from "@blocknote/react";
import React from "react";
import { extractTweetId } from "./TwitterEmbedBlock";

// Use a generic editor type to avoid complex BlockNote type issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;

// Twitter/X icon component
const TwitterIcon = () =>
  React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "currentColor",
    },
    React.createElement("path", {
      d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    })
  );

export function getTwitterSlashCommand(
  onPromptUrl: () => void
): DefaultReactSuggestionItem {
  return {
    title: "Twitter/X Post",
    onItemClick: onPromptUrl,
    aliases: ["tweet", "x", "twitter", "embed"],
    group: "Embeds",
    icon: React.createElement(TwitterIcon),
    subtext: "Embed a tweet from Twitter/X",
  };
}

// Insert a Twitter embed block
export function insertTwitterEmbed(
  editor: EditorInstance,
  url: string
): boolean {
  const tweetId = extractTweetId(url);

  if (!tweetId) {
    return false;
  }

  try {
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [
        {
          type: "twitterEmbed",
          props: {
            url,
            tweetId,
          },
        },
      ],
      currentBlock,
      "after"
    );
    return true;
  } catch (error) {
    console.error("[twitterSlashCommand] Failed to insert Twitter embed:", error);
    return false;
  }
}
