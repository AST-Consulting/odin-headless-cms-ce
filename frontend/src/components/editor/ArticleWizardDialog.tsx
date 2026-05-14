"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { RainbowButton } from "@/components/ui/rainbow-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  CheckCircle,
  X,
  ChevronDown,
  Loader2,
  Square,
} from "lucide-react";
import { fetchTrendingSearches, getCategories, suggestTopics } from "@/lib/api";
import type { TrendingTopic, Category } from "@/lib/types";

/** Extract the English portion of a translated trend title (strip parenthesized original script) */
const getCleanTrendTitle = (trend: TrendingTopic): string => {
  const title = trend.title || trend.query;
  if (!title || typeof title !== "string") return "";
  
  // Translated titles are formatted as "English (OriginalScript)" — use only the English part
  const match = title.match(/^(.+?)\s*\(.*[\u0900-\u0DFF\u0E00-\u0FFF\u1000-\u109F\u0D00-\u0D7F].*\)$/);
  return match ? match[1].trim() : title;
};

/** Get a short preview string for a tooltip */
const getTrendingTooltip = (trend: TrendingTopic): string | null => {
  const parts: string[] = [];
  if (trend.formattedTraffic) parts.push(`${trend.formattedTraffic} searches`);
  const firstSnippet = trend.articles?.[0]?.snippet || trend.articles?.[0]?.title;
  if (firstSnippet) parts.push(firstSnippet);
  return parts.length > 0 ? parts.join(" · ") : null;
};

type WizardStep = "topic" | "generating";

const GENERATION_STEPS = [
  { label: "Researching topic...", duration: 8000 },
  { label: "Writing article...", duration: 15000 },
  { label: "Generating image...", duration: 10000 },
  { label: "Preparing SEO metadata...", duration: 5000 },
  { label: "Almost done...", duration: 60000 },
];

const ARTICLE_TYPES = [
  { value: "article", label: "Article" },
  { value: "recipe", label: "Recipe" },
  { value: "movie_review", label: "Movie Review" },
  // { value: "shorts", label: "Shorts" },
  // { value: "liveblog", label: "Live Blog" },
  // { value: "photo_story", label: "Photo Story" },
  // { value: "video", label: "Video" },
];

const LANGUAGES = [
  { value: "hi", label: "Hindi" },
  { value: "en", label: "English" },
  { value: "bn", label: "Bengali" },
  { value: "te", label: "Telugu" },
  { value: "ta", label: "Tamil" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "pa", label: "Punjabi" },
  { value: "ur", label: "Urdu" },
];

interface ArticleWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (topic: string, language: string, type: string) => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  generationComplete: boolean;
  generationError: string | null;
  defaultTopic: string;
  defaultLanguage: string;
  defaultArticleType: string;
  defaultCategory: string;
}

