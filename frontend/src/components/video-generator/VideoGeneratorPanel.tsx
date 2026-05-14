"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  cancelVideoGenerationJob,
  createVideoGenerationJob,
  fetchVideoSceneImages,
  getArticleById,
  getVideoGenerationJob,
  planVideoScenes,
  publishVideoGenerationJob,
  synthesizeVideoTts,
  uploadFiles,
  type VideoGenerationJobResult,
  type VideoGenerationStatus,
} from "@/lib/api";
import type { Article, MediaFile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePropertyStore, useVideoGeneratorStore } from "@/lib/store";
import {
  beginVideoRenderAttempt,
  resetVideoRenderSession,
  getVideoRenderSessionSnapshot,
  patchVideoRenderSession,
  subscribeVideoRenderSession,
  type VideoRenderSessionInputState,
} from "./videoRenderSession";

type UiState =
  | "idle"
  | "prefilled"
  | "loading"
  | "success"
  | "validation_error"
  | "provider_error"
  | "timeout"
  | "cancelled"
  | "partial_success";

function mapStatusToUiState(status: VideoGenerationStatus): UiState {
  if (status === "completed") return "success";
  if (status === "cancelled") return "cancelled";
  if (status === "timeout") return "timeout";
  if (status === "partial_failure") return "partial_success";
  if (status === "failed") return "provider_error";
  return "loading";
}

function statusBadgeVariant(state: UiState): "default" | "secondary" | "destructive" | "outline" {
  if (state === "success") return "default";
  if (state === "provider_error" || state === "timeout" || state === "validation_error") return "destructive";
  if (state === "partial_success") return "secondary";
  return "outline";
}

type VideoMediaAsset = {
  url: string;
  renderUrl?: string;
  alt?: string;
  caption?: string;
  source?: string;
  assetType?: "image" | "video";
  sourceId?: string;
  durationSec?: number;
  mimeType?: string;
  clipEligibility?: "supported" | "fallback-required" | "disabled";
};

type PlannedScene = {
  id: string;
  order: number;
  headline: string;
  narration: string;
  durationSeconds: number;
  visualQuery: string;
  visualQueryFallbacks?: string[];
  ttsRate?: number;
};

type PlannedScript = {
  title: string;
  scenes: PlannedScene[];
};

type SceneImageSelection = {
  scene: PlannedScene;
  candidates: VideoMediaAsset[];
  selectedUrl: string | null;
};

type VideoGeneratorTelemetryEvent =
  | "gallery-hit-rate"
  | "fallback-rate"
  | "render-fallback-to-still"
  | "publish-success"
  | "publish-failure";

function emitVideoGeneratorTelemetry(
  event: VideoGeneratorTelemetryEvent,
  payload: {
    propertyId?: string;
    jobId?: string;
    sceneId?: string;
    assetType?: "image" | "video";
    fallbackReason?: string;
  }
) {
  const entry = {
    event,
    propertyId: payload.propertyId || "",
    jobId: payload.jobId || "",
    sceneId: payload.sceneId || "",
    assetType: payload.assetType || "image",
    fallbackReason: payload.fallbackReason || "",
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    const dataLayer = (window as typeof window & { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(dataLayer)) {
      dataLayer.push(entry);
    }
  }
  // Keep console telemetry visible during V1 rollout while dashboards are wired.
  // eslint-disable-next-line no-console
  console.info("[video-generator-telemetry]", entry);
}

type SubtitleCue = {
  text: string;
  startFraction: number;
  endFraction: number;
};

type AspectRatio = "16:9" | "9:16" | "1:1";
type Voice = "neutral" | "male" | "female";
type ImageProvider = "auto" | "pexels" | "google" | "media-gallery";
type VideoLanguage = "en" | "hi" | "bn" | "mr" | "ta" | "te";

function getRenderDimensions(aspectRatio: AspectRatio) {
  if (aspectRatio === "9:16") return { width: 720, height: 1280 };
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  return { width: 1280, height: 720 };
}

function pickBestPhotoUrl(photo: any): string {
  const src = photo?.src || {};
  // Prefer the largest available derivative to avoid upscale blur when the image fills
  // the full canvas (up to 1280×720 or 720×1280). medium/small look blurry when stretched.
  return src.large2x || src.large || src.original || src.medium || src.small || photo?.url || "";
}

const BLOCKED_IMAGE_HOSTS = [
  "lookaside.instagram.com",
  "instagram.com",
  "cdninstagram.com",
];

function toDisplayImageUrl(url: string): string {
  if (!url) return "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL || "";

  if (url.startsWith("/public/")) {
    return `${apiBase}${url}`;
  }
  if (url.startsWith("/uploads")) {
    return `${cdnBase}${url}`;
  }
  if (
    url.startsWith("/media-proxy?url=") ||
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    url.startsWith("http://localhost") ||
    url.startsWith("https://localhost")
  ) {
    return url;
  }
  try {
    const parsed = new URL(url);
    const trustedHosts = [apiBase, cdnBase]
      .filter(Boolean)
      .map((base) => {
        try {
          return new URL(base).hostname;
        } catch {
          return "";
        }
      })
      .filter(Boolean);

    if (BLOCKED_IMAGE_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return "";
    }
    // Avoid proxying trusted first-party hosts. This reduces 502s for already-public assets.
    if (trustedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return url;
    }
  } catch {
    return "";
  }
  return `/media-proxy?url=${encodeURIComponent(url)}`;
}

function stripHtml(value: string) {
  if (!value) return "";
  if (typeof window === "undefined") return value.replace(/<[^>]+>/g, " ");
  const doc = new DOMParser().parseFromString(value, "text/html");
  return doc.body.textContent || "";
}

function collectText(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [stripHtml(value)];
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      ...collectText(record.text),
      ...collectText(record.content),
      ...collectText(record.children),
      ...collectText(record.caption),
    ];
  }
  return [];
}

function collectMediaAssets(value: unknown, source: string): VideoMediaAsset[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectMediaAssets(item, source));
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const url =
    typeof record.url === "string"
      ? record.url
      : typeof record.src === "string"
        ? record.src
        : typeof record.imageUrl === "string"
          ? record.imageUrl
          : "";

  const current = url
    ? [{
      url,
      alt: typeof record.alt === "string" ? record.alt : undefined,
      caption: typeof record.caption === "string" ? record.caption : undefined,
      source,
    }]
    : [];

  return [
    ...current,
    ...collectMediaAssets(record.content, source),
    ...collectMediaAssets(record.metadata, source),
    ...collectMediaAssets(record.children, source),
  ];
}

function uniqueMediaAssets(assets: VideoMediaAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (!asset.url || seen.has(asset.url)) return false;
    try {
      const parsed = new URL(asset.url);
      if (BLOCKED_IMAGE_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
        return false;
      }
    } catch {
      return false;
    }
    seen.add(asset.url);
    return true;
  });
}

