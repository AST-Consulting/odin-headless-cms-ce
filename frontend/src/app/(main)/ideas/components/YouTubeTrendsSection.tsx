"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchYoutubeTrends } from "@/lib/api";
import { getTrendsCache, setTrendsCache } from "@/lib/trends-cache";
import { RefreshCw, Clock, Eye, ThumbsUp, MessageSquare, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleSuggestionsDialog } from "./ArticleSuggestionsDialog";

interface YouTubeTrendsSectionProps {
  onCreateDraft: (topic: string) => void;
}

const COUNTRIES = [
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K+`;
  return `${n}+`;
}

export function YouTubeTrendsSection({ onCreateDraft }: YouTubeTrendsSectionProps) {
  const [country, setCountry] = useState("IN");
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<Record<string, unknown>[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");

  const loadTrends = useCallback(async (geo: string, skipCache = false) => {
    const cacheKey = `trends_youtube:${geo}`;

    if (!skipCache) {
      const cached = getTrendsCache<Record<string, unknown>[]>(cacheKey);
      if (cached && cached.length > 0) {
        setVideos(cached);
        setLastUpdated(new Date());
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetchYoutubeTrends({ geo, limit: 15, refresh: skipCache });
      const items = response.items || [];
      setVideos(items);
      setLastUpdated(new Date());
      if (items.length > 0) {
        setTrendsCache(cacheKey, items);
      }
    } catch {
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrends(country);
  }, [country, loadTrends]);

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCountry(c.code)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border cursor-pointer ${
                country === c.code
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{c.flag}</span>
              <span className="hidden sm:inline">{c.name}</span>
              <span className="sm:hidden">{c.code}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastUpdated && (
            <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => loadTrends(country, true)} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && videos.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 w-full max-w-full">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {/* Videos grid — same card style as Google Trends */}
      {!isLoading && videos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 w-full max-w-full">
          {videos.map((video, idx) => {
            const meta = video.metadata as Record<string, unknown>;
            const viewCount = (meta?.viewCount as number) || 0;
            const likeCount = (meta?.likeCount as number) || 0;
            const commentCount = (meta?.commentCount as number) || 0;
            const channelTitle = meta?.channelTitle as string;
            const tags = (meta?.tags as string[]) || [];

            return (
              <div
                key={idx}
                className="group relative rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-red-500/30 dark:hover:shadow-red-500/5 cursor-pointer"
                onClick={() => { setSelectedTopic(video.title as string); setSuggestionsOpen(true); }}
              >
                <div className="p-4 lg:p-5 space-y-2.5 lg:space-y-3">
                  {/* Rank + Title */}
                  <div className="flex items-start gap-2.5 lg:gap-3">
                    <span className="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-red-500/10 flex items-center justify-center text-[11px] lg:text-xs font-bold text-red-600">
                      {idx + 1}
                    </span>
                    <h4 className="flex-1 font-semibold text-sm leading-snug line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                      {video.title as string}
                    </h4>
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                      <Eye className="w-3 h-3 text-orange-400" />
                      {formatCount(viewCount)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                      <ThumbsUp className="w-3 h-3 text-muted-foreground" />
                      {formatCount(likeCount)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      {formatCount(commentCount)}
                    </span>
                    {channelTitle && (
                      <span className="text-[11px] font-medium text-primary/80 bg-primary/8 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                        {channelTitle}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[11px] text-muted-foreground/80 bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                          {tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[11px] text-muted-foreground/40 self-center">
                          +{tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty */}
      {!isLoading && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Play className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-medium mb-1">No YouTube trends available</h3>
          <p className="text-sm text-muted-foreground">Try a different region or refresh</p>
        </div>
      )}

      <ArticleSuggestionsDialog
        open={suggestionsOpen}
        onOpenChange={setSuggestionsOpen}
        topic={selectedTopic}
        onSelectTitle={onCreateDraft}
      />
    </div>
  );
}
