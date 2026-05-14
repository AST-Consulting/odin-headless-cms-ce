"use client";

import { DefaultReactSuggestionItem } from "@blocknote/react";
import React from "react";
import { isValidVideoUrl } from "./VideoEmbedBlock";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;

const VideoIcon = () =>
  React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    React.createElement("polygon", { points: "23 7 16 12 23 17 23 7" }),
    React.createElement("rect", { x: "1", y: "5", width: "15", height: "14", rx: "2", ry: "2" })
  );

export function getVideoEmbedSlashCommand(
  onPromptUrl: () => void
): DefaultReactSuggestionItem {
  return {
    title: "Video Embed",
    onItemClick: onPromptUrl,
    aliases: ["video", "mp4", "clip", "embed video"],
    group: "Embeds",
    icon: React.createElement(VideoIcon),
    subtext: "Embed a video from URL",
  };
}

export function insertVideoEmbed(
  editor: EditorInstance,
  url: string
): boolean {
  if (!isValidVideoUrl(url)) {
    return false;
  }

  try {
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [
        {
          type: "videoEmbed",
          props: {
            url,
            caption: "",
          },
        },
      ],
      currentBlock,
      "after"
    );
    return true;
  } catch (error) {
    console.error("[videoEmbedSlashCommand] Failed to insert video embed:", error);
    return false;
  }
}