function rankAssetsForScene(scene: PlannedScene, assets: VideoMediaAsset[]) {
  const toTokens = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u0900-\u097f\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);
  const queryTokens = new Set(
    toTokens(`${scene.visualQuery} ${scene.headline} ${(scene.visualQueryFallbacks || []).join(" ")}`)
  );

  const scored = assets.map((asset) => {
    const haystack = `${asset.alt || ""} ${asset.caption || ""} ${asset.url || ""} ${asset.source || ""}`;
    const hayTokens = new Set(toTokens(haystack));
    let score = 0;
    queryTokens.forEach((token) => {
      if (hayTokens.has(token)) score += 3;
      else if (haystack.toLowerCase().includes(token)) score += 1;
    });
    if (asset.source === "featuredMedia") score += 6;
    if (asset.source === "media-gallery") score += 2;
    return { asset, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.asset);
}

function buildArticleVideoDraft(article: Article) {
  const articleWithBody = article as Article & { body?: string };
  const contentParts = [
    article.excerpt,
    article.header,
    articleWithBody.body,
    ...(article.richBlocks || []).flatMap((block) => collectText(block)),
  ].filter(Boolean);

  return {
    title: article.title || article.englishHeadline || "",
    content: contentParts.join("\n\n").replace(/\s+\n/g, "\n").trim(),
    mediaAssets: uniqueMediaAssets([
      ...collectMediaAssets(article.featuredMedia, "featuredMedia"),
      ...collectMediaAssets(article.images || [], "images"),
      ...collectMediaAssets(article.richBlocks || [], "richBlocks"),
    ]),
  };
}

async function planScenes(
  title: string,
  content: string,
  options: {
    maxScenes: number;
    language: VideoLanguage;
    voice: Voice;
    aspectRatio: AspectRatio;
    category: string;
    includeHook: boolean;
  }
): Promise<PlannedScript> {
  const raw = (await planVideoScenes({
    title,
    content: content.slice(0, 3000),
    maxScenes: options.maxScenes,
    language: options.language,
    voice: options.voice,
    aspectRatio: options.aspectRatio,
    category: options.category,
    includeHook: options.includeHook,
  })) as PlannedScript;
  if (!raw?.scenes?.length) throw new Error("No scenes returned by planner");
  return {
    title: raw.title || title,
    scenes: raw.scenes.map((scene, i) => ({
      ...scene,
      id: scene.id || `scene-${i + 1}`,
      order: scene.order || i + 1,
      durationSeconds: Number(scene.durationSeconds || 6),
      ttsRate: Number(scene.ttsRate || 1),
      visualQueryFallbacks: scene.visualQueryFallbacks || [],
    })),
  };
}

async function fetchSceneImages(
  scene: PlannedScene,
  options: {
    aspectRatio: AspectRatio;
    imageProvider: ImageProvider;
    articleTitle: string;
    category: string;
    language: VideoLanguage;
    propertyId?: string;
    page?: number;
  }
): Promise<VideoMediaAsset[]> {
  const isClipEligibleForV1 = (candidate: {
    url: string;
    mimeType?: string;
    durationSec?: number;
  }) => {
    const ext = candidate.url.split("?")[0].toLowerCase();
    const allowedExt = [".mp4", ".webm", ".mov"];
    const hasAllowedExt = allowedExt.some((suffix) => ext.endsWith(suffix));
    const isVideoMime = String(candidate.mimeType || "").startsWith("video/");
    const hasValidDuration =
      candidate.durationSec === undefined || Number(candidate.durationSec) <= 30;
    return (isVideoMime || hasAllowedExt) && hasValidDuration;
  };

  const target = getRenderDimensions(options.aspectRatio);
  const targetRatio = target.width / target.height;
  const orientation =
    options.aspectRatio === "9:16"
      ? "portrait"
      : options.aspectRatio === "1:1"
        ? "square"
        : "landscape";
  const data = await fetchVideoSceneImages({
    query: scene.visualQuery,
    fallbackQueries: scene.visualQueryFallbacks || [],
    orientation,
    returnAll: true,
    perPage: 5,
    imageProvider: options.imageProvider,
    includeVideos: true,
    propertyId: options.propertyId,
    contextTitle: options.articleTitle,
    contextCategory: options.category,
    language: options.language,
    page: options.page ?? 1,
  });
  const minWidth = Math.floor(target.width * 1.1);
  const minHeight = Math.floor(target.height * 1.1);
  const photos = (data.photos || [])
    .filter((photo: any) => {
      const w = Number(photo?.width || 0);
      const h = Number(photo?.height || 0);
      if (w < minWidth || h < minHeight) return false;
      if (!w || !h) return false;
      const ratio = w / h;
      // Keep candidates close to the selected video aspect ratio.
      // This reduces aggressive crops and quality loss in final render.
      return Math.abs(ratio - targetRatio) <= 0.45;
    })
    .sort((a: any, b: any) => (Number(b?.width || 0) * Number(b?.height || 0)) - (Number(a?.width || 0) * Number(a?.height || 0)))
    .slice(0, 5);

  const selected = photos.length ? photos : (data.photos || []).slice(0, 5);
  return selected
    .map((photo: any) => {
      const assetType: "image" | "video" = photo?.assetType === "video" ? "video" : "image";
      const durationSec =
        Number.isFinite(Number(photo?.durationSec)) ? Number(photo.durationSec) : undefined;
      const base = {
        url: String(photo?.url || ""),
        renderUrl: String(photo?.thumbnailUrl || "") || pickBestPhotoUrl(photo),
        alt: photo?.alt || scene.headline,
        source: data.source || "stock",
        assetType,
        sourceId: typeof photo?.sourceId === "string" ? photo.sourceId : undefined,
        durationSec,
        mimeType: typeof photo?.mimeType === "string" ? photo.mimeType : undefined,
      } satisfies VideoMediaAsset;

      if (assetType === "video") {
        const backendClipEnabled = data?.clipSelectionEnabled !== false;
        if (!backendClipEnabled) {
          return { ...base, clipEligibility: "disabled" as const };
        }
        return {
          ...base,
          clipEligibility: isClipEligibleForV1(base) ? ("supported" as const) : ("fallback-required" as const),
        };
      }
      return base;
    })
    .filter((asset: VideoMediaAsset) => !!asset.url && !!asset.renderUrl);
}

function pcmToWavBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const pcmBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) pcmBytes[i] = binary.charCodeAt(i);

  const rateMatch = mimeType.match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataLength = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true);
  view.setUint16(32, (numChannels * bitsPerSample) / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);
  new Uint8Array(buffer, 44).set(pcmBytes);
  return new Blob([buffer], { type: "audio/wav" });
}

async function synthesizeSceneAudio(
  scene: PlannedScene,
  options: { voice: Voice; speedMultiplier: number; language: VideoLanguage }
): Promise<Blob | null> {
  // Use a single user-selected speed across all scenes.
  const effectiveRate = options.speedMultiplier;
  let data = await synthesizeVideoTts({
    text: scene.narration,
    voice: options.voice,
    rate: effectiveRate,
    language: options.language,
  });
  if (!data.audioContent) {
    // Retry once to reduce transient provider dropouts that would create silent scenes.
    data = await synthesizeVideoTts({
      text: scene.narration,
      voice: options.voice,
      rate: effectiveRate,
      language: options.language,
    });
  }
  if (!data.audioContent) {
    return null;
  }
  const mimeType = data.mimeType || "audio/wav";
  if (/audio\/(pcm|l16)/i.test(mimeType)) {
    return pcmToWavBlob(data.audioContent, mimeType);
  }
  const binary = atob(data.audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function toTextSlides(content: string, maxSlides = 10) {
  const normalized = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  const chunks = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return chunks.slice(0, maxSlides);
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const resolved = toDisplayImageUrl(url);
    // data: and blob: URLs are same-origin by definition — never proxy them.
    let canvasSafeUrl = resolved;
    if (!resolved.startsWith("data:") && !resolved.startsWith("blob:")) {
      try {
        const parsed = new URL(resolved, window.location.origin);
        const isCrossOrigin = parsed.origin !== window.location.origin;
        if (isCrossOrigin && !resolved.startsWith("/media-proxy?url=")) {
          canvasSafeUrl = `/media-proxy?url=${encodeURIComponent(resolved)}`;
        }
      } catch {
        // Keep original URL for non-standard/relative values.
      }
    }
    if (/^https?:\/\//i.test(canvasSafeUrl)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = canvasSafeUrl;
  });
}


function wrapCaptionLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.length > lines.join(" ").split(/\s+/).length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:!?-]*$/, "")}...`;
  }
  return lines;
}

function generateSubtitleCues(text: string, durationSeconds: number): SubtitleCue[] {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length || durationSeconds <= 0) return [];
  const wordsPerCue = words.length > 40 ? 6 : 4;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    chunks.push(words.slice(i, i + wordsPerCue).join(" "));
  }
  const total = chunks.length;
  return chunks.map((chunk, index) => ({
    text: chunk,
    startFraction: index / total,
    endFraction: (index + 1) / total,
  }));
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
) {
  const scale = Math.max(width / img.width, height / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const x = (width - drawW) / 2;
  const y = (height - drawH) / 2;
  ctx.drawImage(img, x, y, drawW, drawH);
}

function drawContainImageNoCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
) {
  // Layer 1: blurred cover-scaled image fills the entire frame (no black bars).
  const coverScale = Math.max(width / img.width, height / img.height);
  const bgW = img.width * coverScale;
  const bgH = img.height * coverScale;
  const bgX = (width - bgW) / 2;
  const bgY = (height - bgH) / 2;
  ctx.save();
  ctx.filter = "blur(18px) brightness(0.55) saturate(1.2)";
  ctx.drawImage(img, bgX, bgY, bgW, bgH);
  ctx.filter = "none";
  ctx.restore();

  // Layer 2: sharp original image, contain-fitted (no upscale beyond native size).
  const fitScale = Math.min(width / img.width, height / img.height, 1);
  const drawW = img.width * fitScale;
  const drawH = img.height * fitScale;
  const x = (width - drawW) / 2;
  const y = (height - drawH) / 2;
  ctx.drawImage(img, x, y, drawW, drawH);
}

/** Vertical news / Shorts style: full-bleed hero, stacked yellow + black lower-thirds (news portal–like). */
function drawNewsShortPortraitFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  logoImg: HTMLImageElement | null,
  headline: string,
  narration: string,
  progress: number,
  width: number,
  height: number,
  liveNarration: string | undefined,
  activeSubtitleCue: string | undefined,
  showSubtitles: boolean
) {
  ctx.clearRect(0, 0, width, height);
  const padX = Math.round(width * 0.05);
  const progressH = Math.max(5, Math.round(height * 0.004));
  const yellowH = Math.min(Math.round(height * 0.11), 160);
  const blackH = Math.min(Math.round(height * 0.17), 260);
  const lowerBlockH = yellowH + blackH + progressH;

  if (img) {
    // Blurred cover fill — no black bars
    const coverScale = Math.max(width / img.width, height / img.height);
    const bgW = img.width * coverScale;
    const bgH = img.height * coverScale;
    const bgX = (width - bgW) / 2;
    const bgY = (height - bgH) / 2;
    ctx.save();
    ctx.filter = "blur(20px) brightness(0.5) saturate(1.2)";
    ctx.drawImage(img, bgX, bgY, bgW, bgH);
    ctx.filter = "none";
    ctx.restore();

    // Sharp image, contain-fitted (full image visible, no crop)
    const fitScale = Math.min(width / img.width, (height - lowerBlockH) / img.height, 1);
    const drawW = img.width * fitScale;
    const drawH = img.height * fitScale;
    const drawX = (width - drawW) / 2;
    const drawY = ((height - lowerBlockH) - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const grad = ctx.createLinearGradient(0, height * 0.25, 0, height);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.45, "rgba(0,0,0,0.12)");
    grad.addColorStop(0.75, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e293b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }

  if (logoImg) {
    const targetH = Math.round(height * 0.055);
    const scale = targetH / logoImg.height;
    const targetW = Math.max(24, Math.round(logoImg.width * scale));
    const logoX = width - padX - targetW;
    const logoY = Math.round(height * 0.022);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(logoImg, logoX, logoY, targetW, targetH);
    ctx.restore();
  }

  const yBlack = height - lowerBlockH + yellowH;
  const yYellow = height - lowerBlockH;

  ctx.fillStyle = "#FFD400";
  ctx.fillRect(0, yYellow, width, yellowH);

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, yBlack, width, blackH);

  const innerPad = Math.min(28, Math.round(width * 0.04));
  const textMaxW = width - innerPad * 2;
  const cx = width / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const headlineFontPx = Math.max(22, Math.round(height * 0.032));
  ctx.font = `700 ${headlineFontPx}px "Noto Serif Devanagari", "Noto Serif", Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#0a0a0a";
  ctx.shadowColor = "rgba(255,255,255,0.35)";
  ctx.shadowBlur = 2;
  const headLines = wrapCaptionLines(ctx, headline.slice(0, 200), textMaxW, 3);
  const headLineGap = Math.min(34, Math.round(yellowH / Math.max(headLines.length, 1)));
  const headStartY = yYellow + yellowH / 2 - ((headLines.length - 1) * headLineGap) / 2;
  headLines.forEach((line, idx) => {
    ctx.fillText(line, cx, headStartY + idx * headLineGap);
  });
  ctx.shadowBlur = 0;

  let blackBody = narration;
  if (showSubtitles) {
    const roll = liveNarration?.trim();
    if (roll) {
      blackBody = roll;
    } else if (activeSubtitleCue?.trim()) {
      blackBody = activeSubtitleCue;
    }
  }
  const bodyFontPx = Math.max(17, Math.round(height * 0.024));
  ctx.font = `700 ${bodyFontPx}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#ffffff";
  const bodyLines = wrapCaptionLines(ctx, blackBody.slice(0, 320), textMaxW, 4);
  const bodyGap = Math.min(30, Math.round(blackH / Math.max(bodyLines.length + 1, 2)));
  const bodyStartY = yBlack + blackH / 2 - ((bodyLines.length - 1) * bodyGap) / 2;
  bodyLines.forEach((line, idx) => {
    ctx.fillText(line, cx, bodyStartY + idx * bodyGap);
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(0, height - progressH, width, progressH);
  ctx.fillStyle = "#e53935";
  ctx.fillRect(0, height - progressH, Math.max(1, width * progress), progressH);
}

function drawBaseFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  logoImg: HTMLImageElement | null,
  title: string,
  headline: string,
  narration: string,
  progress: number,
  width: number,
  height: number,
  liveNarration?: string,
  aspectRatio: AspectRatio = "16:9",
  activeSubtitleCue?: string,
  showSubtitles = false
) {
  if (aspectRatio === "9:16") {
    drawNewsShortPortraitFrame(
      ctx,
      img,
      logoImg,
      headline,
      narration,
      progress,
      width,
      height,
      liveNarration,
      activeSubtitleCue,
      showSubtitles
    );
    return;
  }

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#1e293b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (img) {
    // V1 rendering requirement: keep full image visible without crop/trim.
    drawContainImageNoCrop(ctx, img, width, height);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(0,0,0,0.25)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.4)");
    grad.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  const pad = Math.round(width * 0.035);
  const strapY = Math.round(height * 0.70);
  const strapH = Math.round(height * 0.10);
  const subtitleY = strapY + strapH + Math.round(height * 0.02);
  const strapTextMaxW = width - pad * 2;

  ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
  ctx.fillRect(0, 0, width, Math.round(height * 0.08));
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "600 18px Inter, system-ui, sans-serif";
  ctx.fillText(title.slice(0, 70), pad, Math.round(height * 0.055), width - pad * 2);

  if (logoImg) {
    const targetH = Math.round(height * 0.06);
    const scale = targetH / logoImg.height;
    const targetW = Math.max(28, Math.round(logoImg.width * scale));
    const logoX = width - pad - targetW;
    const logoY = Math.round(height * 0.01);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(logoX - 6, logoY - 4, targetW + 12, targetH + 8);
    ctx.drawImage(logoImg, logoX, logoY, targetW, targetH);
  }

  ctx.fillStyle = "#facc15";
  ctx.fillRect(pad, strapY, width - pad * 2, strapH);
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#111827";
  ctx.font = `800 ${Math.max(20, Math.round(height * 0.043))}px Inter, system-ui, sans-serif`;
  const strapLines = wrapCaptionLines(ctx, headline.slice(0, 120), strapTextMaxW - 24, 2);
  strapLines.forEach((line, idx) => {
    ctx.fillText(
      line,
      pad + 12,
      strapY + Math.round(strapH * 0.45) + idx * Math.round(strapH * 0.45),
      strapTextMaxW - 24
    );
  });

  ctx.shadowBlur = 6;
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fillRect(pad, subtitleY - 6, width - pad * 2, Math.round(height * 0.15));
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.max(16, Math.round(height * 0.027))}px Inter, system-ui, sans-serif`;
  const display = liveNarration !== undefined ? liveNarration : narration;
  const lines = wrapCaptionLines(ctx, display, width - pad * 2 - 20, 2);
  lines.forEach((line, i) => {
    ctx.fillText(line, pad + 10, subtitleY + Math.round(height * 0.038) + i * Math.round(height * 0.036), width - pad * 2 - 20);
  });

  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, height - 5, width, 5);
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(0, height - 5, width * progress, 5);
}

