"use client";

import React from "react";
import { motion } from "framer-motion";
import { useEditorStore } from "@/lib/store";
import { StorySlide } from "@/lib/web-story.types";

interface StoryCanvasProps {
  slide: StorySlide;
  isPreviewMode?: boolean;
}

export function StoryCanvas({ slide, isPreviewMode }: StoryCanvasProps) {
  const {
    webStoryData,
    webStoryTemplates,
    images: storeImages
  } = useEditorStore() as any;

  const slides = webStoryData?.slides || [];

  const template = webStoryTemplates.find((t: any) => t._id === slide.templateId);

  const processedHtml = template ? template.html.replace(/{{\s*(\w+)\s*}}/g, (_: string, key: string) => {
    const lowerKey = key.toLowerCase();
    const value = Object.entries(slide.templateData || {}).find(([k]) => k.toLowerCase() === lowerKey)?.[1] || "";
    return value;
  }) : "";

  const backgroundField = template?.allowedFields?.find((f: string) => {
    const l = f.toLowerCase();
    return (l.includes('image') || l.includes('media') || l.includes('background')) && !l.includes('credit');
  });

  const backgroundUrl = backgroundField ? (Object.entries(slide.templateData || {}).find(([k]) => k.toLowerCase() === backgroundField.toLowerCase())?.[1] || (template.previewImage as any)?.url) : "";

  return (
    <div
      className="relative aspect-[9/16] w-full h-full shadow-2xl rounded-2xl overflow-hidden border select-none bg-neutral-900"
      style={{
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* TEMPLATE STYLES */}
      {template && (
        <style dangerouslySetInnerHTML={{ __html: template.css }} />
      )}

      {/* STORY PROGRESS BARS - ONLY IN PREVIEW */}
      {isPreviewMode && (
        <div className="absolute top-4 left-4 right-4 z-[100] flex gap-1.5 px-0.5 animate-in fade-in slide-in-from-top-2 duration-500">
          {slides.map((s: any, idx: number) => {
            const currentIndex = slides.findIndex((sl: any) => sl.id === slide.id);
            const isActive = idx === currentIndex;
            const isPast = idx < currentIndex;

            return (
              <div
                key={s.id}
                className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"
              >
                {(isActive || isPast) && (
                  <motion.div
                    className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                    initial={{ width: isPast ? "100%" : "0%" }}
                    animate={{ width: isPast ? "100%" : "100%" }}
                    transition={{
                      duration: isActive ? (slide.duration || 7) : 0,
                      ease: "linear"
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TEMPLATE CONTENT */}
      {template ? (
        <div
          className="absolute inset-0 z-0 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: processedHtml }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-white/50 bg-neutral-900">
          Select a layout template from the right sidebar to start building this slide.
        </div>
      )}
    </div>
  );
}
