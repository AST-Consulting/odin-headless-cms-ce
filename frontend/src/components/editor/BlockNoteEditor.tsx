"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { 
  useCreateBlockNote, 
  getDefaultReactSlashMenuItems, 
  SuggestionMenuController, 
  LinkToolbarController, 
  LinkToolbar, 
  EditLinkButton, 
  DeleteLinkButton 
} from "@blocknote/react";
import { LinkEditDialog } from "./LinkEditDialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  generateArticle,
  getGenerationStatus,
  saveArticle,
  uploadFile,
  uploadFiles,
  getOrganizationDetails,
  terminateGeneration,
  getCategories,
  getCategoryById,
  startArticleFactValidation,
  getFactValidationStatus,
  startFactValidation,
} from "@/lib/api";
// refitMedia is consumed via the refit-featured-image helper below — no direct
// import needed here since handleFeaturedImageSelected goes through the helper.
import { refitToFeaturedAspect } from "@/lib/refit-featured-image";
import { FactCheckDialog } from "./FactCheckDialog";
import type { GenerationJobResult } from "@/lib/api";

import { getImageUrl } from "@/lib/utils";

import { markdownToBlocks } from "@/lib/markdown-to-blocks";
import { useEditorStore, useThemeStore, usePropertyStore, waitForEditorHydration } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { computeArticleStats } from "@/lib/article-stats";
import { Sparkles, FileText, FileType, Globe, Newspaper, FilePlus, Loader2, Square, Clock, Send, FileEdit, ExternalLink, Film } from "lucide-react";
import { toast } from "sonner";
import { useEditorContext } from "./EditorContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { exportToPDF, exportToWord, exportToHTML, extractFilename } from "@/lib/export-utils";
import { AiFormattingToolbar } from "./AiFormattingToolbar";
import { ImagePickerDialog } from "./ImagePickerDialog";
import { getImagePickerSlashCommand } from "./imagePickerSlashCommand";
import { getFeaturedImageSlashCommand } from "./featuredImageSlashCommand";
import { setFeaturedImagePickerListener, setFeaturedImageEditorListener } from "./FeaturedImageBlock";
import { ImageEditorDialog } from "./ImageEditorDialog";
import { ImageBlockOverlay } from "./ImageBlockOverlay";
import { resolveEditableUrl } from "@/lib/editable-image-url";
import { getTimestampSlashCommand, setTimestampEditListener, setAuthorNameEditListener } from "./TimestampBlock";
import { DateTimePickerDialog } from "./DateTimePickerDialog";
import { ValidationDialog } from "./ValidationDialog";
import { ArticleWizardDialog } from "./ArticleWizardDialog";
import { createEditorSchema } from "./editorSchema";
import { CategoryNameSelector } from "@/components/common/CategoryNameSelector";
import { extractTweetId } from "./TwitterEmbedBlock";
import { extractYouTubeVideoId } from "./YouTubeEmbedBlock";
import { extractInstagramPostId } from "./InstagramEmbedBlock";
import { insertTwitterEmbed, getTwitterSlashCommand } from "./twitterSlashCommand";
import { insertYouTubeEmbed, getYouTubeSlashCommand } from "./youtubeSlashCommand";
import { insertInstagramEmbed, getInstagramSlashCommand } from "./instagramSlashCommand";
import { insertSoundCloudEmbed, isValidSoundCloudUrl } from "./SoundCloudEmbedBlock";
import { getSoundCloudSlashCommand } from "./soundcloudSlashCommand";
import { insertSnapchatEmbed, isValidSnapchatUrl } from "./SnapchatEmbedBlock";
import { getSnapchatSlashCommand } from "./snapchatSlashCommand";
import { insertVideoEmbed, getVideoEmbedSlashCommand } from "./videoEmbedSlashCommand";
import { isValidVideoUrl } from "./VideoEmbedBlock";
import { EmbedUrlDialog } from "./EmbedUrlDialog";
import { getFaqSlashCommand } from "./faqSlashCommand";
import { FaqPickerDialog } from "./FaqPickerDialog";
import { getPollSlashCommand } from "./pollSlashCommand";
import { PollPickerDialog } from "./PollPickerDialog";
import { getRelatedArticleSlashCommand } from "./relatedArticleSlashCommand";
import { RelatedArticleModal } from "./RelatedArticleModal";
import type { Block, FAQ } from "@/lib/types";
import { getTemplateBlocks, isEditorEmpty, getPhotoStorySlideBlocks } from "./articleTemplates";
import { LiveBlogEditor } from "./live-blog/LiveBlogEditor";
import { WebStoryEditor } from "./web-story/WebStoryEditor";
import { RecipeEditor } from "./RecipeEditor";
import { AuthorSelector } from "../common/AuthorSelector";
import { AuthorStub } from "@/lib/types";
import { PublishSuccessDialog } from "./PublishSuccessDialog";

type EmbedDialogType = "twitter" | "youtube" | "instagram" | "soundcloud" | "snapchat" | "video" | null;

interface EmbedDialogConfig {
  title: string;
  description: string;
  placeholder: string;
}

const embedDialogConfigs: Record<Exclude<EmbedDialogType, null>, EmbedDialogConfig> = {
  twitter: {
    title: "Embed Twitter/X Post",
    description: "Paste a Twitter or X post URL to embed it in your article.",
    placeholder: "https://twitter.com/user/status/...",
  },
  youtube: {
    title: "Embed YouTube Video",
    description: "Paste a YouTube video URL to embed it in your article.",
    placeholder: "https://www.youtube.com/watch?v=...",
  },
  instagram: {
    title: "Embed Instagram Post",
    description: "Paste an Instagram post or reel URL to embed it in your article.",
    placeholder: "https://www.instagram.com/p/...",
  },
  soundcloud: {
    title: "Embed SoundCloud Track",
    description: "Paste a SoundCloud track or playlist URL to embed it in your article.",
    placeholder: "https://soundcloud.com/artist/track",
  },
  snapchat: {
    title: "Embed Snapchat Spotlight",
    description: "Paste a Snapchat Spotlight URL to embed it in your article.",
    placeholder: "https://www.snapchat.com/spotlight/...",
  },
  video: {
    title: "Embed Video",
    description: "Paste a direct video URL (mp4, webm, etc.) to embed it in your article.",
    placeholder: "https://example.com/video.mp4",
  },
};

// Block types that have content: "none" (no editable content)
const noContentTypes = new Set(["image", "video", "audio", "file", "twitterEmbed", "youtubeEmbed", "instagramEmbed", "timestamp", "soundcloudEmbed", "snapchatEmbed", "featuredImage", "videoEmbed", "faqEmbed", "pollEmbed", "recipeIngredient", "howToStep"]);

// Types that are custom blocks (need special handling during load - deferred insertion)
// Maps legacy types to their new type
const customBlockTypes: Record<string, string> = {
  twitterEmbed: "twitterEmbed",
  twitterCard: "twitterEmbed",
  youtubeEmbed: "youtubeEmbed",
  youtubeCard: "youtubeEmbed",
  instagramEmbed: "instagramEmbed",
  instagramCard: "instagramEmbed",
  timestamp: "timestamp",
  soundcloudEmbed: "soundcloudEmbed",
  snapchatEmbed: "snapchatEmbed",
  featuredImage: "featuredImage",
  videoEmbed: "videoEmbed",
  video: "videoEmbed",
  faqEmbed: "faqEmbed",
  pollEmbed: "pollEmbed",
  recipeIngredient: "recipeIngredient",
  howToStep: "howToStep",
};

const articleTypeLabels: Record<string, string> = {
  article: "Article",
  liveblog: "Live Blog",
  explainer: "Explainer",
  photo_story: "Photo Story",
  video: "Video",
  shorts: "Shorts",
  web_story: "Web Story",
  opinion: "Opinion",
  recipe: "Recipe",
  movie_review: "Movie Review",
};

// Types supported by BlockNote default schema
const standardBlockTypes = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "table",
  "image",
  "video",
  "audio",
  "file",
  "divider",
  "quote",
  "codeBlock",
]);

// Mapping of legacy/non-standard types to standard ones
const legacyTypeMapping: Record<string, string> = {
  list: "bulletListItem",
  "bullet-list": "bulletListItem",
  "ordered-list": "numberedListItem",
  "check-list": "checkListItem",
  "code-block": "codeBlock",
  "twitter-embed": "twitterEmbed",
  "youtube-embed": "youtubeEmbed",
  "instagram-embed": "instagramEmbed",
  quote: "quote",
  divider: "divider",
  embed: "videoEmbed", // Fallback for generic embed
  cta: "paragraph", // Fallback for cta
};

interface DeferredEmbed {
  index: number;
  placeholderId: string;
  type: string;
  props: Record<string, any>;
  content?: any[];
}

/**
 * Transform inline content from legacy format (V1) to standard BlockNote format (V2).
 */
function transformInlineContent(content: any): any[] {
  if (typeof content === "string") {
    // Preserving Hindi and other international characters for visible text
    return [{ type: "text", text: content, styles: {} }];
  }

  if (!Array.isArray(content)) return [];

  return content.map((item) => {
    if (!item || typeof item !== "object") {
      return { type: "text", text: String(item || ""), styles: {} };
    }

    // Handle V2 style objects
    if (item.type === "text") {
      return {
        type: "text",
        text: item.text || "",
        styles: item.styles || {}
      };
    }

    if (item.type === "link") {
      // Logic for both V1 and V2 style links
      // V1 has .text, V2 has .content (which is an array)
      let linkText = item.text || "";
      let linkContent = Array.isArray(item.content) ? transformInlineContent(item.content) : [];

      if (linkContent.length === 0 && linkText) {
        linkContent = [{ type: "text", text: linkText, styles: {} }];
      }

      return {
        type: "link",
        content: linkContent,
        href: (item.href || item.link || "").replace(/[^\x00-\x7F\u0900-\u097F]/g, "") // Sanitize but keep Hindi
      };
    }

    // Fallback/Legacy Conversion (V1 flat properties like { text: '...', bold: true })
    const styles: Record<string, any> = {};
    const styleKeys = ["bold", "italic", "underline", "strike", "code", "textColor", "backgroundColor"];
    styleKeys.forEach(key => {
      if (item[key] !== undefined) styles[key] = item[key];
    });

    if (item.link || item.href) {
      return {
        type: "link",
        content: [{ type: "text", text: item.text || "", styles }],
        href: (item.link || item.href || "").replace(/[^\x00-\x7F\u0900-\u097F]/g, "")
      };
    }

    return {
      type: "text",
      text: item.text || "",
      styles
    };
  });
}

/**
 * Transform stored blocks for the editor.
 * Custom embeds are replaced with placeholders and returned separately for deferred insertion.
 */
/**
 * Transform stored blocks for the editor.
 * Custom embeds are replaced with placeholders and returned separately for deferred insertion.
 */
