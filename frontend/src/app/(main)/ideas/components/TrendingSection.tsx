"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchTrendingSearches } from "@/lib/api";
import type { TrendingTopic } from "@/lib/types";
import {
  TrendingUp,
  RefreshCw,
  Clock,
  Flame,
  Globe,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleSuggestionsDialog } from "./ArticleSuggestionsDialog";
import { getTrendsCache, setTrendsCache } from "@/lib/trends-cache";

interface TrendingSectionProps {
  onCreateDraft: (topic: string) => void;
  onGenerateArticle?: (topic: string) => void;
}

type TrendSource = "live" | "today";

const COUNTRIES = [
  { code: "IN", name: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "US", name: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "GB", name: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "AU", name: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
  { code: "CA", name: "Canada", flag: "\u{1F1E8}\u{1F1E6}" },
  { code: "DE", name: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "FR", name: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "JP", name: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
];

function TopicCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrendingSection({ onCreateDraft }: TrendingSectionProps) {
  const [country, setCountry] = useState("IN");
  const [source, setSource] = useState<TrendSource>("live");
  const [isLoading, setIsLoading] = useState(false);
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedTrendData, setSelectedTrendData] = useState<TrendingTopic | undefined>();

  const handleTopicClick = useCallback((topic: TrendingTopic) => {
    setSelectedTopic(topic.title || topic.query);
    setSelectedTrendData(topic);
    setSuggestionsOpen(true);
  }, []);

  const loadTrending = useCallback(async (geo: string, src: TrendSource, skipCache = false) => {
    const cacheKey = `trends_trending:${src}:${geo}`;

    if (!skipCache) {
      const cached = getTrendsCache<TrendingTopic[]>(cacheKey);
      if (cached && cached.length > 0) {
        setTopics(cached);
        setLastUpdated(new Date());
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchTrendingSearches({ geo, source: src, refresh: skipCache });
      const searches =
        result.daily_searches ||
        result.trending_searches ||
        [];
      const fetched = searches.slice(0, 20);

      if (fetched.length === 0) {
        setError("No trending topics found. Try a different region or refresh.");
      } else {
        setTrendsCache(cacheKey, fetched);
      }

      setTopics(fetched);
      setLastUpdated(new Date());
    } catch {
      setError("Failed to load trending topics. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrending(country, source);
  }, [country, source, loadTrending]);

  const hasContent = topics.length > 0;

  return (
    <div className="space-y-6">
      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Source toggle + Country selector */}
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1">
          {/* Live / Today toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => setSource("live")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
                source === "live"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${source === "live" ? "animate-ping bg-red-500" : "bg-muted-foreground/40"}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${source === "live" ? "bg-red-500" : "bg-muted-foreground/40"}`} />
              </span>
              Live
            </button>
            <button
              onClick={() => setSource("today")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
                source === "today"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Today
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border flex-shrink-0 hidden sm:block" />

          {/* Countries */}
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCountry(c.code)}
              className={`
                flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200 border cursor-pointer
                ${
                  country === c.code
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <span>{c.flag}</span>
              <span className="hidden sm:inline">{c.name}</span>
              <span className="sm:hidden">{c.code}</span>
            </button>
          ))}
        </div>

        {/* Refresh + timestamp */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastUpdated && (
            <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadTrending(country, source, true)}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && !hasContent && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Globe className="w-8 h-8 text-destructive/60" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadTrending(country, source, true)}>
            Try Again
          </Button>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && !hasContent && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <TopicCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Trends grid */}
      {!isLoading && hasContent && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {topics.map((topic, idx) => {
              const rank = idx + 1;
              const volume = topic.search_volume
                ? topic.search_volume >= 1000000 ? `${(topic.search_volume / 1000000).toFixed(1)}M+`
                : topic.search_volume >= 1000 ? `${Math.round(topic.search_volume / 1000)}K+`
                : `${topic.search_volume}+`
                : null;

              return (
                <div
                  key={idx}
                  className="group relative rounded-xl border bg-card overflow-hidden
                    transition-all duration-300 hover:shadow-lg hover:border-primary/30
                    dark:hover:shadow-primary/5 cursor-pointer"
                  onClick={() => handleTopicClick(topic)}
                >
                  <div className="p-4 lg:p-5 space-y-2.5 lg:space-y-3">
                    {/* Title row */}
                    <div className="flex items-start gap-2.5 lg:gap-3">
                      <span className="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] lg:text-xs font-bold text-primary">
                        {rank}
                      </span>
                      <h4 className="flex-1 font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {topic.title || topic.query}
                      </h4>
                      {/* RSS image thumbnail */}
                      {topic.image?.imageUrl && (
                        <img
                          src={topic.image.imageUrl}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                      {volume && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                          <Flame className="w-3 h-3 text-orange-400" />
                          {volume}
                        </span>
                      )}
                      {!volume && topic.formattedTraffic && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                          <Flame className="w-3 h-3 text-orange-400" />
                          {topic.formattedTraffic}
                        </span>
                      )}
                      {topic.categories?.map((cat) => (
                        <span key={cat.id} className="text-[11px] font-medium text-primary/80 bg-primary/8 px-2 py-0.5 rounded-full">
                          {cat.name}
                        </span>
                      ))}
                    </div>

                    {/* Trend breakdown (SerpAPI only) */}
                    {topic.trend_breakdown && topic.trend_breakdown.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {topic.trend_breakdown.slice(0, 3).map((term, i) => (
                          <span key={i} className="text-[11px] text-muted-foreground/80 bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                            {term}
                          </span>
                        ))}
                        {topic.trend_breakdown.length > 3 && (
                          <span className="text-[11px] text-muted-foreground/40 self-center">
                            +{topic.trend_breakdown.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Related articles (RSS) */}
                    {topic.articles && topic.articles.length > 0 && !topic.trend_breakdown && (
                      <div className="space-y-1 pt-0.5">
                        {topic.articles.slice(0, 2).map((article, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground/70 line-clamp-1">
                            {article.source && (
                              <span className="font-medium text-muted-foreground">{article.source}: </span>
                            )}
                            {article.title}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !hasContent && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <TrendingUp className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-base font-medium mb-1">No trending topics yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Click refresh to fetch the latest trends
          </p>
          <Button variant="outline" onClick={() => loadTrending(country, source, true)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Load Trends
          </Button>
        </div>
      )}

      <ArticleSuggestionsDialog
        open={suggestionsOpen}
        onOpenChange={setSuggestionsOpen}
        topic={selectedTopic}
        trendData={selectedTrendData}
        geo={country}
        onSelectTitle={onCreateDraft}
      />
    </div>
  );
}
