"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  MessageCircle,
  Twitter,
  Image as ImageIcon,
  BookOpen,
  Mail,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RepurposeGrid } from "@/components/repurpose/RepurposeGrid";
import { useAuthStore, havePermission } from "@/lib/auth";
import {
  generateSlotImage,
  getLatestRepurpose,
  regenerateRepurposeFormat,
  repurposeArticle,
  updateRepurposeOutputs,
  shareToTwitter,
  shareSingleTweetToTwitter,
  shareCarouselToInstagram,
  type ImageBearingFormat,
  type ImageSource,
  type RepurposedArticle,
  type RepurposeFormat,
  type RepurposeMeta,
} from "@/lib/repurpose-api";
import { getArticleById } from "@/lib/api";

const PHASES = [
  "Reading the article…",
  "Spotting the angle that travels…",
  "Drafting versions for every channel…",
  "Tightening copy for each format…",
];

export default function RepurposePage() {
  const params = useParams<{ id: string }>();
  const articleId = params?.id;
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!havePermission(user, "repurpose", "read")) {
      toast.error("You do not have permission to view repurpose");
      router.push("/dashboard");
    }
  }, [user, hasHydrated, router]);

  const [outputs, setOutputs] = useState<RepurposedArticle | null>(null);
  const [meta, setMeta] = useState<RepurposeMeta | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<Set<RepurposeFormat>>(
    new Set()
  );
  
  const [generatingImages, setGeneratingImages] = useState<Record<string, string>>({});
  
  const [imageQueue, setImageQueue] = useState<{
    done: number;
    total: number;
    succeeded: number;
    failed: number;
  } | null>(null);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const initRef = useRef(false);
  const queueAbortRef = useRef(false);

  useEffect(() => {
    if (!jobId || typeof window === "undefined") return;
    const key = `repurpose-generating-v2-${jobId}`;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const obj = JSON.parse(stored);
        if (typeof obj === "object" && obj !== null) {
          setGeneratingImages((prev) => ({ ...prev, ...obj }));
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId || typeof window === "undefined") return;
    const key = `repurpose-generating-v2-${jobId}`;
    if (Object.keys(generatingImages).length === 0) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, JSON.stringify(generatingImages));
    }
  }, [jobId, generatingImages]);

  useEffect(() => {
    if (!articleId || Object.keys(generatingImages).length === 0) return;
    const handle = window.setInterval(async () => {
      try {
        const latest = await getLatestRepurpose(articleId);
        if (!latest) return;
        
        setOutputs(latest.outputs);
        setMeta(latest.meta);
        
        setGeneratingImages((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const k in prev) {
            const lastTs = prev[k];
            const currentTs = getSlotTimestamp(latest.outputs, k);
            if (currentTs && currentTs !== lastTs) {
              delete next[k];
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      } catch {
        // network blip
      }
    }, 5000);
    return () => window.clearInterval(handle);
  }, [articleId, generatingImages]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const lastSavedOutputsRef = useRef<string>("");

  useEffect(() => {
    if (!jobId || !outputs) return;
    const currentStr = JSON.stringify(outputs);

    if (lastSavedOutputsRef.current === "") {
      lastSavedOutputsRef.current = currentStr;
      return;
    }

    if (currentStr === lastSavedOutputsRef.current) return;
 
    setSaveStatus("unsaved");
 
    const timer = setTimeout(async () => {
      try {
        setSaveStatus("saving");
        setIsSaving(true);
        await updateRepurposeOutputs(jobId, outputs);
        lastSavedOutputsRef.current = currentStr;
        setSaveStatus("saved");
        toast.success("Changes saved", { duration: 1000, id: "auto-save" });
        setTimeout(() => setSaveStatus("idle"), 3000);
      } catch (err: any) {
        console.error("Auto-save failed:", err);
        setSaveStatus("unsaved");
        toast.error("Auto-save failed", { id: "auto-save" });
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [outputs, jobId]);

  useEffect(() => {
    if (!articleId) return;
    getArticleById(articleId)
      .then((article) => setArticleTitle(article?.title || null))
      .catch(() => setArticleTitle(null));
  }, [articleId]);

  useEffect(() => {
    if (!isLoading) return;
    const handle = window.setInterval(() => {
      setPhaseIndex((p) => (p + 1) % PHASES.length);
    }, 1700);
    return () => window.clearInterval(handle);
  }, [isLoading]);

  useEffect(() => {
    if (!articleId || initRef.current) return;
    initRef.current = true;
    bootstrap();
  }, [articleId]);

  async function bootstrap() {
    if (!articleId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const latest = await getLatestRepurpose(articleId);
      if (latest) {
        setOutputs(latest.outputs);
        setMeta(latest.meta);
        setJobId(latest.jobId);
        setConfig(latest.config);
        setGeneratedAt(latest.generatedAt);
        setIsStale(latest.isStale);
        setIsLoading(false);
        // Immediately count missing images and lock the UI before the queue starts
        const missingCount = countMissingImages(latest.outputs, latest.config);
        if (missingCount > 0) {
          setImageQueue({ done: 0, total: missingCount, succeeded: 0, failed: 0 });
          // Pass data directly to avoid stale closure
          runImageQueueDirect("all", latest.outputs, latest.jobId, latest.config);
        }
        return;
      }
      
      // Not generated yet? Stop loader and show selection dialog
      setIsLoading(false);
      setIsSelectionOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load repurpose";
      setErrorMessage(message);
      setIsLoading(false);
    }
  }

  function countMissingImages(o: RepurposedArticle, cfg?: any): number {
    const instaMissing = o.instagramCarousel.filter(c => !c.image).length;
    const storyMissing = cfg?.mirrorInstaToWebstory ? 0 : o.webStory.filter(s => !s.image).length;
    const waMissing = (o.whatsappCard?.imagePrompt && !o.whatsappCard.image) ? 1 : 0;
    const twMissing = (o.twitterThread[0]?.imagePrompt && !o.twitterThread[0]?.image) ? 1 : 0;
    return instaMissing + storyMissing + waMissing + twMissing;
  }

  async function runRepurpose(
    forceRegenerate: boolean,
    formats?: RepurposeFormat[],
    configParams?: any
  ) {
    if (!articleId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await repurposeArticle(articleId, { 
        forceRegenerate,
        formats: formats,
        config: configParams
      });
      setOutputs(result.outputs);
      setMeta(result.meta);
      setJobId(result.jobId);
      setConfig(result.config);
      setGeneratedAt(new Date().toISOString());
      setIsStale(false);
      if (result.cached) {
        toast.message("Loaded from cache");
      } else {
        toast.success("Generated all formats");
        // Immediately lock the UI and start image generation — no setTimeout gap
        const mc = countMissingImages(result.outputs, result.config);
        if (mc > 0) {
          setImageQueue({ done: 0, total: mc, succeeded: 0, failed: 0 });
          runImageQueueDirect("all", result.outputs, result.jobId, result.config);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not repurpose article";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegenerate(format: RepurposeFormat) {
    if (!articleId) return;
    setRegenerating((prev) => new Set(prev).add(format));
    try {
      const result = await regenerateRepurposeFormat(articleId, format, config);
      setOutputs(result.outputs);
      setMeta(result.meta);
      setJobId(result.jobId);
      setConfig(result.config);
      setGeneratedAt(new Date().toISOString());
      toast.success(`Regenerated ${labelFor(format)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Regenerate failed";
      toast.error(message);
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(format);
        return next;
      });
      // Check for missing images in regenerated format
      if (outputs) {
        const mc = countMissingImages(outputs, config);
        if (mc > 0) {
          setImageQueue({ done: 0, total: mc, succeeded: 0, failed: 0 });
          runImageQueueDirect("all", outputs, jobId!, config);
        }
      }
    }
  }

  async function handleGenerateImage(
    opts: { format: ImageBearingFormat; index: number },
    source: ImageSource = "generated",
  ): Promise<RepurposedArticle | null> {
    if (!jobId) {
      toast.error("Generate the formats first.");
      return null;
    }
    const key = `${opts.format}:${opts.index}`;
    const currentTs = getSlotTimestamp(outputs, key) || "";
    
    setGeneratingImages((prev) => ({ ...prev, [key]: currentTs }));

    const loadingToastId = toast.loading(`Generating image...`);
    
    try {
      const result = await generateSlotImage(
        jobId,
        opts.format,
        opts.index,
        source,
      );
      toast.dismiss(loadingToastId);
      
      setMeta(result.meta);
      setOutputs(prev => {
        if (!prev) return result.outputs;
        const next = { ...prev, ...result.outputs };
        
        if (config?.mirrorInstaToWebstory && opts.format === "instagramCarousel") {
          if (next.webStory[opts.index]) {
            next.webStory[opts.index] = { ...next.webStory[opts.index], image: result.image };
          }
        } else if (config?.mirrorInstaToWebstory && opts.format === "webStory") {
          if (next.instagramCarousel[opts.index]) {
            next.instagramCarousel[opts.index] = { ...next.instagramCarousel[opts.index], image: result.image };
          }
        }
        return next;
      });

      return result.outputs;
    } catch (err) {
      toast.dismiss(loadingToastId);
      const message = err instanceof Error ? err.message : "Image generation failed";
      toast.error(message);
      return null;
    } finally {
      setGeneratingImages((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSlotImageClick(
    opts: { format: ImageBearingFormat; index: number },
    source: ImageSource = "generated",
  ) {
    const result = await handleGenerateImage(opts, source);
    if (result) {
      toast.success("Image updated successfully");
    }
  }

  async function runImageQueueDirect(
    scope: "all" | ImageBearingFormat,
    currentOutputs: RepurposedArticle,
    currentJobId: string,
    currentConfig?: any,
  ) {
    const targets: Array<{ format: ImageBearingFormat; index: number }> = [];
    if (scope === "all" || scope === "instagramCarousel") {
      currentOutputs.instagramCarousel.forEach((card, index) => {
        if (!card.image) targets.push({ format: "instagramCarousel", index });
      });
    }
    if ((scope === "all" && !currentConfig?.mirrorInstaToWebstory) || scope === "webStory") {
      currentOutputs.webStory.forEach((slide, index) => {
        if (!slide.image) targets.push({ format: "webStory", index });
      });
    }
    if (scope === "all" || scope === "whatsapp") {
      if (currentOutputs.whatsappCard?.imagePrompt && !currentOutputs.whatsappCard.image) {
        targets.push({ format: "whatsapp", index: 0 });
      }
    }
    if (scope === "all" || scope === "twitterHero") {
      if (currentOutputs.twitterThread[0]?.imagePrompt && !currentOutputs.twitterThread[0]?.image) {
        targets.push({ format: "twitterHero", index: 0 });
      }
    }

    if (targets.length === 0) {
      setImageQueue(null);
      return;
    }

    queueAbortRef.current = false;
    setImageQueue({ done: 0, total: targets.length, succeeded: 0, failed: 0 });

    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      if (queueAbortRef.current) break;
      const result = await handleGenerateImage(targets[i]);
      if (result) succeeded += 1;
      else failed += 1;
      setImageQueue({ done: i + 1, total: targets.length, succeeded, failed });
    }

    setImageQueue(null);
    queueAbortRef.current = false;
  }

  function cancelImageQueue() {
    queueAbortRef.current = true;
  }

  async function handleShareTwitter() {
    if (!jobId) return;
    try {
      const result = await shareToTwitter(jobId);
      if (result.success) {
        toast.success("Posted to X!", {
          action: { label: "View", onClick: () => window.open(result.tweetUrl, "_blank") },
        });
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Sharing failed"); }
  }

  async function handleShareSingleTweet(index: number) {
    if (!jobId) return;
    try {
      const result = await shareSingleTweetToTwitter(jobId, index);
      if (result.success) {
        toast.success("Tweet posted!", {
          action: { label: "View", onClick: () => window.open(result.tweetUrl, "_blank") },
        });
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Sharing failed"); }
  }

  async function handleShareInstagram() {
    if (!jobId) return;
    try {
      const result = await shareCarouselToInstagram(jobId);
      if (result.success) toast.success("Posted to Instagram!");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Sharing failed"); }
  }

  const generatingImagesSet = useMemo(() => new Set(Object.keys(generatingImages)), [generatingImages]);
  const isAnyImageGenerating = generatingImagesSet.size > 0;
  const isImageBusy = isAnyImageGenerating || !!imageQueue;

  const totalMissingImages = useMemo(() => {
    if (!outputs) return 0;
    const instaMissing = outputs.instagramCarousel.filter(c => !c.image).length;
    const storyMissing = config?.mirrorInstaToWebstory ? 0 : outputs.webStory.filter(s => !s.image).length;
    const waMissing = (outputs.whatsappCard?.imagePrompt && !outputs.whatsappCard.image) ? 1 : 0;
    const twMissing = (outputs.twitterThread[0]?.imagePrompt && !outputs.twitterThread[0]?.image) ? 1 : 0;
    return instaMissing + storyMissing + waMissing + twMissing;
  }, [outputs, config]);

  return (
    <div className="container mx-auto max-w-7xl py-6 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 min-w-0">
          <Link href={articleId ? `/editor/${articleId}` : "/blogs"} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />Back to article
          </Link>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">One-Click Repurpose</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Publishing Universe</h1>
          {articleTitle && <p className="text-sm text-muted-foreground max-w-3xl truncate">from “{articleTitle}”</p>}
          <p className="text-sm text-muted-foreground max-w-3xl">One article, every surface — generated in one shot.</p>
          {generatedAt && !isLoading && (
            <p className="text-[11px] text-muted-foreground">Last generated {formatRelative(generatedAt)} {isStale && <span className="ml-2 inline-flex items-center rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-medium">Article changed</span>}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={bootstrap} disabled={isLoading || isImageBusy} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Refresh
          </Button>
          {outputs && totalMissingImages > 0 && !isImageBusy && (
            <Button variant="outline" onClick={() => { if (!outputs || !jobId) return; const mc = countMissingImages(outputs, config); if (mc > 0) setImageQueue({ done: 0, total: mc, succeeded: 0, failed: 0 }); runImageQueueDirect("all", outputs, jobId, config); }} disabled={isLoading} className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
              <ImagePlus className="h-4 w-4" />Generate all images <span className="rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-1.5 py-0.5">{totalMissingImages}</span>
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsSelectionOpen(true)} disabled={isLoading || isImageBusy} className="gap-2">
            <RefreshCw className="h-4 w-4" />Regenerate all
          </Button>
        </div>
      </div>

      {isImageBusy && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {imageQueue ? `Generating image ${imageQueue.done + 1} of ${imageQueue.total}` : `AI is generating ${generatingImagesSet.size} images in background...`}
            </p>
            {imageQueue && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-primary/10 overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(imageQueue.done / imageQueue.total) * 100}%` }} />
              </div>
            )}
          </div>
          {imageQueue && <Button size="sm" variant="ghost" onClick={cancelImageQueue} className="gap-1"><X className="h-3.5 w-3.5" />Cancel</Button>}
        </div>
      )}

      {isLoading && !outputs && <LoadingState phase={PHASES[phaseIndex]} />}

      {outputs && (
        <RepurposeGrid
          outputs={outputs}
          meta={meta || undefined}
          regenerating={regenerating}
          generatingImages={generatingImagesSet}
          onRegenerate={handleRegenerate}
          onGenerateImage={handleSlotImageClick}
          onGenerateAllImages={(format) => {
            if (!outputs || !jobId) return;
            const mc = countMissingImages(outputs, config);
            if (mc > 0) setImageQueue({ done: 0, total: mc, succeeded: 0, failed: 0 });
            runImageQueueDirect(format, outputs, jobId, config);
          }}
          onUpdateOutputs={setOutputs}
          onShareTwitter={handleShareTwitter}
          onShareSingleTweet={handleShareSingleTweet}
          onShareInstagram={handleShareInstagram}
          isQueueRunning={isAnyImageGenerating}
          filenameSeed={slugify(articleTitle || "article")}
          articleId={articleId}
        />
      )}

      <RegenerateSelectionDialog
        open={isSelectionOpen}
        onClose={() => setIsSelectionOpen(false)}
        onConfirm={(selFormats, selConfig) => {
          setIsSelectionOpen(false);
          runRepurpose(true, selFormats, selConfig);
        }}
        initialConfig={config}
      />
    </div>
  );
}

function LoadingState({ phase }: { phase: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div><p className="text-sm font-medium">{phase}</p><p className="text-xs text-muted-foreground">This usually takes 5–15 seconds.</p></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => ( <Skeleton key={i} className="h-64 rounded-lg" /> ))}
      </div>
    </div>
  );
}

function labelFor(format: RepurposeFormat): string {
  const map: Record<RepurposeFormat, string> = { webStory: "web story", instagramCarousel: "Instagram carousel", whatsappCard: "WhatsApp card", pushNotifications: "push notifications", newsletter: "newsletter", twitterThread: "X thread" };
  return map[format];
}

function getSlotTimestamp(outputs: RepurposedArticle | null, key: string): string | null {
  if (!outputs) return null;
  const [format, indexStr] = key.split(":");
  const idx = Number(indexStr);
  if (format === "webStory") return outputs.webStory?.[idx]?.image?.generatedAt || null;
  if (format === "instagramCarousel") return outputs.instagramCarousel?.[idx]?.image?.generatedAt || null;
  if (format === "whatsapp") return outputs.whatsappCard?.image?.generatedAt || null;
  if (format === "twitterHero") return outputs.twitterThread?.[0]?.image?.generatedAt || null;
  return null;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function formatRelative(iso: string): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

const PLATFORMS: { id: RepurposeFormat; label: string; icon: any; color: string; }[] = [
  { id: "whatsappCard", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-500" },
  { id: "twitterThread", label: "X / Twitter", icon: Twitter, color: "text-sky-500" },
  { id: "instagramCarousel", label: "Instagram", icon: ImageIcon, color: "text-pink-500" },
  { id: "webStory", label: "Web Story", icon: BookOpen, color: "text-primary" },
  { id: "newsletter", label: "Newsletter", icon: Mail, color: "text-amber-500" },
  { id: "pushNotifications", label: "Push", icon: Bell, color: "text-indigo-500" },
];

function RegenerateSelectionDialog({
  open,
  onClose,
  onConfirm,
  initialConfig,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (formats: RepurposeFormat[], config: any) => void;
  initialConfig?: any;
}) {
  const [selected, setSelected] = useState<Set<RepurposeFormat>>(new Set(PLATFORMS.map((p) => p.id)));
  const [instaSlideCount, setInstaSlideCount] = useState(initialConfig?.instaSlideCount || 5);
  const [webStorySlideCount, setWebStorySlideCount] = useState(initialConfig?.webStorySlideCount || 5);
  const [mirrorInsta, setMirrorInsta] = useState(initialConfig?.mirrorInstaToWebstory ?? true);
  const hasInsta = selected.has("instagramCarousel");
  const hasWebStory = selected.has("webStory");
  const canMirror = hasInsta && hasWebStory;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{initialConfig ? "Regenerate Previews" : "Start Repurpose Workflow"}</DialogTitle></DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Select Platforms</Label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <button key={p.id} onClick={() => { setSelected((prev) => { const next = new Set(prev); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; }); }} className={cn("flex items-center gap-2 p-2 rounded-md border text-left transition-all", isSelected ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20" : "bg-muted/30 border-transparent opacity-60 grayscale")}>
                    <p.icon className={cn("h-3.5 w-3.5", isSelected ? p.color : "text-muted-foreground")} /><span className="text-[11px] font-medium">{p.label}</span>
                    {isSelected && <Check className="ml-auto h-3 w-3 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
          {(hasInsta || hasWebStory) && (
            <div className="pt-4 border-t space-y-4">
              {canMirror && ( <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-xs font-medium">Mirror Insta Content</Label><p className="text-[10px] text-muted-foreground">Keep Web Story same as Instagram</p></div><Switch checked={mirrorInsta} onCheckedChange={setMirrorInsta} /></div> )}
              {hasInsta && ( <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-xs font-medium text-pink-500">{canMirror && mirrorInsta ? "Slides for both" : "Instagram Card Count"}</Label></div><Select value={String(instaSlideCount)} onValueChange={(v) => setInstaSlideCount(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ( <SelectItem key={n} value={String(n)} className="text-xs">{n} slides</SelectItem> ))}</SelectContent></Select></div> )}
              {hasWebStory && (!mirrorInsta || !hasInsta) && ( <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-xs font-medium text-primary">Web Story Slide Count</Label></div><Select value={String(webStorySlideCount)} onValueChange={(v) => setWebStorySlideCount(Number(v))}><SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ( <SelectItem key={n} value={String(n)} className="text-xs">{n} slides</SelectItem> ))}</SelectContent></Select></div> )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={selected.size === 0} onClick={() => onConfirm(Array.from(selected), { instaSlideCount, webStorySlideCount: mirrorInsta ? instaSlideCount : webStorySlideCount, mirrorInstaToWebstory: mirrorInsta && selected.has("instagramCarousel") && selected.has("webStory") })} className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            {initialConfig ? "Regenerate Selected" : "Start Generation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