function drawSubtitlePill(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number
) {
  if (!text) return;
  ctx.font = "500 24px Inter, system-ui, sans-serif";
  const metrics = ctx.measureText(text);
  const tW = metrics.width + 36;
  const tH = 46;
  const y = height * 0.91;
  const x = width / 2;

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.beginPath();
  ctx.roundRect(x - tW / 2, y - tH * 0.75, tW, tH, 12);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

function applyTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  prevSnapshot: ImageData | null,
  t: number,
  width: number,
  height: number
) {
  if (!prevSnapshot) return;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return;
  tempCtx.putImageData(prevSnapshot, 0, 0);
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();
}

async function decodeAudio(blob: Blob, audioCtx: AudioContext): Promise<AudioBuffer | null> {
  try {
    return await audioCtx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

function mixAudioBuffers(
  buffers: Array<{ buffer: AudioBuffer; startSample: number; gainFactor?: number; maxSamples?: number }>,
  totalSamples: number,
  channels: number
): Float32Array[] {
  const output: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(totalSamples));
  for (const { buffer, startSample, gainFactor = 1, maxSamples } of buffers) {
    const numCh = Math.min(buffer.numberOfChannels, channels);
    const sampleLimit =
      typeof maxSamples === "number" && Number.isFinite(maxSamples)
        ? Math.max(0, Math.min(buffer.length, Math.floor(maxSamples)))
        : buffer.length;
    for (let ch = 0; ch < numCh; ch += 1) {
      const src = buffer.getChannelData(ch);
      const dst = output[ch];
      for (let i = 0; i < sampleLimit; i += 1) {
        const idx = startSample + i;
        if (idx < totalSamples) {
          dst[idx] = Math.max(-1, Math.min(1, dst[idx] + src[i] * gainFactor));
        }
      }
    }
  }
  return output;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  title: string,
  slides: string[],
  images: Array<HTMLImageElement | null>,
  sceneIndex: number
) {
  const { width, height } = canvas;
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#1e293b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const image = images.length ? images[sceneIndex % images.length] : null;
  if (image) {
    drawCoverImage(ctx, image, width, height);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px sans-serif";
  const titleToDraw = title.length > 90 ? `${title.slice(0, 87)}...` : title;
  ctx.fillText(titleToDraw, 60, 96);

  const body = slides[sceneIndex] || "";
  ctx.font = "32px sans-serif";
  const words = body.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > width - 120) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  const visibleLines = lines.slice(0, 6);
  visibleLines.forEach((line, i) => {
    ctx.fillText(line, 60, 190 + i * 52);
  });
}

async function renderVideoBlob(
  title: string,
  script: PlannedScript,
  imageMap: Map<string, VideoMediaAsset[]>,
  audioMap: Map<string, Blob | null>,
  options: { aspectRatio: AspectRatio; showSubtitles: boolean; propertyLogoUrl?: string }
): Promise<{ blob: Blob; durationSec: number }> {
  if (typeof window === "undefined") {
    throw new Error("Video rendering is only available in the browser");
  }
  const canvas = document.createElement("canvas");
  const dims = getRenderDimensions(options.aspectRatio);
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to initialize canvas renderer");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const fps = 24;
  const scenes = script.scenes;
  if (!scenes.length) throw new Error("No scenes available for rendering");

  const sceneImages = new Map<string, Array<HTMLImageElement | null>>();
  const propertyLogo = options.propertyLogoUrl ? await loadImage(options.propertyLogoUrl) : null;
  for (const scene of scenes) {
    const urls = (imageMap.get(scene.id) || []).map((asset) => asset.renderUrl || asset.url).slice(0, 6);
    const imgs = await Promise.all(urls.map(loadImage));
    sceneImages.set(scene.id, imgs.length ? imgs : [null]);
  }

  const sceneAudio = new Map<string, AudioBuffer | null>();
  const sceneDurations = new Map<string, number>();
  const INTER_SCENE_GAP_SEC = 0.5;
  const audioContext = new AudioContext();
  const closeAudioContext = () => audioContext.close().catch(() => undefined);
  try {
  for (const scene of scenes) {
    const requested = Math.max(1, scene.durationSeconds || 6);
    const audioBlob = audioMap.get(scene.id);
    if (!audioBlob) {
      sceneAudio.set(scene.id, null);
      sceneDurations.set(scene.id, requested);
      continue;
    }
    const buffer = await decodeAudio(audioBlob, audioContext);
    sceneAudio.set(scene.id, buffer);
    // Keep scene timing anchored to narration length to avoid dead air gaps.
    sceneDurations.set(scene.id, Math.max(1, buffer?.duration || requested));
  }
  const scenePlaybackTimeline = scenes.map(
    (scene) => sceneDurations.get(scene.id) || Math.max(1, scene.durationSeconds || 6)
  );
  const TAIL_PAD_SEC = 1.2; // extra silence after last scene so final word is never clipped
  const sceneTimeline = scenePlaybackTimeline.map((duration, index) =>
    duration + (index < scenes.length - 1 ? INTER_SCENE_GAP_SEC : TAIL_PAD_SEC)
  );
  const totalDurationSec = sceneTimeline.reduce((sum, sec) => sum + sec, 0);
  const totalFrames = Math.ceil(totalDurationSec * fps);
  const sceneCues = new Map<string, SubtitleCue[]>();
  for (const scene of scenes) {
    const d = sceneDurations.get(scene.id) || Math.max(1, scene.durationSeconds || 6);
    sceneCues.set(scene.id, options.showSubtitles ? generateSubtitleCues(scene.narration, d) : []);
  }
  const sceneStarts: number[] = [];
  let running = 0;
  for (const sec of sceneTimeline) {
    sceneStarts.push(running);
    running += sec;
  }
  const sceneSnapshots: (ImageData | null)[] = [];
  for (let si = 0; si < scenes.length; si += 1) {
    const scene = scenes[si];
    const imgs = sceneImages.get(scene.id) || [];
    drawBaseFrame(
      ctx,
      imgs[0] || null,
      propertyLogo,
      title,
      scene.headline,
      scene.narration,
      0,
      canvas.width,
      canvas.height,
      undefined,
      options.aspectRatio,
      undefined,
      options.showSubtitles
    );
    sceneSnapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: canvas.width, height: canvas.height },
    audio: totalDurationSec > 0 ? { codec: "aac", sampleRate: 44100, numberOfChannels: 1 } : undefined,
    fastStart: "in-memory",
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? {}),
    error: (e) => { throw e; },
  });

  const codecConfig: VideoEncoderConfig = {
    codec: "avc1.42001f",
    width: canvas.width,
    height: canvas.height,
    bitrate: 5_000_000,
    framerate: fps,
    latencyMode: "quality",
  };
  const support = await VideoEncoder.isConfigSupported(codecConfig);
  if (!support.supported) {
    const swConfig: VideoEncoderConfig = { ...codecConfig, codec: "avc1.4d001f" };
    const swSupport = await VideoEncoder.isConfigSupported(swConfig);
    if (!swSupport.supported) throw new Error("H.264 encoding is not supported in this browser");
    videoEncoder.configure(swConfig);
  } else {
    videoEncoder.configure(codecConfig);
  }

  let audioEncoder: AudioEncoder | null = null;
  if (typeof AudioEncoder !== "undefined" && totalDurationSec > 0) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta ?? {}),
      error: () => undefined,
    });
    audioEncoder.configure({
      codec: "mp4a.40.2",
      sampleRate: 44100,
      numberOfChannels: 1,
      bitrate: 128_000,
    });
  }

  let renderedFrames = 0;
  let videoTimestamp = 0;
  const frameDurationUs = Math.round(1_000_000 / fps);
  const transitionFrames = Math.ceil(0.4 * fps);

  for (let si = 0; si < scenes.length; si += 1) {
    const scene = scenes[si];
    const sceneDuration = sceneTimeline[si] || Math.max(1, scene.durationSeconds || 6);
    const sceneFrames = Math.ceil(sceneDuration * fps);
    const sceneImgs = sceneImages.get(scene.id) || [null];
    const prevSnapshot = si > 0 ? sceneSnapshots[si - 1] : null;
    const cues = sceneCues.get(scene.id) || [];
    const isLongNarration = options.showSubtitles && scene.narration.split(" ").length > 25;

    for (let f = 0; f < sceneFrames; f += 1) {
      const progress = sceneFrames > 1 ? f / (sceneFrames - 1) : 1;
      const elapsedInScene = f / fps;
      const imgIdx = sceneImgs.length > 1 ? Math.floor(elapsedInScene / 4) % sceneImgs.length : 0;
      const img = sceneImgs[imgIdx] || null;

      const activeCue = cues.find(
        (cue) => progress >= cue.startFraction && progress < cue.endFraction
      );
      const liveNarration = isLongNarration ? (activeCue?.text || "") : undefined;
      const shortCue =
        options.showSubtitles && !isLongNarration && activeCue?.text ? activeCue.text : undefined;
      drawBaseFrame(
        ctx,
        img,
        propertyLogo,
        title,
        scene.headline,
        scene.narration,
        progress,
        canvas.width,
        canvas.height,
        liveNarration,
        options.aspectRatio,
        shortCue,
        options.showSubtitles
      );

      if (
        options.showSubtitles &&
        !isLongNarration &&
        activeCue?.text &&
        options.aspectRatio !== "9:16"
      ) {
        drawSubtitlePill(ctx, activeCue.text, canvas.width, canvas.height);
      }

      if (f < transitionFrames && prevSnapshot) {
        const t = f / transitionFrames;
        applyTransitionOverlay(ctx, prevSnapshot, t, canvas.width, canvas.height);
      }

      const frame = new VideoFrame(canvas, {
        timestamp: videoTimestamp,
        duration: frameDurationUs,
      });
      const isKey = f === 0 || renderedFrames % (fps * 2) === 0;
      videoEncoder.encode(frame, { keyFrame: isKey });
      frame.close();
      videoTimestamp += frameDurationUs;
      renderedFrames += 1;
      if (renderedFrames % 12 === 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  await videoEncoder.flush();
  videoEncoder.close();

  if (audioEncoder && totalDurationSec > 0) {
    const sampleRate = 44100;
    const totalSamples = Math.ceil(totalDurationSec * sampleRate);
    const scheduled: Array<{ buffer: AudioBuffer; startSample: number; gainFactor?: number; maxSamples?: number }> = [];
    let sampleOffset = 0;
    for (let i = 0; i < scenes.length; i += 1) {
      const scene = scenes[i];
      const buf = sceneAudio.get(scene.id);
      const sceneDuration = sceneTimeline[i] || Math.max(1, scene.durationSeconds || 6);
      const narrationDuration = scenePlaybackTimeline[i] || Math.max(1, scene.durationSeconds || 6);
      if (buf) {
        scheduled.push({
          buffer: buf,
          startSample: sampleOffset,
          gainFactor: 1,
          // No maxSamples cap — let the full audio buffer play out.
          // The inter-scene gap (INTER_SCENE_GAP_SEC) provides breathing room
          // so the last word is never truncated by the next scene starting.
        });
        sampleOffset += Math.ceil(sceneDuration * sampleRate);
      } else {
        sampleOffset += Math.ceil(sceneDuration * sampleRate);
      }
    }
    const mixed = mixAudioBuffers(scheduled, totalSamples, 1);
    const pcm = mixed[0];
    const chunkSize = 4096;
    let audioTimestamp = 0;
    for (let i = 0; i < totalSamples; i += chunkSize) {
      const end = Math.min(i + chunkSize, totalSamples);
      const slice = pcm.slice(i, end);
      const audioData = new AudioData({
        format: "f32",
        sampleRate,
        numberOfFrames: slice.length,
        numberOfChannels: 1,
        timestamp: audioTimestamp,
        data: slice,
      });
      audioEncoder.encode(audioData);
      audioData.close();
      audioTimestamp += Math.round((slice.length / sampleRate) * 1_000_000);
      if (i % (chunkSize * 10) === 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    await audioEncoder.flush();
    audioEncoder.close();
  }

  muxer.finalize();
  const blob = new Blob([target.buffer], { type: "video/mp4" });
  return { blob, durationSec: totalDurationSec };
  } finally {
    closeAudioContext();
  }
}

export function VideoGeneratorPanel() {
  const params = useSearchParams();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const { setLogo, removeLogo, getLogo } = useVideoGeneratorStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaAssets, setMediaAssets] = useState<VideoMediaAsset[]>([]);
  const [uploadedVideo, setUploadedVideo] = useState<MediaFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [job, setJob] = useState<VideoGenerationJobResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uiState, setUiState] = useState<UiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArticleLoading, setIsArticleLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlanningScenes, setIsPlanningScenes] = useState(false);
  const [activeSceneUploadId, setActiveSceneUploadId] = useState<string | null>(null);
  const [plannedScript, setPlannedScript] = useState<PlannedScript | null>(null);
  const [sceneSelections, setSceneSelections] = useState<SceneImageSelection[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [showContentEditor, setShowContentEditor] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [brokenImageUrls, setBrokenImageUrls] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<Voice>("female");
  const [ttsSpeed, setTtsSpeed] = useState(1.2);
  const [maxScenes, setMaxScenes] = useState(6);
  const [imageProvider, setImageProvider] = useState<ImageProvider>("auto");
  const [language, setLanguage] = useState<VideoLanguage>("hi");
  const [category, setCategory] = useState("general");
  const [includeHook, setIncludeHook] = useState(false);
  const [refreshingSceneId, setRefreshingSceneId] = useState<string | null>(null);
  const [sceneSearchQuery, setSceneSearchQuery] = useState<string>("");
  const [expandedSceneCandidateIds, setExpandedSceneCandidateIds] = useState<Record<string, boolean>>({});
  const scenePageRef = useRef<Record<string, number>>({});
  const sceneFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptRef = useRef(0);
  const panelMountedRef = useRef(true);

  const renderSession = useSyncExternalStore(
    subscribeVideoRenderSession,
    getVideoRenderSessionSnapshot,
    getVideoRenderSessionSnapshot
  );

  useEffect(() => {
    panelMountedRef.current = true;
    return () => {
      panelMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const articleId = params.get("articleId");
    const queryTitle = params.get("title");
    const queryContent = params.get("content");

    if (queryTitle) setTitle(queryTitle);
    if (queryContent) setContent(queryContent);
    if (queryTitle || queryContent) setUiState("prefilled");

    if (!articleId) return;

    const loadArticle = async () => {
      setIsArticleLoading(true);
      setMediaAssets([]);
      setErrorMessage("");
      try {
        const article = await getArticleById(articleId);
        if (cancelled) return;
        const draft = buildArticleVideoDraft(article);
        if (!queryTitle) setTitle(draft.title);
        if (!queryContent) setContent(draft.content);
        setMediaAssets(draft.mediaAssets);
        const existingFeaturedVideo = article.featuredVideo;
        if (existingFeaturedVideo?.url) {
          setUploadedVideo({
            _id:
              (existingFeaturedVideo as { _id?: string; id?: string })._id ||
              (existingFeaturedVideo as { _id?: string; id?: string }).id ||
              "",
            fileName: (existingFeaturedVideo as { fileName?: string }).fileName || "featured-video.mp4",
            url: existingFeaturedVideo.url,
            path: existingFeaturedVideo.path || "",
            mimeType:
              (existingFeaturedVideo as { mimeType?: string }).mimeType || "video/mp4",
            source: "video-generator",
            size: Number((existingFeaturedVideo as { size?: number | string }).size || 0),
            propertyId: "",
            createdBy: {
              userName: "system",
            },
            createdAt: article.updatedAt || article.createdAt || new Date().toISOString(),
            updatedAt: article.updatedAt || article.createdAt || new Date().toISOString(),
            media_details:
              (existingFeaturedVideo as { duration?: string | number }).duration !== undefined
                ? { length: String((existingFeaturedVideo as { duration?: string | number }).duration) }
                : undefined,
          });
        }
        setUiState("prefilled");
        toast.success("Article loaded for video generation");
      } catch (error) {
        if (cancelled) return;
        setUiState("provider_error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load article");
        toast.error("Failed to load article for video generation");
      } finally {
        if (!cancelled) setIsArticleLoading(false);
      }
    };

    loadArticle();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const statusText = useMemo(() => {
    if (uiState === "idle") return "Ready";
    if (uiState === "prefilled") return "Prefilled";
    if (uiState === "loading") return "Generating";
    if (uiState === "success") return "Ready to Publish";
    if (uiState === "partial_success") return "Partial Success";
    if (uiState === "cancelled") return "Cancelled";
    if (uiState === "timeout") return "Timed Out";
    if (uiState === "validation_error") return "Validation Error";
    return "Provider Error";
  }, [uiState]);

  const previewAspectRatio = useMemo(() => {
    if (aspectRatio === "9:16") return "9 / 16";
    if (aspectRatio === "1:1") return "1 / 1";
    return "16 / 9";
  }, [aspectRatio]);

  const clearPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const schedulePoll = useCallback(
    (id: string) => {
      const attempt = pollAttemptRef.current;
      // Backoff + jitter to reduce status polling spikes.
      const nextMs = Math.min(9000, 1500 + attempt * 500 + Math.floor(Math.random() * 350));
      pollingTimeoutRef.current = setTimeout(async () => {
        try {
          if (!panelMountedRef.current) {
            return;
          }
          pollAttemptRef.current += 1;
          const current = await getVideoGenerationJob(id);
          if (!panelMountedRef.current) {
            return;
          }
          setJob(current);
          patchVideoRenderSession({ job: current });
          const mapped = mapStatusToUiState(current.status);
          setUiState(mapped);
          if (current.status === "processing") {
            schedulePoll(id);
            return;
          }
          if (current.status === "failed") {
            emitVideoGeneratorTelemetry("publish-failure", {
              propertyId: selectedProperty?._id,
              jobId: id,
              fallbackReason: "generation-failed",
            });
            setErrorMessage(current.errorMessage || "Video generation failed");
            toast.error(current.errorMessage || "Video generation failed");
          }
          if (current.status === "timeout") {
            emitVideoGeneratorTelemetry("publish-failure", {
              propertyId: selectedProperty?._id,
              jobId: id,
              fallbackReason: "generation-timeout",
            });
            setErrorMessage(current.errorMessage || "Video generation timed out");
            toast.error(current.errorMessage || "Video generation timed out");
          }
          if (current.status === "completed") {
            toast.success("Video generation completed");
          }
        } catch (error) {
          if (!panelMountedRef.current) {
            return;
          }
          setUiState("provider_error");
          setErrorMessage(error instanceof Error ? error.message : "Polling failed");
          toast.error("Failed to fetch video generation status");
        }
      }, nextMs);
    },
    [selectedProperty?._id]
  );

  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  useEffect(() => {
    if (renderSession.phase !== "success") return;
    if (renderSession.previewUrl) setPreviewUrl((p) => p || renderSession.previewUrl!);
    if (renderSession.uploadedVideo) setUploadedVideo((u) => u || renderSession.uploadedVideo!);
    if (renderSession.job) setJob((j) => j || renderSession.job!);
    if (renderSession.jobId) setJobId((id) => id || renderSession.jobId!);
    if (
      renderSession.job?.status === "processing" &&
      renderSession.jobId &&
      !pollingTimeoutRef.current
    ) {
      pollAttemptRef.current = 0;
      schedulePoll(renderSession.jobId);
    }
  }, [
    renderSession.phase,
    renderSession.previewUrl,
    renderSession.uploadedVideo,
    renderSession.job,
    renderSession.jobId,
    schedulePoll,
  ]);

  // Rehydrate title, content, and config from the session snapshot when the
  // component remounts after navigation. Only runs once (empty deps) — the
  // article-load effect overwrites these if an articleId param is present.
  useEffect(() => {
    const snap = getVideoRenderSessionSnapshot().inputSnapshot;
    if (!snap) return;
    // Don't clobber values already populated by URL params (articleId flow).
    setTitle((prev) => prev || snap.title);
    setContent((prev) => prev || snap.content);
    setAspectRatio((prev) => (prev === "9:16" ? (snap.aspectRatio as AspectRatio) : prev));
    setLanguage((prev) => (prev === "hi" ? (snap.language as VideoLanguage) : prev));
    setTtsVoice((prev) => (prev === "female" ? (snap.ttsVoice as Voice) : prev));
    setTtsSpeed((prev) => (prev === 1.2 ? snap.ttsSpeed : prev));
    setMaxScenes((prev) => (prev === 6 ? snap.maxScenes : prev));
    setImageProvider((prev) => (prev === "auto" ? (snap.imageProvider as ImageProvider) : prev));
    setCategory((prev) => (prev === "general" ? snap.category : prev));
    setIncludeHook((prev) => (prev === false ? snap.includeHook : prev));
    setShowSubtitles((prev) => (prev === false ? snap.showSubtitles : prev));
    if (snap.title || snap.content) setUiState("prefilled");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (plannedScript) return;
    if (
      renderSession.planPhase !== "planned" ||
      !renderSession.plannedScript ||
      !renderSession.sceneSelections
    ) {
      return;
    }
    const script = renderSession.plannedScript as PlannedScript;
    const selections = renderSession.sceneSelections as SceneImageSelection[];
    setPlannedScript(script);
    setSceneSelections(selections);
    setActiveSceneId(renderSession.planActiveSceneId || selections[0]?.scene.id || null);
    const flat = selections.flatMap((sel) => sel.candidates);
    setMediaAssets(uniqueMediaAssets(flat));
    setUiState("prefilled");
  }, [
    plannedScript,
    renderSession.planPhase,
    renderSession.plannedScript,
    renderSession.sceneSelections,
    renderSession.planActiveSceneId,
  ]);

  useEffect(() => {
    if (renderSession.planPhase !== "plan_error" || !renderSession.planErrorMessage) return;
    if (plannedScript) return;
    setErrorMessage(renderSession.planErrorMessage);
    setUiState("provider_error");
  }, [renderSession.planPhase, renderSession.planErrorMessage, plannedScript]);

  const handlePlanScenes = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      setUiState("validation_error");
      setErrorMessage("Title and content are required");
      return;
    }
    if (title.trim().length > 200) {
      setUiState("validation_error");
      setErrorMessage("Title must be 200 characters or less");
      return;
    }
    if (content.trim().length > 30000) {
      setUiState("validation_error");
      setErrorMessage("Content must be 30,000 characters or less");
      return;
    }
    setIsPlanningScenes(true);
    setPlannedScript(null);
    setSceneSelections([]);
    setExpandedSceneCandidateIds({});
    setErrorMessage("");
    setUiState("loading");
    const inputSnapshot: VideoRenderSessionInputState = {
      title: title.trim(),
      content: content.trim(),
      aspectRatio,
      language,
      ttsVoice,
      ttsSpeed,
      maxScenes,
      imageProvider,
      category,
      includeHook,
      showSubtitles,
    };
    patchVideoRenderSession({
      planPhase: "planning",
      plannedScript: null,
      sceneSelections: null,
      planActiveSceneId: null,
      planErrorMessage: null,
      inputSnapshot,
    });
    clearPolling();
    try {
      const planned = await planScenes(title.trim(), content.trim(), {
        maxScenes,
        language,
        voice: ttsVoice,
        aspectRatio,
        category,
        includeHook,
      });
      const articleAssets = uniqueMediaAssets(mediaAssets);
      const featuredAsset = articleAssets.find((asset) => asset.source === "featuredMedia");

      const sceneStockAssets = await Promise.all(
        planned.scenes.map((scene) =>
          fetchSceneImages(scene, {
            aspectRatio,
            imageProvider,
            articleTitle: title.trim(),
            category,
            language,
            propertyId: selectedProperty?._id,
          })
        )
      );

      const nextSelections: SceneImageSelection[] = planned.scenes.map((scene, i) => {
        const stockAssets = sceneStockAssets[i];
        const usedGallery = stockAssets.some((asset) => asset.source === "media-gallery");
        emitVideoGeneratorTelemetry(usedGallery ? "gallery-hit-rate" : "fallback-rate", {
          propertyId: selectedProperty?._id,
          sceneId: scene.id,
          assetType: stockAssets.some((asset) => asset.assetType === "video") ? "video" : "image",
          fallbackReason: usedGallery ? "" : "no-gallery-match",
        });
        const rankedArticleAssets = rankAssetsForScene(scene, articleAssets);
        const sceneAssets = uniqueMediaAssets([...stockAssets, ...rankedArticleAssets]);
        const preferredSelectedUrl =
          scene.order === 1 && featuredAsset
            ? featuredAsset.url
            : sceneAssets[0]?.url || null;
        return { scene, candidates: sceneAssets, selectedUrl: preferredSelectedUrl };
      });

      setPlannedScript(planned);
      setSceneSelections(nextSelections);
      setActiveSceneId(nextSelections[0]?.scene.id || null);
      const flattenedAssets = nextSelections.flatMap((selection) => selection.candidates);
      // Keep all assets (including cross-scene duplicates) so each scene retains its
      // own full candidate pool. Global dedup here would starve later scenes.
      setMediaAssets(flattenedAssets);
      setUiState("prefilled");
      patchVideoRenderSession({
        planPhase: "planned",
        plannedScript: planned,
        sceneSelections: nextSelections,
        planActiveSceneId: nextSelections[0]?.scene.id || null,
        planErrorMessage: null,
      });
      toast.success(`Scenes ready. Review and adjust ${planned.scenes.length} scene image selection(s).`);
    } catch (error) {
      setUiState("provider_error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to plan scenes");
      patchVideoRenderSession({
        planPhase: "plan_error",
        planErrorMessage: error instanceof Error ? error.message : "Failed to plan scenes",
      });
      toast.error("Failed to plan scenes");
    } finally {
      setIsPlanningScenes(false);
    }
  }, [
    title,
    content,
    clearPolling,
    maxScenes,
    language,
    ttsVoice,
    ttsSpeed,
    aspectRatio,
    category,
    includeHook,
    imageProvider,
    showSubtitles,
    mediaAssets,
    selectedProperty?._id,
  ]);

  const resolveRenderableAsset = useCallback(
    (selection: SceneImageSelection): VideoMediaAsset | null => {
      const selected = selection.candidates.find((asset) => asset.url === selection.selectedUrl) || null;
      const orderedCandidates = [
        ...(selected ? [selected] : []),
        ...selection.candidates.filter((asset) => asset.url !== selected?.url),
        ...mediaAssets,
      ];
      const seen = new Set<string>();
      for (const asset of orderedCandidates) {
        const assetUrl = asset.renderUrl || asset.url;
        if (!asset?.url || seen.has(asset.url)) continue;
        seen.add(asset.url);
        if (!assetUrl || brokenImageUrls.includes(asset.url)) continue;
        if (!toDisplayImageUrl(assetUrl)) continue;
        return asset;
      }
      return null;
    },
    [brokenImageUrls, mediaAssets]
  );

  const propertyLogoUrl = useMemo(() => {
    const property = selectedProperty as any;
    const rawLogo =
      property?.logos?.square?.url ||
      property?.logos?.horizontal?.url ||
      property?.logos?.primary?.url ||
      property?.logo?.url ||
      property?.logoUrl ||
      "";
    return rawLogo ? toDisplayImageUrl(rawLogo) : "";
  }, [selectedProperty]);

  // Custom logo uploaded by the user — overrides property logo when present.
  const customLogoDataUrl = selectedProperty?._id ? getLogo(selectedProperty._id) : null;
  const effectiveLogoUrl = customLogoDataUrl || propertyLogoUrl;

  const handleRenderVideo = useCallback(async () => {
    if (!plannedScript?.scenes?.length || !sceneSelections.length) {
      setUiState("validation_error");
      setErrorMessage("Plan scenes first, then render the video.");
      return;
    }
    setIsSubmitting(true);
    setIsRendering(true);
    setErrorMessage("");
    setUiState("loading");
    clearPolling();
    try {
      const unresolvedScenes = sceneSelections.filter((selection) => !resolveRenderableAsset(selection));
      if (unresolvedScenes.length > 0) {
        setUiState("validation_error");
        setErrorMessage(
          `${unresolvedScenes.length} scene(s) have no usable media after fallback checks. Refresh, replace, or upload media before generating.`
        );
        patchVideoRenderSession({
          phase: "idle",
          errorMessage: "Resolve scene media issues before generating.",
        });
        toast.error("Resolve scene media issues before generating");
        return;
      }

      beginVideoRenderAttempt();

      const sceneImageMap = new Map<string, VideoMediaAsset[]>();
      const sceneAudioMap = new Map<string, Blob | null>();
      let missingAudioScenes = 0;

      for (const selection of sceneSelections) {
        const { scene } = selection;
        const resolvedAsset = resolveRenderableAsset(selection);
        if (!resolvedAsset) {
          continue;
        }
        sceneImageMap.set(scene.id, [resolvedAsset]);
        if (resolvedAsset.assetType === "video") {
          emitVideoGeneratorTelemetry("render-fallback-to-still", {
            propertyId: selectedProperty?._id,
            sceneId: scene.id,
            assetType: "video",
            fallbackReason:
              resolvedAsset.clipEligibility === "fallback-required"
                ? "eligibility-check-failed"
                : resolvedAsset.clipEligibility === "disabled"
                  ? "clip-kill-switch"
                  : "v1-still-render",
          });
        }
        // eslint-disable-next-line no-await-in-loop
        const audio = await synthesizeSceneAudio(scene, {
          voice: ttsVoice,
          speedMultiplier: ttsSpeed,
          language,
        });
        if (!audio) missingAudioScenes += 1;
        sceneAudioMap.set(scene.id, audio);
      }
      if (missingAudioScenes > 0) {
        toast.warning(`${missingAudioScenes} scene(s) had TTS fallback with no audio`);
      }

      const flattenedAssets = sceneSelections.flatMap((selection) => {
        const resolved = resolveRenderableAsset(selection);
        return resolved ? [resolved] : [];
      });
      const jobMediaAssets = uniqueMediaAssets(flattenedAssets);
      setMediaAssets(jobMediaAssets);

      patchVideoRenderSession({ phase: "encoding" });
      const { blob, durationSec } = await renderVideoBlob(title.trim(), plannedScript, sceneImageMap, sceneAudioMap, {
        aspectRatio,
        showSubtitles,
        propertyLogoUrl: effectiveLogoUrl,
      });
      const localPreviewUrl = URL.createObjectURL(blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return localPreviewUrl;
      });

      patchVideoRenderSession({ phase: "uploading", previewUrl: localPreviewUrl });
      const file = new File(
        [blob],
        `${(params.get("articleId") || `video-${Date.now()}`)}.mp4`,
        { type: "video/mp4" }
      );
      setIsUploading(true);
      const uploaded = await uploadFiles(
        [file],
        false,
        "video-generator",
        title.trim(),
        selectedProperty?._id
      );
      const media = uploaded[0];
      setUploadedVideo(media);
      setIsUploading(false);

      const created = await createVideoGenerationJob({
        title: title.trim(),
        content: content.trim(),
        articleId: params.get("articleId") || undefined,
        mediaAssets: jobMediaAssets,
        uploadedVideoUrl: media?.url || undefined,
        durationSec,
      });
      setJob({
        ...created,
        result: {
          ...(created.result || {}),
          uploadedVideoUrl: media?.url || null,
          durationSec,
        },
      });
      setJobId(created._id);
      pollAttemptRef.current = 0;
      if (created.status === "processing") {
        schedulePoll(created._id);
      } else {
        setUiState(mapStatusToUiState(created.status));
      }
      patchVideoRenderSession({
        phase: "success",
        previewUrl: localPreviewUrl,
        uploadedVideo: media,
        job: {
          ...created,
          result: {
            ...(created.result || {}),
            uploadedVideoUrl: media?.url || null,
            durationSec,
          },
        },
        jobId: created._id,
        errorMessage: null,
      });
      toast.success("Video rendered and uploaded");
    } catch (error) {
      setUiState("provider_error");
      const msg = error instanceof Error ? error.message : "Failed to create job";
      setErrorMessage(msg);
      patchVideoRenderSession({ phase: "error", errorMessage: msg });
      toast.error("Failed to render/upload video");
    } finally {
      if (panelMountedRef.current) {
        setIsSubmitting(false);
        setIsRendering(false);
        setIsUploading(false);
      }
    }
  }, [
    plannedScript,
    sceneSelections,
    title,
    content,
    params,
    clearPolling,
    schedulePoll,
    mediaAssets,
    selectedProperty?._id,
    maxScenes,
    language,
    ttsVoice,
    aspectRatio,
    category,
    includeHook,
    imageProvider,
    ttsSpeed,
    showSubtitles,
    resolveRenderableAsset,
    effectiveLogoUrl,
  ]);

  const handleSelectSceneImage = useCallback((sceneId: string, imageUrl: string) => {
    setSceneSelections((current) =>
      current.map((selection) =>
        selection.scene.id === sceneId ? { ...selection, selectedUrl: imageUrl } : selection
      )
    );
  }, []);

  const handleRemoveSceneImage = useCallback((sceneId: string, imageUrl: string) => {
    setSceneSelections((current) =>
      current.map((selection) => {
        if (selection.scene.id !== sceneId) return selection;
        const candidates = selection.candidates.filter((asset) => asset.url !== imageUrl);
        const selectedUrl =
          selection.selectedUrl === imageUrl ? (candidates[0]?.url || null) : selection.selectedUrl;
        return { ...selection, candidates, selectedUrl };
      })
    );
  }, []);

  const handleSceneImageUpload = useCallback(
    async (sceneId: string, file: File | null) => {
      if (!file) return;
      try {
        setActiveSceneUploadId(sceneId);
        const uploaded = await uploadFiles(
          [file],
          false,
          "video-generator-scene",
          file.name,
          selectedProperty?._id
        );
        const media = uploaded[0];
        if (!media?.url) {
          throw new Error("Upload did not return an image URL");
        }
        const newAsset: VideoMediaAsset = {
          url: media.url,
          renderUrl: media.url,
          alt: media.fileName || "Uploaded scene image",
          caption: undefined,
          source: "upload",
          assetType: "image",
          sourceId: media._id,
          mimeType: media.mimeType,
        };
        setSceneSelections((current) =>
          current.map((selection) =>
            selection.scene.id === sceneId
              ? {
                ...selection,
                candidates: uniqueMediaAssets([newAsset, ...selection.candidates]),
                selectedUrl: newAsset.url,
              }
              : selection
          )
        );
        toast.success("Scene image uploaded and selected");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Scene image upload failed");
      } finally {
        setActiveSceneUploadId(null);
      }
    },
    [selectedProperty?._id]
  );

  const handleRefreshSceneImages = useCallback(
    async (sceneId: string, customQuery?: string) => {
      const selection = sceneSelections.find((s) => s.scene.id === sceneId);
      if (!selection) return;
      setRefreshingSceneId(sceneId);
      try {
        // If a custom query is given, reset page to 1; otherwise increment to get the next batch.
        const nextPage = customQuery
          ? 1
          : (scenePageRef.current[sceneId] ?? 1) + 1;
        scenePageRef.current[sceneId] = nextPage;

        const scene = customQuery
          ? { ...selection.scene, visualQuery: customQuery, visualQueryFallbacks: [] }
          : selection.scene;
        const stockAssets = await fetchSceneImages(scene, {
          aspectRatio,
          imageProvider,
          articleTitle: title.trim(),
          category,
          language,
          propertyId: selectedProperty?._id,
          page: nextPage,
        });
        const fresh = uniqueMediaAssets(stockAssets.length ? stockAssets : []);
        if (!fresh.length) {
          toast.warning("No images found. Try a different search term.");
          return;
        }
        setSceneSelections((current) =>
          current.map((s) =>
            s.scene.id === sceneId
              ? { ...s, candidates: fresh, selectedUrl: fresh[0]?.url || null }
              : s
          )
        );
        toast.success(`${fresh.length} image(s) loaded`);
      } catch {
        toast.error("Failed to refresh images");
      } finally {
        setRefreshingSceneId(null);
      }
    },
    [sceneSelections, aspectRatio, imageProvider, title, category, language, selectedProperty?._id]
  );

  const markBrokenImageUrl = useCallback((url: string) => {
    if (!url) return;
    setBrokenImageUrls((current) => (current.includes(url) ? current : [...current, url]));
  }, []);

  const handleSceneImageError = useCallback(
    (sceneId: string, imageUrl: string) => {
      if (!imageUrl) return;
      markBrokenImageUrl(imageUrl);
      // Remove the broken candidate entirely and auto-select the next working one.
      // We use the functional updater so we operate on fresh state and don't rely on
      // a stale brokenImageUrls closure.
      setSceneSelections((current) =>
        current.map((selection) => {
          if (selection.scene.id !== sceneId) return selection;
          const remaining = selection.candidates.filter((asset) => asset.url !== imageUrl);
          const fallback =
            selection.selectedUrl === imageUrl
              ? (remaining[0]?.url || null)
              : selection.selectedUrl;
          return { ...selection, candidates: remaining, selectedUrl: fallback };
        })
      );
    },
    [markBrokenImageUrl]
  );

  const activeSceneSelection = useMemo(
    () => sceneSelections.find((selection) => selection.scene.id === activeSceneId) || null,
    [sceneSelections, activeSceneId]
  );

  // Reset search query when switching scenes so stale text doesn't carry over.
  useEffect(() => {
    setSceneSearchQuery("");
  }, [activeSceneId]);
  const configuredScenesCount = useMemo(
    () => sceneSelections.filter((selection) => Boolean(selection.selectedUrl)).length,
    [sceneSelections]
  );

  const handleNewVideo = useCallback(() => {
    resetVideoRenderSession();
    setTitle("");
    setContent("");
    setUiState("idle");
    setErrorMessage("");
    setPlannedScript(null);
    setSceneSelections([]);
    setActiveSceneId(null);
    setJob(null);
    setJobId(null);
    setUploadedVideo(null);
    setPreviewUrl(null);
    setIsRendering(false);
    setIsPlanningScenes(false);
    clearPolling();
  }, [clearPolling]);

  const handleCancel = useCallback(async () => {
    // Stop any local rendering/planning in progress
    if (isRendering || isPlanningScenes) {
      setIsRendering(false);
      setIsPlanningScenes(false);
      patchVideoRenderSession({ phase: "idle", planPhase: "idle" });
      toast.info("Cancelled");
      return;
    }
    if (!jobId) return;
    try {
      const updated = await cancelVideoGenerationJob(jobId);
      setJob(updated);
      clearPolling();
      setUiState("cancelled");
      toast.success("Video generation cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed");
    }
  }, [jobId, isRendering, isPlanningScenes, clearPolling]);

  const handlePublish = useCallback(async () => {
    if (!jobId || !job) return;
    const articleId = params.get("articleId") || job.articleId;
    if (!articleId) {
      setUiState("validation_error");
      setErrorMessage("articleId is required for publish");
      return;
    }
    if (!uploadedVideo) {
      setUiState("validation_error");
      setErrorMessage("Generate and upload video first before publish");
      return;
    }
    try {
      const updated = await publishVideoGenerationJob(jobId, {
        articleId,
        uploadedVideo: {
          id: uploadedVideo._id,
          url: uploadedVideo.url,
          path: uploadedVideo.path,
          fileName: uploadedVideo.fileName,
          mimeType: uploadedVideo.mimeType,
          size: uploadedVideo.size,
          duration:
            uploadedVideo.media_details?.length !== undefined
              ? String(uploadedVideo.media_details.length)
              : undefined,
        },
      });
      setJob(updated);
      emitVideoGeneratorTelemetry("publish-success", {
        propertyId: selectedProperty?._id,
        jobId,
      });
      if (updated.status === "partial_failure") {
        setUiState("partial_success");
        toast.warning("Published with partial failure, retry may be required");
      } else {
        setUiState("success");
        toast.success("Video published successfully");
      }
    } catch (error) {
      emitVideoGeneratorTelemetry("publish-failure", {
        propertyId: selectedProperty?._id,
        jobId,
        fallbackReason: error instanceof Error ? error.message : "publish-failed",
      });
      setUiState("provider_error");
      setErrorMessage(error instanceof Error ? error.message : "Publish failed");
      toast.error("Failed to publish generated video");
    }
  }, [jobId, job, params, uploadedVideo, selectedProperty?._id]);

  return (
    <Card>
      
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div aria-live="polite" className="text-sm text-muted-foreground">
              {isArticleLoading
                ? "Loading article..."
                : isPlanningScenes || renderSession.planPhase === "planning"
                  ? "Planning scenes and collecting image candidates… (continues if you switch pages)"
                  : isRendering ||
                      renderSession.phase === "preparing" ||
                      renderSession.phase === "encoding" ||
                      renderSession.phase === "uploading"
                    ? isUploading || renderSession.phase === "uploading"
                      ? "Uploading final video..."
                      : isRendering || renderSession.phase === "encoding"
                        ? "Rendering video (continues if you switch pages)…"
                        : "Preparing audio and assets…"
                    : statusText}
            </div>
            {(renderSession.planPhase !== "idle" || renderSession.phase !== "idle" || title || plannedScript) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={handleNewVideo}
              >
                + New Video
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Flow: 1) Plan scenes 2) Choose images 3) Generate video 4) Publish.
          </p>
        </div>

        {(renderSession.phase === "preparing" ||
          renderSession.phase === "encoding" ||
          renderSession.phase === "uploading") && (
          <div className="rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
            Video generation is running in this browser tab. You can open Media Gallery or other
            pages—when you come back, the preview and job will appear here if the run already
            finished.
          </div>
        )}
        {renderSession.planPhase === "planning" && (
          <div className="rounded-md border border-sky-300/80 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-50">
            Scene planning is running in this browser tab. You can switch to Media Gallery or
            elsewhere—when you return, scenes and image picks will appear here if planning already
            finished.
          </div>
        )}
        {renderSession.phase === "error" && renderSession.errorMessage && !errorMessage ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Last render failed: {renderSession.errorMessage}
          </div>
        ) : null}
        {renderSession.planPhase === "plan_error" && renderSession.planErrorMessage ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Last plan failed: {renderSession.planErrorMessage}
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="video-title">Title</Label>
          <Input
            id="video-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter article title"
            aria-invalid={uiState === "validation_error"}
          />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <button
            type="button"
            onClick={() => setShowContentEditor((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-medium">Article content</span>
            <span className="text-xs text-muted-foreground">
              {showContentEditor ? "Hide" : "Show"}
            </span>
          </button>
          {showContentEditor ? (
            <textarea
              id="video-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or edit article content"
              className="w-full min-h-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-invalid={uiState === "validation_error"}
            />
          ) : (
            <p className="line-clamp-4 text-xs text-muted-foreground">
              {content || "No content loaded yet."}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">Core options</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="aspect-ratio">Orientation</Label>
              <select
                id="aspect-ratio"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="16:9">Landscape (16:9)</option>
                <option value="9:16">Portrait (9:16)</option>
                <option value="1:1">Square (1:1)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="max-scenes">Scenes</Label>
              <Input
                id="max-scenes"
                type="number"
                min={3}
                max={8}
                value={maxScenes}
                onChange={(e) => setMaxScenes(Math.max(3, Math.min(8, Number(e.target.value || 6))))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tts-voice">Voice</Label>
              <select
                id="tts-voice"
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value as Voice)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="neutral">Neutral</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as VideoLanguage)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="bn">Bengali</option>
                <option value="mr">Marathi</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedOptions((v) => !v)}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {showAdvancedOptions ? "Hide advanced options" : "Show advanced options"}
          </button>

          {showAdvancedOptions ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="tts-speed">TTS speed</Label>
                <Input
                  id="tts-speed"
                  type="number"
                  min={0.7}
                  max={1.3}
                  step={0.05}
                  value={ttsSpeed}
                  onChange={(e) => setTtsSpeed(Math.max(0.7, Math.min(1.3, Number(e.target.value || 1.2))))}
                />
              </div>
            <div className="space-y-1">
              <Label htmlFor="image-provider">Image provider</Label>
              <select
                id="image-provider"
                value={imageProvider}
                onChange={(e) => setImageProvider(e.target.value as ImageProvider)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="auto">Auto (Gallery first)</option>
                <option value="media-gallery">Media Gallery only</option>
                <option value="google">Google Images</option>
                <option value="pexels">Pexels</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="video-category">Category</Label>
              <Input
                id="video-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="general, technology, business..."
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm sm:col-span-2 lg:col-span-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showSubtitles}
                  onChange={(e) => setShowSubtitles(e.target.checked)}
                />
                Show captions
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeHook}
                  onChange={(e) => setIncludeHook(e.target.checked)}
                />
                Include hook opening scene
              </label>
            </div>

            {/* ── Custom watermark logo ── */}
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>Watermark logo</Label>
              <div className="flex items-center gap-3">
                {customLogoDataUrl ? (
                  <>
                    <img
                      src={customLogoDataUrl}
                      alt="Custom watermark"
                      className="h-10 max-w-[120px] rounded border border-border object-contain bg-muted/30 px-1"
                    />
                    <button
                      type="button"
                      onClick={() => selectedProperty?._id && removeLogo(selectedProperty._id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {propertyLogoUrl ? "Using property logo" : "No logo set"}
                  </p>
                )}
                <label className="cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                  {customLogoDataUrl ? "Replace" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !selectedProperty?._id) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = reader.result as string;
                        setLogo(selectedProperty._id, dataUrl);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground/60">
                Burned into every video frame (top-right). PNG with transparency recommended. Saved per property.
              </p>
            </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 rounded-md border bg-background/80 p-2">
          <Button
            onClick={handlePlanScenes}
            disabled={isArticleLoading || isPlanningScenes || isSubmitting || isRendering || isUploading || uiState === "loading"}
          >
            {isArticleLoading
              ? "Loading article..."
              : isPlanningScenes
                ? "Planning scenes..."
                : "Plan Scenes"}
          </Button>
          <Button
            onClick={handleRenderVideo}
            disabled={
              !plannedScript?.scenes?.length ||
              isPlanningScenes ||
              isSubmitting ||
              isRendering ||
              isUploading ||
              activeSceneUploadId !== null ||
              uiState === "loading"
            }
          >
            {isRendering ? "Rendering..." : isUploading ? "Uploading..." : isSubmitting ? "Generating..." : "Generate Video"}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={!isRendering && !isPlanningScenes && (!jobId || uiState !== "loading")}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handlePublish}
            disabled={!jobId || !uploadedVideo || (uiState !== "success" && uiState !== "partial_success")}
          >
            Publish and Insert
          </Button>
        </div>

        {plannedScript?.scenes?.length ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>Step 2: Pick image per scene</Label>
              <Badge variant="outline">{plannedScript.scenes.length} scenes</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure one scene at a time. Keep the selected image, switch to another option, or upload a replacement.
            </p>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
              {configuredScenesCount}/{sceneSelections.length} scenes configured
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sceneSelections.map((selection, index) => {
                const isActive = selection.scene.id === activeSceneId;
                const isDone = Boolean(selection.selectedUrl);
                return (
                  <button
                    key={selection.scene.id}
                    type="button"
                    onClick={() => setActiveSceneId(selection.scene.id)}
                    className={`rounded-md border px-3 py-2 text-left transition ${isActive ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"}`}
                  >
                    <p className="text-xs text-muted-foreground">Scene {index + 1}</p>
                    <p className="line-clamp-1 text-sm font-medium">{selection.scene.headline}</p>
                    <p className={`text-[11px] ${isDone ? "text-green-600" : "text-muted-foreground"}`}>
                      {isDone ? "Media selected" : "Needs selection"}
                    </p>
                  </button>
                );
              })}
            </div>

            {activeSceneSelection ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{activeSceneSelection.scene.headline}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      Query: {activeSceneSelection.scene.visualQuery}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={(node) => {
                        sceneFileInputRefs.current[activeSceneSelection.scene.id] = node;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        void handleSceneImageUpload(activeSceneSelection.scene.id, file);
                        e.currentTarget.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={activeSceneUploadId === activeSceneSelection.scene.id}
                      onClick={() => sceneFileInputRefs.current[activeSceneSelection.scene.id]?.click()}
                    >
                      {activeSceneUploadId === activeSceneSelection.scene.id ? "Uploading..." : "Upload / Replace"}
                    </Button>
                  </div>
                </div>

                {/* Search / refresh images for this scene */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={activeSceneSelection.scene.visualQuery}
                    value={sceneSearchQuery}
                    onChange={(e) => setSceneSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !refreshingSceneId) {
                        void handleRefreshSceneImages(activeSceneSelection.scene.id, sceneSearchQuery.trim() || undefined);
                      }
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={refreshingSceneId === activeSceneSelection.scene.id}
                    onClick={() =>
                      void handleRefreshSceneImages(activeSceneSelection.scene.id, sceneSearchQuery.trim() || undefined)
                    }
                  >
                    {refreshingSceneId === activeSceneSelection.scene.id ? "Searching..." : "🔄 Refresh"}
                  </Button>
                </div>

                {activeSceneSelection.selectedUrl ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Selected media</p>
                    {(() => {
                      const selectedAsset = activeSceneSelection.candidates.find(
                        (asset) => asset.url === activeSceneSelection.selectedUrl
                      );
                      if (selectedAsset?.assetType !== "video") return null;
                      const clipState = selectedAsset.clipEligibility;
                      if (clipState === "disabled") {
                        return (
                          <p className="text-[11px] text-amber-600">
                            Clip selected, clip path currently disabled by kill switch, using still image fallback.
                          </p>
                        );
                      }
                      if (clipState === "fallback-required") {
                        return (
                          <p className="text-[11px] text-amber-600">
                            Clip selected, rendered as still in V1 due to eligibility checks.
                          </p>
                        );
                      }
                      return (
                        <p className="text-[11px] text-muted-foreground">
                          Clip selected (rendered as still in V1).
                        </p>
                      );
                    })()}
                    <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-md border ring-2 ring-primary bg-background">
                      <div className="flex min-h-[170px] max-h-[300px] items-center justify-center bg-muted/40">
                        <img
                          src={toDisplayImageUrl(
                            activeSceneSelection.candidates.find(
                              (asset) => asset.url === activeSceneSelection.selectedUrl
                            )?.renderUrl || activeSceneSelection.selectedUrl
                          )}
                          alt="Selected scene image"
                          className="max-h-[300px] w-auto max-w-full object-contain"
                          onError={() =>
                            handleSceneImageError(
                              activeSceneSelection.scene.id,
                              activeSceneSelection.selectedUrl || ""
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeSceneSelection.candidates.length ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Other options</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(expandedSceneCandidateIds[activeSceneSelection.scene.id]
                        ? activeSceneSelection.candidates
                        : activeSceneSelection.candidates.slice(0, 4)
                      ).map((asset) => {
                        const isSelected = asset.url === activeSceneSelection.selectedUrl;
                        return (
                          <div
                            key={asset.url}
                            className={`overflow-hidden rounded-md border ${isSelected ? "ring-2 ring-primary" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectSceneImage(activeSceneSelection.scene.id, asset.url)
                              }
                              className="block w-full text-left"
                            >
                              <div className="h-24 w-full bg-black/60">
                                <img
                                  src={toDisplayImageUrl(asset.renderUrl || asset.url)}
                                  alt={asset.alt || "Scene option"}
                                  className="h-full w-full object-contain"
                                  onError={() =>
                                    handleSceneImageError(activeSceneSelection.scene.id, asset.url)
                                  }
                                />
                              </div>
                            </button>
                            <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                              <span className="truncate text-muted-foreground">
                                {asset.assetType === "video" ? "clip" : "image"} · {asset.source || "stock"}
                              </span>
                              <button
                                type="button"
                                className="text-destructive"
                                onClick={() =>
                                  handleRemoveSceneImage(activeSceneSelection.scene.id, asset.url)
                                }
                                disabled={activeSceneSelection.candidates.length <= 1}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                        })}
                    </div>
                    {activeSceneSelection.candidates.length > 4 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          setExpandedSceneCandidateIds((current) => ({
                            ...current,
                            [activeSceneSelection.scene.id]:
                              !current[activeSceneSelection.scene.id],
                          }))
                        }
                      >
                        {expandedSceneCandidateIds[activeSceneSelection.scene.id]
                          ? "Show less"
                          : `Show more (${activeSceneSelection.candidates.length - 4})`}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No options available. Upload an image for this scene.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        {previewUrl ? (
          <div className="space-y-2">
            <Label>Rendered preview</Label>
            <div className="overflow-hidden rounded-md border bg-black">
              <video
                src={previewUrl}
                controls
                className="mx-auto w-full max-h-[62vh] object-contain"
                style={{ aspectRatio: previewAspectRatio }}
              />
            </div>
          </div>
        ) : null}

        {uploadedVideo ? (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Uploaded Video</p>
            <p>File: {uploadedVideo.fileName}</p>
            <p>
              URL:{" "}
              <a href={uploadedVideo.url} target="_blank" rel="noreferrer" className="text-primary underline">
                Open media
              </a>
            </p>
          </div>
        ) : null}

        {job ? (
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Latest Job</summary>
            <p className="font-medium">Latest Job</p>
            <p>ID: {job._id}</p>
            <p>Status: {job.status}</p>
            <p>Published: {job.publishedAt ? "yes" : "no"}</p>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
