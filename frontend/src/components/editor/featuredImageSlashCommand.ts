import { DefaultReactSuggestionItem } from "@blocknote/react";
import { Camera } from "lucide-react";
import React from "react";

export const getFeaturedImageSlashCommand = (
    onOpenDialog: () => void
): DefaultReactSuggestionItem => ({
    title: "Featured Image",
    onItemClick: onOpenDialog,
    aliases: ["featured", "featured-image", "feature", "thumbnail"],
    icon: React.createElement(Camera, { size: 18 }),
    subtext: "Set the featured image for this article",
    group: "Media Gallery",
});
