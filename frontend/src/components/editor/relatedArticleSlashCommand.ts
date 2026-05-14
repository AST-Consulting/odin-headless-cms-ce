import { DefaultReactSuggestionItem } from "@blocknote/react";
import { CopyPlus } from "lucide-react";
import React from "react";

export const getRelatedArticleSlashCommand = (
  onOpenDialog: () => void
): DefaultReactSuggestionItem => ({
  title: "Add Article",
  onItemClick: onOpenDialog,
  aliases: ["article", "add", "related", "story"],
  icon: React.createElement(CopyPlus, { size: 18 }),
  subtext: "Search and embed a related story/article via headline link",
  group: "Components",
});
