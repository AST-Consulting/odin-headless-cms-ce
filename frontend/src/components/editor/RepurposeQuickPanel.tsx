"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  ImageIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Twitter,
  BookOpen,
  Mail,
  Bell,
  Layers,
  ChevronRight,
  ExternalLink,
  Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getLatestRepurpose,
  repurposeArticle,
  updateRepurposeOutputs,
  shareToTwitter,
  shareSingleTweetToTwitter,
  shareCarouselToInstagram,
  generateSlotImage,
  type ImageBearingFormat,
  type RepurposedArticle,
  type RepurposeFormat,
  type RepurposeMeta,
  type TwitterTweet,
  type WhatsappCard,
  type InstagramCard,
  type WebStorySlide,
} from "@/lib/repurpose-api";
import {
  formatTwitterThreadForCopy,
  formatWhatsappForCopy,
  formatInstagramCardForCopy,
} from "@/lib/repurpose-formatters";
import { copyImage } from "@/lib/clipboard-with-image";
import { downloadImage, inferImageExtension, downloadImagesSequential } from "@/lib/download-image";

interface RepurposeQuickPanelProps {
  articleId?: string;
}

type CopyKey =
  | "whatsapp:text"
  | "whatsapp:image"
  | "thread:text"
  | `tweet:text:${number}`
  | `tweet:image:${number}`
  | `insta:text:${number}`
  | `insta:download:${number}`
  | `webstory:text:${number}`
  | `webstory:download:${number}`;

