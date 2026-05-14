import { DefaultReactSuggestionItem } from "@blocknote/react";
import { BarChart2 } from "lucide-react";
import React from "react";

/**
 * Returns the slash command item for Polls.
 * Provides a quick way for editors to insert polls via the "/" menu.
 */
export const getPollSlashCommand = (
  onOpenDialog: () => void
): DefaultReactSuggestionItem => ({
  title: "Poll",
  onItemClick: onOpenDialog,
  aliases: ["poll", "vote", "survey", "questionnaire", "interactive"],
  icon: React.createElement(BarChart2, { size: 18 }),
  subtext: "Search, select or create an interactive poll",
  group: "Components",
});
