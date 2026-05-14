"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  downloadImagesSequential,
  inferImageExtension,
} from "@/lib/download-image";

export interface StorySlide {
  title: string;
  body: string;
  imageUrl?: string;
  imagePromptHint?: string;
}

interface StoryPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  slides: StorySlide[];
  title: string;
  filenamePrefix: string;
  variant: "story" | "carousel";
}

export function StoryPreviewDialog({
  open,
  onClose,
  slides,
  title,
  filenamePrefix,
  variant,
}: StoryPreviewDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        setActiveIndex((i) => Math.min(i + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft") {
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slides.length]);

  const slide = slides[activeIndex];
  const total = slides.length;
  const aspectClass = variant === "story" ? "aspect-[9/16]" : "aspect-[4/5]";
  const aspectLabel =
    variant === "story" ? "Vertical 9:16" : "Portrait 4:5";

  async function handleDownloadAll() {
    const items = slides
      .map((s, i) => ({ slide: s, index: i }))
      .filter((entry) => !!entry.slide.imageUrl)
      .map((entry) => ({
        url: entry.slide.imageUrl as string,
        filename: `${filenamePrefix}_${variant}_${entry.index + 1}${inferImageExtension(entry.slide.imageUrl as string)}`,
      }));
    if (items.length === 0) {
      toast.error("No images yet — generate them first.");
      return;
    }
    setDownloading(true);
    try {
      const result = await downloadImagesSequential(items);
      if (result.failed === 0) {
        toast.success(`Downloaded ${result.succeeded} images`);
      } else {
        toast.warning(
          `Downloaded ${result.succeeded}, failed ${result.failed}`
        );
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-4xl !p-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {title} — {variant === "story" ? "Story" : "Carousel"} preview
        </DialogTitle>
        {slide && (
          <div className="flex flex-col md:flex-row">
            {/* Phone frame */}
            <div className="flex items-center justify-center bg-gradient-to-br from-[hsl(230_25%_8%)] to-[hsl(230_25%_4%)] p-6 md:p-8">
              <div
                className={cn(
                  "relative w-[280px] rounded-[2.2rem] border-[6px] border-neutral-900 bg-black shadow-2xl overflow-hidden",
                  aspectClass
                )}
              >
                {slide.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/85" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/5" />
                )}
                {/* Progress bars */}
                <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
                  {slides.map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden"
                    >
                      <div
                        className={cn(
                          "h-full bg-white transition-all duration-300",
                          i < activeIndex
                            ? "w-full"
                            : i === activeIndex
                              ? "w-full"
                              : "w-0"
                        )}
                      />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-5 z-10 text-white">
                  <p className="text-base font-semibold leading-snug drop-shadow-lg">
                    {slide.title}
                  </p>
                  <p className="text-xs mt-2 leading-relaxed drop-shadow-md text-white/90">
                    {slide.body}
                  </p>
                </div>
                {/* Tap zones */}
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => Math.max(i - 1, 0))}
                  className="absolute inset-y-0 left-0 w-1/3 z-20"
                  aria-label="Previous"
                />
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((i) => Math.min(i + 1, total - 1))
                  }
                  className="absolute inset-y-0 right-0 w-2/3 z-20"
                  aria-label="Next"
                />
              </div>
            </div>

            {/* Side panel */}
            <div className="flex-1 p-5 md:p-6 flex flex-col gap-4 min-w-0">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {variant === "story" ? "Web Story" : "Instagram Carousel"} •{" "}
                  {aspectLabel}
                </p>
                <h2 className="text-lg font-semibold tracking-tight mt-1 truncate">
                  {title}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Slide {activeIndex + 1} of {total}
                </p>
              </div>

              <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2 min-h-[120px]">
                <p className="text-sm font-medium">{slide.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {slide.body}
                </p>
                {!slide.imageUrl && slide.imagePromptHint && (
                  <p className="text-[11px] text-muted-foreground italic mt-2">
                    🎨 {slide.imagePromptHint} (image not generated yet)
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 mt-auto">
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setActiveIndex((i) => Math.max(i - 1, 0))
                    }
                    disabled={activeIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setActiveIndex((i) => Math.min(i + 1, total - 1))
                    }
                    disabled={activeIndex === total - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  onClick={handleDownloadAll}
                  disabled={downloading}
                  className="gap-2"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download all images
                </Button>
              </div>

              {/* Slide thumbnails */}
              <div className="flex gap-2 overflow-x-auto pt-2 border-t border-border/40">
                {slides.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "shrink-0 w-12 rounded-md overflow-hidden border-2 transition-all",
                      aspectClass,
                      i === activeIndex
                        ? "border-primary"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    {s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[10px] text-muted-foreground">
                        {i + 1}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