function transformBlocksForEditor(storedBlocks: Block[]): {
  blocks: PartialBlock[];
  deferredEmbeds: DeferredEmbed[];
} {
  if (!storedBlocks || !Array.isArray(storedBlocks) || storedBlocks.length === 0) {
    return { blocks: [], deferredEmbeds: [] };
  }

  const deferredEmbeds: DeferredEmbed[] = [];

  const { articleType, articleTitle } = useEditorStore.getState();

  // Legacy migration: the article title used to be stored as a leading H1 inside
  // the doc. Now the title has its own input box, so strip that leading H1 on
  // load when it matches the article title (or is an empty heading) to avoid
  // visual duplication.
  const workingBlocks = (() => {
    if (!storedBlocks.length) return storedBlocks;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = storedBlocks[0] as any;
    const firstType = legacyTypeMapping[first?.type || ""] || first?.type;
    if (firstType !== "heading") return storedBlocks;
    const rawContent = first?.content;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = Array.isArray(rawContent)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? rawContent.map((c: any) => c?.text || "").join("").trim()
      : typeof rawContent === "string" ? rawContent.trim() : "";
    const titleTrim = (articleTitle || "").trim();
    const shouldDrop = text === "" || (titleTrim && text === titleTrim);
    return shouldDrop ? storedBlocks.slice(1) : storedBlocks;
  })();

  const transform = (blocksToTransform: any[], isTopLevel: boolean): PartialBlock[] => {
    if (!blocksToTransform || !Array.isArray(blocksToTransform)) return [];

    return blocksToTransform
      .filter(block => {
        if (!block) return false;
        let rawType = (block.type || "paragraph") as string;
        let blockType = legacyTypeMapping[rawType] || rawType;
        // In article mode, we strip out timestamps to make it 'flat'
        if (articleType === "article" && (blockType === "timestamp" || customBlockTypes[blockType] === "timestamp")) {
          return false;
        }
        return true;
      })
      .map((block, index) => {
        let rawType = (block.type || "paragraph") as string;
        let blockType = legacyTypeMapping[rawType] || rawType;

        // Handle custom blocks (deferred insertion if top-level)
        if (isTopLevel && blockType in customBlockTypes) {
          const customType = customBlockTypes[blockType];
          const props = block.metadata?.props || block.props || {};

          let customProps: Record<string, string> = {};
          let placeholderText = "Loading...";

          if (customType === "twitterEmbed") {
            const url = (props?.url || "").replace(/[^\x00-\x7F]/g, "");
            const embedId = props?.tweetId || extractTweetId(url) || "";
            customProps = { url, tweetId: embedId };
            placeholderText = "Loading tweet...";
          } else if (customType === "youtubeEmbed") {
            const url = (props?.url || "").replace(/[^\x00-\x7F]/g, "");
            const embedId = props?.videoId || extractYouTubeVideoId(url) || "";
            customProps = { url, videoId: embedId };
            placeholderText = "Loading YouTube video...";
          } else if (customType === "instagramEmbed") {
            const url = (props?.url || "").replace(/[^\x00-\x7F]/g, "");
            const embedId = props?.postId || extractInstagramPostId(url) || "";
            customProps = { url, postId: embedId };
            placeholderText = "Loading Instagram post...";
          } else if (customType === "timestamp") {
            customProps = {
              timestamp: (props?.timestamp || new Date().toISOString()) as string,
              authorName: (props?.authorName || "") as string,
              authorId: props?.authorId || "",
              authorSlug: props?.authorSlug || "",
              status: (block?.status || "active") as string,
            };
            placeholderText = "Loading timestamp...";
          } else if (customType === "soundcloudEmbed") {
            customProps = {
              url: (props?.url || "").replace(/[^\x00-\x7F]/g, ""),
              height: props?.height || "166"
            };
            placeholderText = "Loading SoundCloud...";
          } else if (customType === "snapchatEmbed") {
            customProps = { url: (props?.url || "").replace(/[^\x00-\x7F]/g, "") };
            placeholderText = "Loading Snapchat...";
          } else if (customType === "featuredImage") {
            // Populate from block props first, then fall back to store images
            const storeImages = useEditorStore.getState().images;
            const storeImg = storeImages?.[0];
            customProps = {
              url: props?.url || (storeImg?.url ? (getImageUrl(storeImg.url) ?? "") : "") || "",
              alt: props?.alt || storeImg?.alt || "",
              caption: props?.caption || storeImg?.caption || "",
            };
            placeholderText = "Loading featured image...";
          } else if (customType === "videoEmbed") {
            const url = (props?.url || "").replace(/[^\x00-\x7F]/g, "");
            customProps = {
              url: url ? (getImageUrl(url) ?? "") : "",
              caption: (props?.caption || "") as string,
            };
            placeholderText = "Loading video...";
          } else if (customType === "faqEmbed") {
            customProps = {
              faqId: (props?.faqId || "") as string,
              question: (props?.question || "") as string,
              answer: (props?.answer || "") as string,
            };
            placeholderText = "Loading FAQ...";
          } else if (customType === "pollEmbed") {
            customProps = {
              pollId: (props?.pollId || "") as string,
            };
            placeholderText = "Loading Poll...";
          } else if (customType === "recipeIngredient") {
            const rawContent = block.content;
            const plainText = typeof rawContent === "string" ? rawContent : 
              (Array.isArray(rawContent) ? rawContent.map((c: any) => c.text || "").join("") : "");
            customProps = { text: props.text || plainText };
            placeholderText = "Loading ingredient...";
          } else if (customType === "howToStep") {
            const rawContent = block.content;
            const plainText = typeof rawContent === "string" ? rawContent : 
              (Array.isArray(rawContent) ? rawContent.map((c: any) => c.text || "").join("") : "");
            customProps = { text: props.text || plainText };
            placeholderText = "Loading step...";
          }

          const placeholderId = block.id || block._id || `__deferred_${customType}_${index}`;
          deferredEmbeds.push({ 
            index, 
            placeholderId, 
            type: customType, 
            props: customProps, 
            content: [] // Content: none blocks should have empty content
          });
          return { id: placeholderId, type: "paragraph", content: [{ type: "text", text: placeholderText, styles: {} }] } as PartialBlock;
        }

        // Whitelist block types
        if (!standardBlockTypes.has(blockType) && !Object.values(customBlockTypes).includes(blockType)) {
          blockType = "paragraph";
        }

        const rawChildren = block.metadata?.children || block.children;
        const transformedChildren = Array.isArray(rawChildren) ? transform(rawChildren, false) : undefined;
        const props = block.metadata?.props || block.props || {};
        let content = block.content;

        if (blockType === "table") {
          if (content && typeof content === "object") {
            const rows = content.rows || [];
            content = {
              type: "tableContent",
              rows: rows.map((row: any) => ({
                cells: Array.isArray(row.cells) ? row.cells.map(transformInlineContent) : []
              }))
            };
          } else {
            content = { type: "tableContent", rows: [] };
          }
        } else if (!noContentTypes.has(blockType)) {
          content = transformInlineContent(content);
        } else {
          content = undefined;
        }

        // Ensure heading level is between 1-3 if set
        if (blockType === "heading" && props.level) {
          const levelCode = parseInt(props.level);
          if (isNaN(levelCode) || levelCode < 1 || levelCode > 3) {
            props.level = 1;
          }
        }

        // Apply CDN to media URLs
        const finalProps = typeof props === "object" ? { ...props } : {};
        if (blockType === "image" || blockType === "video" || blockType === "audio") {
          if (finalProps.url) finalProps.url = getImageUrl(finalProps.url) ?? "";
          else if (finalProps.src) finalProps.src = getImageUrl(finalProps.src) ?? "";
        }

        return {
          id: block.id || block._id,
          type: blockType,
          content: content,
          props: finalProps,
          children: transformedChildren,
        } as PartialBlock;
      });
  };

  const transformedBlocks = transform(workingBlocks, true);

  // Ensure a featuredImage block exists — inject one after the first heading if missing
  const hasFeaturedImage = deferredEmbeds.some((e) => e.type === "featuredImage");
  if (!hasFeaturedImage) {
    const firstHeadingIndex = transformedBlocks.findIndex(
      (b) => (b as { type?: string }).type === "heading"
    );
    const insertIndex = firstHeadingIndex >= 0 ? firstHeadingIndex + 1 : 0;
    // Get image from store if available
    const storeImages = useEditorStore.getState().images;
    const storeImg = storeImages?.[0];
    const featuredPlaceholderId = `__deferred_featuredImage_inject`;
    const placeholder = {
      id: featuredPlaceholderId,
      type: "paragraph",
      content: [{ type: "text", text: "Loading featured image...", styles: {} }],
    } as PartialBlock;
    transformedBlocks.splice(insertIndex, 0, placeholder);
    // Adjust deferred embed indexes that come after the insertion point
    deferredEmbeds.forEach((e) => {
      if (e.index >= insertIndex) e.index++;
    });
    deferredEmbeds.push({
      index: insertIndex,
      placeholderId: featuredPlaceholderId,
      type: "featuredImage",
      props: {
        url: storeImg?.url ? (getImageUrl(storeImg.url) ?? "") : "",
        alt: storeImg?.alt || "",
        caption: storeImg?.caption || "",
      },
    });
  }

  return { blocks: transformedBlocks, deferredEmbeds };
}

const defaultBlocks: PartialBlock[] = [
  {
    type: "heading",
    content: [],
    props: { level: 1 }
  },
  { id: "__deferred_featuredImage_default", type: "paragraph", content: [{ type: "text", text: "Loading featured image...", styles: {} }] } as PartialBlock,
];

// Default deferred embeds — matching indexes for custom blocks in defaultBlocks
const defaultDeferredEmbeds: DeferredEmbed[] = [
  { index: 1, placeholderId: "__deferred_featuredImage_default", type: "featuredImage", props: { url: "", alt: "", caption: "" } },
];

/**
 * Process template blocks: replace custom blocks (like featuredImage) with
 * placeholders and return deferred embeds for them.
 * This prevents React 19 "Cannot find node position" errors for custom blocks.
 */
function processTemplateBlocks(blocks: PartialBlock[]): {
  blocks: PartialBlock[];
  deferredEmbeds: DeferredEmbed[];
} {
  const deferredEmbeds: DeferredEmbed[] = [];
  const processed = blocks.map((block, index) => {
    const blockType = (block as { type?: string }).type || "paragraph";
    if (blockType === "featuredImage") {
      // Get image from store if available
      const storeImages = useEditorStore.getState().images;
      const storeImg = storeImages?.[0];
      const placeholderId = `__deferred_featuredImage_template_${index}`;
      deferredEmbeds.push({
        index,
        placeholderId,
        type: "featuredImage",
        props: {
          url: storeImg?.url ? (getImageUrl(storeImg.url) ?? "") : "",
          alt: storeImg?.alt || "",
          caption: storeImg?.caption || "",
        },
      });
      return {
        id: placeholderId,
        type: "paragraph",
        content: [{ type: "text", text: "Loading featured image...", styles: {} }],
      } as PartialBlock;
    }
    if (blockType === "videoEmbed" || blockType === "video") {
      const props = (block as { props?: Record<string, string> }).props || {};
      const placeholderId = `__deferred_videoEmbed_template_${index}`;
      deferredEmbeds.push({
        index,
        placeholderId,
        type: "videoEmbed",
        props: {
          url: props.url ? (getImageUrl(props.url) ?? "") : "",
          caption: props.caption || "",
        },
      });
      return {
        id: placeholderId,
        type: "paragraph",
        content: [{ type: "text", text: "Loading video...", styles: {} }],
      } as PartialBlock;
    }
    if (blockType === "recipeIngredient") {
      const content = (block as any).content || [];
      const placeholderId = `__deferred_recipeIngredient_template_${index}`;
      deferredEmbeds.push({
        index,
        placeholderId,
        type: "recipeIngredient",
        props: (block as any).props || {},
        content,
      });
      return {
        id: placeholderId,
        type: "paragraph",
        content: [{ type: "text", text: "Loading ingredient...", styles: {} }],
      } as PartialBlock;
    }
    if (blockType === "howToStep") {
      const content = (block as any).content || [];
      const placeholderId = `__deferred_howToStep_template_${index}`;
      deferredEmbeds.push({
        index,
        placeholderId,
        type: "howToStep",
        props: (block as any).props || {},
        content,
      });
      return {
        id: placeholderId,
        type: "paragraph",
        content: [{ type: "text", text: "Loading step...", styles: {} }],
      } as PartialBlock;
    }
    return block;
  });
  return { blocks: processed, deferredEmbeds };
}

const GENERATION_STEPS = [
  { label: "Researching topic...", duration: 8000 },
  { label: "Writing article...", duration: 15000 },
  { label: "Generating image...", duration: 10000 },
  { label: "Preparing SEO metadata...", duration: 5000 },
  { label: "Almost done...", duration: 60000 },
];

