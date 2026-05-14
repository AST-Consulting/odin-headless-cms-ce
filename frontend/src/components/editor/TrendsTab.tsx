"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchTrends } from "@/lib/api";
import type { TrendsDataType, TrendsResponse } from "@/lib/types";
import { Loader2, TrendingUp, TrendingDown, MapPin, Lightbulb } from "lucide-react";

export function TrendsTab() {
  const [query, setQuery] = useState("");
  const [dataType, setDataType] = useState<TrendsDataType>("TIMESERIES");
  const [isLoading, setIsLoading] = useState(false);
  const [trendsData, setTrendsData] = useState<TrendsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchTrends({
        query: query.trim(),
        data_type: dataType,
        date: "today 12-m",
      });
      setTrendsData(data);
    } catch (err: any) {
      // Map technical errors to user-friendly messages
      let errorMessage = "Failed to fetch trends data";
      
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        errorMessage = "Please log in to search trends";
      } else if (err.message?.includes('429') || err.message?.includes('Too Many')) {
        errorMessage = "Too many requests. Please wait a moment";
      } else if (err.message?.includes('timeout')) {
        errorMessage = "Request timed out. Please try again";
      } else if (err.message?.includes('Network')) {
        errorMessage = "Network error. Check your connection";
      } else if (err.message?.includes('503')) {
        errorMessage = "Service temporarily unavailable";
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="space-y-2">
        <Input
          placeholder="Search topic (e.g., 'artificial intelligence', 'climate change')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />

        <div className="flex gap-2">
          <Select value={dataType} onValueChange={(v) => setDataType(v as TrendsDataType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TIMESERIES">Interest Over Time</SelectItem>
              <SelectItem value="GEO_MAP">By Region</SelectItem>
              <SelectItem value="RELATED_TOPICS">Related Topics</SelectItem>
              <SelectItem value="RELATED_QUERIES">Related Queries</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleSearch} disabled={isLoading || !query.trim()} className="flex-1">
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Search Trends
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {trendsData && !isLoading && (
        <div className="h-[400px] overflow-y-auto pr-2">
          <div className="space-y-4">
            {/* Interest Over Time */}
            {trendsData.interest_over_time && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Interest Over Time
                </h3>
                <div className="space-y-1">
                  {trendsData.interest_over_time.timeline_data?.slice(-5).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-2 bg-muted rounded">
                      <span className="text-muted-foreground">{item.date}</span>
                      <span className="font-medium">
                        {item.values[0]?.extracted_value || 0}
                      </span>
                    </div>
                  ))}
                </div>
                {trendsData.interest_over_time.averages && (
                  <div className="p-2 bg-primary/10 rounded text-xs">
                    <span className="font-medium">Average: </span>
                    {trendsData.interest_over_time.averages[0]?.value.toFixed(1)}
                  </div>
                )}
              </div>
            )}

            {/* Interest By Region */}
            {trendsData.interest_by_region && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Top Regions
                </h3>
                <div className="space-y-1">
                  {trendsData.interest_by_region.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs p-2 bg-muted rounded">
                      <span>{item.location}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-primary/20 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${item.extracted_value}%` }}
                          />
                        </div>
                        <span className="font-medium w-8 text-right">
                          {item.extracted_value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Topics */}
            {trendsData.related_topics && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Related Topics
                </h3>
                {trendsData.related_topics.top && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Top</p>
                    <div className="space-y-1">
                      {trendsData.related_topics.top.slice(0, 5).map((item, idx) => {
                        const title = item.topic?.title || item.topic_title || item.query || "";
                        return (
                          <div key={idx} className="flex justify-between text-xs p-2 bg-muted rounded">
                            <span className="flex-1">{title}</span>
                            <span className="font-medium">{item.value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {trendsData.related_topics.rising && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Rising
                    </p>
                    <div className="space-y-1">
                      {trendsData.related_topics.rising.slice(0, 5).map((item, idx) => {
                        const title = item.topic?.title || item.topic_title || item.query || "";
                        return (
                          <div key={idx} className="flex justify-between text-xs p-2 bg-green-500/10 rounded">
                            <span className="flex-1">{title}</span>
                            <span className="font-medium text-green-600">+{item.value}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Related Queries */}
            {trendsData.related_queries && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Related Searches</h3>
                {trendsData.related_queries.top && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Top</p>
                    <div className="space-y-1">
                      {trendsData.related_queries.top.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs p-2 bg-muted rounded">
                          <span className="flex-1">{item.query}</span>
                          <span className="font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {trendsData.related_queries.rising && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Rising
                    </p>
                    <div className="space-y-1">
                      {trendsData.related_queries.rising.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs p-2 bg-green-500/10 rounded">
                          <span className="flex-1">{item.query}</span>
                          <span className="font-medium text-green-600">+{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!trendsData && !isLoading && !error && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Search for a topic to see Google Trends data</p>
          <p className="text-xs mt-1">Past 12 months of trend data</p>
        </div>
      )}
    </div>
  );
}

