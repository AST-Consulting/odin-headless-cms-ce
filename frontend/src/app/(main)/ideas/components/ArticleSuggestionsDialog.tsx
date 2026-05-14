"use client";

import { useState, useEffect, useCallback } from "react";
import { suggestTopics, fetchCrossPlatformTrends, generateArticle } from "@/lib/api";
import { useEditorStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Sparkles,
  PenLine,
  RefreshCw,
  TrendingUp,
  Flame,
  Newspaper,
  ExternalLink,
  Tag,
  Youtube,
  Twitter,
  MessageCircle,
} from "lucide-react";
import type { TrendingTopic } from "@/lib/types";

interface CrossPlatformItem {
  title: string;
  url?: string;
  metadata: Record<string, unknown>;
}

interface ArticleSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
  trendData?: TrendingTopic;
  trendBreakdown?: string[];
  geo?: string;
  onSelectTitle: (title: string) => void;
}

const PLATFORM_CONFIG: Record<string, { label: string; icon: typeof Youtube; color: string; bgColor: string }> = {
  youtube: { label: "YouTube", icon: Youtube, color: "text-red-600", bgColor: "bg-red-500/10" },
  twitter: { label: "X / Twitter", icon: Twitter, color: "text-sky-500", bgColor: "bg-sky-500/10" },
  reddit: { label: "Reddit", icon: MessageCircle, color: "text-orange-500", bgColor: "bg-orange-500/10" },
};

