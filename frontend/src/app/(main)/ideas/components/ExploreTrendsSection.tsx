"use client";

import { useState } from "react";
import { fetchTrends } from "@/lib/api";
import { getTrendsCache, setTrendsCache } from "@/lib/trends-cache";
import type { TrendsResponse } from "@/lib/types";
import {
  Search,
  TrendingUp,
  MapPin,
  Lightbulb,
  Loader2,
  PenLine,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ExploreTrendsSectionProps {
  onCreateDraft: (topic: string) => void;
  onGenerateArticle?: (topic: string) => void;
}

interface CombinedTrendsData {
  interest_over_time?: TrendsResponse["interest_over_time"];
  interest_by_region?: TrendsResponse["interest_by_region"];
  related_topics?: TrendsResponse["related_topics"];
  related_queries?: TrendsResponse["related_queries"];
}

function RegionBar({ location, value }: { location: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 truncate text-muted-foreground">{location}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function TimelineRow({ date, value }: { date: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-32 text-muted-foreground truncate">{date}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/70 rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExploreTrendsSection({
  onCreateDraft,
  onGenerateArticle,
}: ExploreTrendsSectionProps) {
  // SerpAPI returns topic name in different fields depending on version/endpoint
  const getTopicTitle = (item: { topic?: { title?: string }; topic_title?: string; query?: string }) =>
    item.topic?.title || item.topic_title || item.query || "";

  // SerpAPI rising values can be a number (e.g. 5000 = +5,000%) or "Breakout" (>5000%)
  const formatRisingValue = (value: number | string) => {
    if (typeof value === "string") return value;
    return `+${value.toLocaleString()}%`;
  };

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [trendsData, setTrendsData] = useState<CombinedTrendsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState("");

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const cacheKey = `trends_explore:${trimmed.toLowerCase()}`;
    const cached = getTrendsCache<CombinedTrendsData>(cacheKey);
    if (cached) {
      setTrendsData(cached);
      setSearchedQuery(trimmed);
      return;
    }

    setIsLoading(true);
    setError(null);
    setTrendsData(null);

    try {
      // Fetch all 4 data types in parallel — SerpAPI returns one type per request
      const [timeseriesResult, geoResult, topicsResult, queriesResult] =
        await Promise.allSettled([
          fetchTrends({ query: trimmed, data_type: "TIMESERIES", date: "today 12-m" }),
          fetchTrends({ query: trimmed, data_type: "GEO_MAP", date: "today 12-m" }),
          fetchTrends({ query: trimmed, data_type: "RELATED_TOPICS", date: "today 12-m" }),
          fetchTrends({ query: trimmed, data_type: "RELATED_QUERIES", date: "today 12-m" }),
        ]);

      const combined: CombinedTrendsData = {};

      if (timeseriesResult.status === "fulfilled") {
        combined.interest_over_time = timeseriesResult.value.interest_over_time;
      }
      if (geoResult.status === "fulfilled") {
        combined.interest_by_region = geoResult.value.interest_by_region;
      }
      if (topicsResult.status === "fulfilled") {
        combined.related_topics = topicsResult.value.related_topics;
      }
      if (queriesResult.status === "fulfilled") {
        combined.related_queries = queriesResult.value.related_queries;
      }

      const hasData =
        combined.interest_over_time ||
        (combined.interest_by_region && combined.interest_by_region.length > 0) ||
        combined.related_topics ||
        combined.related_queries;

      if (!hasData) {
        setError("No trends data found for this query. Try a different search term.");
      } else {
        setTrendsData(combined);
        setTrendsCache(cacheKey, combined);
      }

      setSearchedQuery(trimmed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("429")) {
        setError("Too many requests. Please wait a moment.");
      } else if (message.includes("timeout")) {
        setError("Request timed out. Please try again.");
      } else {
        setError("Failed to fetch trends data. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const hasResults = trendsData && !isLoading;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search any topic... (e.g., 'artificial intelligence', 'climate change')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 h-11"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="h-11 gap-1.5 px-5"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Search
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && <ResultsSkeleton />}

      {/* Results */}
      {hasResults && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Action bar for searched query */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                Results for &ldquo;{searchedQuery}&rdquo;
              </h3>
              <Badge variant="secondary" className="text-[10px]">
                Past 12 months
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => onCreateDraft(searchedQuery)}
              >
                <PenLine className="w-3 h-3" />
                Draft
              </Button>
              {onGenerateArticle && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onGenerateArticle(searchedQuery)}
                >
                  <Sparkles className="w-3 h-3" />
                  Generate
                </Button>
              )}
            </div>
          </div>

          {/* Interest Over Time */}
          {trendsData.interest_over_time?.timeline_data &&
            trendsData.interest_over_time.timeline_data.length > 0 && (
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold">Interest Over Time</h4>
                  {trendsData.interest_over_time.averages?.[0] && (
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      Avg: {trendsData.interest_over_time.averages[0].value.toFixed(0)}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {trendsData.interest_over_time.timeline_data.slice(-8).map((item, idx) => (
                    <TimelineRow
                      key={idx}
                      date={item.date}
                      value={item.values[0]?.extracted_value || 0}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Interest by Region */}
          {trendsData.interest_by_region && trendsData.interest_by_region.length > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold">Top Regions</h4>
              </div>
              <div className="space-y-2">
                {trendsData.interest_by_region.slice(0, 8).map((item, idx) => (
                  <RegionBar
                    key={idx}
                    location={item.location}
                    value={item.extracted_value}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Related Topics */}
          {trendsData.related_topics &&
            ((trendsData.related_topics.top && trendsData.related_topics.top.length > 0) ||
              (trendsData.related_topics.rising && trendsData.related_topics.rising.length > 0)) && (
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold">Related Topics</h4>
                </div>

                {trendsData.related_topics.top && trendsData.related_topics.top.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Top
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {trendsData.related_topics.top.slice(0, 10).map((item, idx) => {
                        const title = getTopicTitle(item);
                        if (!title) return null;
                        return (
                          <button
                            key={idx}
                            onClick={() => onCreateDraft(title)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                              border bg-card hover:border-primary/40 hover:bg-primary/5
                              transition-all duration-200 cursor-pointer group"
                          >
                            <span>{title}</span>
                            <span className="text-muted-foreground font-medium">{item.value}</span>
                            <PenLine className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {trendsData.related_topics.rising &&
                  trendsData.related_topics.rising.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        Rising
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trendsData.related_topics.rising.slice(0, 10).map((item, idx) => {
                          const title = getTopicTitle(item);
                          if (!title) return null;
                          return (
                            <button
                              key={idx}
                              onClick={() => onCreateDraft(title)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                                border border-green-500/20 bg-green-500/5 hover:bg-green-500/10
                                transition-all duration-200 cursor-pointer group"
                            >
                              <span>{title}</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {formatRisingValue(item.value)}
                              </span>
                              <PenLine className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            )}

          {/* Related Queries */}
          {trendsData.related_queries &&
            ((trendsData.related_queries.top && trendsData.related_queries.top.length > 0) ||
              (trendsData.related_queries.rising &&
                trendsData.related_queries.rising.length > 0)) && (
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold">Related Searches</h4>
                </div>

                {trendsData.related_queries.top &&
                  trendsData.related_queries.top.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Top
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trendsData.related_queries.top.slice(0, 10).map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => setQuery(item.query)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                              border bg-card hover:border-primary/40 hover:bg-primary/5
                              transition-all duration-200 cursor-pointer"
                          >
                            <span>{item.query}</span>
                            <span className="text-muted-foreground font-medium">{item.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {trendsData.related_queries.rising &&
                  trendsData.related_queries.rising.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        Rising
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trendsData.related_queries.rising.slice(0, 8).map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => setQuery(item.query)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                              border border-green-500/20 bg-green-500/5 hover:bg-green-500/10
                              transition-all duration-200 cursor-pointer"
                          >
                            <span>{item.query}</span>
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {formatRisingValue(item.value)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
        </div>
      )}

      {/* Empty state */}
      {!trendsData && !isLoading && !error && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-4">
            <BarChart3 className="w-10 h-10 text-primary/30" />
          </div>
          <h3 className="text-base font-medium mb-1">Explore Google Trends</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Search any topic to see interest over time, regional popularity, related topics, and
            related queries from the past 12 months
          </p>
        </div>
      )}
    </div>
  );
}
