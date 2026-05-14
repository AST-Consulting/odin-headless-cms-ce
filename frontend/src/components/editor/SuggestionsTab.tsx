"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useEditorContext } from "./EditorContext";
import { analyzeContent, applySuggestionFix } from "@/lib/api";
import { markdownToBlocks } from "@/lib/markdown-to-blocks";
import { toast } from "sonner";
import {
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wand2,
  BookOpen,
  Clock,
  FileText,
  BarChart3,
  MessageSquare,
  AlertTriangle,
  Wrench,
  RefreshCw,
} from "lucide-react";

interface Suggestion {
  category: "readability" | "engagement" | "structure" | "tone";
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
}

interface ContentMetrics {
  wordCount: number;
  readingTime: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  complexSentences: number;
  complexSentenceRatio: number;
  fleschScore: number;
  readingLevel: string;
  headingCount: number;
  passiveVoiceCount: number;
  avgParagraphLength: number;
}

interface ScoreBreakdown {
  readability: number;
  engagement: number;
  structure: number;
  tone: number;
}

interface AnalysisResult {
  suggestions: Suggestion[];
  summary: string;
  wordCount: number;
  readingTime: number;
  metrics?: ContentMetrics;
  scoreBreakdown?: ScoreBreakdown;
}

const categoryConfig = {
  readability: {
    icon: Lightbulb,
    label: "Readability",
    color: "bg-blue-500/10 text-blue-500",
  },
  engagement: {
    icon: Sparkles,
    label: "Engagement",
    color: "bg-purple-500/10 text-purple-500",
  },
  structure: {
    icon: Target,
    label: "Structure",
    color: "bg-green-500/10 text-green-500",
  },
  tone: {
    icon: TrendingUp,
    label: "Tone",
    color: "bg-orange-500/10 text-orange-500",
  },
};

const severityConfig = {
  low: { color: "bg-gray-500/10 text-gray-500", label: "Low" },
  medium: { color: "bg-yellow-500/10 text-yellow-500", label: "Medium" },
  high: { color: "bg-red-500/10 text-red-500", label: "High" },
};

// Score color helper
const getScoreColor = (score: number): string => {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
};

const getScoreBgColor = (score: number): string => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
};