function GenerationOverlay({ onCancel }: { onCancel: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const advanceStep = (idx: number) => {
      if (idx >= GENERATION_STEPS.length - 1) return;
      setTimeout(() => {
        if (cancelled) return;
        setStepIndex(idx + 1);
        advanceStep(idx + 1);
      }, GENERATION_STEPS[idx].duration);
    };
    advanceStep(0);
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 max-w-md text-center p-8">
        {/* Animated icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>

        {/* Progress steps */}
        <div className="space-y-3 w-full">
          <p className="text-lg font-semibold">Generating your article</p>
          <div className="space-y-2">
            {GENERATION_STEPS.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-sm transition-all duration-500 ${idx < stepIndex ? "text-primary" :
                  idx === stepIndex ? "text-foreground font-medium" :
                    "text-muted-foreground/40"
                  }`}
              >
                {idx < stepIndex ? (
                  <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground flex-shrink-0">
                    &#10003;
                  </span>
                ) : idx === stepIndex ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                ) : (
                  <span className="w-5 h-5 rounded-full border border-border flex-shrink-0" />
                )}
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onCancel} className="gap-1.5 mt-2">
          <Square className="w-3.5 h-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Inner component that creates the editor
function EditorWithBlocks({
  initialBlocks,
  deferredEmbeds,
}: {
  initialBlocks: PartialBlock[];
  deferredEmbeds: DeferredEmbed[];
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [embedsInserted, setEmbedsInserted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingAs, setSavingAs] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [preserveUpdatedAt, setPreserveUpdatedAt] = useState(false);
  // Holds the AbortController for the in-flight save so a newer save can cancel it.
  const saveAbortRef = useRef<AbortController | null>(null);
  // Autosave infrastructure — refs shadow reactive state so the debounced closure
  // always sees current values instead of a stale snapshot.
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const isDirtyRef = useRef(false);
  // Monotonic edit counter — lets a save detect if new edits landed mid-flight
  // so it doesn't mark the doc clean when the saved payload is already stale.
  const editCounterRef = useRef(0);
  // Forward ref for scheduleAutosave so performFinalSave can retrigger it even
  // though the function is declared later in the file.
  const scheduleAutosaveRef = useRef<(() => void) | null>(null);
  // Debounced sync — heavy per-keystroke work (block mapping, title sync) runs
  // ~250ms after the user stops typing instead of on every keystroke.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSyncRef = useRef<(() => void) | null>(null);
  // Forward ref for flushSync so performFinalSave (declared earlier) can flush
  // pending work before reading the editor document.
  const flushSyncRef = useRef<(() => void) | null>(null);
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  const articleUpdatedAt = useEditorStore((state) => state.articleUpdatedAt);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isNewArticleDialogOpen, setIsNewArticleDialogOpen] = useState(false);
  const [isPublishSuccessDialogOpen, setIsPublishSuccessDialogOpen] = useState(false);
  const [publishedArticleUrl, setPublishedArticleUrl] = useState("");
  const selectedLanguage = typeof window !== "undefined"
    ? localStorage.getItem("odin_language") || "hi"
    : "hi";
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isFeaturedImagePickerOpen, setIsFeaturedImagePickerOpen] = useState(false);
  const [featuredImageEditorUrl, setFeaturedImageEditorUrl] = useState<string | null>(null);
  // Regular image block edit/replace state — blockId is the BlockNote block being acted on
  const [imageBlockEditTarget, setImageBlockEditTarget] = useState<{ blockId: string; url: string } | null>(null);
  const [imageBlockReplaceTargetId, setImageBlockReplaceTargetId] = useState<string | null>(null);
  const [isDateTimePickerOpen, setIsDateTimePickerOpen] = useState(false);
  const [editingTimestampBlockId, setEditingTimestampBlockId] = useState<string | null>(null);
  const [editingTimestampDate, setEditingTimestampDate] = useState<Date | undefined>(undefined);
  const [editingAuthorBlockId, setEditingAuthorBlockId] = useState<string | null>(null);
  const [editingAuthorName, setEditingAuthorName] = useState("");
  const [editingAuthorStub, setEditingAuthorStub] = useState<AuthorStub[]>([]);
  const [isAuthorNameDialogOpen, setIsAuthorNameDialogOpen] = useState(false);
  const [embedDialogType, setEmbedDialogType] = useState<EmbedDialogType>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = useState(false);
  const [isFaqPickerOpen, setIsFaqPickerOpen] = useState(false);
  const [isPollPickerOpen, setIsPollPickerOpen] = useState(false);
  const [isRelatedArticlePickerOpen, setIsRelatedArticlePickerOpen] = useState(false);
  const [isLinkEditOpen, setIsLinkEditOpen] = useState(false);
  const [linkEditData, setLinkEditData] = useState({ url: "", text: "" });

  // Reality Check / Fact Validation States
  const {
    factCheckJobId,
    setFactCheckJobId,
    factCheckResult,
    setFactCheckResult,
    currentArticleId,
  } = useEditorStore(
    useShallow((s) => ({
      factCheckJobId: s.factCheckJobId,
      setFactCheckJobId: s.setFactCheckJobId,
      factCheckResult: s.factCheckResult,
      setFactCheckResult: s.setFactCheckResult,
      currentArticleId: s.currentArticleId,
    }))
  );

  // Hydrate fact check state from localStorage on mount
  useEffect(() => {
    if (!currentArticleId || factCheckResult || factCheckJobId) return;

    const cacheKey = `odin_cms_fc_${currentArticleId}`;
    const localData = localStorage.getItem(cacheKey);

    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed?.findings?.length > 0) {
          setFactCheckResult(parsed);
        }
      } catch (e) {
        console.error("Corrupted fact check local data, clearing", e);
        localStorage.removeItem(cacheKey);
      }
    }
  }, [currentArticleId, factCheckResult, factCheckJobId, setFactCheckResult]);


  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  // Local draft for the title input box — committed to the store on blur/Enter
  // so per-keystroke typing doesn't trigger store-wide re-renders.
  const [titleDraft, setTitleDraft] = useState("");

  // Intercept link clicks in the editor to require Ctrl/Cmd key for navigation
  useEffect(() => {
    const handleLinkInteraction = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link) {
        // Double-check the link is inside our editor BEFORE doing anything
        const isInIdEditor = editorContainerRef.current?.contains(link);
        const isInClassEditor = !!link.closest(".blocknote-editor") || !!link.closest(".bn-editor");

        if (isInIdEditor || isInClassEditor) {
          // If Ctrl (Windows/Linux) or Cmd (Mac) is NOT pressed, prevent navigation
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
        }
        // If the link is NOT inside the editor (e.g. sidebar links), do nothing — let it navigate normally
      }
    };

    // Use capture phase for both events to intercept before any other libraries
    window.addEventListener("click", handleLinkInteraction, { capture: true });
    window.addEventListener("mousedown", handleLinkInteraction, { capture: true });

    return () => {
      window.removeEventListener("click", handleLinkInteraction, { capture: true });
      window.removeEventListener("mousedown", handleLinkInteraction, { capture: true });
    };
  }, []);

  // Create schema with custom blocks - done at runtime to avoid Turbopack issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema = useMemo(() => createEditorSchema() as any, []);

  const {
    setBlocks,
    setSeoData,
    seoData,
    setTags,
    setCategories,
    tags,
    categories,
    primaryCategory,
    setPrimaryCategory,
    primaryCategorySlug,
    setPrimaryCategorySlug,
    slug,
    articleTitle,
    setArticleTitle,
    resetEditor,
    setCurrentArticleId,
    status,
    setStatus,
    scheduledAt,
    setScheduledAt,
    authors,
    setAuthors,
    articleType,
    setArticleType,
    englishHeadline,
    setEnglishHeadline,
    slugStatus,
    generationJobId,
    setGenerationJobId,
    isSponsored,
    setIsSponsored,
    isPremium,
    setIsPremium,
    articleStats,
    setArticleStats,
  } = useEditorStore();

  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const { selectedProperty } = usePropertyStore();
  const { setEditor } = useEditorContext();
  const router = useRouter();

  // Fetch category options for the toolbar dropdown
  useEffect(() => {
    getCategories({ limit: 50, status: "active" })
      .then((data) => {
        const cats = data.data || [];
        setCategoryOptions(cats.map((c: { _id: string; title: string }) => ({ value: c._id, label: c.title })));
      })
      .catch(() => { });
  }, []);

  // Auto-select logged-in user as author by default
  useEffect(() => {
    if (user && (!authors || authors.length === 0)) {
      setAuthors([{
        id: user.id,
        name: user.name,
        slug: user.slug || ""
      }]);
    }
  }, [user, authors, setAuthors]);

  // Create editor with custom schema including Twitter embed
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks.length > 0 ? initialBlocks : defaultBlocks,
    placeholders: {
      heading: "Heading",
      default: "Start writing or type '/' for commands...",
    },
    uploadFile: async (file: File) => {
      try {
        const uploadToast = toast.loading(`Uploading ${file.name}...`);
        const propertyId = selectedProperty?._id || user?.propertyId;
        const url = await uploadFile(file, false, propertyId);
        toast.dismiss(uploadToast);
        toast.success(`${file.name} uploaded successfully!`);
        return url;
      } catch (error) {
        console.error("[BlockNoteEditor] Upload failed:", error);
        toast.error(`Failed to upload ${file.name}`);
        throw error;
      }
    },
  });

  // Apply fact check findings as inline styles
  // Uses a retry loop: the editor content may still be loading from the API,
  // so we keep retrying until all findings are resolved or max retries hit.
  useEffect(() => {
    if (!editor || !factCheckResult?.findings) return;

    let attempt = 0;
    const maxAttempts = 6;
    let timer: ReturnType<typeof setTimeout>;

    const applyHighlights = () => {
      // Check if editor document has real content
      const doc = editor.document;
      const hasContent = doc.some((b: any) => {
        if (!b.content || !Array.isArray(b.content)) return false;
        return (b.content as any[]).some((c: any) => c.type === 'text' && c.text?.trim().length > 0);
      });
      if (!hasContent) {
        attempt++;
        if (attempt < maxAttempts) timer = setTimeout(applyHighlights, 500);
        return;
      }

      // Step 1: Group findings by resolved block ID
      const blockFindings = new Map<string, { block: any; findings: any[] }>();
      let unmatchedCount = 0;

      factCheckResult.findings.forEach((finding: any) => {
        if (!finding.verdict || finding.verdict === 'accurate' || !finding.quote) return;

        let targetBlock = finding.blockId ? editor.getBlock(finding.blockId) : null;

        // Fallback: search by quote text if blockId is stale
        if (!targetBlock) {
          editor.forEachBlock((b) => {
            if (b.content && Array.isArray(b.content)) {
              const fullText = (b.content as any[])
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('');
              if (fullText.includes(finding.quote)) {
                targetBlock = b;
                return false;
              }
            }
            return true;
          });
        }

        if (!targetBlock || !Array.isArray(targetBlock.content)) {
          unmatchedCount++;
          return;
        }

        const key = targetBlock.id;
        if (!blockFindings.has(key)) {
          blockFindings.set(key, { block: targetBlock, findings: [] });
        }
        blockFindings.get(key)!.findings.push(finding);
      });

      // Step 2: For each block, apply ALL findings in a single content pass
      blockFindings.forEach(({ block, findings }) => {
        let contentItems: any[] = [...(block.content as any[])];
        let anyModified = false;

        for (const finding of findings) {
          const nextContent: any[] = [];
          let modified = false;

          for (const item of contentItems) {
            if (item.type === 'text' && !item.styles?.factCheck && item.text.includes(finding.quote)) {
              const index = item.text.indexOf(finding.quote);
              const before = item.text.substring(0, index);
              const after = item.text.substring(index + finding.quote.length);

              if (before) nextContent.push({ ...item, text: before });

              const styleValue = `${finding.id}|${finding.quote}`;
              nextContent.push({
                ...item,
                text: finding.quote,
                styles: { ...item.styles, factCheck: styleValue },
              });

              if (after) nextContent.push({ ...item, text: after });
              modified = true;
            } else {
              nextContent.push(item);
            }
          }

          if (modified) {
            contentItems = nextContent;
            anyModified = true;
          }
        }

        if (anyModified) {
          editor.updateBlock(block, { content: contentItems } as any);
        }
      });

      // If some findings couldn't be matched and we haven't exhausted retries, try again
      if (unmatchedCount > 0) {
        attempt++;
        if (attempt < maxAttempts) timer = setTimeout(applyHighlights, 500);
      }
    };

    // Initial delay to let editor hydrate
    timer = setTimeout(applyHighlights, 300);

    return () => clearTimeout(timer);
  }, [editor, factCheckResult?.findings]);

  // Insert deferred embeds after editor is ready
  useEffect(() => {
    if (!editor || embedsInserted || deferredEmbeds.length === 0) return;

    // Small delay to ensure editor is fully initialized
    const timer = setTimeout(() => {
      try {
        const document = editor.document;
        let anyFailures = false;

        // Replace placeholder paragraphs with actual embed blocks
        deferredEmbeds.forEach((embed) => {
          // Find placeholder by ID first (reliable), then by content as fallback
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const placeholderBlock = document.find((b: any) => b.id === embed.placeholderId)
            || document.find((b: any) =>
              b.type === "paragraph" &&
              Array.isArray(b.content) &&
              (b.content[0] as any)?.text?.includes("Loading") &&
              (b.content[0] as any)?.text?.includes(embed.type.replace("Embed", ""))
            )
            || (embed.index < document.length ? document[embed.index] : null);

          if (placeholderBlock) {
            // Check if it's already the right type to avoid redundant updates
            if (placeholderBlock.type === embed.type) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.updateBlock(placeholderBlock, {
              type: embed.type,
              props: embed.props,
              ...(embed.content ? { content: embed.content } : {}),
            } as any);
          } else {
            console.warn(`[BlockNoteEditor] Could not find placeholder for ${embed.type} (ID: ${embed.placeholderId}, Index: ${embed.index})`);
            anyFailures = true;
          }
        });

        // Only mark as fully inserted if we found everything (or we want to stop trying)
        // If some are missing, they might still be hydrating, so we might want to try again
        // But for now, we'll mark as true to avoid infinite loops, unless we add a retry counter
        if (!anyFailures || deferredEmbeds.length > 0) {
          setEmbedsInserted(true);
        }
      } catch (err) {
        console.error("[BlockNoteEditor] Failed to insert deferred embeds:", err);
        setEmbedsInserted(true); // Don't get stuck in a loop
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [editor, deferredEmbeds, embedsInserted]);

  // Handle opening embed dialogs
  const handleTwitterEmbed = useCallback(() => {
    setEmbedDialogType("twitter");
  }, []);

  const handleYouTubeEmbed = useCallback(() => {
    setEmbedDialogType("youtube");
  }, []);

  const handleInstagramEmbed = useCallback(() => {
    setEmbedDialogType("instagram");
  }, []);

  const handleSoundCloudEmbed = useCallback(() => {
    setEmbedDialogType("soundcloud");
  }, []);

  const handleSnapchatEmbed = useCallback(() => {
    setEmbedDialogType("snapchat");
  }, []);

  const handleVideoEmbed = useCallback(() => {
    setEmbedDialogType("video");
  }, []);

  // Handle embed URL submission from dialog
  // Returns true if successful (dialog will close), false if validation failed (dialog stays open)
  const handleEmbedUrlSubmit = useCallback(
    (url: string): boolean => {
      if (!embedDialogType) return false;

      switch (embedDialogType) {
        case "twitter": {
          const tweetId = extractTweetId(url);
          if (!tweetId) {
            toast.error("Invalid Twitter/X URL. Please use a valid tweet URL.");
            return false;
          }
          const success = insertTwitterEmbed(editor, url);
          if (success) {
            toast.success("Tweet embedded!");
            return true;
          } else {
            toast.error("Failed to embed tweet");
            return false;
          }
        }
        case "youtube": {
          const videoId = extractYouTubeVideoId(url);
          if (!videoId) {
            toast.error("Invalid YouTube URL. Please use a valid YouTube video URL.");
            return false;
          }
          const success = insertYouTubeEmbed(editor, url);
          if (success) {
            toast.success("YouTube video embedded!");
            return true;
          } else {
            toast.error("Failed to embed YouTube video");
            return false;
          }
        }
        case "instagram": {
          const postId = extractInstagramPostId(url);
          if (!postId) {
            toast.error("Invalid Instagram URL. Please use a valid Instagram post or reel URL.");
            return false;
          }
          const success = insertInstagramEmbed(editor, url);
          if (success) {
            toast.success("Instagram post embedded!");
            return true;
          } else {
            toast.error("Failed to embed Instagram post");
            return false;
          }
        }
        case "soundcloud": {
          if (!isValidSoundCloudUrl(url)) {
            toast.error("Invalid SoundCloud URL. Please use a valid SoundCloud track URL.");
            return false;
          }
          const success = insertSoundCloudEmbed(editor, url, 166);
          if (success) {
            toast.success("SoundCloud embedded!");
            return true;
          } else {
            toast.error("Failed to embed SoundCloud");
            return false;
          }
        }
        case "snapchat": {
          if (!isValidSnapchatUrl(url)) {
            toast.error("Invalid Snapchat URL. Please use a valid Snapchat Spotlight URL.");
            return false;
          }
          const success = insertSnapchatEmbed(editor, url);
          if (success) {
            toast.success("Snapchat Spotlight embedded!");
            return true;
          } else {
            toast.error("Failed to embed Snapchat Spotlight");
            return false;
          }
        }
        case "video": {
          if (!isValidVideoUrl(url)) {
            toast.error("Invalid video URL. Please use a valid video URL.");
            return false;
          }
          const success = insertVideoEmbed(editor, url);
          if (success) {
            toast.success("Video embedded!");
            return true;
          } else {
            toast.error("Failed to embed video");
            return false;
          }
        }
        default:
          return false;
      }
    },
    [editor, embedDialogType]
  );

  // Handle timestamp edit request from the edit button
  useEffect(() => {
    setTimestampEditListener((blockId: string, currentTimestamp: string) => {
      const date = currentTimestamp ? new Date(currentTimestamp) : new Date();
      setEditingTimestampBlockId(blockId);
      setEditingTimestampDate(date);
      setIsDateTimePickerOpen(true);
    });

    return () => setTimestampEditListener(null);
  }, []);

  // Handle author name edit request from the edit button
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAuthorNameEditListener((blockId: string, currentAuthorName: string) => {
      setEditingAuthorBlockId(blockId);
      setEditingAuthorName(currentAuthorName);

      // Try to find author details if available in the editor block
      if (editor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const block = editor.document.find((b: any) => b.id === blockId);
        if (block?.props) {
          setEditingAuthorStub([{
            id: (block.props.authorId as string) || "",
            name: (block.props.authorName as string) || currentAuthorName,
            slug: (block.props.authorSlug as string) || "",
          }]);
        } else {
          setEditingAuthorStub([{ id: "", name: currentAuthorName }]);
        }
      } else {
        setEditingAuthorStub([{ id: "", name: currentAuthorName }]);
      }

      setIsAuthorNameDialogOpen(true);
    });

    return () => setAuthorNameEditListener(null);
  }, [editor]);

  // Wire featured image block click to open the existing picker or editor
  useEffect(() => {
    setFeaturedImagePickerListener(() => setIsFeaturedImagePickerOpen(true));
    setFeaturedImageEditorListener((url: string) => setFeaturedImageEditorUrl(url));
    return () => { setFeaturedImagePickerListener(null); setFeaturedImageEditorListener(null); };
  }, []);

  // Sync featuredImage block when store images change (e.g. from SeoTab)
  // Only runs after deferred embeds are inserted to avoid "Cannot find node position"
  const prevFeaturedUrl = useRef<string>("");
  useEffect(() => {
    if (!editor || !embedsInserted) return;
    const unsub = useEditorStore.subscribe((state) => {
      const img = state.images?.[0];
      const url = img?.url ? (getImageUrl(img.url) ?? "") : "";
      if (url === prevFeaturedUrl.current) return;
      prevFeaturedUrl.current = url;
      const alt = img?.alt || "";
      const caption = img?.caption || "";
      requestAnimationFrame(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const featuredBlock = editor.document.find((b: any) => b.type === "featuredImage");
        if (featuredBlock) {
          editor.updateBlock(featuredBlock, {
            type: "featuredImage",
            props: { url, alt, caption },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        }
      });
    });
    return unsub;
  }, [editor, embedsInserted]);

  // Handle timestamp update from date picker (for editing existing timestamps)
  const handleTimestampUpdate = useCallback((date: Date) => {
    if (editingTimestampBlockId && editor) {
      // Find and update the existing timestamp block
      const blocks = editor.document;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = blocks.find((b: any) => b.id === editingTimestampBlockId);
      if (block) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.updateBlock(block, {
          type: "timestamp",
          props: { timestamp: date.toISOString() },
        } as any);
        toast.success("Timestamp updated!");
      }
    }
    // Reset editing state
    setEditingTimestampBlockId(null);
    setEditingTimestampDate(undefined);
  }, [editor, editingTimestampBlockId]);

  const handleAuthorNameUpdate = useCallback(() => {
    if (editingAuthorBlockId && editor) {
      const author = editingAuthorStub[0];
      if (!author) {
        toast.error("Please select an author");
        return;
      }

      const blocks = editor.document;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = blocks.find((b: any) => b.id === editingAuthorBlockId);
      if (block) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.updateBlock(block, {
          type: "timestamp",
          props: {
            authorName: author.name.trim(),
            authorId: author.id,
            authorSlug: author.slug || "",
          },
        } as any);
        toast.success("Author updated!");
      }
    }
    setEditingAuthorBlockId(null);
    setEditingAuthorName("");
    setEditingAuthorStub([]);
    setIsAuthorNameDialogOpen(false);
  }, [editor, editingAuthorBlockId, editingAuthorStub]);

  const handleRelatedArticleSelected = (article: any) => {
    if (editor && article) {
      const protocol = window.location.protocol;
      const base = selectedProperty?.domain || process.env.BRAND_URL || "";
      let absoluteBase = base.startsWith("http") ? base : `${protocol}//${base}`;
      if (absoluteBase.endsWith("/")) absoluteBase = absoluteBase.slice(0, -1);
      const url = `${absoluteBase}/${article.fullSlug || article.slug}`;
      
      editor.insertBlocks(
        [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "ये भी पढ़ें: ", styles: { bold: true, italic: true } },
              {
                type: "link",
                href: url,
                content: [{ type: "text", text: article.title, styles: { bold: true, italic: true } }]
              }
            ]
          } as any,
        ],
        editor.getTextCursorPosition().block,
        "after"
      );
    }
    setIsRelatedArticlePickerOpen(false);
  };

  const handlePollSelected = (poll: any) => {
    if (editor && poll) {
      editor.insertBlocks(
        [
          {
            type: "pollEmbed",
            props: {
              pollId: poll._id,
            },
          } as any,
        ],
        editor.getTextCursorPosition().block,
        "after"
      );
    }
    setIsPollPickerOpen(false);
  };

  useEffect(() => {
    if (editor) {
      setEditor(editor);
    }
    return () => setEditor(null);
  }, [editor, setEditor]);

  const applyGenerationResult = (result: GenerationJobResult['result']) => {
    if (!result || !editor) return;

    let { article: articleMarkdown, seo } = result;
    const generatedTags = (seo as Record<string, unknown>)?.tags || [];
    const generatedSlug = (seo as Record<string, unknown>)?.slug || "";
    const generatedEnglishHeadline = (seo as Record<string, unknown>)?.englishHeadline || "";
    const generatedFeaturedMedia = (seo as Record<string, unknown>)?.featuredMedia;
    const generatedImageUrl = (seo as Record<string, unknown>)?.imageUrl || "";

    // Extract title from the generated markdown (H1), JSON, or fall back to SEO title
    let generatedTitle = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsedJson: any = null;
    if (articleMarkdown.trim().startsWith('{')) {
      try {
        parsedJson = JSON.parse(articleMarkdown);
        generatedTitle = parsedJson.title || "";
 
        // Auto-populate recipe metadata if present in JSON and article is a recipe
        if (articleType === "recipe") {
          if (parsedJson.prepTime || parsedJson.cookTime || parsedJson.recipeCategory) {
            useEditorStore.getState().setRecipeData({
              prepTime: parsedJson.prepTime,
              cookTime: parsedJson.cookTime,
              totalTime: parsedJson.totalTime,
              recipeCategory: parsedJson.recipeCategory,
              recipeCuisine: parsedJson.recipeCuisine,
              ratingValue: "5",
              ratingCount: "1"
            });
          }

          // Extract actual article content
          if (parsedJson.article) {
            articleMarkdown = parsedJson.article;
          } else {
            // Fallback for older prompts or unexpected structures
            let md = parsedJson.introduction ? `${parsedJson.introduction}\n\n` : "";
            if (parsedJson.ingredients && Array.isArray(parsedJson.ingredients)) {
              md += "### Ingredients\n\n";
              parsedJson.ingredients.forEach((i: string) => md += `- ${i}\n`);
              md += "\n";
            }
            if (parsedJson.steps && Array.isArray(parsedJson.steps)) {
              md += "### Steps\n\n";
              parsedJson.steps.forEach((s: string, idx: number) => md += `${idx + 1}. ${s}\n`);
            }
            if (md) articleMarkdown = md;
          }
        }

        // Auto-populate movie review metadata if present in JSON and article is a movie review
        if (articleType === "movie_review" && (parsedJson.movieName || parsedJson.director || parsedJson.actors)) {
          useEditorStore.getState().setMovieReviewData({
            movieName: parsedJson.movieName || "",
            director: parsedJson.director || "",
            actors: parsedJson.actors || "",
            ratingValue: parsedJson.ratingValue || "8.5",
            ratingCount: parsedJson.ratingCount || "10",
            bestRating: parsedJson.bestRating || "10",
            reviewCount: parsedJson.reviewCount || "5"
          });

          // Extract actual article content
          if (parsedJson.article) {
            articleMarkdown = parsedJson.article;
          }
        }
      } catch (e) {
        console.error("JSON parse error in applyGenerationResult:", e);
      }
    }

    if (!generatedTitle) {
      const h1Match = articleMarkdown.match(/^#\s+(.+)$/m);
      generatedTitle = h1Match
        ? h1Match[1].replace(/\*\*/g, '').replace(/\*/g, '').trim()
        : ((seo as Record<string, unknown>)?.title as string) || "";
    }

    if (generatedTitle) {
      setArticleTitle(generatedTitle);
      useEditorStore.getState().setArticleTitle(generatedTitle);
    }

    // Title lives in the input box now — strip the leading H1 from the markdown
    // before converting to blocks so it doesn't render twice.
    const bodyMarkdown = articleMarkdown.replace(/^\s*#\s+.+\r?\n+/, '');

    setSeoData(seo);
    setTags((generatedTags as string[]) || []);
    setCategories([]);
    useEditorStore.getState().setSlug(generatedSlug as string);

    if (generatedEnglishHeadline) {
      useEditorStore.getState().setEnglishHeadline(generatedEnglishHeadline as string);
      useEditorStore.getState().setIsManualSlug(false);
    }

    if (generatedFeaturedMedia) {
      const media = generatedFeaturedMedia as { url: string; id?: string; _id?: string; path: string };
      useEditorStore
        .getState()
        .setImages([
          { url: media.url, id: media.id || media._id, path: media.path, alt: articleTitle, caption: "AI Generated" },
        ]);
    } else if (generatedImageUrl) {
      useEditorStore
        .getState()
        .setImages([{ url: generatedImageUrl as string, alt: articleTitle, caption: "AI Generated" }]);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let newBlocks: any[] = [];

    // Special handling for recipe blocks ONLY if we have explicit ingredients and steps in JSON
    if (articleType === "recipe" && parsedJson && parsedJson.ingredients && parsedJson.steps) {
      try {
        // Introduction
        if (parsedJson.introduction) {
          newBlocks.push({
            type: "paragraph",
            content: transformInlineContent(parsedJson.introduction)
          });
        }
        
        // Ingredients
        newBlocks.push({
          type: "heading",
          props: { level: 2 },
          content: transformInlineContent("Ingredients")
        });
        
        parsedJson.ingredients.forEach((ing: string) => {
          newBlocks.push({
            type: "recipeIngredient",
            props: { text: ing || "" }
          });
        });

        // Steps
        newBlocks.push({
          type: "heading",
          props: { level: 2 },
          content: transformInlineContent("Steps")
        });

        parsedJson.steps.forEach((step: string) => {
          newBlocks.push({
            type: "howToStep",
            props: { text: step || "" }
          });
        });
      } catch (e) {
        console.error("Error creating structured recipe blocks:", e);
      }
    }

    // Fallback to markdown-to-blocks if no structured blocks were created
    if (newBlocks.length === 0) {
      newBlocks = markdownToBlocks(bodyMarkdown, editor as any);
    }

    // Insert featured image at the top of the body (the title is now separate,
    // so there's no leading H1 to position after).
    const featuredUrl = (generatedFeaturedMedia as { url?: string })?.url || (generatedImageUrl as string);
    if (featuredUrl) {
      const insertAt = 0;
      const featuredBlock = {
        id: crypto.randomUUID(),
        type: "featuredImage",
        props: {
          url: getImageUrl(featuredUrl) ?? "",
          alt: generatedTitle || articleTitle,
          caption: "AI Generated",
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newBlocks.splice(insertAt, 0, featuredBlock as any);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.replaceBlocks(editor.document, newBlocks as any);
    toast.success(
      `${articleType.charAt(0).toUpperCase() + articleType.slice(1).replace("_", " ")} and SEO generated!`
    );
  };

  // Keep a ref so the polling interval always calls the latest version
  const applyGenerationResultRef = useRef(applyGenerationResult);
  applyGenerationResultRef.current = applyGenerationResult;

  // Poll for generation job status — useEffect is the single owner of the interval
  useEffect(() => {
    if (!generationJobId || !editor) return;

    setIsGenerating(true);
    setGenerationComplete(false);
    setGenerationError(null);
    let cancelled = false;

    const poll = async () => {
      try {
        const job = await getGenerationStatus(generationJobId);
        if (cancelled) return;

        if (job.status === 'completed') {
          setIsGenerating(false);
          setGenerationJobId(null);
          setGenerationComplete(true);
          if (job.result) {
            applyGenerationResultRef.current(job.result);
          }
          // Brief delay to show "Your article is ready!" before closing
          setTimeout(() => setIsWizardOpen(false), 800);
        } else if (job.status === 'failed') {
          setIsGenerating(false);
          setGenerationJobId(null);
          setGenerationError(job.error || "Article generation failed");
          toast.error(job.error || "Article generation failed");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[BlockNoteEditor] Polling error:", error);
        setIsGenerating(false);
        setGenerationJobId(null);
        setGenerationError("Failed to check generation status");
        toast.error("Failed to check generation status");
      }
    };

    // Poll immediately, then every 4s
    poll();
    const interval = setInterval(poll, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // Only re-run when jobId or editor changes — ref handles the rest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationJobId, editor]);

  // Warn the user if they try to close the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for legacy browsers; modern browsers show their own generic text.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleGenerateArticle = async (wizardTopic?: string, wizardLanguage?: string, wizardType?: string) => {
    const topic = wizardTopic || articleTitle;
    const lang = wizardLanguage || selectedLanguage;
    const type = wizardType || articleType;

    if (!topic.trim()) {
      toast.error(wizardTopic !== undefined
        ? "Please enter a topic to generate your article"
        : "Please add an H1 heading as the article title");
      return;
    }

    setIsGenerating(true);
    setGenerationComplete(false);
    setGenerationError(null);
    setIsWizardOpen(false); // Close dialog — GenerationOverlay handles the UI
    try {
      const { jobId } = await generateArticle(topic, lang, type);
      setGenerationJobId(jobId); // This triggers the useEffect which handles all polling
    } catch (error) {
      console.error("[BlockNoteEditor] Failed to start article generation:", error);
      toast.error("Failed to start article generation.");
      setIsGenerating(false);
      setGenerationError("Failed to start article generation.");
    }
  };

  const openVideoGenerator = useCallback(() => {
    const params = new URLSearchParams();
    if (currentArticleId) params.set("articleId", currentArticleId);
    if (articleTitle?.trim()) params.set("title", articleTitle.trim());
    const qs = params.toString();
    router.push(qs ? `/video-generator?${qs}` : "/video-generator");
  }, [router, currentArticleId, articleTitle]);

  const handleStopGeneration = async () => {
    if (!generationJobId) {
      setIsGenerating(false);
      return;
    }

    const loadingToast = toast.loading("Stopping generation...");
    try {
      await terminateGeneration(generationJobId);
      setGenerationJobId(null);
      setIsGenerating(false);
      setGenerationError("Generation stopped");
      toast.dismiss(loadingToast);
      toast.success("AI Generation stopped.");
    } catch (error) {
      console.error("[BlockNoteEditor] Failed to stop generation:", error);
      // Even if API fails, we stop UI polling and local state
      setGenerationJobId(null);
      setIsGenerating(false);
      setGenerationError("Generation stopped");
      toast.dismiss(loadingToast);
      toast.error("Process stopped in editor.");
    }
  };

  // Helper function to count characters in richBlocks
  const countRichBlocksCharacters = (blocks: unknown[]): number => {
    let totalChars = 0;
    blocks.forEach((block: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = block as any;
      if (b.content && Array.isArray(b.content)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        b.content.forEach((item: any) => {
          if (item.text) {
            totalChars += item.text.length;
          }
        });
      }
    });
    return totalChars;
  };

  // Helper function to check if blocks contain timestamp
  const hasTimestampBlock = (blocks: unknown[]): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return blocks.some((block: any) => block.type === "timestamp");
  };

  // Helper function to check if blocks contain video
  const hasVideoBlock = (blocks: unknown[]): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return blocks.some((block: any) =>
      block.type === "video" ||
      block.type === "videoEmbed" ||
      block.type === "youtubeEmbed" ||
      block.type === "twitterEmbed" ||
      block.type === "instagramEmbed" ||
      block.type === "snapchatEmbed"
    );
  };


  // Helper function to count image blocks
  const countImageBlocks = (blocks: unknown[]): number => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (blocks as any[]).filter((block: any) => block.type === "image").length;
  };

  const getValidationIssues = (editorBlocks: unknown[], currentType: string, currentStatus: string) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const currentTitle = useEditorStore.getState().articleTitle || articleTitle;
    if (!currentTitle || currentTitle.trim().length === 0) {
      errors.push("Article title is required");
    }

    if (!editorBlocks || !Array.isArray(editorBlocks) || editorBlocks.length === 0) {
      errors.push("Content cannot be empty");
    }

    if (slugStatus === 'taken' && status !== 'published') {
      errors.push("The URL (Slug) is already in use by another article. Please change the headline or URL.");
    }

    if (currentStatus === "published" || currentStatus === "scheduled") {
      if (!englishHeadline || englishHeadline.trim().length === 0) {
        errors.push("English Headline is required for URL generation");
      }
      if (!primaryCategory) {
        errors.push("Primary Category is required for publication");
      }
      if (!tags || tags.length === 0) {
        errors.push("At least one tag is required for publication");
      }
      if (!authors || authors.length === 0) {
        errors.push("At least one author is required for publication");
      }

      const { images } = useEditorStore.getState();
      if (!images || images.length === 0) {
        errors.push("Featured image is mandatory for all articles");
      }

      const totalCharacters = countRichBlocksCharacters(editorBlocks);

      if (currentType === "liveblog") {
        if (!hasTimestampBlock(editorBlocks)) {
          errors.push("Live blog must contain at least one timestamp block");
        }
      } else if (currentType === "video" || currentType === "shorts") {
        // Body video block is optional, but featured video is mandatory
        const { featuredVideo } = useEditorStore.getState();
        if (!featuredVideo || !featuredVideo.url) {
          errors.push(`Featured Video is required for ${articleTypeLabels[currentType].toLowerCase()} articles`);
        }
        if (!featuredVideo || !featuredVideo.duration) {
          errors.push(`Video Duration is required for featured video`);
        }
      } else if (currentType === "photo_story") {
        const imageCount = countImageBlocks(editorBlocks);
        if (imageCount < 2) {
          errors.push(`Photo story must contain at least 2 images (current: ${imageCount})`);
        }
      }
    }

    // SEO Recommendations (Warnings)
    const { seoData } = useEditorStore.getState();
    if (seoData) {
      if (seoData.title && seoData.title.length > 0) {
        if (seoData.title.length < 50) {
          warnings.push("Meta Title is too short (50-60 characters ideal)");
        } else if (seoData.title.length > 60) {
          warnings.push("Meta Title is too long (50-60 characters ideal)");
        }
      }

      if (seoData.description && seoData.description.length > 0) {
        if (seoData.description.length < 120) {
          warnings.push("Meta Description is too short (120-160 characters ideal)");
        } else if (seoData.description.length > 160) {
          warnings.push("Meta Description is too long (max 160 characters ideal)");
        }
      }
    }

    return { errors, warnings };
  };



  const handleSave = async (overrideStatus?: string) => {
    if (!editor) {
      toast.error("Editor not ready");
      return;
    }

    const editorBlocks = editor.document;
    const effectiveStatus = overrideStatus || status;

    // Guard: scheduled articles must have a scheduledAt date
    if (effectiveStatus === "scheduled" && !scheduledAt) {
      setIsScheduleDialogOpen(true);
      return;
    }

    // Validation check
    const { errors, warnings } = getValidationIssues(editorBlocks, articleType, effectiveStatus);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setValidationWarnings(warnings);
      setIsValidationDialogOpen(true);
      return;
    }

    try {
      // If not publishing or no current ID (meaning it's a first-time save as draft), proceed to save
      await performFinalSave(effectiveStatus);
    } catch (error) {
      console.error("[BlockNoteEditor] handleSave error:", error);
    }
  };

  const performFinalSave = async (effectiveStatus: string, silent: boolean = false) => {
    // Flush any debounced sync so the store reflects the latest doc before we read it.
    flushSyncRef.current?.();
    const editorBlocks = editor?.document || [];
    // Cancel any in-flight save; the newer request supersedes it.
    if (saveAbortRef.current) {
      saveAbortRef.current.abort();
    }
    const controller = new AbortController();
    saveAbortRef.current = controller;
    const editsAtStart = editCounterRef.current;
    try {
      setIsSaving(true);
      setSavingAs(effectiveStatus);

      // Title lives in the input box → store. No fallback to editor H1 anymore.
      const title = useEditorStore.getState().articleTitle || articleTitle;

      if (!title || title.trim().length === 0) {
        toast.error("Please provide an article title");
        setIsSaving(false);
        return;
      }

      let currentStatus = "active";
      const richBlocks = editorBlocks.map(
        (
          block: any,
          index: number
        ) => {
          // In live blog, blocks after a timestamp inherit its status
          if (block.type === "timestamp") {
            currentStatus = block.props?.status || "active";
          }

          // SANITIZE-ON-SAVE: Strip AI highlighting styles from the database payload.
          // This ensures the production DB remains clean while local highlights persist via localStorage.
          let sanitizedContent = block.content;
          if (Array.isArray(block.content)) {
            sanitizedContent = block.content.map((item: any) => {
              if (item.styles?.factCheck || item.styles?.contradiction) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { factCheck, contradiction, ...cleanStyles } = item.styles;
                return { ...item, styles: cleanStyles };
              }
              return item;
            });
          }

          // For pollEmbed blocks, store the pre-generated HTML directly in the content field.
          // This treats it like raw content that the backend can serve without specific conversion logic.
          if (block.type === "pollEmbed" && block.props?.pollId) {
            sanitizedContent = [
              {
                type: "text",
                text: `<div class="poll-widget" data-poll-id="${block.props.pollId}" data-template="template#2"></div>`,
                styles: {},
              },
            ];
          }

          return {
            id: block.id || `block-${index}`,
            type: block.type || "paragraph",
            content: sanitizedContent,
            metadata: { props: block.props, children: block.children },
            order: index,
            status: currentStatus,
          };
        }
      );

      const { user } = useAuthStore.getState();
      const { slug, images, featuredVideo } = useEditorStore.getState();

      const propertyId = selectedProperty?._id || user?.propertyId;
      if (!propertyId) {
        toast.error("No property selected. Please select a property first.");
        setIsSaving(false);
        return;
      }

      // Final title check using store title as fallback
      const finalTitle = (title || useEditorStore.getState().articleTitle || "").trim();
      if (!finalTitle) {
        toast.error("Please provide an article title");
        setIsSaving(false);
        return;
      }

      const articleData = {
        organizationId: user?.organizationId || "",
        propertyId,
        type: articleType,
        status: effectiveStatus || "draft",
        scheduledAt: effectiveStatus === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        coverageStartTime: articleType === "liveblog" ? useEditorStore.getState().coverageStartTime || null : undefined,
        coverageEndTime: articleType === "liveblog" ? useEditorStore.getState().coverageEndTime || null : undefined,
        lang: selectedLanguage,
        title: finalTitle,
        englishHeadline: englishHeadline || undefined,
        richBlocks,
        seo: seoData || undefined,
        tags: tags?.length ? tags : [],
        categories: categories || [],
        primaryCategory,
        authors: authors || [],
        slug: slug || undefined,
        featuredMedia:
          images && images.length > 0
            ? { path: images[0].path || "", id: images[0].id || "", url: images[0].url, alt: images[0].alt || "", caption: images[0].caption || "" }
            : undefined,
        featuredVideo: featuredVideo ? {
          path: featuredVideo.path || "",
          id: featuredVideo.id || "",
          url: featuredVideo.url,
          alt: featuredVideo.alt || "",
          caption: featuredVideo.caption || "",
          duration: featuredVideo.duration
        } : undefined,
        webStoryData: articleType === 'web_story' && useEditorStore.getState().webStoryData
          ? {
            slides: useEditorStore.getState().webStoryData!.slides.map((s: any) => ({
              templateId: s.templateId || "",
              templateData: s.templateData || {},
            })),
          }
          : undefined,
        currentArticleId,
        isSponsored: useEditorStore.getState().isSponsored,
        isPremium: useEditorStore.getState().isPremium,
        recipeData: articleType === "recipe" ? useEditorStore.getState().recipeData : undefined,
        movieReviewData: articleType === "movie_review" ? useEditorStore.getState().movieReviewData : undefined,
        ...(preserveUpdatedAt && currentArticleId ? { preserveUpdatedAt: true } : {}),
      };

      console.log("[BlockNoteEditor] Saving article with payload:", articleData);

      const response = await saveArticle(articleData, { signal: controller.signal });

      if (response && response._id) setCurrentArticleId(response._id);
      if (effectiveStatus) setStatus(effectiveStatus);
      if (!preserveUpdatedAt) {
        useEditorStore.getState().setArticleUpdatedAt(new Date().toISOString());
      }
      // Only mark clean if no edits landed while the save was in flight —
      // otherwise the saved payload is already stale and we need to stay dirty
      // so the next autosave picks up the newer content.
      if (editCounterRef.current === editsAtStart) {
        setIsDirty(false);
      } else {
        // Edits arrived mid-save. Kick off another autosave pass so the newer
        // content doesn't sit unsaved until the next keystroke.
        scheduleAutosaveRef.current?.();
      }
      if (!silent) {
        setIsValidationDialogOpen(false);
        if (effectiveStatus === "published") {
          const protocol = window.location.protocol;
          const base = selectedProperty?.domain || process.env.BRAND_URL || "";
          let absoluteBase = base.startsWith("http") ? base : `${protocol}//${base}`;
          if (absoluteBase.endsWith("/")) absoluteBase = absoluteBase.slice(0, -1);
          const url = `${absoluteBase}${primaryCategorySlug ? `/${primaryCategorySlug}` : ""}/${slug}`;
          setPublishedArticleUrl(url);
          setIsPublishSuccessDialogOpen(true);
        } else {
          toast.success(`Article "${title}" updated successfully!`);
        }
      }
    } catch (error) {
      // Aborted saves are expected when a newer save supersedes this one — stay quiet.
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("[BlockNoteEditor] Failed to save:", error);
      if (!silent) {
        toast.error("Failed to save article.");
      }
    } finally {
      // Only clear saving state if this controller is still the latest.
      if (saveAbortRef.current === controller) {
        saveAbortRef.current = null;
        setIsSaving(false);
        setSavingAs(null);
      }
    }
  };

  // Autosave — runs after a quiet period of edits. Only drafts with a persisted
  // article ID are autosaved; published/scheduled states require an explicit click.
  // Plain function (not useCallback) so the closure always sees the latest
  // performFinalSave, which itself closes over many component-local values.
  const runAutosave = async () => {
    if (!editor) return;
    if (!isDirtyRef.current) return;
    if (isSavingRef.current) return;
    const store = useEditorStore.getState();
    if (!store.currentArticleId) return;
    if (store.status !== "draft") return;
    if (store.generationJobId) return;

    // Title is required by the save pipeline; derive from first heading if store is empty.
    let title = store.articleTitle || "";
    if (!title) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstHeading = editor.document.find((b: any) => b.type === "heading") as any;
      if (firstHeading && firstHeading.content) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = firstHeading.content as any;
        title = Array.isArray(content)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? content.map((c: any) => c.text || "").join("")
          : String(content);
      }
    }
    if (!title.trim()) return;

    try {
      await performFinalSave(store.status, true);
    } catch {
      // performFinalSave already swallows non-abort errors when silent=true.
    }
  };

  const runAutosaveRef = useRef(runAutosave);
  // Refresh the ref every render so the timeout always invokes the freshest closure.
  useEffect(() => { runAutosaveRef.current = runAutosave; });

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      runAutosaveRef.current?.();
    }, 2000);
  }, []);
  useEffect(() => { scheduleAutosaveRef.current = scheduleAutosave; }, [scheduleAutosave]);

  // Clean up any pending autosave timer and in-flight save on unmount.
  // Flush pending debounced sync so the store isn't left stale.
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        runSyncRef.current?.();
      }
      if (saveAbortRef.current) saveAbortRef.current.abort();
    };
  }, []);

  const handleConfirmPublish = () => {
    // No-op
  };

  const handleExportHTML = async () => {
    if (!editor) return;
    try {
      const html = await editor.blocksToHTMLLossy(editor.document);
      if (!html || html.trim().length === 0) {
        toast.error("No content");
        return;
      }
      exportToHTML(html, extractFilename(await editor.blocksToMarkdownLossy(editor.document)));
      toast.success("Exported as HTML!");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleExportPDF = async () => {
    if (!editor) return;
    try {
      const markdown = await editor.blocksToMarkdownLossy(editor.document);
      if (!markdown || markdown.trim().length === 0) {
        toast.error("No content");
        return;
      }
      await exportToPDF(markdown, extractFilename(markdown));
      toast.success("Exported as PDF!");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleExportWord = async () => {
    if (!editor) return;
    try {
      const markdown = await editor.blocksToMarkdownLossy(editor.document);
      if (!markdown || markdown.trim().length === 0) {
        toast.error("No content");
        return;
      }
      await exportToWord(markdown, extractFilename(markdown));
      toast.success("Exported as Word!");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleNewArticle = () => {
    setIsNewArticleDialogOpen(true);
  };

  const confirmNewArticle = async () => {
    setIsNewArticleDialogOpen(false);
    try {
      const { user } = useAuthStore.getState();
      const { selectedProperty } = usePropertyStore.getState();
      if (!user) {
        toast.error("Login required");
        return;
      }

      if (currentArticleId) {
        localStorage.removeItem(`odin_cms_fc_${currentArticleId}`);
      }
      resetEditor();
      setCurrentArticleId(null);
      setArticleTitle("");
      setStatus("draft");

      // Update local authors state immediately
      setAuthors([{
        id: user.id,
        name: user.name,
        slug: user.slug || ""
      }]);

      if (editor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.replaceBlocks(editor.document, defaultBlocks as any);
        // Insert deferred featuredImage block after ProseMirror settles
        setTimeout(() => {
          try {
            const document = editor.document;
            defaultDeferredEmbeds.forEach((embed) => {
              if (embed.index < document.length) {
                const placeholderBlock = document[embed.index];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                editor.updateBlock(placeholderBlock, {
                  type: embed.type,
                  props: embed.props,
                } as any);
              }
            });
          } catch (err) {
            console.error("[BlockNoteEditor] Failed to insert deferred embeds on new article:", err);
          }
        }, 100);
      }

      let organizationId = user.organizationId;
      if (!organizationId) {
        try {
          organizationId =
            ((user as Record<string, unknown>).orgId as string) || (await getOrganizationDetails()).data._id;
        } catch (e) {
          console.error("Failed to get org ID", e);
        }
      }
      if (!organizationId) {
        toast.error("Could not get Organization ID");
        return;
      }

      const response = await saveArticle({
        title: "",
        richBlocks: [
          {
            id: crypto.randomUUID(),
            type: "heading",
            content: [],
            metadata: { props: { level: 1 }, children: [] },
            order: 0,
          },
        ],
        status: "draft",
        organizationId,
        propertyId: selectedProperty?._id || user.propertyId,
        type: "article",
        lang: selectedLanguage,
        authors: [{
          id: user.id,
          name: user.name,
          slug: user.slug || ""
        }]
      });

      const articleId = response._id || response.data?._id;
      if (articleId) {
        setCurrentArticleId(articleId);
        toast.success("New article started");
        router.push(`/editor/${articleId}`);
      }
    } catch (error) {
      console.error("Failed to create article:", error);
      toast.error("Failed to create article");
    }
  };

  const handleMediaSelectedFromPicker = (files: { url: string; id: string; path: string; mimeType?: string }[]) => {
    // If replacing an existing image block, update it in place instead of inserting
    if (imageBlockReplaceTargetId && editor && files.length > 0) {
      const fileUrl = getImageUrl(files[0].url) ?? "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.updateBlock(imageBlockReplaceTargetId as any, { props: { url: fileUrl } } as any);
      setImageBlockReplaceTargetId(null);
      toast.success("Image replaced!");
      return;
    }

    if (articleType === "web_story") {
      const {
        webStoryPickTarget,
        activeSlideId,
        addElement,
        setSelectedElementId,
        updateSlide
      } = useEditorStore.getState() as any;

      if (!activeSlideId) return;

      if (webStoryPickTarget === "background" && files.length > 0) {
        const fileUrl = getImageUrl(files[0].url) ?? "";
        updateSlide(activeSlideId, {
          background: { type: "image", content: fileUrl }
        });
        toast.success("Background updated!");
        return;
      }

      files.forEach((file) => {
        const fileUrl = getImageUrl(file.url) ?? "";
        const isVideo = file.mimeType?.startsWith("video/");
        const newId = crypto.randomUUID();

        const newElement = {
          id: newId,
          type: isVideo ? "video" : "image",
          content: fileUrl,
          x: 20,
          y: 20,
          width: 60,
          height: 40,
          rotation: 0,
          opacity: 1,
          zIndex: 1,
          style: isVideo ? {} : { borderRadius: 0 },
          animation: { type: "fade-in", duration: 1, delay: 0 }
        };

        addElement(activeSlideId, newElement);
        setSelectedElementId(newId);
      });

      toast.success(`${files.length} item(s) added to slide!`);
      return;
    }

    if (editor && files.length > 0) {
      const cursorPosition = editor.getTextCursorPosition();
      let targetBlock = cursorPosition.block;

      // Insert all media files one by one
      files.forEach((file, index) => {
        const fileUrl = getImageUrl(file.url) ?? "";

        let blocksToInsert: any[];

        if (articleType === "photo_story") {
          // Calculate slide index based on current image count
          const currentImages = editor.document.filter(b => b.type === "image");
          const startIndex = currentImages.length + 1;
          blocksToInsert = getPhotoStorySlideBlocks(fileUrl, startIndex + index);
        } else {
          const isVideo = file.mimeType?.startsWith("video/");
          blocksToInsert = isVideo
            ? [{ type: "videoEmbed", props: { url: fileUrl, caption: "" } }]
            : [{ type: "image", props: { url: fileUrl } }];
        }

        // Insert media block(s)
        const insertedBlocks = editor.insertBlocks(blocksToInsert, targetBlock, "after");

        // Update target block for next item (if any)
        if (insertedBlocks && insertedBlocks.length > 0) {
          targetBlock = insertedBlocks[insertedBlocks.length - 1] as any;
        }
      });

      toast.success(`${files.length} item(s) inserted!`);
    }
  };

  // Handle featured image selection from slash command or block click
  // Helper: sync the featuredImage block in the editor with a given url/alt/caption
  const syncFeaturedImageBlock = useCallback((url: string, alt: string, caption: string) => {
    if (!editor) return;
    // Use requestAnimationFrame to avoid updating during React render cycles
    requestAnimationFrame(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const featuredBlock = editor.document.find((b: any) => b.type === "featuredImage");
      if (featuredBlock) {
        editor.updateBlock(featuredBlock, {
          type: "featuredImage",
          props: { url, alt, caption },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
    });
  }, [editor]);

  const handleFaqSelected = (faq: FAQ) => {
    if (!editor) return;

    const currentBlock = editor.getTextCursorPosition().block;

    editor.insertBlocks(
      [
        {
          type: "faqEmbed",
          props: {
            faqId: faq._id,
            question: faq.question,
            answer: faq.answer,
          },
        } as any,
      ],
      currentBlock,
      "after"
    );
  };


  // Helper to trigger link toolbar on click
  useEffect(() => {
    if (!editor) return;
    const editorElement = document.querySelector(".blocknote-editor");
    if (!editorElement) return;

    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const mouseEvent = e as MouseEvent;
      const link = target.closest("a");
      if (link) {
        e.preventDefault();
        setTimeout(() => {
          const tiptap = (editor as any)._tiptapEditor;
          if (tiptap) {
            tiptap.commands.extendMarkRange("link");
            editor.focus();
          }
        }, 10);
      }
    };

            const handleLinkMouseOver = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link) {
        const tiptap = (editor as any)._tiptapEditor;
        if (tiptap) {
          try {
            const pos = tiptap.view.posAtDOM(link, 0);
            if (pos !== undefined) {
              // Place the cursor exactly inside the link
              // A point selection (cursor) triggers the Link Toolbar
              // A range selection triggers the Formatting Toolbar
              tiptap.commands.setTextSelection(pos + 1);
            }
          } catch (err) {}
        }
      }
    };

    editorElement.addEventListener("mouseover", handleLinkMouseOver, true);
    editorElement.addEventListener("click", handleLinkClick);
    return () => {
      editorElement.removeEventListener("mouseover", handleLinkMouseOver, true);
      editorElement.removeEventListener("click", handleLinkClick);
    };
  }, [editor]);

  const handleLinkEditSubmit = (url: string, text: string) => {
    if (!editor) return;

    const tiptap = (editor as any)._tiptapEditor;
    if (tiptap) {
      // Extend the selection to the entire link mark so createLink replaces it
      tiptap.commands.extendMarkRange("link");
    }

    editor.createLink(url, text);
    editor.focus();
  };

  const handleCreateLinkClick = () => {
    if (!editor) return;
    const selectedText = editor.getSelectedText();
    setLinkEditData({ url: "", text: selectedText });
    setIsLinkEditOpen(true);
  };

  const handleFeaturedImageSelected = async (images: { url: string; id: string; path: string }[]) => {
    if (images.length === 0) return;
    const image = images[0]; // Only use first image
    const { setImages, seoData } = useEditorStore.getState();
    const altText = seoData?.title || "Featured Image";

    const refitted = await refitToFeaturedAspect(image, articleType, selectedProperty?._id);
    const finalImage = { url: getImageUrl(refitted.url) ?? "", id: refitted.id, path: refitted.path };

    // Set as featured image in the store (syncs with SeoTab)
    setImages([{
      url: finalImage.url,
      id: finalImage.id,
      path: finalImage.path,
      alt: altText,
      caption: ""
    }]);

    // Sync the featuredImage block in the editor
    syncFeaturedImageBlock(finalImage.url, altText, "");

    toast.success("Featured image updated!");

    if (images.length > 1) {
      toast.info("Only the first image was set as featured image");
    }
  };


  // Heavy work triggered by edits — block walking, title sync, store writes.
  // Runs debounced so typing stays smooth; flushed before save and on unmount.
  const runSync = () => {
    if (!editor) return;
    const editorBlocks = editor.document;

    // Convert any standard "video" or "file" blocks (with video URLs) to custom
    // "videoEmbed" blocks for preview. Handles drag-and-drop uploads where
    // BlockNote auto-creates standard video/file blocks.
    const videoExtPattern = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editorBlocks.forEach((block: any) => {
      const url = block.props?.url || "";
      const isVideoBlock = block.type === "video" && url;
      const isFileBlockWithVideo = block.type === "file" && url && videoExtPattern.test(url);
      if (isVideoBlock || isFileBlockWithVideo) {
        try {
          editor.updateBlock(block, {
            type: "videoEmbed",
            props: {
              url,
              caption: block.props.caption || "",
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        } catch {
          // Ignore — block may not be ready yet
        }
      }
    });

    const mappedBlocks = editorBlocks.map(
      (
        block: { id?: string; type?: string; content: unknown; props: unknown; children: unknown },
        index: number
      ) => ({
        id: block.id || `block-${index}`,
        type: block.type || "paragraph",
        content: block.content,
        metadata: { props: block.props, children: block.children },
        order: index,
      })
    );
    setBlocks(mappedBlocks as Block[]);

    // Recompute word count / reading time alongside block sync so both the
    // editor footer and the SEO tab stay in lockstep with the content.
    setArticleStats(computeArticleStats(editorBlocks));
  };

  // Refresh the ref every render so the timeout always invokes the freshest closure.
  useEffect(() => { runSyncRef.current = runSync; });

  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      runSyncRef.current?.();
    }, 250);
  }, []);

  const flushSync = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
      runSyncRef.current?.();
    }
  }, []);
  useEffect(() => { flushSyncRef.current = flushSync; }, [flushSync]);

  // Seed stats on initial load — runSync only fires on edits, so an article
  // that's just opened would show "0 words" until the user starts typing.
  useEffect(() => {
    if (!editor) return;
    setArticleStats(computeArticleStats(editor.document));
  }, [editor, setArticleStats]);

  const handleEditorChange = useCallback(() => {
    setIsDirty(true);
    editCounterRef.current += 1;
    scheduleAutosave();
    scheduleSync();
  }, [scheduleAutosave, scheduleSync]);

  // Keep the input's local draft in sync with external title updates (article
  // load, AI generation, type-switch). User typing doesn't fight this because
  // the effect only runs when articleTitle actually changes.
  useEffect(() => {
    setTitleDraft(articleTitle || "");
  }, [articleTitle]);

  const syncTitle = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed === (useEditorStore.getState().articleTitle || "")) return;
    setArticleTitle(trimmed);
    setIsDirty(true);
    editCounterRef.current += 1;
    scheduleAutosave();
  }, [setArticleTitle, scheduleAutosave]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        .blocknote-editor a, 
        .blocknote-editor .bn-link,
        .blocknote-editor [data-link-url],
        .blocknote-editor [data-link],
        .blocknote-editor [href],
        .bn-container a,
        .bn-container [data-link-url] {
          color: #2563eb !important;
          text-decoration: underline !important;
          text-decoration-color: #2563eb !important;
          cursor: pointer !important;
        }
        .blocknote-editor a *, 
        .bn-container a * {
          color: inherit !important;
          text-decoration: inherit !important;
        }
      `}} />
      <CardHeader key="editor-card-header" className="pt-2 pb-1 space-y-2">
        {/* Row 1: Keep modified date (left) + Type/Category/AI (right) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {currentArticleId ? (
            <div className="flex items-center gap-3 min-w-0">
              {articleUpdatedAt && (
                <div className="hidden sm:flex flex-col">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider leading-none">Last modified</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {new Date(articleUpdatedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}{" "}
                    {new Date(articleUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Switch
                  checked={preserveUpdatedAt}
                  onCheckedChange={setPreserveUpdatedAt}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap"><span className="hidden xl:inline">Do Not Update Modified Date</span><span className="xl:hidden">Keep Date</span></span>
              </label>
            </div>
          ) : <div />}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {status === "published" ? (
              <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 border rounded-md bg-muted/30 text-[11px] sm:text-xs font-medium h-9 sm:h-10 w-auto min-w-[100px] sm:min-w-[120px] xl:w-[150px] cursor-default border-dashed border-muted-foreground/20">
                <Newspaper className="h-4 w-4 opacity-70 shrink-0" />
                <span className="truncate">{articleTypeLabels[articleType] || articleType}</span>
              </div>
            ) : (
              <Select value={articleType} onValueChange={(type) => {
                const prevType = articleType;
                setArticleType(type);

                // Use a short delay to ensure editor instance and React state are synchronized
                // before performing document mutations. This prevents ProseMirror "descAt" errors.
                setTimeout(() => {
                  if (!editor) return;
                  const currentDocument = editor.document;

                  // Handle conversions between article types for existing content
                  if (!isEditorEmpty(currentDocument)) {
                    // When switching FROM liveblog TO article: flatten content by removing timestamps
                    if (type === "article" && prevType === "liveblog") {
                      const contentBlocks = currentDocument.filter(b => b.type !== "timestamp");
                      editor.replaceBlocks(currentDocument, contentBlocks);
                      toast.info("Converted to article (removed timestamps)");
                    }
                    // When switching FROM article TO liveblog: ensure at least one timestamp exists
                    else if (type === "liveblog" && prevType === "article") {
                      const hasTimestamp = currentDocument.some(b => b.type === "timestamp");
                      if (!hasTimestamp) {
                        const { user: currentUser } = useAuthStore.getState();
                        editor.insertBlocks(
                          [{
                            type: "timestamp",
                            props: {
                              timestamp: new Date().toISOString(),
                              authorName: currentUser?.name || "",
                              authorId: currentUser?.id || "",
                              authorSlug: currentUser?.slug || ""
                            }
                          } as any],
                          currentDocument[0],
                          "after"
                        );
                        toast.info("Converted to live blog (added initial timestamp)");
                      }
                    }
                    // When switching TO recipe
                    else if (type === "recipe") {
                      const hasIngredients = currentDocument.some((b: any) =>
                        b.type === "recipeIngredient" ||
                        (b.type === "heading" && (b.content?.[0] as any)?.text?.match(/Ingredients|सामग्री/i))
                      );
                      const hasInstructions = currentDocument.some((b: any) =>
                        b.type === "howToStep" ||
                        (b.type === "heading" && (b.content?.[0] as any)?.text?.match(/Steps|Instructions|विधि|बनाने/i))
                      );

                      const title = currentDocument[0]?.type === "heading" ? (currentDocument[0].content?.[0] as any)?.text || "" : "";
                      const isHindi = title.match(/[^\x00-\x7F]/);

                      const newRecipeBlocks: any[] = [];
                      if (!hasIngredients) {
                        newRecipeBlocks.push(
                          { type: "heading", props: { level: 2 }, content: [{ type: "text", text: isHindi ? "सामग्री" : "Ingredients", styles: {} }] } as any,
                          { type: "recipeIngredient", props: { text: isHindi ? "सामग्री 1" : "Ingredient 1" } } as any
                        );
                      }
                      if (!hasInstructions) {
                        newRecipeBlocks.push(
                          { type: "heading", props: { level: 2 }, content: [{ type: "text", text: isHindi ? "विधि" : "Preparation Steps", styles: {} }] } as any,
                          { type: "howToStep", props: { text: isHindi ? "चरण 1" : "Step 1" } } as any
                        );
                      }

                      if (newRecipeBlocks.length > 0) {
                        try {
                          const lastBlock = currentDocument[currentDocument.length - 1];
                          editor.insertBlocks(newRecipeBlocks, lastBlock, "after");
                          toast.info(`Added structured sections for Recipe`);
                        } catch (err) {
                          console.error("[BlockNoteEditor] Failed to proactively add recipe blocks:", err);
                          // Fallback: If insertion fails (e.g. descAt error) and doc is very short, try fresh template
                          if (currentDocument.length <= 3) {
                            const { user: currentUser } = useAuthStore.getState();
                            const templateUser = currentUser ? { name: currentUser.name, id: currentUser.id, slug: currentUser.slug || "" } : null;
                            const template = getTemplateBlocks(type, templateUser);
                            const { blocks: processedBlocks } = processTemplateBlocks(template);
                            editor.replaceBlocks(currentDocument, processedBlocks as any);
                          }
                        }
                      }
                    }
                    // When switching TO movie_review
                    else if (type === "movie_review") {
                      const hasRating = currentDocument.some((b: any) =>
                        (b.type === "paragraph" || b.type === "heading") &&
                        (b.content?.[0] as any)?.text?.match(/Rating|रेटिंग/i)
                      );

                      if (!hasRating) {
                        const title = currentDocument[0]?.type === "heading" ? (currentDocument[0].content?.[0] as any)?.text || "" : "";
                        const isHindi = title.match(/[^\x00-\x7F]/);

                        try {
                          const lastBlock = currentDocument[currentDocument.length - 1];
                          editor.insertBlocks(
                            [
                              { type: "heading", props: { level: 2 }, content: [{ type: "text", text: isHindi ? "रेटिंग" : "Rating", styles: {} }] } as any,
                              { type: "paragraph", content: [{ type: "text", text: isHindi ? "रेटिंग: 4/5" : "Rating: 4/5", styles: { bold: true } }] } as any
                            ],
                            lastBlock,
                            "after"
                          );
                          toast.info("Added Rating section for Movie Review");
                        } catch (err) {
                          console.error("[BlockNoteEditor] Failed to proactively add movie review blocks:", err);
                          // Fallback for short docs
                          if (currentDocument.length <= 3) {
                            const { user: currentUser } = useAuthStore.getState();
                            const templateUser = currentUser ? { name: currentUser.name, id: currentUser.id, slug: currentUser.slug || "" } : null;
                            const template = getTemplateBlocks(type, templateUser);
                            const { blocks: processedBlocks } = processTemplateBlocks(template);
                            editor.replaceBlocks(currentDocument, processedBlocks as any);
                          }
                        }
                      }
                    }
                  }

                  if (isEditorEmpty(currentDocument)) {
                    const { user: currentUser } = useAuthStore.getState();
                    const templateUser = currentUser ? { name: currentUser.name, id: currentUser.id, slug: currentUser.slug || "" } : null;
                    const template = getTemplateBlocks(type, templateUser);

                    // Preserve existing heading content if any
                    const firstBlock = currentDocument[0] as any;
                    if (firstBlock && firstBlock.type === "heading" && Array.isArray(firstBlock.content) && firstBlock.content.length > 0) {
                      const firstTemplateBlock = template[0] as any;
                      if (firstTemplateBlock && firstTemplateBlock.type === "heading") {
                        firstTemplateBlock.content = firstBlock.content;
                      }
                    }

                    const { blocks: processedBlocks, deferredEmbeds: embeds } = processTemplateBlocks(template);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    editor.replaceBlocks(currentDocument, processedBlocks as any);

                    // Auto-open media picker for Photo Story
                    if (type === "photo_story") {
                      setTimeout(() => setIsImagePickerOpen(true), 150);
                    }

                    // Insert deferred custom blocks after ProseMirror settles
                    if (embeds.length > 0) {
                      setTimeout(() => {
                        try {
                          const finalDoc = editor.document;
                          embeds.forEach((embed) => {
                            if (embed.index < finalDoc.length) {
                              const placeholderBlock = finalDoc[embed.index];
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              editor.updateBlock(placeholderBlock, {
                                type: embed.type,
                                props: embed.props,
                                content: embed.content || undefined,
                              } as any);
                            }
                          });
                        } catch (err) {
                          console.error("[BlockNoteEditor] Failed to insert deferred template embeds:", err);
                        }
                      }, 100);
                    }
                  }
                }, 50);
              }}>
                <SelectTrigger className="w-auto min-w-[100px] sm:min-w-[120px] xl:w-[150px] h-9 sm:h-10 text-xs sm:text-sm">
                  <Newspaper className="h-4 w-4 mr-1.5 sm:mr-2 opacity-70" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Type</SelectLabel>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="recipe">Recipe</SelectItem>
                    <SelectItem value="movie_review">Movie Review</SelectItem>
                    <SelectItem value="liveblog">Live Blog</SelectItem>
                    <SelectItem value="explainer">Explainer</SelectItem>
                    <SelectItem value="photo_story">Photo Story</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="shorts">Shorts</SelectItem>
                    <SelectItem value="web_story">Web Story</SelectItem>
                    <SelectItem value="opinion">Opinion</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <CategoryNameSelector
              selected={categories || []}
              onChange={async (selectedCategories) => {
                setCategories(selectedCategories);
                if (selectedCategories.length === 0) {
                  setPrimaryCategory(null);
                  setPrimaryCategorySlug(null);
                } else if (!primaryCategory || !selectedCategories.includes(primaryCategory)) {
                  const categoryId = selectedCategories[0];
                  setPrimaryCategory(categoryId);
                  try {
                    const details = await getCategoryById(categoryId);
                    if (details) setPrimaryCategorySlug(details.fullSlug || details.slug || null);
                  } catch { }
                }
              }}
              placeholder="Categories..."
              className="w-auto min-w-[140px] max-w-[220px] h-9 sm:h-10 text-xs sm:text-sm"
              compact
              maxDisplayed={1}
            />
            {categoryOptions.length > 0 && categories && categories.length > 1 && (
              <Combobox
                options={categoryOptions.filter(opt => (categories || []).includes(opt.value))}
                value={primaryCategory || undefined}
                onChange={async (val) => {
                  setPrimaryCategory(val);
                  const cat = categoryOptions.find(opt => opt.value === val);
                  if (cat) {
                    try {
                      const details = await getCategoryById(cat.value);
                      if (details) setPrimaryCategorySlug(details.fullSlug || details.slug || null);
                    } catch { }
                  }
                }}
                placeholder="Primary category"
                searchPlaceholder="Search..."
                className="w-auto min-w-[140px]"
                buttonClassName="h-9 sm:h-10 text-xs sm:text-sm"
                direction="down"
              />
            )}
            <RainbowButton
              onClick={() => setIsWizardOpen(true)}
              size="sm"
              disabled={!["article", "recipe", "movie_review"].includes(articleType)}
              className={`sm:h-10 sm:px-6 sm:text-sm overflow-hidden transition-all duration-300 ${isGenerating ? 'ring-2 ring-red-500/50' : ''}`}
              title={!["article", "recipe", "movie_review"].includes(articleType) ? "AI Generation is only available for Article, Recipe, and Movie Review types" : "Generate with AI"}
            >
              {isGenerating ? (
                <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2 fill-current" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">{isGenerating ? "Generating..." : "Generate with AI"}</span>
            </RainbowButton>
            <Button
              size="sm"
              variant="outline"
              onClick={openVideoGenerator}
              className="sm:h-10 sm:px-4 sm:text-sm"
              title="Launch native video generator"
            >
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Generate Video</span>
            </Button>
          </div>
        </div>
        {/* Row 2: Status + Draft, Schedule, Publish, New */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${status === "published"
            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
            : status === "scheduled"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
            }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === "published" ? "bg-green-500" : status === "scheduled" ? "bg-purple-500" : "bg-amber-500"
              }`} />
            {status || "draft"}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Switch
                checked={isSponsored}
                onCheckedChange={setIsSponsored}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">Sponsored</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Switch
                checked={isPremium}
                onCheckedChange={setIsPremium}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">Premium</span>
            </label>
            <span className="w-px h-5 bg-border" />
            <Button
              size="sm"
              onClick={() => handleSave("draft")}
              disabled={isSaving}
              className={`h-8 px-3 gap-1 ${isDirty || status === "draft"
                ? "bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-sm"
                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-0 font-medium dark:text-amber-400 dark:bg-amber-500/15 dark:hover:bg-amber-500/25"}`}
              variant={isDirty || status === "draft" ? "default" : "outline"}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {savingAs === "draft" ? "Saving..." : isDirty ? "Save Draft" : "Draft"}
              </span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsScheduleDialogOpen(true)}
              className={`h-8 px-3 gap-1 ${status === "scheduled"
                ? "bg-purple-500 hover:bg-purple-600 text-white font-medium shadow-sm"
                : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-0 font-medium dark:text-purple-400 dark:bg-purple-500/15 dark:hover:bg-purple-500/25"}`}
              variant={status === "scheduled" ? "default" : "outline"}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {status === "scheduled" && scheduledAt
                  ? new Date(scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                  : "Schedule"}
              </span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave("published")}
              disabled={isSaving}
              className={`h-8 px-3 gap-1 ${status === "published"
                ? "bg-green-500 hover:bg-green-600 text-white font-medium shadow-sm"
                : "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-0 font-medium dark:text-green-400 dark:bg-green-500/15 dark:hover:bg-green-500/25"}`}
              variant={status === "published" ? "default" : "outline"}
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {savingAs === "published" ? "Publishing..." : "Publish"}
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportHTML}>
                  <Globe className="w-4 h-4 mr-2" />
                  HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportWord}>
                  <FileType className="w-4 h-4 mr-2" />
                  Word
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              className="h-8 px-3 gap-1 bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20 border-0 font-medium dark:text-cyan-400 dark:bg-cyan-500/15 dark:hover:bg-cyan-500/25"
              variant="outline"
              disabled={!slug}
              onClick={() => {
                const protocol = window.location.protocol;
                const base = selectedProperty?.domain || process.env.BRAND_URL || "";
                let absoluteBase = base.startsWith("http") ? base : `${protocol}//${base}`;
                if (absoluteBase.endsWith("/")) absoluteBase = absoluteBase.slice(0, -1);
                const url = `${absoluteBase}${primaryCategorySlug ? `/${primaryCategorySlug}` : ""}/${slug}`;
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Preview</span>
            </Button>
            <Button
              onClick={handleNewArticle}
              size="sm"
              className="h-8 px-3 gap-1 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-0 font-medium dark:text-blue-400 dark:bg-blue-500/15 dark:hover:bg-blue-500/25"
              variant="outline"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">New</span>
            </Button>
          </div>
        </div>
        <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Schedule Article</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Publish Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; })()}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setScheduledAt("");
                  setIsScheduleDialogOpen(false);
                  handleSave("draft");
                }}
              >
                Clear
              </Button>
              <Button
                size="sm"
                disabled={!scheduledAt || isSaving}
                onClick={() => {
                  setIsScheduleDialogOpen(false);
                  handleSave("scheduled");
                }}
              >
                {savingAs === "scheduled" ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isNewArticleDialogOpen} onOpenChange={setIsNewArticleDialogOpen}>
          <DialogContent className="sm:max-w-sm" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmNewArticle(); } }}>
            <DialogHeader>
              <DialogTitle>Start New Article?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Unsaved changes will be lost.</p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsNewArticleDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmNewArticle}>
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent
        key={`editor-content-${articleType}`}
        ref={editorContainerRef}
        className={`flex-1 min-h-0 relative ${articleType === "liveblog" || articleType === "web_story" ? "!p-0 overflow-hidden" : "overflow-y-auto"}`}
      >
        {isGenerating && <GenerationOverlay onCancel={handleStopGeneration} />}
        {articleType !== "liveblog" && articleType !== "web_story" && (
          <ImageBlockOverlay
            editorContainerRef={editorContainerRef}
            onEdit={(blockId, url) => setImageBlockEditTarget({ blockId, url })}
            onReplace={(blockId) => {
              setImageBlockReplaceTargetId(blockId);
              setIsImagePickerOpen(true);
            }}
          />
        )}
        {articleType === "liveblog" ? (
          <LiveBlogEditor
            key="live-blog-editor"
            editor={editor}
            embedsReady={embedsInserted}
            onSave={handleSave}
            onImagePick={() => setIsImagePickerOpen(true)}
          />
        ) : articleType === "web_story" ? (
          <WebStoryEditor
            key="web-story-editor"
            editor={editor}
            onSave={handleSave}
            onImagePick={() => setIsImagePickerOpen(true)}
          />
        ) : articleType === "recipe" ? (
          <RecipeEditor
            editor={editor}
            theme={theme}
            titleDraft={titleDraft}
            setTitleDraft={setTitleDraft}
            syncTitle={syncTitle}
            setIsDirty={setIsDirty}
            editCounterRef={editCounterRef}
            scheduleAutosave={scheduleAutosave}
            handleEditorChange={handleEditorChange}
            setIsImagePickerOpen={setIsImagePickerOpen}
            setIsFeaturedImagePickerOpen={setIsFeaturedImagePickerOpen}
            setIsFaqPickerOpen={setIsFaqPickerOpen}
            setIsPollPickerOpen={setIsPollPickerOpen}
            handleTwitterEmbed={handleTwitterEmbed}
            handleYouTubeEmbed={handleYouTubeEmbed}
            handleInstagramEmbed={handleInstagramEmbed}
            handleSoundCloudEmbed={handleSoundCloudEmbed}
            handleSnapchatEmbed={handleSnapchatEmbed}
            handleVideoEmbed={handleVideoEmbed}
            articleStats={articleStats}
          />
        ) : (
          <div key="standard-editor-wrapper" className="">
            {/* Align with .bn-editor's 54px inline padding so the title input
                matches the width of the editor content below. */}
            <div className="pt-3 pb-2 px-[54px]">
              <Input
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  // Mark dirty + schedule autosave per keystroke so tab-close
                  // and autosave work even before the user blurs the input.
                  setIsDirty(true);
                  editCounterRef.current += 1;
                  scheduleAutosave();
                }}
                onBlur={() => syncTitle(titleDraft)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    syncTitle(titleDraft);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Enter article title..."
                className="h-10 text-lg font-semibold border-dashed bg-transparent placeholder:text-muted-foreground/50"
              />
            </div>
            <BlockNoteView
              key={`blocknote-view-${articleType}`}
              editor={editor}
              theme={theme === "dark" ? "dark" : "light"}
              className="blocknote-editor"
              onChange={handleEditorChange}
              slashMenu={false}
            >
              <SuggestionMenuController
                key="suggestion-menu-controller"
                triggerCharacter="/"
                getItems={async (query) => {
                  const { user } = useAuthStore.getState();
                  const items = [
                    ...getDefaultReactSlashMenuItems(editor).filter(
                      (item) => item.title !== "Image" && item.title !== "Video"
                    ),
                    getImagePickerSlashCommand(() => setIsImagePickerOpen(true)),
                    getFeaturedImageSlashCommand(() => setIsFeaturedImagePickerOpen(true)),
                    getTimestampSlashCommand(editor, user ? { id: user.id, name: user.name, slug: user.slug ?? "" } : null),
                    getTwitterSlashCommand(handleTwitterEmbed),
                    getYouTubeSlashCommand(handleYouTubeEmbed),
                    getInstagramSlashCommand(handleInstagramEmbed),
                    getSoundCloudSlashCommand(handleSoundCloudEmbed),
                    getSnapchatSlashCommand(handleSnapchatEmbed),
                    getVideoEmbedSlashCommand(handleVideoEmbed),
                    getFaqSlashCommand(() => setIsFaqPickerOpen(true)),
                    getPollSlashCommand(() => setIsPollPickerOpen(true)),
                    getRelatedArticleSlashCommand(() => setIsRelatedArticlePickerOpen(true)),
                  ];
                  return items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()));
                }}
              />
              <AiFormattingToolbar key="ai-formatting-toolbar" onLinkClick={handleCreateLinkClick} />
              <LinkToolbarController key={"link-toolbar-" + currentArticleId}
                linkToolbar={(props) => (
                  <LinkToolbar {...props}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        let linkText = editor.getSelectedText();
                        if (!linkText && editor.getTextCursorPosition().block && Array.isArray(editor.getTextCursorPosition().block.content)) {
                          const linkItem = (editor.getTextCursorPosition().block.content as any[]).find(
                            (item) => item.type === "link" && item.href === props.url
                          );
                          if (linkItem && Array.isArray(linkItem.content)) {
                            linkText = linkItem.content.map((c: any) => c.text || "").join("");
                          }
                        }
                        setLinkEditData({ url: props.url, text: linkText || "" });
                        setIsLinkEditOpen(true);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      className="h-8 px-2 text-xs gap-1.5 hover:bg-zinc-100 font-bold text-zinc-700"
                    >
                      <FileEdit className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <DeleteLinkButton {...props} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(props.url, "_blank")}
                      className="h-8 px-2 text-xs gap-1.5 hover:bg-zinc-100 font-bold text-zinc-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </LinkToolbar>
                )}
              />
            </BlockNoteView>
            <div className="mt-1 px-[54px] pb-2 pt-1.5 border-t border-border/40 flex items-center gap-3 text-[11px] text-muted-foreground/70 select-none">
              <span>
                <span className="font-medium text-muted-foreground">{articleStats.words.toLocaleString()}</span> {articleStats.words === 1 ? "word" : "words"}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="font-medium text-muted-foreground">{articleStats.readingMinutes}</span> min read
              </span>
            </div>
          </div>
        )}
      </CardContent>
      <ImagePickerDialog
        key="image-picker-dialog-regular"
        open={isImagePickerOpen}
        onOpenChange={(open) => {
          setIsImagePickerOpen(open);
          if (!open) setImageBlockReplaceTargetId(null);
        }}
        onImageSelected={handleMediaSelectedFromPicker}
        defaultAspectRatio={articleType === "web_story" || articleType === "shorts" ? "9:16" : "16:9"}
        galleryAspectRatio={articleType === "web_story" || articleType === "shorts" ? 9 / 16 : 16 / 9}
        allowedTypes={articleType === "shorts" ? "shorts" : "all"}
        orientation={articleType === "shorts" ? "portrait" : "landscape"}
      />
      <ImagePickerDialog
        key="image-picker-dialog-featured"
        open={isFeaturedImagePickerOpen}
        onOpenChange={setIsFeaturedImagePickerOpen}
        onImageSelected={handleFeaturedImageSelected}
        defaultAspectRatio={articleType === "web_story" || articleType === "shorts" ? "9:16" : "16:9"}
        galleryAspectRatio={articleType === "web_story" || articleType === "shorts" ? 9 / 16 : 16 / 9}
        cropConstraint={{ aspect: articleType === "web_story" || articleType === "shorts" ? 9 / 16 : 16 / 9, minWidth: 1200 }}
        allowedTypes="image"
        orientation={articleType === "web_story" || articleType === "shorts" ? "portrait" : "landscape"}
      />
      <ImageEditorDialog
        open={!!featuredImageEditorUrl}
        onOpenChange={(open) => { if (!open) setFeaturedImageEditorUrl(null); }}
        imageUrl={featuredImageEditorUrl || ""}
        cropConstraint={{ aspect: articleType === "web_story" ? 9 / 16 : 16 / 9, minWidth: 1200 }}
        onSave={async (blob) => {
          try {
            const file = new File([blob], "featured-image-edited.png", { type: "image/png" });
            // Source image already had watermark; don't re-stamp it
            const uploaded = await uploadFiles([file], false, undefined, undefined, undefined, true);
            if (uploaded.length > 0) {
              handleFeaturedImageSelected([{ url: uploaded[0].url, id: uploaded[0]._id, path: uploaded[0].path }]);
              setFeaturedImageEditorUrl(null);
            }
          } catch (err) {
            console.error("Failed to upload edited featured image:", err);
          }
        }}
      />
      <ImageEditorDialog
        open={!!imageBlockEditTarget}
        onOpenChange={(open) => { if (!open) setImageBlockEditTarget(null); }}
        imageUrl={imageBlockEditTarget?.url ? resolveEditableUrl(imageBlockEditTarget.url) : ""}
        onSave={async (blob) => {
          if (!imageBlockEditTarget || !editor) return;
          try {
            const file = new File([blob], "image-edited.png", { type: "image/png" });
            // Source image already had watermark; don't re-stamp it
            const uploaded = await uploadFiles([file], false, undefined, undefined, undefined, true);
            if (uploaded.length > 0) {
              const fileUrl = getImageUrl(uploaded[0].url) ?? "";
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              editor.updateBlock(imageBlockEditTarget.blockId as any, { props: { url: fileUrl } } as any);
              setImageBlockEditTarget(null);
              toast.success("Image updated!");
            }
          } catch (err) {
            console.error("Failed to upload edited image:", err);
            toast.error("Failed to save edited image");
          }
        }}
      />
      <DateTimePickerDialog
        key="date-time-picker-dialog"
        open={isDateTimePickerOpen}
        onOpenChange={(open) => {
          setIsDateTimePickerOpen(open);
          if (!open) {
            setEditingTimestampBlockId(null);
            setEditingTimestampDate(undefined);
          }
        }}
        onTimestampSelected={handleTimestampUpdate}
        initialDate={editingTimestampDate}
        isEditing={!!editingTimestampBlockId}
      />
      <Dialog
        key="author-name-dialog"
        open={isAuthorNameDialogOpen}
        onOpenChange={(open) => {
          setIsAuthorNameDialogOpen(open);
          if (!open) {
            setEditingAuthorBlockId(null);
            setEditingAuthorName("");
            setEditingAuthorStub([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Author</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-2">
            <Label>Select Author</Label>
            <AuthorSelector
              selected={editingAuthorStub}
              onChange={setEditingAuthorStub}
              placeholder="Search and select author..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAuthorNameDialogOpen(false);
                setEditingAuthorBlockId(null);
                setEditingAuthorName("");
                setEditingAuthorStub([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAuthorNameUpdate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {embedDialogType && (
        <EmbedUrlDialog
          key="embed-url-dialog"
          open={!!embedDialogType}
          onOpenChange={(open) => {
            if (!open) setEmbedDialogType(null);
          }}
          onSubmit={handleEmbedUrlSubmit}
          title={embedDialogConfigs[embedDialogType].title}
          description={embedDialogConfigs[embedDialogType].description}
          placeholder={embedDialogConfigs[embedDialogType].placeholder}
        />
      )}
      <ValidationDialog
        key="validation-dialog"
        open={isValidationDialogOpen}
        onOpenChange={setIsValidationDialogOpen}
        errors={validationErrors}
        warnings={validationWarnings}
        onBackToEditor={() => setIsValidationDialogOpen(false)}
      />
      <ArticleWizardDialog
        key="article-wizard-dialog"
        open={isWizardOpen}
        onOpenChange={(open) => {
          setIsWizardOpen(open);
          if (!open) {
            // Reset completion state when wizard closes so it can be reopened fresh
            setGenerationComplete(false);
            setGenerationError(null);
          }
        }}
        onGenerate={handleGenerateArticle}
        onStopGeneration={handleStopGeneration}
        isGenerating={isGenerating}
        generationComplete={generationComplete}
        generationError={generationError}
        defaultTopic={articleTitle}
        defaultLanguage={selectedLanguage}
        defaultArticleType={articleType}
        defaultCategory={primaryCategory || ""}
      />
      <FaqPickerDialog
        isOpen={isFaqPickerOpen}
        onClose={() => setIsFaqPickerOpen(false)}
        onSelect={handleFaqSelected}
      />
      <RelatedArticleModal
        isOpen={isRelatedArticlePickerOpen}
        onClose={() => setIsRelatedArticlePickerOpen(false)}
        onSelect={handleRelatedArticleSelected}
      />
      <PollPickerDialog
        isOpen={isPollPickerOpen}
        onClose={() => setIsPollPickerOpen(false)}
        onSelect={handlePollSelected}
      />
      <PublishSuccessDialog
        open={isPublishSuccessDialogOpen}
        onOpenChange={setIsPublishSuccessDialogOpen}
        articleTitle={articleTitle}
        articleUrl={publishedArticleUrl}
      />
      <LinkEditDialog
        open={isLinkEditOpen}
        onOpenChange={setIsLinkEditOpen}
        initialUrl={linkEditData.url}
        initialText={linkEditData.text}
        onSubmit={handleLinkEditSubmit}
      />
    </Card>
  );
}

// Outer component - waits for hydration and data then renders EditorWithBlocks
export function BlockNoteEditorComponent() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [hydrated, setHydrated] = useState(false);
  const [ready, setReady] = useState(false);
  const [initialBlocks, setInitialBlocks] = useState<PartialBlock[]>(defaultBlocks);
  const [deferredEmbeds, setDeferredEmbeds] = useState<DeferredEmbed[]>([]);

  // Get reactive values from store
  const blocks = useEditorStore((state) => state.blocks);
  const currentArticleId = useEditorStore((state) => state.currentArticleId);

  // Use a ref to track which article ID we've actually initialized the editor for
  // undefined means we haven't initialized at all.
  const initializedArticleId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    waitForEditorHydration().then(() => {
      setHydrated(true);
    });
  }, []);

  // Effect to initialize content once data is available
  useEffect(() => {
    if (!hydrated) return;

    // We initialize the editor when:
    // 1. the currentArticleId in store doesn't match what we've initialized for
    // 2. OR the articleType has changed (to handle liveblog <-> article transitions properly)
    // (this covers the transition from null -> id, or id1 -> id2, or id -> null, or type change)
    if (initializedArticleId.current !== currentArticleId || (useEditorStore.getState().articleType !== (window as any).__lastArticleType)) {
      (window as any).__lastArticleType = useEditorStore.getState().articleType;

      const { articleType } = useEditorStore.getState();

      if (currentArticleId) {
        // Case: Loading an existing article
        if (blocks && Array.isArray(blocks) && blocks.length > 0) {
          const { blocks: transformed, deferredEmbeds: embeds } = transformBlocksForEditor(blocks);
          setInitialBlocks(transformed);
          setDeferredEmbeds(embeds);
          initializedArticleId.current = currentArticleId;
          setReady(true);
        } else if (blocks && Array.isArray(blocks) && blocks.length === 0) {
          // Article exists but has no blocks yet (e.g. just created)
          const { articleType } = useEditorStore.getState();
          const { user: currentUser } = useAuthStore.getState();
          const templateUser = currentUser ? { name: currentUser.name, id: currentUser.id, slug: currentUser.slug || "" } : null;
          const template = getTemplateBlocks(articleType, templateUser);
          const { blocks: processedBlocks, deferredEmbeds: embeds } = processTemplateBlocks(template);

          setInitialBlocks(processedBlocks);
          setDeferredEmbeds(embeds);
          initializedArticleId.current = currentArticleId;
          setReady(true);
        }
      } else {
        // Case: No article ID (New article starting from base /editor route)
        const { articleType } = useEditorStore.getState();
        const { user: currentUser } = useAuthStore.getState();
        const templateUser = currentUser ? { name: currentUser.name, id: currentUser.id, slug: currentUser.slug || "" } : null;
        const template = getTemplateBlocks(articleType, templateUser);
        const { blocks: processedBlocks, deferredEmbeds: embeds } = processTemplateBlocks(template);
        setInitialBlocks(processedBlocks);
        setDeferredEmbeds(embeds);
        initializedArticleId.current = null;
        setReady(true);
      }
    }
  }, [hydrated, currentArticleId, blocks, useEditorStore.getState().articleType]);

  if (!hydrated || !ready) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader></CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="text-muted-foreground">Initializing editor...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <EditorWithBlocks
      key={`${currentArticleId || "new-article"}-${useEditorStore.getState().articleType}`}
      initialBlocks={initialBlocks}
      deferredEmbeds={deferredEmbeds}
    />
  );
}
