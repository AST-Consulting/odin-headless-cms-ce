"use client";

import { useState } from "react";
import {
  Bell,
  BookOpen,
  Download,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Maximize2,
  Mail,
  MessageCircle,
  Play,
  RefreshCw,
  Twitter,
  Send,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { OutputCard } from "./OutputCard";
import {
  ImageLightbox,
  type LightboxImage,
} from "./ImageLightbox";
import {
  StoryPreviewDialog,
  type StorySlide,
} from "./StoryPreviewDialog";
import { WhatsappMockup } from "./WhatsappMockup";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  downloadImagesSequential,
  inferImageExtension,
} from "@/lib/download-image";
import { copyImage } from "@/lib/clipboard-with-image";
import type {
  ImageBearingFormat,
  ImageSource,
  InstagramCard,
  PushNotificationVariant,
  RepurposedArticle,
  RepurposeFormat,
  RepurposeMeta,
  TwitterTweet,
  WebStorySlide,
  WhatsappCard,
} from "@/lib/repurpose-api";
import {
  formatInstagram,
  formatNewsletter,
  formatPush,
  formatTwitterThread,
  formatWebStory,
  formatWhatsapp,
} from "@/lib/repurpose-formatters";

interface ImageGenKey {
  format: ImageBearingFormat;
  index: number;
}

interface RepurposeGridProps {
  outputs: RepurposedArticle;
  meta?: RepurposeMeta;
  regenerating: Set<RepurposeFormat>;
  generatingImages: Set<string>;
  onRegenerate: (format: RepurposeFormat, config?: any) => void;
  onGenerateImage: (key: ImageGenKey, source?: ImageSource) => void;
  onGenerateAllImages?: (scope: ImageBearingFormat) => void;
  onUpdateOutputs?: (outputs: RepurposedArticle) => void;
  onShareTwitter?: () => Promise<void>;
  onShareSingleTweet?: (index: number) => Promise<void>;
  onShareInstagram?: () => Promise<void>;
  isQueueRunning?: boolean;
  filenameSeed?: string;
  articleId?: string;
}

type PreviewState =
  | { open: false }
  | { open: true; variant: "story" | "carousel"; title: string };