export function SuggestionsTab() {
  const { editor } = useEditorContext();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [fixingIndex, setFixingIndex] = useState<number | null>(null);
  const [fixedIndices, setFixedIndices] = useState<Set<number>>(new Set());

  const getEditorContent = async (): Promise<string> => {
    if (!editor) return "";
    const markdown = await editor.blocksToMarkdownLossy(editor.document);
    return markdown;
  };

  const checkEditorContent = () => {
    if (!editor) {
      setHasContent(false);
      return;
    }
    const blocks = editor.document;
    const hasText = blocks.some(
      (block: { content?: unknown[] }) =>
        block.content && block.content.length > 0
    );
    setHasContent(hasText);
  };

  const handleAnalyze = async () => {
    if (!editor) {
      toast.error("Editor not ready");
      return;
    }

    const content = await getEditorContent();
    if (!content.trim()) {
      toast.error("Please write some content first");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(false);
    setFixedIndices(new Set());
    try {
      const result = await analyzeContent(content);
      setAnalysis(result);
      toast.success("Content analyzed successfully");
    } catch (error) {
      console.error("Failed to analyze content:", error);
      setAnalysisError(true);
      toast.error("Failed to analyze content");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyFix = async (suggestion: Suggestion, index: number) => {
    if (!editor) {
      toast.error("Editor not ready");
      return;
    }

    setFixingIndex(index);
    try {
      const content = await getEditorContent();
      const fixedContent = await applySuggestionFix(content, {
        title: suggestion.title,
        description: suggestion.description,
        category: suggestion.category,
      });

      const newBlocks = markdownToBlocks(fixedContent, editor);
      editor.replaceBlocks(editor.document, newBlocks);

      setFixedIndices((prev) => new Set(prev).add(index));
      toast.success(`Applied fix: ${suggestion.title}`);
    } catch (error) {
      console.error("Failed to apply fix:", error);
      toast.error("Failed to apply fix. Please try again.");
    } finally {
      setFixingIndex(null);
    }
  };

  // Calculate overall score
  const overallScore = useMemo(() => {
    if (!analysis?.scoreBreakdown) return 0;
    const { readability, engagement, structure, tone } = analysis.scoreBreakdown;
    return Math.round((readability + engagement + structure + tone) / 4);
  }, [analysis?.scoreBreakdown]);

  // Check content on mount and periodically
  useEffect(() => {
    if (editor) {
      checkEditorContent();
      const interval = setInterval(checkEditorContent, 2000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div className="space-y-4">
      {/* Analysis Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Content Analysis</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAnalyze}
          disabled={isAnalyzing || !hasContent}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Wand2 className="w-3 h-3 mr-2" />
              Analyze Content
            </>
          )}
        </Button>
      </div>

      {/* Error State with Retry */}
      {analysisError && !isAnalyzing && (
        <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
              Analysis Failed
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mb-3">
              Something went wrong while analyzing your content.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyze}
              className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Retry Analysis
            </Button>
          </div>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-4 pr-4">
            {/* Overall Score */}
            {analysis.scoreBreakdown && (
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Overall Content Score
                    </div>
                    <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
                      {overallScore}
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-full ${getScoreBgColor(overallScore)} bg-opacity-10`}>
                    <BarChart3 className={`w-6 h-6 ${getScoreColor(overallScore)}`} />
                  </div>
                </div>
                <Progress value={overallScore} className="h-2" />
              </Card>
            )}

            {/* Score Breakdown */}
            {analysis.scoreBreakdown && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Score Breakdown
                </h4>
                <div className="space-y-3">
                  {Object.entries(analysis.scoreBreakdown).map(([key, score]) => {
                    const config = categoryConfig[key as keyof typeof categoryConfig];
                    const Icon = config.icon;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-3 h-3 ${config.color.split(' ')[1]}`} />
                            <span className="text-xs font-medium capitalize">{key}</span>
                          </div>
                          <span className={`text-xs font-bold ${getScoreColor(score)}`}>
                            {score}
                          </span>
                        </div>
                        <Progress value={score} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">Words</div>
                </div>
                <div className="text-xl font-bold">{analysis.wordCount}</div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">Read Time</div>
                </div>
                <div className="text-xl font-bold">{analysis.readingTime} min</div>
              </Card>
            </div>

            {/* Detailed Metrics */}
            {analysis.metrics && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Detailed Metrics
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Flesch Score</div>
                    <div className="font-semibold">{analysis.metrics.fleschScore}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {analysis.metrics.readingLevel}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Avg Sentence</div>
                    <div className="font-semibold">{analysis.metrics.avgSentenceLength} words</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Sentences</div>
                    <div className="font-semibold">{analysis.metrics.sentenceCount}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Paragraphs</div>
                    <div className="font-semibold">{analysis.metrics.paragraphCount}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Headings</div>
                    <div className="font-semibold">{analysis.metrics.headingCount}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Complex Sentences</div>
                    <div className="font-semibold">
                      {analysis.metrics.complexSentences} ({analysis.metrics.complexSentenceRatio}%)
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Summary */}
            {analysis.summary && (
              <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      Summary
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                      {analysis.summary}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Suggestions */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Suggestions ({analysis.suggestions.length})
              </h3>

              <div className="space-y-3">
                {analysis.suggestions.length === 0 ? (
                  <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <div className="text-center">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Excellent work!
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        No major improvements needed.
                      </p>
                    </div>
                  </Card>
                ) : (
                  analysis.suggestions.map((suggestion, index) => {
                    const config = categoryConfig[suggestion.category];
                    const SuggestionIcon = config.icon;
                    const severityStyle = severityConfig[suggestion.severity];
                    const isFixing = fixingIndex === index;
                    const isFixed = fixedIndices.has(index);

                    return (
                      <Card
                        key={index}
                        className={`p-3 transition-colors ${
                          isFixed
                            ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10 opacity-75"
                            : suggestion.severity === "high"
                            ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10"
                            : suggestion.severity === "medium"
                            ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/10"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 ${isFixed ? "bg-green-500/10 text-green-500" : config.color}`}>
                            {isFixed ? <CheckCircle2 className="w-4 h-4" /> : <SuggestionIcon className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={`text-sm font-medium leading-tight ${isFixed ? "line-through text-muted-foreground" : ""}`}>
                                {suggestion.title}
                              </h4>
                              {isFixed ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-green-500/10 text-green-500 shrink-0"
                                >
                                  Fixed
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${severityStyle.color} shrink-0`}
                                >
                                  {severityStyle.label}
                                </Badge>
                              )}
                            </div>
                            <p className={`text-xs leading-relaxed ${isFixed ? "text-muted-foreground" : "text-foreground/90 dark:text-foreground/80"}`}>
                              {suggestion.description}
                            </p>
                            <div className="flex items-center justify-between pt-1">
                              <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                                {config.label}
                              </Badge>
                              {!isFixed && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleApplyFix(suggestion, index)}
                                  disabled={fixingIndex !== null}
                                  className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                >
                                  {isFixing ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Fixing...
                                  </>
                                ) : (
                                  <>
                                    <Wrench className="w-3 h-3 mr-1" />
                                    Apply Fix
                                  </>
                                )}
                              </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      )}

      {!analysis && !isAnalyzing && !analysisError && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium mb-1">
            {hasContent ? "Ready to Analyze" : "Start Writing"}
          </p>
          <p className="text-xs">
            {hasContent
              ? "Click 'Analyze Content' to get AI-powered suggestions"
              : "Write some content to get detailed analysis and suggestions"}
          </p>
        </div>
      )}
    </div>
  );
}
