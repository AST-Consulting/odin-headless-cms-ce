"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchTrendingSearches, getTrendingTopics } from "@/lib/api";
import type { TrendingTopic } from "@/lib/types";
import { Loader2, TrendingUp, ExternalLink, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TrendingNowTabProps {
  onSuggestArticle?: (trendTitle: string, trendData?: string) => void;
}

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
];

// Helper to map AI topics to TrendingTopic format
const mapAiTopicsToTrending = (topics: { topic?: string; hindiTopic?: string }[]): TrendingTopic[] => {
  return topics.map((topic) => ({
    title: topic.topic || topic.hindiTopic || '',
    query: topic.topic || ''
  } as TrendingTopic));
};

export function TrendingNowTab({ onSuggestArticle }: TrendingNowTabProps = {}) {
  const [country, setCountry] = useState("IN");
  const [isLoading, setIsLoading] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadTrending = async (geo: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Try the /trends/trending-now API first with geo parameter
      const data = await fetchTrendingSearches({ geo });

      // Extract trending searches from response
      const searches = data.daily_searches || data.trending_searches || [];
      if (searches.length > 0) {
        setTrendingTopics(searches.slice(0, 20)); // Top 20
        setLastUpdated(new Date());
        return;
      }

      // Fallback to /ai/trending-topics if no results
      const aiData = await getTrendingTopics();
      const aiTopics = mapAiTopicsToTrending(aiData.topics || []);
      setTrendingTopics(aiTopics.slice(0, 20));
      setLastUpdated(new Date());
    } catch (err: unknown) {
      // Try fallback API before showing error
      try {
        const aiData = await getTrendingTopics();
        const aiTopics = mapAiTopicsToTrending(aiData.topics || []);
        if (aiTopics.length > 0) {
          setTrendingTopics(aiTopics.slice(0, 20));
          setLastUpdated(new Date());
          return;
        }
      } catch {
        // Both APIs failed, show error
      }

      // Map technical errors to user-friendly messages
      let errorMessage = "Failed to fetch trending topics";
      const errorMsg = err instanceof Error ? err.message : '';

      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        errorMessage = "Please log in to view trending topics";
      } else if (errorMsg.includes('429') || errorMsg.includes('Too Many')) {
        errorMessage = "Too many requests. Please wait a moment and try again";
      } else if (errorMsg.includes('timeout') || errorMsg.includes('ECONNABORTED')) {
        errorMessage = "Request timed out. Please check your connection and try again";
      } else if (errorMsg.includes('Network') || errorMsg.includes('Failed to fetch')) {
        errorMessage = "Network error. Please check your internet connection";
      } else if (errorMsg.includes('503') || errorMsg.includes('unavailable')) {
        errorMessage = "Service temporarily unavailable. Please try again later";
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrending(country);
  }, [country]);

  const selectedCountry = COUNTRIES.find(c => c.code === country);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Trending Now</h3>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadTrending(country)}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {/* Country Selector */}
      <Select value={country} onValueChange={setCountry}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.flag} {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Error State */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && !trendingTopics.length && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Trending Topics */}
      {!isLoading && trendingTopics.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
          {trendingTopics.map((topic, idx) => (
            <div
              key={idx}
              className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Rank */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm line-clamp-2">
                      {topic.title || topic.query}
                    </h4>
                    {topic.exploreLink && (
                      <a
                        href={topic.exploreLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary" />
                      </a>
                    )}
                  </div>

                  {/* Traffic */}
                  {topic.formattedTraffic && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {topic.formattedTraffic} searches
                    </p>
                  )}

                  {/* Articles */}
                  {topic.articles && topic.articles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {topic.articles.slice(0, 2).map((article, aIdx) => (
                        <a
                          key={aIdx}
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-muted-foreground hover:text-foreground line-clamp-1"
                        >
                          • {article.title}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Suggest Article Button */}
                  {onSuggestArticle && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 w-full justify-start text-xs h-7"
                      onClick={() => {
                        const trendData = topic.formattedTraffic
                          ? `Traffic: ${topic.formattedTraffic}`
                          : undefined;
                        onSuggestArticle(topic.title || topic.query, trendData);
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Suggest Article Topics
                    </Button>
                  )}
                </div>

                {/* Image */}
                {topic.image?.imageUrl && (
                  <img
                    src={topic.image.imageUrl}
                    alt={topic.title || topic.query}
                    className="w-16 h-16 object-cover rounded flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && trendingTopics.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No trending topics available</p>
          <p className="text-xs mt-1">Try a different country</p>
        </div>
      )}
    </div>
  );
}

