"use client";

import { DefaultReactSuggestionItem } from "@blocknote/react";
import React from "react";
import { extractYouTubeVideoId } from "./YouTubeEmbedBlock";

// Use a generic editor type to avoid complex BlockNote type issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;

// YouTube icon component
const YouTubeIcon = () =>
  React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "#FF0000",
    },
    React.createElement("path", {
      d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
    })
  );

export function getYouTubeSlashCommand(
  onPromptUrl: () => void
): DefaultReactSuggestionItem {
  return {
    title: "YouTube Video",
    onItemClick: onPromptUrl,
    aliases: ["youtube", "video", "yt", "embed"],
    group: "Embeds",
    icon: React.createElement(YouTubeIcon),
    subtext: "Embed a YouTube video",
  };
}

// Insert a YouTube embed block
export function insertYouTubeEmbed(
  editor: EditorInstance,
  url: string
): boolean {
  const videoId = extractYouTubeVideoId(url);

  if (!videoId) {
    return false;
  }

  try {
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [
        {
          type: "youtubeEmbed",
          props: {
            url,
            videoId,
          },
        },
      ],
      currentBlock,
      "after"
    );
    return true;
  } catch (error) {
    console.error("[youtubeSlashCommand] Failed to insert YouTube embed:", error);
    return false;
  }
}
