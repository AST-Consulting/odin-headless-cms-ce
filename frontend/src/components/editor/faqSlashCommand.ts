import { DefaultReactSuggestionItem } from "@blocknote/react";
import { HelpCircle } from "lucide-react";
import React from "react";

export const getFaqSlashCommand = (
  onOpenDialog: () => void
): DefaultReactSuggestionItem => ({
  title: "FAQ",
  onItemClick: onOpenDialog,
  aliases: ["faq", "question", "answer", "help", "support"],
  icon: React.createElement(HelpCircle, { size: 18 }),
  subtext: "Search, select or create an FAQ to embed",
  group: "Components",
});