export function ArticleSuggestionsDialog({
  open,
  onOpenChange,
  topic,
  trendData,
  trendBreakdown,
  geo,
  onSelectTitle,
}: ArticleSuggestionsDialogProps) {
  const [titles, setTitles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [crossPlatform, setCrossPlatform] = useState<Record<string, CrossPlatformItem[]>>({});
  const [crossPlatformLoading, setCrossPlatformLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!topic) return;
    setIsLoading(true);
    setError(null);
    setTitles([]);
    setShowSuggestions(true);
    try {
      const contextParts: string[] = [];

      const breakdownTerms = trendBreakdown || trendData?.trend_breakdown;
      if (breakdownTerms?.length) {
        contextParts.push(`Related searches: ${breakdownTerms.join(", ")}`);
      }

      if (trendData?.articles?.length) {
        const articleContext = trendData.articles
          .map((a) => `${a.title}${a.source ? ` (${a.source})` : ""}`)
          .join("; ");
        contextParts.push(`Recent news: ${articleContext}`);
      }

      if (trendData?.formattedTraffic || trendData?.search_volume) {
        contextParts.push(`Search volume: ${trendData.formattedTraffic || trendData.search_volume}`);
      }

      // Add cross-platform context
      const platformNames = Object.keys(crossPlatform);
      if (platformNames.length > 0) {
        contextParts.push(`Also trending on: ${platformNames.join(", ")}`);
      }

      const context = contextParts.length > 0 ? contextParts.join(". ") : undefined;
      const result = await suggestTopics(topic, "hi", context);
      setTitles(result);
    } catch {
      setError("Failed to generate suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [topic, trendBreakdown, trendData, crossPlatform]);

  useEffect(() => {
    if (open && topic) {
      setCrossPlatformLoading(true);
      fetchCrossPlatformTrends(topic, geo)
        .then((data) => setCrossPlatform(data || {}))
        .catch(() => setCrossPlatform({}))
        .finally(() => setCrossPlatformLoading(false));
    }
    if (!open) {
      setTitles([]);
      setError(null);
      setShowSuggestions(false);
      setCrossPlatform({});
      setIsStartingGeneration(false);
    }
  }, [open, topic, geo]);

  const router = useRouter();
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);

  const handleSelect = async (title: string) => {
    setIsStartingGeneration(true);
    try {
      const lang = typeof window !== "undefined" ? localStorage.getItem("odin_language") || "hi" : "hi";
      const { jobId } = await generateArticle(title, lang);
      useEditorStore.setState({
        blocks: [
          {
            id: crypto.randomUUID(),
            type: "heading",
            content: [{ type: "text", text: title, styles: {} }],
            metadata: { props: { level: 1 }, children: [] },
            order: 0,
          },
          {
            id: crypto.randomUUID(),
            type: "paragraph",
            content: [{ type: "text", text: "", styles: {} }],
            metadata: { props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, children: [] },
            order: 1,
          },
        ],
        selectedBlockId: null,
        seoData: null,
        tags: [],
        categories: [],
        primaryCategory: null,
        primaryCategorySlug: null,
        authors: [],
        articleTitle: title,
        currentArticleId: null,
        slug: "",
        status: "draft",
        images: [],
        articleType: "article",
        generationJobId: jobId,
      });
      onOpenChange(false);
      router.push("/editor");
    } catch {
      setIsStartingGeneration(false);
      setError("Failed to start article generation. Please try again.");
    }
  };

  const handleDraft = (title: string) => {
    onSelectTitle(title);
    onOpenChange(false);
  };

  const articles = trendData?.articles || [];
  const breakdown = trendBreakdown || trendData?.trend_breakdown || [];
  const traffic = trendData?.formattedTraffic || trendData?.traffic;
  const searchVolume = trendData?.search_volume;
  const categories = trendData?.categories || [];
  const imageUrl = trendData?.image?.imageUrl;

  const volumeLabel = searchVolume
    ? searchVolume >= 1000000 ? `${(searchVolume / 1000000).toFixed(1)}M+`
    : searchVolume >= 1000 ? `${Math.round(searchVolume / 1000)}K+`
    : `${searchVolume}+`
    : null;

  const crossPlatformEntries = Object.entries(crossPlatform).filter(([, items]) => items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3">
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="line-clamp-2 text-base">{topic}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(volumeLabel || traffic) && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    {volumeLabel || traffic}
                  </Badge>
                )}
                {categories.map((cat) => (
                  <Badge key={cat.id} variant="outline" className="text-[10px] px-1.5 py-0">
                    {cat.name}
                  </Badge>
                ))}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Related keywords */}
          {breakdown.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5" />
                Related Keywords
              </div>
              <div className="flex flex-wrap gap-1.5">
                {breakdown.map((term, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50"
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related news */}
          {articles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Newspaper className="w-3.5 h-3.5" />
                Related News
              </div>
              <div className="space-y-2">
                {articles.map((article, i) => (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/20 transition-all duration-200 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title}
                      </p>
                      {article.source && (
                        <p className="text-[11px] text-muted-foreground mt-1">{article.source}</p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Cross-platform trends */}
          {crossPlatformLoading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          )}

          {!crossPlatformLoading && crossPlatformEntries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5" />
                Also Trending On
              </div>
              {crossPlatformEntries.map(([platform, items]) => {
                const config = PLATFORM_CONFIG[platform];
                if (!config) return null;
                const Icon = config.icon;

                return (
                  <div key={platform} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      <span className="text-xs font-semibold">{config.label}</span>
                    </div>
                    <div className="space-y-1">
                      {items.map((item, i) => {
                        const meta = item.metadata || {};
                        const viewCount = meta.viewCount as number;
                        const score = meta.score as number;
                        const tweetVolume = meta.tweetVolume as string;
                        const channelTitle = meta.channelTitle as string;
                        const subreddit = meta.subreddit as string;

                        return (
                          <a
                            key={i}
                            href={item.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg ${config.bgColor} text-xs hover:opacity-80 transition-opacity ${item.url ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <span className="flex-1 font-medium line-clamp-1">{item.title}</span>
                            <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground">
                              {viewCount && <span>{viewCount >= 1000 ? `${Math.round(viewCount / 1000)}K` : viewCount} views</span>}
                              {score && <span>{score >= 1000 ? `${(score / 1000).toFixed(1)}K` : score} upvotes</span>}
                              {tweetVolume && <span>{tweetVolume}</span>}
                              {channelTitle && <span>{channelTitle}</span>}
                              {subreddit && <span>r/{subreddit}</span>}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Generate article ideas section */}
          {!showSuggestions && (
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Want to write about this topic?
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDraft(topic)}
                  className="gap-1.5"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  Draft
                </Button>
                <Button
                  size="sm"
                  onClick={fetchSuggestions}
                  className="gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Ideas
                </Button>
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          {showSuggestions && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Article Ideas
                </div>
                {titles.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={fetchSuggestions}
                    disabled={isLoading}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                    New ideas
                  </Button>
                )}
              </div>

              {isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5 pt-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating article ideas...
                  </p>
                </div>
              )}

              {error && !isLoading && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button size="sm" variant="outline" onClick={fetchSuggestions} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </Button>
                </div>
              )}

              {isStartingGeneration && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Starting article generation...</p>
                </div>
              )}

              {!isLoading && !error && !isStartingGeneration && titles.length > 0 && (
                <div className="space-y-2">
                  {titles.map((title, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelect(title)}
                      disabled={isStartingGeneration}
                      className="w-full group flex items-start gap-3 p-3 rounded-lg border
                        bg-card hover:bg-accent/50 hover:border-primary/30
                        transition-all duration-200 text-left cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10
                        flex items-center justify-center text-xs font-semibold text-primary
                        group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {idx + 1}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-medium leading-snug pt-0.5">
                        {title}
                      </span>
                      <Sparkles className="w-4 h-4 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  ))}
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Click a title to generate full article
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
