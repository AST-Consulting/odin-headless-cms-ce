"use client";

import { BlockNoteSchema, defaultBlockSpecs, defaultStyleSpecs } from "@blocknote/core";
import { createReactStyleSpec } from "@blocknote/react";
import React from "react";
import { TwitterEmbedBlock } from "./TwitterEmbedBlock";
import { YouTubeEmbedBlock } from "./YouTubeEmbedBlock";
import { InstagramEmbedBlock } from "./InstagramEmbedBlock";
import { TimestampBlock } from "./TimestampBlock";
import { SoundCloudEmbedBlock } from "./SoundCloudEmbedBlock";
import { SnapchatEmbedBlock } from "./SnapchatEmbedBlock";
import { FeaturedImageBlock } from "./FeaturedImageBlock";
import { VideoEmbedBlock } from "./VideoEmbedBlock";
import { FaqBlock } from "./FaqBlock";
import { PollBlock } from "./PollBlock";
import { RecipeIngredientBlock, HowToStepBlock } from "./RecipeBlocks";

import { useEditorContext } from "./EditorContext";
import { useEditorStore } from "@/lib/store";
import { Check, X } from "lucide-react";

const ContradictionMarker = (props: any) => {
  const { atomicReplaceQuote } = useEditorContext();
  const { factCheckResult, setFactCheckResult } = useEditorStore();

  // Parse the combined ID and original text from the style value
  const styleValue = props.value || props.style?.factCheck || "";
  const [findingId, originalTextFromStyles] = styleValue.split('|');
  const finalOriginalText = originalTextFromStyles || props.children;

  // ATTEMPT TO LOG EVERYTHING
  console.log("%c[CONTRADICTION MARKER RENDER CALL]", "background: #7c3aed; color: #fff; font-weight: bold; padding: 2px 4px;");
  console.log("Resolved findingId:", findingId, "Original Text:", finalOriginalText);
  
  const finding = factCheckResult?.findings?.find((f: any) => f.id === findingId);

  // Debug log to see if markers are rendering and finding their data
  console.log("[ContradictionMarker] Rendering ID:", findingId, "Finding Found:", !!finding);

  const handleAccept = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (finding && finding.blockId) {
      console.log("[ContradictionMarker] Accepting finding:", finding.id);
      atomicReplaceQuote?.(finding.blockId, finding.quote, finding.suggestedReplacement, finding.id);
      setFactCheckResult({
        ...factCheckResult!,
        findings: factCheckResult!.findings.filter(f => f.id !== finding.id)
      });
    }
  };

  const handleIgnore = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (finding) {
      console.log("[ContradictionMarker] Ignoring finding:", finding.id);
      setFactCheckResult({
        ...factCheckResult!,
        findings: factCheckResult!.findings.filter(f => f.id !== finding.id)
      });
    }
  };

  // Safety check for finding data
  if (!finding) {
    return React.createElement("span", {
      className: "bg-red-200 text-red-800 px-0.5",
      style: { backgroundColor: '#fee2e2', color: '#991b1b' }
    }, props.children);
  }
  return React.createElement("span", {
    className: "group relative inline-block transition-all align-middle",
    style: { display: 'inline-block', position: 'relative', verticalAlign: 'middle' },
    "data-finding-id": findingId
  }, [
    // Original (Orange)
    React.createElement("span", {
      key: "old",
      className: "bg-orange-50/50 text-orange-900/80 px-1.5 py-0.5 rounded-l-sm line-through decoration-orange-300 inline-block",
      style: { textDecoration: 'line-through', display: 'inline-block', whiteSpace: 'pre-wrap' }
    }, finalOriginalText),
    
    // Suggested (Green)
    React.createElement("span", {
      key: "new",
      className: "bg-green-50/50 text-green-900 px-1.5 py-0.5 rounded-r-sm font-bold inline-block",
      style: { fontWeight: 'bold', display: 'inline-block', whiteSpace: 'pre-wrap' }
    }, finding.suggestedReplacement),

    // Floating toolbar on hover - Fixed gap issue with padding and better positioning
    React.createElement("span", {
      key: "actions",
      className: "invisible group-hover:visible absolute bottom-[100%] left-0 pb-2 z-[99999] animate-in fade-in slide-in-from-bottom-1 duration-200",
      style: { pointerEvents: 'auto' }
    }, [
      React.createElement("div", {
        key: "toolbar",
        className: "flex items-center gap-1 bg-white border border-rose-200 shadow-2xl rounded-md p-1.5",
        style: { boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }
      }, [
        React.createElement("button", {
          key: "accept",
          onClick: handleAccept,
          className: "h-7 px-3 rounded-md bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 shadow-sm transition-transform active:scale-95 flex items-center gap-1",
          style: { cursor: 'pointer', border: 'none' }
        }, [
          React.createElement(Check, { key: "check-icon", size: 12, strokeWidth: 3 }),
          React.createElement("span", { key: "accept-label" }, "Accept")
        ]),
        React.createElement("button", {
          key: "ignore",
          onClick: handleIgnore,
          className: "h-7 px-3 rounded-md bg-zinc-600 text-white text-[11px] font-bold hover:bg-zinc-700 shadow-sm transition-transform active:scale-95 flex items-center gap-1",
          style: { cursor: 'pointer', border: 'none' }
        }, [
          React.createElement(X, { key: "x-icon", size: 12, strokeWidth: 3 }),
          React.createElement("span", { key: "ignore-label" }, "Ignore")
        ])
      ])
    ])
  ]);
};

export function createEditorSchema() {
  // At runtime, defaultBlockSpecs should be properly initialized
  if (typeof window === 'undefined') return BlockNoteSchema.create();
  
  return BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      twitterEmbed: TwitterEmbedBlock(),
      youtubeEmbed: YouTubeEmbedBlock(),
      instagramEmbed: InstagramEmbedBlock(),
      timestamp: TimestampBlock(),
      soundcloudEmbed: SoundCloudEmbedBlock(),
      snapchatEmbed: SnapchatEmbedBlock(),
      featuredImage: FeaturedImageBlock(),
      videoEmbed: VideoEmbedBlock(),
      faqEmbed: FaqBlock(),
      pollEmbed: PollBlock(),
      recipeIngredient: RecipeIngredientBlock(),
      howToStep: HowToStepBlock(),
    },
    styleSpecs: {
      ...defaultStyleSpecs,
      factCheck: createReactStyleSpec(
        {
          type: "factCheck",
          propSchema: "string", 
        },
        {
          render: (props: any) => React.createElement(ContradictionMarker, props),
        }
      ),
      // Keep legacy for cleanup
      findingHighlight: createReactStyleSpec({ type: "findingHighlight", propSchema: "string" }, { render: (props: any) => React.createElement("span", { className: "hidden" }, props.children) }),
      contradiction: createReactStyleSpec({ type: "contradiction", propSchema: "boolean" }, { render: (props: any) => React.createElement("span", { className: "hidden" }, props.children) }),
    },
  });
}

// Export the custom block types for type checking
export const customBlockTypes = new Set(["twitterEmbed", "youtubeEmbed", "instagramEmbed", "timestamp", "soundcloudEmbed", "snapchatEmbed", "featuredImage", "videoEmbed", "faqEmbed", "pollEmbed", "recipeIngredient", "howToStep"]);

// Legacy block types (old names that might be stored in DB)
export const legacyBlockTypes = new Set(["twitterCard", "instagramCard", "youtubeCard"]);
