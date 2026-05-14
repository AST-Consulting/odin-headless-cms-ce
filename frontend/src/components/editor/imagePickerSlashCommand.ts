import { DefaultReactSuggestionItem } from "@blocknote/react";
import { Image as ImageIcon } from "lucide-react";
import React from "react";

export const getImagePickerSlashCommand = (
  onOpenDialog: () => void
): DefaultReactSuggestionItem => ({
  title: "Image",
  onItemClick: onOpenDialog,
  aliases: ["ai", "ai-image", "generate", "upload", "gallery", "image", "video", "media"],
  icon: React.createElement(ImageIcon, { size: 18 }),
  subtext: "Upload, select from gallery, or generate with AI",
  group: "Media Gallery",
});
