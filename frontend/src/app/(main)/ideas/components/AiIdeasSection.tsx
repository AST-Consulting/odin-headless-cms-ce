"use client";

import { useState, useEffect, useCallback } from "react";
import { suggestTopics, getCategories } from "@/lib/api";
import { getTrendsCache, setTrendsCache } from "@/lib/trends-cache";
import type { Category } from "@/lib/types";
import {
  Lightbulb,
  PenLine,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryNameSelector } from "@/components/common/CategoryNameSelector";

interface AiIdeasSectionProps {
  onCreateDraft: (topic: string) => void;
  onGenerateArticle?: (topic: string) => void;
}

function SuggestionSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function AiIdeasSection({ onCreateDraft, onGenerateArticle }: AiIdeasSectionProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]); // Changed to array for CategoryNameSelector
  const [language] = useState("hi");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load categories for title lookup
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getCategories({ limit: 50, status: "active" });
        if (!cancelled) {
          setCategories(data.data || []);
        }
      } catch {
        // Non-critical, categories will just be empty
      }
    };
    load();

    return () => { cancelled = true; };
  }, []);

  const fetchSuggestions = useCallback(async (categoryId: string, lang: string, force = false) => {
    const category = categories.find((c) => c._id === categoryId);
    if (!category) return;

    const cacheKey = `trends_ai_ideas:${categoryId}:${lang}`;
    if (!force) {
      const cached = getTrendsCache<string[]>(cacheKey);
      if (cached && cached.length > 0) {
        setSuggestions(cached);
        return;
      }
    }

    setIsLoadingSuggestions(true);
    setError(null);
    setSuggestions([]);

    try {
      const topics = await suggestTopics(category.title, lang, undefined, force);
      setTrendsCache(cacheKey, topics);
      setSuggestions(topics);
    } catch {
      setError("Failed to generate suggestions. Please try again.");
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [categories]);

  // Fetch suggestions when category or language changes
  useEffect(() => {
    if (selectedCategory.length > 0) {
      fetchSuggestions(selectedCategory[0], language);
    } else {
      setSuggestions([]);
    }
  }, [selectedCategory, language, fetchSuggestions]);

  const handleRefresh = () => {
    if (selectedCategory.length > 0) {
      fetchSuggestions(selectedCategory[0], language, true);
    }
  };

  const selectedCategoryTitle = selectedCategory.length > 0
    ? categories.find((c) => c._id === selectedCategory[0])?.title
    : undefined;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Choose a category
          </p>
          <CategoryNameSelector
            selected={selectedCategory}
            onChange={(selected) => {
              // Only keep the last selected category (single-select behavior)
              if (selected.length > 0) {
                setSelectedCategory([selected[selected.length - 1]]);
              } else {
                setSelectedCategory([]);
              }
            }}
            placeholder="Select a category..."
            className="max-w-md"
          />
        </div>
        {selectedCategory.length > 0 && suggestions.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoadingSuggestions}
            className="gap-1.5 mt-6"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSuggestions ? "animate-spin" : ""}`} />
            New Ideas
          </Button>
        )}
      </div>

      {/* Suggestions */}
      {selectedCategory.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">
              Ideas for {selectedCategoryTitle}
            </h3>
            {isLoadingSuggestions && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-sm text-destructive">
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="ml-2 h-auto py-1 px-2 text-xs"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading */}
          {isLoadingSuggestions && suggestions.length === 0 && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <SuggestionSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Suggestion cards */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={`${selectedCategory[0]}-${idx}`}
                  className="group flex items-start gap-3 rounded-xl border bg-card p-4
                    transition-all duration-200 hover:shadow-md hover:border-primary/20
                    dark:hover:shadow-primary/5 animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
                >
                  {/* Number */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {idx + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed">{suggestion}</p>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-1 flex-shrink-0
                      opacity-0 group-hover:opacity-100
                      translate-x-2 group-hover:translate-x-0
                      transition-all duration-200"
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs gap-1.5 px-2"
                      onClick={() => onCreateDraft(suggestion)}
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Draft</span>
                    </Button>
                    {onGenerateArticle && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1.5 px-2"
                        onClick={() => onGenerateArticle(suggestion)}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Generate</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state (after load, no suggestions) */}
          {!isLoadingSuggestions && !error && suggestions.length === 0 && selectedCategory.length > 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <Lightbulb className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">
                No suggestions available for this category
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial state - no category selected */}
      {selectedCategory.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-primary/30" />
          </div>
          <h3 className="text-base font-medium mb-1">Pick a category above</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Our AI will generate fresh, trending topic ideas tailored to your chosen beat
          </p>
        </div>
      )}
    </div>
  );
}
