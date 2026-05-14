"use client";

import { CheckCircle2, ImageIcon, ImagePlus, Loader2, Maximize2, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ImageSource, WhatsappCard } from "@/lib/repurpose-api";

interface WhatsappMockupProps {
  card: WhatsappCard;
  publicationName?: string;
  featuredImageUrl?: string;
  previewUrl?: string;
  isGeneratingImage?: boolean;
  onGenerateImage?: (source: ImageSource) => void;
  onOpenImage?: () => void;
  onUpdate?: (data: Partial<WhatsappCard>) => void;
  emptyState?: React.ReactNode;
}

export function WhatsappMockup({
  card,
  publicationName = "News Desk",
  featuredImageUrl,
  previewUrl,
  isGeneratingImage,
  onGenerateImage,
  onOpenImage,
  onUpdate,
  emptyState,
}: WhatsappMockupProps) {
  if (!card || !card.text) {
    return (
      emptyState || (
        <p className="text-xs text-muted-foreground italic">
          No content generated.
        </p>
      )
    );
  }
  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const linkLabel = previewUrl
    ? safeHostname(previewUrl)
    : card.previewLink
      ? safeHostname(card.previewLink)
      : "your-publication.com";

  return (
    <div className="rounded-lg p-3 bg-[#e5ddd5] dark:bg-[#0b141a] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 30%, hsl(140 50% 40%) 1px, transparent 1px), radial-gradient(circle at 75% 60%, hsl(140 50% 40%) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />

      <div className="relative">
        <div className="rounded-2xl bg-white dark:bg-[#1f2c33] shadow-md overflow-hidden mx-auto max-w-[88%]">
          {/* Channel header */}
          <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#25d366] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
              {publicationName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1 truncate">
                {publicationName}
                <CheckCircle2 className="h-3 w-3 text-[#25d366] fill-current" />
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Channel · just now
              </p>
            </div>
          </div>

          {/* Hero image / image-source picker */}
          {card.image ? (
            <button
              type="button"
              onClick={onOpenImage}
              className="block relative w-full aspect-[16/9] bg-neutral-200 dark:bg-neutral-800 group"
              disabled={!onOpenImage}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.image.generatedAt ? `${card.image.imageUrl}${card.image.imageUrl.includes('?') ? '&' : '?'}v=${card.image.generatedAt}` : card.image.imageUrl}
                alt={card.previewTitle || "WhatsApp hero"}
                className={cn("absolute inset-0 h-full w-full object-cover", isGeneratingImage && "opacity-50")}
              />
              {isGeneratingImage ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
              ) : onOpenImage && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100" />
                </div>
              )}
            </button>
          ) : (
            <ImageSourcePicker
              imagePrompt={card.imagePrompt}
              featuredImageUrl={featuredImageUrl}
              isBusy={!!isGeneratingImage}
              onPick={onGenerateImage}
            />
          )}

          {/* Body text */}
          <div className="px-3 py-2.5">
            <Textarea
              value={card.text}
              onChange={(e) => onUpdate?.({ text: e.target.value })}
              className="text-sm text-neutral-900 dark:text-white border-none p-0 focus-visible:ring-0 resize-none min-h-[60px] bg-transparent leading-relaxed"
            />
          </div>

          {/* Link preview card */}
          {(card.previewTitle || card.previewDescription || previewUrl) && (
            <div className="mx-3 mb-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#172227] p-2.5">
              <Input
                value={card.previewTitle || ""}
                onChange={(e) => onUpdate?.({ previewTitle: e.target.value })}
                className="h-6 text-[11px] font-semibold text-neutral-900 dark:text-white border-none p-0 focus-visible:ring-0 bg-transparent leading-snug"
                placeholder="Title"
              />
              {card.previewDescription !== undefined && (
                <Textarea
                  value={card.previewDescription}
                  onChange={(e) =>
                    onUpdate?.({ previewDescription: e.target.value })
                  }
                  className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-0.5 border-none p-0 focus-visible:ring-0 resize-none min-h-[30px] bg-transparent leading-snug"
                  placeholder="Description"
                />
              )}
              <p className="text-[10px] text-neutral-500 dark:text-neutral-500 mt-1 truncate">
                {linkLabel}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="px-3 pb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
              {time}
            </p>
            {card.image && onGenerateImage && (
              <div className="flex items-center gap-1">
                {featuredImageUrl &&
                  card.image.imageUrl !== featuredImageUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onGenerateImage("featured")}
                      disabled={isGeneratingImage}
                      className="h-6 px-2 text-[10px] gap-1 text-primary hover:bg-primary/10"
                      title="Use the article's featured image"
                    >
                      <Star className="h-3 w-3" />
                      Use featured
                    </Button>
                  )}
                {card.imagePrompt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onGenerateImage("generated")}
                    disabled={isGeneratingImage}
                    className="h-6 px-2 text-[10px] gap-1 text-primary hover:bg-primary/10"
                    title="Regenerate with AI"
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Re-image
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="relative text-[10px] text-muted-foreground mt-2 text-center">
          {card.text.length} characters
        </p>
      </div>
    </div>
  );
}

interface ImageSourcePickerProps {
  imagePrompt?: string;
  featuredImageUrl?: string;
  isBusy: boolean;
  onPick?: (source: ImageSource) => void;
}

function ImageSourcePicker({
  imagePrompt,
  featuredImageUrl,
  isBusy,
  onPick,
}: ImageSourcePickerProps) {
  const canUseFeatured = !!featuredImageUrl && !!onPick;
  const canGenerate = !!imagePrompt && !!onPick;

  return (
    <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-900 flex flex-col items-center justify-center gap-3 p-3">
      <ImageIcon className="h-7 w-7 text-neutral-400 dark:text-neutral-600" />
      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 text-center max-w-[80%] line-clamp-2">
        {imagePrompt || "Pick a hero image for this channel post"}
      </p>
      <div className="flex items-center gap-2">
        {canUseFeatured && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPick?.("featured")}
            disabled={isBusy}
            className={cn(
              "h-7 gap-1 text-[11px]",
              "border-amber-500/40 text-amber-600 bg-white/80 dark:bg-black/30",
              "hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-500/60",
              "dark:text-amber-400"
            )}
            title="Use the article's featured image"
          >
            <Star className="h-3 w-3" />
            Use featured
          </Button>
        )}
        {canGenerate && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPick?.("generated")}
            disabled={isBusy}
            className="h-7 gap-1 text-[11px] border-primary/30 text-primary bg-white/80 dark:bg-black/30 hover:bg-primary/10"
            title="Generate a fresh AI image"
          >
            {isBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ImagePlus className="h-3 w-3" />
            )}
            Generate AI image
          </Button>
        )}
        {!canUseFeatured && !canGenerate && (
          <p className="text-[10px] text-muted-foreground italic">
            No image source available
          </p>
        )}
      </div>
    </div>
  );
}

function safeHostname(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}