export function RepurposeQuickPanel({ articleId }: RepurposeQuickPanelProps) {
  const [loading, setLoading] = useState(false);
  const [outputs, setOutputs] = useState<RepurposedArticle | null>(null);
  const [meta, setMeta] = useState<RepurposeMeta | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<Set<RepurposeFormat>>(
    new Set(["whatsappCard", "twitterThread", "instagramCarousel", "webStory"])
  );
  const [instaSlideCount, setInstaSlideCount] = useState(5);
  const [webStorySlideCount, setWebStorySlideCount] = useState(5);
  const [mirrorInsta, setMirrorInsta] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState<Set<CopyKey>>(new Set());
  const [done, setDone] = useState<CopyKey | null>(null);
  const [, setIsSaving] = useState(false);
  const [sharingTwitter, setSharingTwitter] = useState(false);
  const [sharingInstagram, setSharingInstagram] = useState(false);
  const [sharingTweetIdx, setSharingTweetIdx] = useState<number | null>(null);
  const lastSavedOutputsRef = useRef<string>("");

  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!jobId || !outputs) return;
    let active = true;
    const currentStr = JSON.stringify(outputs);

    if (lastSavedOutputsRef.current === "") {
      lastSavedOutputsRef.current = currentStr;
      return;
    }

    if (currentStr === lastSavedOutputsRef.current) return;

    setSaveStatus("unsaved");

    const timer = setTimeout(async () => {
      try {
        if (!active) return;
        setSaveStatus("saving");
        setIsSaving(true);
        await updateRepurposeOutputs(jobId, outputs);
        if (!active) return;
        lastSavedOutputsRef.current = currentStr;
        setSaveStatus("saved");
        toast.success("Changes saved", { duration: 1000, id: "quick-save" });
        setTimeout(() => {
          if (active) setSaveStatus("idle");
        }, 3000);
      } catch (err: any) {
        if (!active) return;
        console.error("Auto-save failed:", err);
        setSaveStatus("unsaved");
        toast.error("Auto-save failed", { id: "quick-save" });
      } finally {
        if (active) setIsSaving(false);
      }
    }, 2000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [outputs, jobId]);

  useEffect(() => {
    if (articleId && !outputs && !loading) {
      load(false, undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  if (!articleId) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
        Save the article first to enable repurpose previews.
      </div>
    );
  }

  async function load(
    forceRegenerate: boolean,
    formats?: RepurposeFormat[],
    checkCacheOnly = false
  ) {
    if (!articleId) return;
    setLoading(true);
    try {
      if (!forceRegenerate) {
        const cached = await getLatestRepurpose(articleId);
        if (cached) {
          setOutputs(cached.outputs);
          setMeta(cached.meta);
          setJobId(cached.jobId);
          toast.message("Loaded from cache");
          if (cached.outputs.instagramCarousel.some(c => !c.image) || cached.outputs.webStory.some(s => !s.image)) {
             runImageQueue(cached.jobId, cached.outputs, ["instagramCarousel", "webStory"]);
          }
          return;
        }
        if (checkCacheOnly) {
          setLoading(false);
          return;
        }
      }
      const result = await repurposeArticle(articleId, {
        forceRegenerate,
        formats: formats || Array.from(selectedFormats),
        config: {
          instaSlideCount,
          webStorySlideCount: mirrorInsta ? instaSlideCount : webStorySlideCount,
          mirrorInstaToWebstory: mirrorInsta && selectedFormats.has("instagramCarousel") && selectedFormats.has("webStory"),
        },
      });
      setOutputs(result.outputs);
      setMeta(result.meta);
      setJobId(result.jobId);
      toast.success(result.cached ? "Loaded from cache" : "Previews generated");

      if (!result.cached) {
        const visualFormats: RepurposeFormat[] = [];
        if (selectedFormats.has("instagramCarousel")) visualFormats.push("instagramCarousel");
        if (selectedFormats.has("webStory")) visualFormats.push("webStory");
        if (visualFormats.length > 0) {
          runImageQueue(result.jobId, result.outputs, visualFormats as any);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate previews";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function runImageQueue(jid: string, currentOutputs: RepurposedArticle, formats: ImageBearingFormat[]) {
    const targets: Array<{ format: ImageBearingFormat; index: number }> = [];
    formats.forEach(fmt => {
      if (fmt === "instagramCarousel") {
        currentOutputs.instagramCarousel.forEach((card, i) => { if (!card.image) targets.push({ format: "instagramCarousel", index: i }); });
      }
      if (fmt === "webStory") {
        currentOutputs.webStory.forEach((slide, i) => { if (!slide.image) targets.push({ format: "webStory", index: i }); });
      }
    });
    if (targets.length === 0) return;
    for (const target of targets) {
      const key = `${target.format}:${target.index}`;
      setGeneratingImages(prev => new Set(prev).add(key));
      try {
        const res = await generateSlotImage(jid, target.format, target.index);
        setOutputs(prev => {
           if (!prev) return res.outputs;
           const next = { ...prev, ...res.outputs };
           if (mirrorInsta && target.format === "instagramCarousel" && next.webStory[target.index]) {
              next.webStory[target.index] = { ...next.webStory[target.index], image: res.image };
           } else if (mirrorInsta && target.format === "webStory" && next.instagramCarousel[target.index]) {
              next.instagramCarousel[target.index] = { ...next.instagramCarousel[target.index], image: res.image };
           }
           return next;
        });
      } catch (err) { console.error("Quick panel image gen failed:", err); }
      finally { setGeneratingImages(prev => { const next = new Set(prev); next.delete(key); return next; }); }
    }
  }

  function flashDone(key: CopyKey) {
    setDone(key);
    window.setTimeout(() => { setDone((cur) => (cur === key ? null : cur)); }, 1800);
  }

  async function handleCopyText(key: CopyKey, text: string) {
    setBusy((prev) => new Set(prev).add(key));
    try { await navigator.clipboard.writeText(text); toast.success("Text copied"); flashDone(key); }
    catch { toast.error("Copy failed"); }
    finally { setBusy((prev) => { const next = new Set(prev); next.delete(key); return next; }); }
  }

  async function handleDownloadImage(key: CopyKey, imageUrl: string, filenameSeed: string) {
    setBusy((prev) => new Set(prev).add(key));
    try {
      await downloadImage(imageUrl, `${filenameSeed}${inferImageExtension(imageUrl)}`);
      toast.success("Image download started");
      flashDone(key);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleShareTwitter() {
    if (!jobId) return;
    try { setSharingTwitter(true); const result = await shareToTwitter(jobId); if (result.success) toast.success("Posted to X!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Sharing failed"); }
    finally { setSharingTwitter(false); }
  }

  async function handleShareSingleTweet(index: number) {
    if (!jobId) return;
    try { setSharingTweetIdx(index); const result = await shareSingleTweetToTwitter(jobId, index); if (result.success) toast.success(`Tweet ${index + 1} posted!`); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Sharing failed"); }
    finally { setSharingTweetIdx(null); }
  }

  async function handleShareInstagram() {
    if (!jobId) return;
    try {
      setSharingInstagram(true);
      const result = await shareCarouselToInstagram(jobId);
      if (result.success) toast.success("Posted to Instagram!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sharing failed");
    } finally {
      setSharingInstagram(false);
    }
  }

  async function handleDownloadAll(format: "instagramCarousel" | "webStory") {
    if (!outputs) return;
    const items = (outputs[format] as any[])
      .map((item, idx) => {
        const url = item.image?.imageUrl;
        if (!url) return null;
        return {
          url,
          filename: `${format === "webStory" ? "webstory_slide" : "insta_card"}_${idx + 1}${inferImageExtension(url)}`
        };
      })
      .filter((i): i is { url: string; filename: string } => !!i);

    if (items.length === 0) {
      toast.error("No images to download");
      return;
    }

    toast.info(`Starting download of ${items.length} images...`);
    try {
      await downloadImagesSequential(items);
      toast.success("Batch download complete");
    } catch (err) {
      toast.error("Batch download failed");
    }
  }

  if (!outputs) {
    return (
      <div className="space-y-4">
        <ConfigurationState
          onGenerate={() => load(false)} loading={loading} selected={selectedFormats}
          onToggle={(id: RepurposeFormat) => { setSelectedFormats((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }}
          instaSlideCount={instaSlideCount} onInstaSlideCountChange={setInstaSlideCount}
          webStorySlideCount={webStorySlideCount} onWebStorySlideCountChange={setWebStorySlideCount}
          mirrorInsta={mirrorInsta} onMirrorInstaChange={setMirrorInsta}
        />
        <FooterCta articleId={articleId} disabled />
      </div>
    );
  }

  const featuredImageUrl = meta?.featuredImageUrl;
  const hasWhatsapp = !!outputs.whatsappCard?.text;
  const hasTwitter = outputs.twitterThread.length > 0;
  const hasInstagram = outputs.instagramCarousel.length > 0;
  const hasWebStory = outputs.webStory.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">Quick Previews</div>
        <Button variant="ghost" size="sm" className="h-8 w-8 hover:bg-primary/5 text-muted-foreground" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {saveStatus !== "idle" && (
        <div className={cn("flex items-center gap-1.5 text-[10px] mb-3 transition-colors", saveStatus === "saving" && "animate-pulse")}>
          {saveStatus === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          <span>{saveStatus === "saving" ? "Saving changes..." : "All changes saved"}</span>
        </div>
      )}

      <div className="space-y-6">
        {hasWhatsapp && (
          <WhatsappQuickCard
            card={outputs.whatsappCard} featuredImageUrl={featuredImageUrl} busy={busy} done={done}
            onCopyText={() => handleCopyText("whatsapp:text", formatWhatsappForCopy({ ...outputs.whatsappCard, previewLink: outputs.whatsappCard.previewLink || meta?.previewUrl || (articleId ? "/preview/" + articleId : "") }))}
            onDownloadImage={(url: string) => handleDownloadImage("whatsapp:image", url, "whatsapp_card")}
            onChangeText={(text: string) => setOutputs({ ...outputs, whatsappCard: { ...outputs.whatsappCard, text } })}
          />
        )}

        {hasTwitter && (
          <TwitterQuickThread
            tweets={outputs.twitterThread} featuredImageUrl={featuredImageUrl} busy={busy} done={done}
            onCopyThreadText={() => handleCopyText("thread:text", formatTwitterThreadForCopy(outputs.twitterThread))}
            onCopyTweetText={(tweet: TwitterTweet, idx: number) => handleCopyText(`tweet:text:${idx}` as CopyKey, tweet.text)}
            onDownloadTweetImage={(url: string, idx: number) => handleDownloadImage(`tweet:image:${idx}` as CopyKey, url, `tweet_${idx + 1}`)}
            onChangeTweetText={(idx: number, text: string) => {
              const newThread = [...outputs.twitterThread];
              newThread[idx] = { ...newThread[idx], text };
              setOutputs({ ...outputs, twitterThread: newThread });
            }}
            onShareThread={handleShareTwitter} isSharingThread={sharingTwitter}
            onShareTweet={handleShareSingleTweet} isSharingTweet={sharingTweetIdx}
          />
        )}

        {hasInstagram && (
          <InstagramQuickCard
            cards={outputs.instagramCarousel} busy={busy} done={done}
            onCopyCardText={(card: InstagramCard, idx: number) => handleCopyText(`insta:text:${idx}` as CopyKey, formatInstagramCardForCopy(card))}
            onDownloadCardImage={(url: string, idx: number) => handleDownloadImage(`insta:download:${idx}` as CopyKey, url, `insta_card_${idx + 1}`)}
            onShare={handleShareInstagram}
            onDownloadAll={() => handleDownloadAll("instagramCarousel")}
            isSharing={sharingInstagram}
            onChangeCardText={(idx: number, text: string) => {
              const newCards = [...outputs.instagramCarousel];
              newCards[idx] = { ...newCards[idx], body: text };
              setOutputs({ ...outputs, instagramCarousel: newCards });
            }}
            generatingImages={generatingImages}
            onGenerateImage={(idx: number) => {
              if (!jobId) return;
              const key = `instagramCarousel:${idx}`;
              setGeneratingImages((prev) => new Set(prev).add(key));
              generateSlotImage(jobId, "instagramCarousel", idx)
                .then((res) => setOutputs(res.outputs))
                .catch(() => toast.error("Image generation failed"))
                .finally(() => setGeneratingImages((prev) => { const next = new Set(prev); next.delete(key); return next; }));
            }}
          />
        )}

        {hasWebStory && (
          <WebStoryQuickCard
            slides={outputs.webStory} busy={busy} done={done}
            onCopySlideText={(slide: WebStorySlide, idx: number) => handleCopyText(`webstory:text:${idx}` as CopyKey, slide.title + "\n\n" + slide.body)}
            onDownloadSlideImage={(url: string, idx: number) => handleDownloadImage(`webstory:download:${idx}` as CopyKey, url, `webstory_slide_${idx + 1}`)}
            onDownloadAll={() => handleDownloadAll("webStory")}
            generatingImages={generatingImages}
            onGenerateImage={(idx: number) => {
              if (!jobId) return;
              const key = `webStory:${idx}`;
              setGeneratingImages((prev) => new Set(prev).add(key));
              generateSlotImage(jobId, "webStory", idx)
                .then((res) => setOutputs(res.outputs))
                .catch(() => toast.error("Image generation failed"))
                .finally(() => setGeneratingImages((prev) => { const next = new Set(prev); next.delete(key); return next; }));
            }}
          />
        )}
      </div>

      <FooterCta articleId={articleId} />
    </div>
  );
}

const PLATFORMS: { id: RepurposeFormat; label: string; icon: any; color: string; }[] = [
  { id: "whatsappCard", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-500" },
  { id: "twitterThread", label: "X / Twitter", icon: Twitter, color: "text-sky-500" },
  { id: "instagramCarousel", label: "Instagram", icon: ImageIcon, color: "text-pink-500" },
  { id: "webStory", label: "Web Story", icon: BookOpen, color: "text-primary" },
  { id: "newsletter", label: "Newsletter", icon: Mail, color: "text-amber-500" },
  { id: "pushNotifications", label: "Push", icon: Bell, color: "text-indigo-500" },
];

function ConfigurationState({ onGenerate, loading, selected, onToggle, instaSlideCount, onInstaSlideCountChange, webStorySlideCount, onWebStorySlideCountChange, mirrorInsta, onMirrorInstaChange }: any) {
  const hasInsta = selected.has("instagramCarousel");
  const hasWebStory = selected.has("webStory");
  const canMirror = hasInsta && hasWebStory;
  return (
    <div className="rounded-xl border border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10"><Sparkles className="h-5 w-5 text-primary" /></div>
        <div><p className="text-sm font-bold">Repurpose Narrative</p><p className="text-[11px] text-muted-foreground mt-1 px-4 leading-relaxed">Select platforms to transform your article into social previews.</p></div>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => {
            const isSelected = selected.has(p.id);
            return (
              <button key={p.id} onClick={() => onToggle(p.id)} className={cn("flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left", isSelected ? "bg-background border-primary/50 shadow-sm ring-1 ring-primary/20" : "bg-muted/30 border-transparent hover:bg-muted/50 opacity-60")}>
                <div className={cn("p-1.5 rounded-md", isSelected ? "bg-primary/10" : "bg-muted")}><p.icon className={cn("h-3.5 w-3.5", isSelected ? p.color : "text-muted-foreground")} /></div>
                <span className={cn("text-[11px] font-semibold truncate", isSelected ? "text-foreground" : "text-muted-foreground")}>{p.label}</span>
                {isSelected && <Check className="ml-auto h-3 w-3 text-primary" />}
              </button>
            );
          })}
        </div>
        {(hasInsta || hasWebStory) && (
          <div className="pt-3 border-t border-border/40 space-y-4">
            {canMirror && ( <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-[11px] font-bold">Mirror Insta Content</Label></div><Switch checked={mirrorInsta} onCheckedChange={onMirrorInstaChange} /></div> )}
            {hasInsta && ( <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-[11px] font-bold text-pink-500">{canMirror && mirrorInsta ? "Slides for both" : "Instagram Card Count"}</Label></div><Select value={String(instaSlideCount)} onValueChange={(v) => onInstaSlideCountChange(Number(v))}><SelectTrigger className="h-8 w-20 text-[10px] font-bold"><SelectValue /></SelectTrigger><SelectContent>{[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ( <SelectItem key={n} value={String(n)} className="text-xs font-medium">{n} slides</SelectItem> ))}</SelectContent></Select></div> )}
            {hasWebStory && (!mirrorInsta || !hasInsta) && ( <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-[11px] font-bold text-primary">Web Story Slide Count</Label></div><Select value={String(webStorySlideCount)} onValueChange={(v) => onWebStorySlideCountChange(Number(v))}><SelectTrigger className="h-8 w-20 text-[10px] font-bold"><SelectValue /></SelectTrigger><SelectContent>{[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ( <SelectItem key={n} value={String(n)} className="text-xs font-medium">{n} slides</SelectItem> ))}</SelectContent></Select></div> )}
          </div>
        )}
      </div>
      <Button size="default" onClick={onGenerate} disabled={loading || selected.size === 0} className="w-full gap-2 shadow-lg shadow-primary/20">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate {selected.size > 0 ? `(${selected.size})` : ""} previews
      </Button>
    </div>
  );
}

function WhatsappQuickCard({ card, featuredImageUrl, busy, done, onCopyText, onDownloadImage, onChangeText }: any) {
  const heroUrl = card.image?.imageUrl || featuredImageUrl;
  return (
    <section className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-tight"><MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp</div>
        <CopyActions textBusy={busy.has("whatsapp:text")} textDone={done === "whatsapp:text"} imageBusy={busy.has("whatsapp:image")} imageDone={done === "whatsapp:image"} onCopyText={onCopyText} onDownloadImage={heroUrl ? () => onDownloadImage(heroUrl) : undefined} />
      </header>
      {heroUrl && <div className="aspect-[16/9] border-b border-border/40"><img src={heroUrl} alt="" className="h-full w-full object-cover" /></div>}
      <div className="p-3.5 bg-gradient-to-b from-transparent to-muted/10">
        <Textarea value={card.text} onChange={(e) => onChangeText(e.target.value)} className="text-[13px] leading-relaxed border-none p-0 focus-visible:ring-0 resize-none min-h-[100px] bg-transparent font-medium" />
        {(card.previewTitle || card.previewLink) && ( <div className="mt-3 rounded-lg border border-border/40 bg-muted/40 p-3 text-[11px] space-y-1">{card.previewTitle && <p className="font-bold truncate text-foreground">{card.previewTitle}</p>}{card.previewLink && <p className="text-primary/70 font-medium truncate pt-1">{card.previewLink}</p>}</div> )}
      </div>
    </section>
  );
}

function TwitterQuickThread({ tweets, featuredImageUrl, busy, done, onCopyThreadText, onCopyTweetText, onDownloadTweetImage, onChangeTweetText, onShareThread, isSharingThread, onShareTweet, isSharingTweet }: any) {
  return (
    <section className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-tight"><Twitter className="h-3.5 w-3.5 text-sky-500" /> X Thread<span className="text-[10px] text-muted-foreground ml-1">· {tweets.length}</span></div>
        <div className="flex items-center gap-1.5"><CopyTextButton onClick={onCopyThreadText} busy={busy.has("thread:text")} done={done === "thread:text"} label="Copy Thread" /><Button variant="outline" size="sm" onClick={onShareThread} disabled={isSharingThread} className="h-7 gap-1.5 text-[11px] font-bold border-primary/20 text-primary hover:bg-primary/5 rounded-full">{isSharingThread ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Post All</Button></div>
      </header>
      <div className="divide-y divide-border/30">
        {tweets.map((tweet: any, idx: number) => {
          const isLead = idx === 0; const heroUrl = tweet.image?.imageUrl || (isLead ? featuredImageUrl : undefined); const overLimit = tweet.text.length > 280;
          return (
            <div key={idx} className="p-4 space-y-3 hover:bg-muted/5">
              <div className="flex items-center justify-between"><span className={cn("text-[10px] font-bold uppercase tracking-widest", isLead ? "text-primary" : "text-muted-foreground")}>Tweet {idx + 1}</span><span className={cn("text-[10px] font-bold", overLimit ? "text-destructive" : "text-muted-foreground")}>{tweet.text.length}/280</span></div>
              {isLead && heroUrl && <div className="rounded-lg overflow-hidden border border-border/40 aspect-[16/9] mb-1"><img src={heroUrl} alt="" className="h-full w-full object-cover" /></div>}
              <Textarea value={tweet.text} onChange={(e) => onChangeTweetText(idx, e.target.value)} className="text-[13px] leading-relaxed border-none p-0 focus-visible:ring-0 resize-none min-h-[60px] bg-transparent font-medium" />
              <div className="flex items-center justify-end gap-1.5 pt-1"><CopyActions size="xs" textBusy={busy.has(`tweet:text:${idx}`)} textDone={done === `tweet:text:${idx}`} imageBusy={busy.has(`tweet:image:${idx}`)} imageDone={done === `tweet:image:${idx}`} onCopyText={() => onCopyTweetText(tweet, idx)} onDownloadImage={heroUrl ? () => onDownloadTweetImage(heroUrl, idx) : undefined} /><Button size="icon" variant="ghost" className="h-6 w-6 text-primary hover:bg-primary/5" onClick={() => onShareTweet(idx)} disabled={isSharingTweet !== null}>{isSharingTweet === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}</Button></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InstagramQuickCard({ cards, busy, done, onCopyCardText, onDownloadCardImage, onShare, onDownloadAll, isSharing, onChangeCardText, generatingImages, onGenerateImage }: any) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <ImageIcon className="h-3.5 w-3.5 text-pink-500" /> Instagram
        </div>
        <div className="flex items-center gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDownloadAll} 
            className="h-7 gap-1.5 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5 rounded-full"
          >
            <Download className="h-3 w-3" /> 
            Download All
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onShare} 
            disabled={isSharing} 
            className="h-7 gap-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted rounded-full"
          >
            {isSharing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} 
            Post
          </Button>
          <div className="text-[10px] font-medium text-muted-foreground ml-1">{cards.length} cards</div>
        </div>
      </div>
      <div className="space-y-3">
        {cards.map((card: any, idx: number) => {
          const heroUrl = card.image?.imageUrl; 
          const isGenerating = generatingImages.has(`instagramCarousel:${idx}`);
          return (
            <div key={idx} className="group relative flex gap-4 p-4 bg-white border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-all">
              <div className="relative shrink-0 w-24 aspect-square rounded-lg overflow-hidden border border-border/40 bg-muted/40 flex items-center justify-center">
                {heroUrl ? (
                  <img src={heroUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground/20">{idx + 1}</span>
                )}
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Card {idx + 1}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2.5 gap-1.5 text-[10px] font-bold text-primary border-primary/20 hover:bg-primary/5 rounded-md"
                    onClick={() => onGenerateImage(idx)}
                    disabled={isGenerating}
                  >
                    <ImageIcon className="h-3 w-3" />
                    {heroUrl ? "Regenerate" : "Generate"}
                  </Button>
                </div>
                <Input 
                  value={card.title} 
                  onChange={(e) => onChangeCardText(idx, e.target.value)} 
                  className="h-6 text-[13px] font-bold border-none p-0 focus-visible:ring-0 bg-transparent" 
                  placeholder="Card Title" 
                />
                <Textarea 
                  value={card.body} 
                  onChange={(e) => onChangeCardText(idx, e.target.value)} 
                  className="text-[12px] leading-relaxed text-muted-foreground font-medium border-none p-0 focus-visible:ring-0 resize-none min-h-[40px] bg-transparent" 
                />
                {card.image?.prompt && (
                  <div className="mt-auto flex items-start gap-1.5">
                    <Sparkles className="h-2.5 w-2.5 text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-muted-foreground italic line-clamp-1">{card.image.prompt}</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-1.5 pt-2">
                  <CopyActions 
                    size="xs" 
                    textBusy={busy.has(`insta:text:${idx}`)} 
                    textDone={done === `insta:text:${idx}`} 
                    imageBusy={busy.has(`insta:download:${idx}`)} 
                    imageDone={done === `insta:download:${idx}`} 
                    onCopyText={() => onCopyCardText(card, idx)} 
                    onDownloadImage={heroUrl ? () => onDownloadCardImage(heroUrl, idx) : undefined} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WebStoryQuickCard({ slides, busy, done, onCopySlideText, onDownloadSlideImage, onDownloadAll, generatingImages, onGenerateImage }: any) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> Web Story
        </div>
        <div className="flex items-center gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDownloadAll} 
            className="h-7 gap-1.5 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5 rounded-full"
          >
            <Download className="h-3 w-3" /> 
            Download All
          </Button>
          <div className="text-[10px] font-medium text-muted-foreground ml-1">{slides.length} slides</div>
        </div>
      </div>
      <div className="space-y-3">
        {slides.map((slide: any, idx: number) => {
          const heroUrl = slide.image?.imageUrl; 
          const isGenerating = generatingImages.has(`webStory:${idx}`);
          return (
            <div key={idx} className="group flex gap-4 p-4 bg-white border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-all">
              <div className="relative shrink-0 w-20 aspect-[9/16] rounded-lg overflow-hidden bg-muted/30 border border-border/40 flex items-center justify-center">
                {heroUrl ? (
                  <img src={heroUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground/20">{idx + 1}</span>
                )}
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Slide {idx + 1}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2.5 gap-1.5 text-[10px] font-bold text-primary border-primary/20 hover:bg-primary/5 rounded-md"
                    onClick={() => onGenerateImage(idx)}
                    disabled={isGenerating}
                  >
                    <ImageIcon className="h-3 w-3" />
                    {heroUrl ? "Regenerate" : "Generate"}
                  </Button>
                </div>
                <h4 className="text-[13px] font-bold text-foreground leading-snug">
                  {slide.title}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                  {slide.body}
                </p>
                {slide.image?.prompt && (
                  <div className="mt-auto flex items-start gap-1.5">
                    <Sparkles className="h-2.5 w-2.5 text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-muted-foreground italic line-clamp-1">{slide.image.prompt}</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-1.5 pt-2">
                  <CopyActions 
                    size="xs" 
                    textBusy={busy.has(`webstory:text:${idx}`)} 
                    textDone={done === `webstory:text:${idx}`} 
                    imageBusy={busy.has(`webstory:download:${idx}`)} 
                    imageDone={done === `webstory:download:${idx}`} 
                    onCopyText={() => onCopySlideText(slide, idx)} 
                    onDownloadImage={heroUrl ? () => onDownloadSlideImage(heroUrl, idx) : undefined} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CopyActions({ textBusy, textDone, imageBusy, imageDone, onCopyText, onDownloadImage, imageLabel = "Download", size = "sm" }: any) {
  return (
    <div className="flex items-center gap-1">
      <CopyTextButton onClick={onCopyText} busy={textBusy} done={textDone} size={size} />
      {onDownloadImage && ( <Button variant={imageDone ? "secondary" : "outline"} size="sm" onClick={onDownloadImage} disabled={imageBusy} className={cn("gap-1.5 text-[10px] font-bold rounded-full", size === "xs" ? "h-6 px-2.5" : "h-7 px-3")}>{imageBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : imageDone ? <Check className="h-3 w-3" /> : <Download className="h-3 w-3" />}{imageDone ? "Downloaded" : imageLabel}</Button> )}
    </div>
  );
}

function CopyTextButton({ onClick, busy, done, label = "Copy", size = "sm" }: any) {
  const Icon = done ? Check : busy ? Loader2 : Copy;
  return ( <Button variant={done ? "secondary" : "outline"} size="sm" onClick={onClick} disabled={busy} className={cn("gap-1.5 text-[10px] font-bold rounded-full", size === "xs" ? "h-6 px-2.5" : "h-7 px-3")}><Icon className={cn("h-3 w-3", busy && "animate-spin")} /> {done ? "Copied" : label}</Button> );
}

function FooterCta({ articleId, disabled }: { articleId?: string; disabled?: boolean; }) {
  const router = useRouter();
  return ( <Button variant="default" size="default" className="w-full justify-between gap-2 group h-11 rounded-xl shadow-md hover:shadow-lg transition-all" disabled={disabled || !articleId} onClick={() => articleId && router.push(`/repurpose/${articleId}`)}><span className="flex items-center gap-2 font-bold text-sm"><Layers className="h-4 w-4 text-primary-foreground/80" /> More Repurpose Options</span><div className="h-6 w-6 rounded-full bg-primary-foreground/10 flex items-center justify-center group-hover:bg-primary-foreground/20 transition-colors"><ChevronRight className="h-3.5 w-3.5 text-primary-foreground transition-transform group-hover:translate-x-0.5" /></div></Button> );
}
