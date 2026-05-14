"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadImage, inferImageExtension } from "@/lib/download-image";

export type LightboxAspect = "9:16" | "4:5" | "4:3" | "16:9";

export interface LightboxImage {
  url: string;
  generatedAt?: string;
  caption?: string;
  filenameSeed: string;
  aspect: LightboxAspect;
}

const ASPECT_CLASS: Record<LightboxAspect, string> = {
  "9:16": "aspect-[9/16] max-h-[75vh]",
  "4:5": "aspect-[4/5] max-h-[75vh]",
  "4:3": "aspect-[4/3] max-h-[75vh]",
  "16:9": "aspect-[16/9] max-h-[75vh]",
};

const ASPECT_LABEL: Record<LightboxAspect, string> = {
  "9:16": "Vertical (9:16) — Web story / Reel",
  "4:5": "Portrait (4:5) — Instagram feed",
  "4:3": "Landscape (4:3)",
  "16:9": "Wide (16:9) — Twitter card / WhatsApp channel hero",
};

interface ImageLightboxProps {
  image: LightboxImage | null;
  onClose: () => void;
}

export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  const [downloading, setDownloading] = useState(false);
  const open = !!image;

  async function handleDownload() {
    if (!image) return;
    setDownloading(true);
    try {
      const filename = `${image.filenameSeed}${inferImageExtension(image.url)}`;
      await downloadImage(image.url, filename);
      toast.success("Image downloaded");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not download image";
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-3xl !p-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {image?.caption || "Generated image"}
        </DialogTitle>
        {image && (
          <div className="flex flex-col">
            <div
              className={cn(
                "relative w-full bg-black/40 flex items-center justify-center",
                ASPECT_CLASS[image.aspect]
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.generatedAt ? `${image.url}${image.url.includes('?') ? '&' : '?'}v=${image.generatedAt}` : image.url}
                alt={image.caption || "Generated"}
                className="h-full w-auto object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-3 p-4 border-t border-border/60">
              <div className="min-w-0">
                {image.caption && (
                  <p className="text-sm font-medium truncate">
                    {image.caption}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ASPECT_LABEL[image.aspect]}
                </p>
              </div>
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="gap-2 shrink-0"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