export function ArticleWizardDialog({
  open,
  onOpenChange,
  onGenerate,
  onStopGeneration,
  isGenerating,
  generationComplete,
  generationError,
  defaultTopic,
  defaultLanguage,
  defaultArticleType,
  defaultCategory,
}: ArticleWizardDialogProps) {
  const [step, setStep] = useState<WizardStep>("topic");
  const [topic, setTopic] = useState(defaultTopic);
  const [language, setLanguage] = useState(defaultLanguage);
  const [articleType, setArticleType] = useState(defaultArticleType);
  const [guidance, setGuidance] = useState("");
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  const [generationStage, setGenerationStage] = useState(0);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsCache = useRef<Record<string, string[]>>({});

  // Sync defaults when dialog opens
  useEffect(() => {
    if (open) {
      setTopic(defaultTopic);
      setLanguage(defaultLanguage);
      setArticleType(defaultArticleType);
      setCategory(defaultCategory);

      if (isGenerating) {
        setStep("generating");
      } else {
        setStep("topic");
        setGenerationStage(0);
        setGuidance("");
        setIsGuidanceOpen(false);
      }
    }
  }, [open, defaultTopic, defaultLanguage, defaultArticleType, defaultCategory, isGenerating]);

  // Load trending topics and categories on dialog open
  useEffect(() => {
    if (!open || step !== "topic") return;

    let cancelled = false;
    const loadTrending = async () => {
      setIsLoadingTrending(true);
      try {
        const data = await fetchTrendingSearches({ geo: "IN" });
        if (cancelled) return;
        const searches = data.daily_searches || data.trending_searches || [];
        setTrendingTopics(searches.slice(0, 12));
      } catch {
        // Trending is non-critical, silently fail
      } finally {
        if (!cancelled) setIsLoadingTrending(false);
      }
    };
    const loadCategories = async () => {
      try {
        const data = await getCategories({ limit: 50, status: "active" });
        if (cancelled) return;
        setCategories(data.data || []);
      } catch {
        // Non-critical
      }
    };
    loadTrending();
    loadCategories();
    return () => { cancelled = true; };
  }, [open, step]);

  // Fetch AI topic suggestions when category changes
  useEffect(() => {
    if (!category || !open || step !== "topic") {
      setCategorySuggestions([]);
      return;
    }

    const cacheKey = `${category}:${language}`;
    if (suggestionsCache.current[cacheKey]) {
      setCategorySuggestions(suggestionsCache.current[cacheKey]);
      return;
    }

    let cancelled = false;
    setIsLoadingSuggestions(true);
    suggestTopics(
      categories.find((c) => c._id === category)?.title || category,
      language
    )
      .then((topics) => {
        if (cancelled) return;
        suggestionsCache.current[cacheKey] = topics;
        setCategorySuggestions(topics);
      })
      .catch(() => {
        if (!cancelled) setCategorySuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSuggestions(false);
      });

    return () => { cancelled = true; };
  }, [category, language, open, step, categories]);

  // Auto-focus textarea
  useEffect(() => {
    if (open && step === "topic") {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, step]);

  // Generation stage progression — matches GenerationOverlay style
  useEffect(() => {
    if (step !== "generating" || generationComplete || generationError) return;

    setGenerationStage(0);
    let cancelled = false;

    const advanceStep = (idx: number) => {
      if (idx >= GENERATION_STEPS.length - 1) return;
      stageTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setGenerationStage(idx + 1);
        advanceStep(idx + 1);
      }, GENERATION_STEPS[idx].duration);
    };
    advanceStep(0);

    return () => {
      cancelled = true;
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    };
  }, [step, generationComplete, generationError]);

  // Handle generation complete
  useEffect(() => {
    if (generationComplete && step === "generating") {
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
      setGenerationStage(GENERATION_STEPS.length);
    }
  }, [generationComplete, step]);

  // Handle generation error
  useEffect(() => {
    if (generationError && step === "generating") {
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    }
  }, [generationError, step]);

  const handleGenerate = () => {
    const parts = [topic];
    const selectedCategory = categories.find((c) => c._id === category);
    if (selectedCategory) {
      parts.push(`\nCategory: ${selectedCategory.title}`);
    }
    if (guidance.trim()) {
      parts.push(`\nGuidance:\n${guidance.trim()}`);
    }
    setStep("generating");
    onGenerate(parts.join(""), language, articleType);
  };

  const handleRetry = () => {
    setStep("topic");
  };

  const isTopicValid = topic.trim().length >= 10;

  const getLanguageLabel = (value: string) =>
    LANGUAGES.find((l) => l.value === value)?.label || value;

  const getArticleTypeLabel = (value: string) =>
    ARTICLE_TYPES.find((t) => t.value === value)?.label || value;

  // Step 1: Topic
  const renderTopicStep = () => (
    <div className="space-y-5">
      <div>
        <Textarea
          ref={textareaRef}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., India's 2026 Chandrayaan-5 mission and its significance..."
          rows={3}
          className="resize-none text-base"
        />
        {topic.length > 0 && topic.length < 10 && (
          <p className="text-xs text-muted-foreground mt-1.5">
            At least 10 characters needed ({topic.length}/10)
          </p>
        )}
      </div>

      {/* Category suggestions */}
      {category && (isLoadingSuggestions || categorySuggestions.length > 0) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Suggested for {categories.find((c) => c._id === category)?.title || "category"}
          </p>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
            {isLoadingSuggestions ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))
            ) : (
              categorySuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTopic(s)}
                  className="w-full text-left text-sm px-3 py-2 rounded-md border border-transparent hover:border-primary/20 hover:bg-primary/5 text-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Trending chips */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Trending now</p>
        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
          {isLoadingTrending ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full" />
            ))
          ) : trendingTopics.length > 0 ? (
            <TooltipProvider delayDuration={300}>
              {trendingTopics.map((t, i) => {
                const tooltipText = getTrendingTooltip(t);
                const chip = (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                    onClick={() => setTopic(getCleanTrendTitle(t))}
                  >
                    {getCleanTrendTitle(t)}
                  </Badge>
                );

                if (!tooltipText) return <span key={i}>{chip}</span>;

                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>{chip}</TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[280px] text-xs font-normal">
                      {tooltipText}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          ) : (
            <p className="text-xs text-muted-foreground">No trending topics available</p>
          )}
        </div>
      </div>

      {/* Smart defaults bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-auto min-w-[100px] h-8 text-xs">
            <SelectValue>{getLanguageLabel(language)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={articleType} onValueChange={setArticleType}>
          <SelectTrigger className="w-auto min-w-[100px] h-8 text-xs">
            <SelectValue>{getArticleTypeLabel(articleType)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ARTICLE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <Combobox
            options={categories.map((cat) => ({ value: cat._id, label: cat.title }))}
            value={category}
            onChange={setCategory}
            placeholder="Category (optional)"
            searchPlaceholder="Search categories..."
            className="w-auto min-w-[160px]"
            buttonClassName="h-8 text-xs"
            direction="up"
          />
        )}
      </div>

      {/* Optional guidance */}
      <div>
        <button
          type="button"
          onClick={() => setIsGuidanceOpen(!isGuidanceOpen)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isGuidanceOpen ? "rotate-0" : "-rotate-90"}`}
          />
          Add guidance for the AI
        </button>
        {isGuidanceOpen && (
          <Textarea
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="e.g., Focus on stats, mention IPL performance, keep it under 500 words..."
            rows={2}
            className="resize-none text-sm mt-2"
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end pt-2">
        <RainbowButton
          onClick={handleGenerate}
          disabled={!isTopicValid}
          className="gap-1.5"
        >
          <Sparkles className="h-4 w-4" />
          Generate Article
        </RainbowButton>
      </div>
    </div>
  );

  // Step 2: Generation progress — matches GenerationOverlay style
  const renderGeneratingStep = () => {
    if (generationError) {
      return (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <X className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-sm text-destructive text-center max-w-xs">{generationError}</p>
          <Button variant="outline" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      );
    }

    const isComplete = generationStage >= GENERATION_STEPS.length;

    return (
      <div className="flex flex-col items-center gap-6 py-8">
        {/* Animated icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {isComplete ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            )}
          </div>
          {!isComplete && (
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          )}
        </div>

        {/* Progress steps */}
        <div className="space-y-3 w-full">
          <p className="text-lg font-semibold text-center">
            {isComplete ? "Your article is ready!" : "Generating your article"}
          </p>
          <div className="space-y-2">
            {GENERATION_STEPS.map((s, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                  idx < generationStage ? "text-primary" :
                  idx === generationStage ? "text-foreground font-medium" :
                  "text-muted-foreground/40"
                }`}
              >
                {idx < generationStage ? (
                  <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground flex-shrink-0">
                    &#10003;
                  </span>
                ) : idx === generationStage ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                ) : (
                  <span className="w-5 h-5 rounded-full border border-border flex-shrink-0" />
                )}
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {!isComplete && (
          <Button variant="outline" size="sm" onClick={onStopGeneration} className="gap-1.5 mt-2">
            <Square className="w-3.5 h-3.5" />
            Cancel
          </Button>
        )}
      </div>
    );
  };

  const heading = step === "topic"
    ? { title: "What should we write about?", description: "Describe your idea, or pick a trending topic below" }
    : { title: "Crafting your article...", description: "Sit back while AI writes your content" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] gap-0 overflow-visible">
        <DialogHeader className="pb-4">
          <DialogTitle>{heading.title}</DialogTitle>
          <DialogDescription>{heading.description}</DialogDescription>
        </DialogHeader>

        <div
          key={step}
          className={`animate-in fade-in slide-in-from-right-4 duration-300`}
        >
          {step === "topic" && renderTopicStep()}
          {step === "generating" && renderGeneratingStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