export function RepurposeGrid({
  outputs,
  meta,
  regenerating,
  generatingImages,
  onRegenerate,
  onGenerateImage,
  onGenerateAllImages,
  onUpdateOutputs,
  onShareTwitter,
  onShareSingleTweet,
  onShareInstagram,
  isQueueRunning,
  filenameSeed = "repurpose",
  articleId,
}: RepurposeGridProps) {
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ open: false });
  const [isSharingTwitter, setIsSharingTwitter] = useState(false);
  const [isSharingInstagram, setIsSharingInstagram] = useState(false);
  const [sharingSingleTweet, setSharingSingleTweet] = useState<number | null>(null);
  const [copyingImage, setCopyingImage] = useState(false);
  const [configDialog, setConfigDialog] = useState<{
    open: boolean;
    format?: RepurposeFormat;
    count: number;
  }>({ open: false, count: 5 });

  async function handleShareTwitter() {
    if (!onShareTwitter) return;
    try {
      setIsSharingTwitter(true);
      await onShareTwitter();
    } finally {
      setIsSharingTwitter(false);
    }
  }

  async function handleShareInstagram() {
    if (!onShareInstagram) return;
    try {
      setIsSharingInstagram(true);
      await onShareInstagram();
    } finally {
      setIsSharingInstagram(false);
    }
  }

  async function handleShareSingleTweet(index: number) {
    if (!onShareSingleTweet) return;
    try {
      setSharingSingleTweet(index);
      await onShareSingleTweet(index);
    } finally {
      setSharingSingleTweet(null);
    }
  }

  function openImage(
    url: string,
    caption: string,
    aspect: "9:16" | "4:5" | "4:3" | "16:9",
    seed: string,
    generatedAt?: string
  ) {
    setLightbox({ url, caption, aspect, filenameSeed: seed, generatedAt });
  }

  const webStorySlides: StorySlide[] = outputs.webStory.map((s) => ({
    title: s.title,
    body: s.body,
    imageUrl: s.image?.imageUrl,
    imagePromptHint: s.imagePrompt,
  }));

  const carouselSlides: StorySlide[] = outputs.instagramCarousel.map((c) => ({
    title: c.title,
    body: c.body,
    imageUrl: c.image?.imageUrl,
    imagePromptHint: c.visualSuggestion,
  }));

  function handleSyncFromInsta() {
    if (!onUpdateOutputs || outputs.instagramCarousel.length === 0) return;
    const syncedWebStory: WebStorySlide[] = outputs.instagramCarousel.map(
      (card) => ({
        title: card.title,
        body: card.body,
        imagePrompt: card.visualSuggestion,
        image: card.image,
      })
    );
    onUpdateOutputs({ ...outputs, webStory: syncedWebStory });
    toast.success("Synced from Instagram (including images)");
  }

  function handleSyncFromWebStory() {
    if (!onUpdateOutputs || outputs.webStory.length === 0) return;
    const syncedInsta: InstagramCard[] = outputs.webStory.map(
      (slide) => ({
        title: slide.title,
        body: slide.body,
        visualSuggestion: slide.imagePrompt,
        image: slide.image,
      })
    );
    onUpdateOutputs({ ...outputs, instagramCarousel: syncedInsta });
    toast.success("Synced from Web Story (including images)");
  }

  function triggerRegenerate(format: RepurposeFormat) {
    if (format === "webStory" || format === "instagramCarousel") {
      setConfigDialog({ open: true, format, count: 5 });
    } else {
      onRegenerate(format);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <OutputCard
          title="Web Story"
          subtitle={`${outputs.webStory.length} slides · 9:16`}
          icon={BookOpen}
          accent="primary"
          copyText={() => formatWebStory(outputs.webStory)}
          onRegenerate={() => triggerRegenerate("webStory")}
          isRegenerating={regenerating.has("webStory")}
          headerActions={
            <FormatHeaderActions
              hasAnyImage={outputs.webStory.some((s) => !!s.image)}
              missingImageCount={
                outputs.webStory.filter((s) => !s.image).length
              }
              isQueueRunning={!!isQueueRunning}
              onPreview={() =>
                setPreview({
                  open: true,
                  variant: "story",
                  title: "Web Story preview",
                })
              }
              onGenerateAll={
                onGenerateAllImages
                  ? () => onGenerateAllImages("webStory")
                  : undefined
              }
              onDownloadAll={() =>
                downloadAllImages(
                  outputs.webStory.map((s, i) => ({
                    url: s.image?.imageUrl,
                    seed: `${filenameSeed}_webstory_${i + 1}`,
                  }))
                )
              }
            />
          }
        >
          <WebStoryView
            slides={outputs.webStory}
            generatingImages={generatingImages}
            onGenerateImage={(index) =>
              onGenerateImage({ format: "webStory", index })
            }
            onOpenImage={(url, caption, idx, generatedAt) =>
              openImage(
                url,
                caption,
                "9:16",
                `${filenameSeed}_webstory_${idx + 1}`,
                generatedAt
              )
            }
            onUpdateSlide={(idx: number, data: Partial<WebStorySlide>) => {
              if (!onUpdateOutputs) return;
              const newSlides = [...outputs.webStory];
              newSlides[idx] = { ...newSlides[idx], ...data };
              onUpdateOutputs({ ...outputs, webStory: newSlides });
            }}
            emptyState={
              <EmptyCardState
                onGenerate={() => triggerRegenerate("webStory")}
                onSync={
                  outputs.instagramCarousel.length > 0
                    ? handleSyncFromInsta
                    : undefined
                }
                syncLabel="Sync from Instagram"
                isRegenerating={regenerating.has("webStory")}
              />
            }
          />
        </OutputCard>

        <OutputCard
          title="Instagram Carousel"
          subtitle={`${outputs.instagramCarousel.length} cards · 4:5`}
          icon={ImageIcon}
          accent="warning"
          copyText={() => formatInstagram(outputs.instagramCarousel)}
          onRegenerate={() => triggerRegenerate("instagramCarousel")}
          isRegenerating={regenerating.has("instagramCarousel")}
          headerActions={
            <div className="flex items-center gap-1">
              {onShareInstagram && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-primary hover:bg-primary/10"
                  onClick={handleShareInstagram}
                  disabled={isSharingInstagram || regenerating.has("instagramCarousel")}
                >
                  {isSharingInstagram ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span className="text-xs font-semibold">Post</span>
                </Button>
              )}
              <FormatHeaderActions
                hasAnyImage={outputs.instagramCarousel.some((c) => !!c.image)}
                missingImageCount={
                  outputs.instagramCarousel.filter((c) => !c.image).length
                }
                isQueueRunning={!!isQueueRunning}
                onPreview={() =>
                  setPreview({
                    open: true,
                    variant: "carousel",
                    title: "Instagram Carousel preview",
                  })
                }
                onGenerateAll={
                  onGenerateAllImages
                    ? () => onGenerateAllImages("instagramCarousel")
                    : undefined
                }
                onDownloadAll={() =>
                  downloadAllImages(
                    outputs.instagramCarousel.map((c, i) => ({
                      url: c.image?.imageUrl,
                      seed: `${filenameSeed}_carousel_${i + 1}`,
                    }))
                  )
                }
              />
            </div>
          }
        >
          <InstagramView
            cards={outputs.instagramCarousel}
            generatingImages={generatingImages}
            onGenerateImage={(index) =>
              onGenerateImage({ format: "instagramCarousel", index })
            }
            onOpenImage={(url, caption, idx, generatedAt) =>
              openImage(
                url,
                caption,
                "4:5",
                `${filenameSeed}_carousel_${idx + 1}`,
                generatedAt
              )
            }
            onUpdateCard={(idx: number, data: Partial<InstagramCard>) => {
              if (!onUpdateOutputs) return;
              const newCards = [...outputs.instagramCarousel];
              newCards[idx] = { ...newCards[idx], ...data };
              onUpdateOutputs({ ...outputs, instagramCarousel: newCards });
            }}
            emptyState={
              <EmptyCardState
                onGenerate={() => triggerRegenerate("instagramCarousel")}
                onSync={
                  outputs.webStory.length > 0
                    ? handleSyncFromWebStory
                    : undefined
                }
                syncLabel="Sync from Web Story"
                isRegenerating={regenerating.has("instagramCarousel")}
              />
            }
          />
        </OutputCard>

        <OutputCard
          title="WhatsApp Channel Post"
          subtitle="Hero + body + link preview"
          icon={MessageCircle}
          accent="success"
          copyText={() =>
            formatWhatsapp({
              ...outputs.whatsappCard,
              previewLink:
                outputs.whatsappCard?.previewLink ||
                meta?.previewUrl ||
                (articleId ? "/preview/" + articleId : ""),
            })
          }
          onRegenerate={() => onRegenerate("whatsappCard")}
          isRegenerating={regenerating.has("whatsappCard")}
          headerActions={
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={async () => {
                const url = outputs.whatsappCard?.image?.imageUrl || meta?.featuredImageUrl;
                if (!url) return;
                try {
                  setCopyingImage(true);
                  await copyImage(url, "whatsapp_card");
                  toast.success("Image copied");
                } catch (err) {
                  toast.error("Failed to copy image");
                } finally {
                  setCopyingImage(false);
                }
              }}
              disabled={!(outputs.whatsappCard?.image?.imageUrl || meta?.featuredImageUrl) || copyingImage}
              title="Copy hero image"
            >
              {copyingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </Button>
          }
        >
          <WhatsappMockup
            card={outputs.whatsappCard}
            featuredImageUrl={meta?.featuredImageUrl}
            previewUrl={meta?.previewUrl}
            isGeneratingImage={generatingImages.has("whatsapp:0")}
            onGenerateImage={(source) =>
              onGenerateImage({ format: "whatsapp", index: 0 }, source)
            }
            onOpenImage={
              outputs.whatsappCard?.image
                ? () =>
                    openImage(
                      outputs.whatsappCard.image!.imageUrl,
                      outputs.whatsappCard.previewTitle ||
                        "WhatsApp channel hero",
                      "16:9",
                      `${filenameSeed}_whatsapp_hero`,
                      outputs.whatsappCard.image!.generatedAt
                    )
                : undefined
            }
            onUpdate={(data) => {
              if (!onUpdateOutputs) return;
              onUpdateOutputs({
                ...outputs,
                whatsappCard: { ...outputs.whatsappCard, ...data },
              });
            }}
            emptyState={
              <EmptyCardState
                onGenerate={() => onRegenerate("whatsappCard")}
                isRegenerating={regenerating.has("whatsappCard")}
              />
            }
          />
        </OutputCard>

        <OutputCard
          title="Push Notifications"
          subtitle="3 A/B variants"
          icon={Bell}
          accent="primary"
          copyText={() => formatPush(outputs.pushNotifications)}
          onRegenerate={() => onRegenerate("pushNotifications")}
          isRegenerating={regenerating.has("pushNotifications")}
        >
          <PushMockup
            variants={outputs.pushNotifications}
            onUpdate={(idx, data) => {
              if (!onUpdateOutputs) return;
              const newVariants = [...outputs.pushNotifications];
              newVariants[idx] = { ...newVariants[idx], ...data };
              onUpdateOutputs({ ...outputs, pushNotifications: newVariants });
            }}
            emptyState={
              <EmptyCardState
                onGenerate={() => onRegenerate("pushNotifications")}
                isRegenerating={regenerating.has("pushNotifications")}
              />
            }
          />
        </OutputCard>

        <OutputCard
          title="Newsletter Blurb"
          subtitle="Subject + preview + body"
          icon={Mail}
          accent="success"
          copyText={() => formatNewsletter(outputs.newsletter)}
          onRegenerate={() => onRegenerate("newsletter")}
          isRegenerating={regenerating.has("newsletter")}
        >
          <NewsletterView
            newsletter={outputs.newsletter}
            onUpdate={(data) => {
              if (!onUpdateOutputs) return;
              onUpdateOutputs({
                ...outputs,
                newsletter: { ...outputs.newsletter, ...data },
              });
            }}
            emptyState={
              <EmptyCardState
                onGenerate={() => onRegenerate("newsletter")}
                isRegenerating={regenerating.has("newsletter")}
              />
            }
          />
        </OutputCard>

        <OutputCard
          title="X / Twitter Thread"
          subtitle={`${outputs.twitterThread.length} tweets · lead has hero`}
          icon={Twitter}
          accent="primary"
          copyText={() => formatTwitterThread(outputs.twitterThread)}
          onRegenerate={() => onRegenerate("twitterThread")}
          isRegenerating={regenerating.has("twitterThread")}
          headerActions={
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-primary hover:bg-primary/10"
              onClick={handleShareTwitter}
              disabled={isSharingTwitter || regenerating.has("twitterThread")}
            >
              {isSharingTwitter ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span className="text-xs font-semibold">Post to X</span>
            </Button>
          }
        >
          <TwitterView
            tweets={outputs.twitterThread}
            isGeneratingHero={generatingImages.has("twitterHero:0")}
            onGenerateHero={
              outputs.twitterThread[0]?.imagePrompt
                ? () => onGenerateImage({ format: "twitterHero", index: 0 })
                : undefined
            }
            onOpenHero={
              outputs.twitterThread[0]?.image
                ? () =>
                    openImage(
                      outputs.twitterThread[0].image!.imageUrl,
                      "Lead tweet hero",
                      "16:9",
                      `${filenameSeed}_tweet_hero`,
                      outputs.twitterThread[0].image!.generatedAt
                    )
                : undefined
            }
            onUpdateTweet={(idx, data) => {
              if (!onUpdateOutputs) return;
              const newThread = [...outputs.twitterThread];
              newThread[idx] = { ...newThread[idx], ...data };
              onUpdateOutputs({ ...outputs, twitterThread: newThread });
            }}
            onShareTweet={handleShareSingleTweet}
            isSharingTweet={sharingSingleTweet}
            emptyState={
              <EmptyCardState
                onGenerate={() => onRegenerate("twitterThread")}
                isRegenerating={regenerating.has("twitterThread")}
              />
            }
          />
        </OutputCard>
      </div>

      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
      <StoryPreviewDialog
        open={preview.open}
        onClose={() => setPreview({ open: false })}
        slides={preview.open && preview.variant === "story" ? webStorySlides : carouselSlides}
        title={preview.open ? preview.title : ""}
        filenamePrefix={filenameSeed}
        variant={preview.open ? preview.variant : "story"}
      />

      <Dialog
        open={configDialog.open}
        onOpenChange={(open) => setConfigDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate {configDialog.format === "webStory" ? "Web Story" : "Instagram Carousel"}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Slide/Card Count</Label>
              <Select
                value={String(configDialog.count)}
                onValueChange={(v) =>
                  setConfigDialog((prev) => ({ ...prev, count: Number(v) }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} slides
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic px-1">
                Note: This will use AI credits to generate new content.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfigDialog({ open: false, count: 5 })}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (configDialog.format) {
                  const config =
                    configDialog.format === "instagramCarousel"
                      ? { instaSlideCount: configDialog.count }
                      : { webStorySlideCount: configDialog.count };
                  onRegenerate(configDialog.format, config);
                }
                setConfigDialog({ open: false, count: 5 });
              }}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface FormatHeaderActionsProps {
  hasAnyImage: boolean;
  missingImageCount: number;
  isQueueRunning: boolean;
  onPreview: () => void;
  onGenerateAll?: () => void;
  onDownloadAll: () => void;
}

function FormatHeaderActions({
  hasAnyImage,
  missingImageCount,
  isQueueRunning,
  onPreview,
  onGenerateAll,
  onDownloadAll,
}: FormatHeaderActionsProps) {
  return (
    <>
      {onGenerateAll && missingImageCount > 0 && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-primary hover:bg-primary/10"
          onClick={onGenerateAll}
          disabled={isQueueRunning}
          title={`Generate ${missingImageCount} image${missingImageCount > 1 ? "s" : ""}`}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={onPreview}
        title="Preview as phone story"
      >
        <Play className="h-4 w-4" />
      </Button>
      {hasAnyImage && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onDownloadAll}
          title="Download all images"
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}

async function downloadAllImages(
  items: Array<{ url?: string; seed: string }>
) {
  const ready = items
    .filter((item) => !!item.url)
    .map((item) => ({
      url: item.url as string,
      filename: `${item.seed}${inferImageExtension(item.url as string)}`,
    }));
  if (ready.length === 0) {
    toast.error("No images to download yet — generate them first.");
    return;
  }
  toast.message(`Downloading ${ready.length} image${ready.length > 1 ? "s" : ""}…`);
  const result = await downloadImagesSequential(ready);
  if (result.failed === 0) {
    toast.success(`Downloaded ${result.succeeded} images`);
  } else {
    toast.warning(
      `Downloaded ${result.succeeded}, failed ${result.failed}`
    );
  }
}

interface WebStoryViewProps {
  slides: WebStorySlide[];
  generatingImages: Set<string>;
  onGenerateImage: (index: number) => void;
  onOpenImage: (url: string, caption: string, index: number, generatedAt?: string) => void;
  onUpdateSlide: (idx: number, data: Partial<WebStorySlide>) => void;
  emptyState?: React.ReactNode;
}

function WebStoryView({
  slides,
  generatingImages,
  onGenerateImage,
  onOpenImage,
  onUpdateSlide,
  emptyState,
}: WebStoryViewProps) {
  if (slides.length === 0) return emptyState || <Empty />;
  return (
    <div className="space-y-3">
      {slides.map((slide, idx) => {
        const busy = generatingImages.has(`webStory:${idx}`);
        return (
          <div
            key={idx}
            className="rounded-md border border-border/50 bg-muted/20 p-3"
          >
            <div className="flex items-start gap-3">
              <SlideThumbnail
                imageUrl={slide.image?.imageUrl}
                generatedAt={slide.image?.generatedAt}
                aspect="9:16"
                placeholder={`${idx + 1}`}
                busy={busy}
                onClick={() =>
                  slide.image &&
                  onOpenImage(slide.image.imageUrl, slide.title, idx, slide.image.generatedAt)
                }
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Slide {idx + 1}
                  </span>
                  <SlotImageButton
                    hasImage={!!slide.image}
                    isBusy={busy}
                    onClick={() => onGenerateImage(idx)}
                  />
                </div>
                <Input
                  value={slide.title}
                  onChange={(e) => onUpdateSlide(idx, { title: e.target.value })}
                  className="h-7 text-sm font-semibold border-none p-0 focus-visible:ring-0 bg-transparent"
                />
                <Textarea
                  value={slide.body}
                  onChange={(e) => onUpdateSlide(idx, { body: e.target.value })}
                  className="text-xs text-muted-foreground leading-snug border-none p-0 focus-visible:ring-0 resize-none min-h-[40px] bg-transparent"
                />
                {!slide.image && slide.imagePrompt && (
                  <p className="text-[10px] text-muted-foreground/80 truncate">
                    🎨 {slide.imagePrompt}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface InstagramViewProps {
  cards: InstagramCard[];
  generatingImages: Set<string>;
  onGenerateImage: (index: number) => void;
  onOpenImage: (url: string, caption: string, index: number, generatedAt?: string) => void;
  onUpdateCard: (idx: number, data: Partial<InstagramCard>) => void;
  emptyState?: React.ReactNode;
}

function InstagramView({
  cards,
  generatingImages,
  onGenerateImage,
  onOpenImage,
  onUpdateCard,
  emptyState,
}: InstagramViewProps) {
  if (cards.length === 0) return emptyState || <Empty />;
  return (
    <div className="space-y-3">
      {cards.map((card, idx) => {
        const busy = generatingImages.has(`instagramCarousel:${idx}`);
        return (
          <div
            key={idx}
            className="rounded-md border border-border/50 bg-muted/20 p-3"
          >
            <div className="flex items-start gap-3">
              <SlideThumbnail
                imageUrl={card.image?.imageUrl}
                generatedAt={card.image?.generatedAt}
                aspect="4:5"
                placeholder={`${idx + 1}`}
                busy={busy}
                onClick={() =>
                  card.image &&
                  onOpenImage(card.image.imageUrl, card.title, idx, card.image.generatedAt)
                }
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Card {idx + 1}
                  </span>
                  <SlotImageButton
                    hasImage={!!card.image}
                    isBusy={busy}
                    onClick={() => onGenerateImage(idx)}
                  />
                </div>
                <Input
                  value={card.title}
                  onChange={(e) => onUpdateCard(idx, { title: e.target.value })}
                  className="h-7 text-sm font-semibold border-none p-0 focus-visible:ring-0 bg-transparent"
                />
                <Textarea
                  value={card.body}
                  onChange={(e) => onUpdateCard(idx, { body: e.target.value })}
                  className="text-xs text-muted-foreground leading-snug border-none p-0 focus-visible:ring-0 resize-none min-h-[40px] bg-transparent"
                />
                {!card.image && card.visualSuggestion && (
                  <p className="text-[10px] text-muted-foreground/80 truncate">
                    🎨 {card.visualSuggestion}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PushMockupProps {
  variants: PushNotificationVariant[];
  onUpdate: (idx: number, data: Partial<PushNotificationVariant>) => void;
  emptyState?: React.ReactNode;
}

export function PushMockup({ variants, onUpdate, emptyState }: PushMockupProps) {
  if (variants.length === 0) return emptyState || <Empty />;
  return (
    <div className="space-y-3">
      {variants.map((v, idx) => (
        <div key={idx} className="rounded-md border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Variant {idx + 1} ({v.label})
            </span>
          </div>
          <Input
            value={v.headline}
            onChange={(e) => onUpdate(idx, { headline: e.target.value })}
            className="mb-1 h-7 text-sm font-semibold border-none p-0 focus-visible:ring-0 bg-transparent"
          />
          <Input
            value={v.body}
            onChange={(e) => onUpdate(idx, { body: e.target.value })}
            className="h-6 text-xs text-muted-foreground border-none p-0 focus-visible:ring-0 bg-transparent"
          />
        </div>
      ))}
    </div>
  );
}

interface SlideThumbnailProps {
  imageUrl?: string;
  generatedAt?: string;
  aspect: "9:16" | "4:5";
  placeholder: string;
  busy: boolean;
  onClick: () => void;
}

function SlideThumbnail({
  imageUrl,
  generatedAt,
  aspect,
  placeholder,
  busy,
  onClick,
}: SlideThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!imageUrl}
      className={cn(
        "shrink-0 w-20 rounded-md overflow-hidden border border-border/60 relative group",
        aspect === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]",
        imageUrl
          ? "cursor-zoom-in hover:border-primary/50"
          : "cursor-default bg-gradient-to-br from-primary/10 to-primary/5"
      )}
    >
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={generatedAt ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${generatedAt}` : imageUrl}
            alt=""
            className={cn("h-full w-full object-cover", busy && "opacity-50")}
          />
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
            </div>
          )}
        </>
      ) : busy ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {placeholder}
        </div>
      )}
    </button>
  );
}

interface SlotImageButtonProps {
  hasImage: boolean;
  isBusy: boolean;
  onClick: () => void;
  small?: boolean;
}

function SlotImageButton({
  hasImage,
  isBusy,
  onClick,
  small,
}: SlotImageButtonProps) {
  const Icon = isBusy ? Loader2 : hasImage ? RefreshCw : ImagePlus;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={isBusy}
      className={cn(
        "h-7 gap-1 text-[11px] border-primary/30 text-primary hover:bg-primary/10 hover:text-primary",
        small && "h-6 px-2 text-[10px]"
      )}
    >
      <Icon className={cn("h-3 w-3", isBusy && "animate-spin")} />
      {hasImage ? "Re-image" : "Image"}
    </Button>
  );
}

interface NewsletterViewProps {
  newsletter: { subject: string; preview: string; body: string };
  onUpdate: (
    data: Partial<{ subject: string; preview: string; body: string }>
  ) => void;
  emptyState?: React.ReactNode;
}

function NewsletterView({ newsletter, onUpdate, emptyState }: NewsletterViewProps) {
  if (!newsletter || !newsletter.subject) return emptyState || <Empty />;
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="bg-muted/40 px-3 py-2 border-b border-border/50">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          From: News Desk
        </div>
        <Input
          value={newsletter.subject}
          onChange={(e) => onUpdate({ subject: e.target.value })}
          className="h-6 text-sm font-semibold border-none p-0 focus-visible:ring-0 bg-transparent"
        />
        {newsletter.preview !== undefined && (
          <Input
            value={newsletter.preview}
            onChange={(e) => onUpdate({ preview: e.target.value })}
            className="h-5 text-xs text-muted-foreground border-none p-0 focus-visible:ring-0 bg-transparent"
          />
        )}
      </div>
      <div className="p-3">
        <Textarea
          value={newsletter.body}
          onChange={(e) => onUpdate({ body: e.target.value })}
          className="text-sm leading-relaxed border-none p-0 focus-visible:ring-0 resize-none min-h-[120px] bg-transparent"
        />
      </div>
    </div>
  );
}

interface TwitterViewProps {
  tweets: TwitterTweet[];
  isGeneratingHero?: boolean;
  onGenerateHero?: () => void;
  onOpenHero?: () => void;
  onUpdateTweet: (idx: number, data: Partial<TwitterTweet>) => void;
  onShareTweet?: (idx: number) => void;
  isSharingTweet?: number | null;
  emptyState?: React.ReactNode;
}

function TwitterView({
  tweets,
  isGeneratingHero,
  onGenerateHero,
  onOpenHero,
  onUpdateTweet,
  onShareTweet,
  isSharingTweet,
  emptyState,
}: TwitterViewProps) {
  if (tweets.length === 0) return emptyState || <Empty />;
  return (
    <div className="space-y-3">
      {tweets.map((tweet, idx) => {
        const isLead = idx === 0;
        const heroUrl = tweet.image?.imageUrl;
        const overLimit = tweet.text.length > 280;
        return (
          <div
            key={tweet.index}
            className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2"
          >
            <div className="flex items-center justify-between text-[10px]">
              <span
                className={cn(
                  "font-medium uppercase tracking-wide",
                  isLead ? "text-primary" : "text-muted-foreground"
                )}
              >
                Tweet {tweet.index}
                {isLead && " · Lead"}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    overLimit ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {tweet.text.length}/280
                </span>
                {onShareTweet && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-primary hover:bg-primary/10"
                    onClick={() => onShareTweet(idx)}
                    disabled={isSharingTweet !== null}
                    title="Post this tweet only"
                  >
                    {isSharingTweet === idx ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Send className="h-2.5 w-2.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            <Textarea
              value={tweet.text}
              onChange={(e) => onUpdateTweet(idx, { text: e.target.value })}
              className="text-sm leading-snug border-none p-0 focus-visible:ring-0 resize-none min-h-[60px] bg-transparent"
              placeholder={`Write tweet ${tweet.index}...`}
            />

            {isLead && (
              <div className="flex items-start gap-3 pt-1 border-t border-border/20 mt-1">
                <SlideThumbnail
                  imageUrl={heroUrl}
                  generatedAt={tweet.image?.generatedAt}
                  aspect="4:5"
                  placeholder="Hero"
                  busy={!!isGeneratingHero}
                  onClick={() => heroUrl && onOpenHero?.()}
                />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase">
                      Hero Image
                    </span>
                    {onGenerateHero && (
                      <SlotImageButton
                        hasImage={!!heroUrl}
                        isBusy={!!isGeneratingHero}
                        onClick={onGenerateHero}
                        small
                      />
                    )}
                  </div>
                  {tweet.imagePrompt && (
                    <p className="text-[10px] text-muted-foreground italic line-clamp-2">
                      🎨 {tweet.imagePrompt}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyCardState({
  onGenerate,
  onSync,
  isRegenerating,
  syncLabel = "Sync from previous",
}: {
  onGenerate: () => void;
  onSync?: () => void;
  isRegenerating: boolean;
  syncLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[120px] rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium">No content generated yet</p>
        <p className="text-[10px] text-muted-foreground italic">
          Start building this channel's presence
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          size="sm"
          onClick={onGenerate}
          disabled={isRegenerating}
          className="h-8 gap-2"
        >
          {isRegenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generate
        </Button>
        {onSync && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSync}
            disabled={isRegenerating}
            className="h-8 gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {syncLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <p className="text-xs text-muted-foreground italic">
      No content generated.
    </p>
  );
}
