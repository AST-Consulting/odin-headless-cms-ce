"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchRedditTrends } from "@/lib/api";
import { getTrendsCache, setTrendsCache } from "@/lib/trends-cache";
import { RefreshCw, Clock, ArrowBigUp, MessageSquare, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleSuggestionsDialog } from "./ArticleSuggestionsDialog";

interface RedditTrendsSectionProps {
  onCreateDraft: (topic: string) => void;
}

const SUBREDDITS = [
  { value: "india", label: "India" },
  { value: "IndiaSpeaks", label: "India Speaks" },
  { value: "IndianGaming", label: "Gaming" },
  { value: "bollywood", label: "Bollywood" },
  { value: "Cricket", label: "Cricket" },
  { value: "IndianStockMarket", label: "Stock Market" },
  { value: "indiainvestments", label: "Investments" },
  { value: "technology", label: "Technology" },
  { value: "worldnews", label: "World News" },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K+`;
  return `${n}+`;
}

export function RedditTrendsSection({ onCreateDraft }: RedditTrendsSectionProps) {
  const [subreddit, setSubreddit] = useState("india");
  const [isLoading, setIsLoading] = useState(false);
  const [topics, setTopics] = useState<Record<string, unknown>[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");

  const loadTrends = useCallback(async (category: string, skipCache = false) => {
    const cacheKey = `trends_reddit:${category}`;

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
      const response = await fetchRedditTrends({ category, limit: 15, refresh: skipCache });
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
    loadTrends(subreddit);
  }, [subreddit, loadTrends]);

  const handleTopicClick = (title: string) => {
    setSelectedTopic(title);
    setSuggestionsOpen(true);
  };

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {SUBREDDITS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSubreddit(s.value)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border cursor-pointer ${
                subreddit === s.value
                  ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                  : "bg-card border-border hover:border-orange-400/40 hover:bg-orange-50 dark:hover:bg-orange-500/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
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
          <Button size="sm" variant="outline" onClick={() => loadTrends(subreddit, true)} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Section header */}
      {!isLoading && topics.length > 0 && (
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
          <h3 className="text-sm lg:text-base font-semibold">Reddit Trending Topics</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            r/{subreddit}
          </Badge>
        </div>
      )}

      {/* Loading */}
      {isLoading && topics.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 w-full max-w-full">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {/* Topics grid — styled like Google Trends cards */}
      {!isLoading && topics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 w-full max-w-full">
          {topics.map((topic, idx) => {
            const meta = topic.metadata as Record<string, unknown>;
            const score = (meta?.score as number) || 0;
            const numComments = (meta?.numComments as number) || 0;
            const subredditName = meta?.subreddit as string;
            const linkFlair = meta?.linkFlair as string;

            return (
              <div
                key={idx}
                className="group relative rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-orange-500/30 dark:hover:shadow-orange-500/5 cursor-pointer"
                onClick={() => handleTopicClick(topic.title as string)}
              >
                <div className="p-4 lg:p-5 space-y-2.5 lg:space-y-3">
                  {/* Rank + Title */}
                  <div className="flex items-start gap-2.5 lg:gap-3">
                    <span className="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-[11px] lg:text-xs font-bold text-orange-600">
                      {idx + 1}
                    </span>
                    <h4 className="flex-1 font-semibold text-sm leading-snug line-clamp-3 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {topic.title as string}
                    </h4>
                  </div>

                  {/* Engagement stats */}
                  <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                      <ArrowBigUp className="w-3 h-3 text-orange-500" />
                      {formatCount(score)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/70 bg-muted px-2 py-0.5 rounded-md">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      {formatCount(numComments)}
                    </span>
                    {subredditName && subredditName !== subreddit && (
                      <span className="text-[11px] font-medium text-orange-600/80 bg-orange-500/8 px-2 py-0.5 rounded-full">
                        r/{subredditName}
                      </span>
                    )}
                    {linkFlair && (
                      <span className="text-[11px] text-muted-foreground/80 bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full">
                        {linkFlair}
                      </span>
                    )}
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
          <Flame className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-medium mb-1">No Reddit trends available</h3>
          <p className="text-sm text-muted-foreground">Try a different subreddit or refresh</p>
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
