import { DefaultReactSuggestionItem } from "@blocknote/react";
import { Sparkles } from "lucide-react";
import React from "react";

export const getAiImageSlashCommand = (
  onOpenDialog: () => void
): DefaultReactSuggestionItem => ({
  title: "AI Image",
  onItemClick: onOpenDialog,
  aliases: ["ai", "generate", "image", "ai-image", "generate-image"],
  icon: React.createElement(Sparkles, { size: 18 }),
  subtext: "Generate an image using AI",
});
