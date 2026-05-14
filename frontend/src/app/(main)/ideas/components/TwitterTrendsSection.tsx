"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchTwitterTrends } from "@/lib/api";
import { getTrendsCache, setTrendsCache } from "@/lib/trends-cache";
import { RefreshCw, Clock, Hash, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleSuggestionsDialog } from "./ArticleSuggestionsDialog";

interface TwitterTrendsSectionProps {
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

export function TwitterTrendsSection({ onCreateDraft }: TwitterTrendsSectionProps) {
  const [country, setCountry] = useState("IN");
  const [isLoading, setIsLoading] = useState(false);
  const [topics, setTopics] = useState<Record<string, unknown>[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");

  const loadTrends = useCallback(async (geo: string, skipCache = false) => {
    const cacheKey = `trends_twitter:${geo}`;

    if (!skipCache) {
      const cached = getTrendsCache<Record<string, unknown>[]>(cacheKey);
      if (cached && cached.length > 0) {
        setTopics(cached);
        setLastUpdated(new Date());
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetchTwitterTrends({ geo, limit: 20, refresh: skipCache });
      const items = response.items || [];
      setTopics(items);
      setLastUpdated(new Date());
      if (items.length > 0) {
        setTrendsCache(cacheKey, items);
      }
    } catch {
      setTopics([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrends(country);
  }, [country, loadTrends]);

  const handleTopicClick = (title: string) => {
    setSelectedTopic(title);
    setSuggestionsOpen(true);
  };

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
                  ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                  : "bg-card border-border hover:border-sky-400/40 hover:bg-sky-50 dark:hover:bg-sky-500/5 text-muted-foreground hover:text-foreground"
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
      {isLoading && topics.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 w-full max-w-full">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {/* Topics grid — same card style as Google Trends */}
      {!isLoading && topics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 w-full max-w-full">
          {topics.map((topic, idx) => {
            const meta = topic.metadata as Record<string, unknown>;
            const isHashtag = meta?.isHashtag as boolean;
            const tweetVolume = meta?.tweetVolume as string;

            return (
              <div
                key={idx}
                className="group relative rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-sky-500/30 dark:hover:shadow-sky-500/5 cursor-pointer"
                onClick={() => handleTopicClick(topic.title as string)}
              >
                <div className="p-4 lg:p-5 space-y-2.5 lg:space-y-3">
                  {/* Rank + Title */}
                  <div className="flex items-start gap-2.5 lg:gap-3">
                    <span className="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-[11px] lg:text-xs font-bold text-sky-600">
                      {idx + 1}
                    </span>
                    <h4 className="flex-1 font-semibold text-sm leading-snug line-clamp-2 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      {topic.title as string}
                    </h4>
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                    {isHashtag && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                        <Hash className="w-3 h-3 text-sky-400" />
                        Hashtag
                      </span>
                    )}
                    {tweetVolume && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                        <Flame className="w-3 h-3 text-orange-400" />
                        {tweetVolume}
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-sky-600/80 bg-sky-500/8 px-2 py-0.5 rounded-full">
                      𝕏 Trending
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty */}
      {!isLoading && topics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Hash className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-medium mb-1">No Twitter/X trends available</h3>
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
