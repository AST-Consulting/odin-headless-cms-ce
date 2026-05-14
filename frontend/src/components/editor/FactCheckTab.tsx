import React, { useEffect, useState, useMemo } from "react";
import { useEditorStore, usePropertyStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Info, AlertTriangle, CheckCircle2, Loader2, AlertCircle, ExternalLink, Check, X } from "lucide-react";
import { startFactValidation, getFactValidationStatus } from "@/lib/api";
import { toast } from "sonner";
import type { FactCheckResult, FactCheckFinding } from "@/lib/types";
import { useEditorContext } from "./EditorContext";

const LOADING_MESSAGES = [
  "Identifying factual claims within the article...",
  "Initializing grounding search across web indices...",
  "Cross-referencing entities against news archives...",
  "Analyzing official government and statistical databases...",
  "Verifying dates and historical event timelines...",
  "Comparing claims with reputable news wire services...",
  "Assessing the reliability of mentioned sources...",
  "Checking for recent updates on developing stories...",
  "Applying strict journalistic validation rules...",
  "Evaluating statistical claims and numerical data...",
  "Synthesizing findings and source citations...",
  "Finalizing verification report and suggestions..."
];

export function FactCheckTab() {
  const {
    articleType,
    articleTitle,
    blocks,
    currentArticleId,
    setFactCheckJobId,
    factCheckJobId,
    factCheckResult,
    setFactCheckResult
  } = useEditorStore(
    useShallow((s) => ({
      articleType: s.articleType,
      articleTitle: s.articleTitle,
      blocks: s.blocks,
      currentArticleId: s.currentArticleId,
      setFactCheckJobId: s.setFactCheckJobId,
      factCheckJobId: s.factCheckJobId,
      factCheckResult: s.factCheckResult,
      setFactCheckResult: s.setFactCheckResult,
    }))
  );
  
  const { editor, atomicReplaceQuote } = useEditorContext();
  const selectedProperty = usePropertyStore((s) => s.selectedProperty);

  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>(
    factCheckResult ? 'completed' : (factCheckJobId ? 'processing' : 'idle')
  );
  const [error, setError] = useState<string | null>(null);
  const [isPollingActive, setIsPollingActive] = useState(!!factCheckJobId && !factCheckResult);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Rotation for loading messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'processing') {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (!factCheckJobId || !isPollingActive) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const job = await getFactValidationStatus(factCheckJobId);
        if (cancelled) return;

        if (job.status === 'completed') {
          setStatus('completed');
          setFactCheckResult(job.result);
          setIsPollingActive(false);
          toast.success("Fact check completed!");
        } else if (job.status === 'failed') {
          setStatus('failed');
          setError(job.error || "Fact check failed");
          setIsPollingActive(false);
        } else {
          setStatus('processing');
        }
      } catch (err: any) {
        if (cancelled) return;
        setStatus('failed');
        setError(err.message || "Failed to fetch status");
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [factCheckJobId, isPollingActive]);

  // Sync local status when factCheckResult is already loaded (hydrated by EditorWithBlocks)
  useEffect(() => {
    if (factCheckResult && status === 'idle') {
      setStatus('completed');
    }
  }, [factCheckResult, status]);

  // Sync fact check state to localStorage for persistence across reloads
  useEffect(() => {
    if (currentArticleId && factCheckResult) {
      const cacheKey = `odin_cms_fc_${currentArticleId}`;
      localStorage.setItem(cacheKey, JSON.stringify(factCheckResult));
      // Backend state is already managed by the job service
    }
  }, [currentArticleId, factCheckResult]);

  const handleManualFactCheck = async () => {
    if (articleType !== "article") {
      toast.error("Fact-checking is only available for articles.");
      return;
    }

    try {
      setStatus('processing');
      setError(null);
      setFactCheckResult(null);
      
      if (currentArticleId) {
        localStorage.removeItem(`odin_cms_fc_${currentArticleId}`);
      }

      const propertyLanguage = selectedProperty?.lang;
      const storedLanguage = typeof window !== "undefined"
        ? localStorage.getItem("odin_language")
        : null;

      const selectedLanguage = propertyLanguage || storedLanguage || "hi";

      const factCheckPayload = {
        articleId: currentArticleId || undefined,
        title: articleTitle,
        type: articleType,
        language: selectedLanguage,
        richBlocks: blocks.map((block: any, index: number) => ({
          id: block.id || `block-${index}`,
          type: block.type || "paragraph",
          content: block.content,
          metadata: { props: block.props, children: block.children },
          order: index,
        })),
        strictness: "strict" as const
      };

      const { jobId } = await startFactValidation(factCheckPayload);
      setFactCheckJobId(jobId);
      setIsPollingActive(true);
      toast.success("Fact validation started");
    } catch (error) {
      console.error("Failed to start manual fact check:", error);
      toast.error("Failed to start fact validation");
      setStatus('failed');
      setIsPollingActive(false);
    }
  };

  const isEditorEmpty = useMemo(() => {
    if (!blocks || blocks.length === 0) return true;
    for (const block of blocks as any[]) {
      if (!block.content) continue;
      if (Array.isArray(block.content)) {
        const hasText = (block.content as any[]).some((c: any) => c.type === 'text' && typeof c.text === 'string' && c.text.trim().length > 0);
        if (hasText) return false;
      } else if (typeof block.content === 'string' && block.content.trim().length > 0) {
        return false;
      }
    }
    return true;
  }, [blocks]);

  const seriousFindings = factCheckResult?.findings.filter((f: FactCheckFinding) => (f.verdict as string) !== 'accurate') || [];

  const handleAccept = (finding: FactCheckFinding) => {
    if (!editor || !finding.blockId || !atomicReplaceQuote) {
      if (!finding.blockId) toast.warning("Cannot auto-replace: Text not found in editor or context missing");
      return;
    }
    
    // Use the unified atomic replace logic from EditorContext
    const success = atomicReplaceQuote(finding.blockId, finding.quote, finding.suggestedReplacement, finding.id);
    
    if (success) {
      // Remove from global list
      setFactCheckResult({
        ...factCheckResult!,
        findings: factCheckResult!.findings.filter((f: FactCheckFinding) => f.id !== finding.id)
      });
      toast.success("Fact correction applied");
    } else {
      toast.error("Failed to apply correction: claim not found in block");
    }
  };

  const handleScrollToFinding = (blockId: string) => {
    if (!editor || !blockId) return;
    try {
      const block = editor.getBlock(blockId);
      if (block) {
        editor.setTextCursorPosition(blockId, "start");
        // Scroll the actual editor container if available
        const editorElement = document.querySelector('.bn-editor');
        if (editorElement) {
           // We can also try simple element scrolling if the editor cursor positioning isn't enough
           const domElement = document.querySelector(`[data-id="${blockId}"]`);
           if (domElement) {
              domElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
           }
        }
      }
    } catch (e) {
      console.error("Failed to scroll to block:", e);
    }
  };

  const handleReject = (findingId: string) => {
    // Just remove from store, EditorWithBlocks useEffect will handle clearing highlights
    setFactCheckResult({
      ...factCheckResult!,
      findings: factCheckResult!.findings.filter((f: FactCheckFinding) => f.id !== findingId)
    });
    toast.info("Finding dismissed");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            Fact Validation
            <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
              AI Powered
            </span>
          </span>
        </h3>
        <p className="text-sm text-muted-foreground">
          {status === 'processing' && isPollingActive
            ? "AI is currently verifying claims..."
            : "Verify statements and claims against trusted sources."}
        </p>
      </div>

      {status === 'idle' ? (
        <Card className="p-6 border-2 border-dashed flex flex-col items-center justify-center text-center gap-4 bg-muted/30">
          <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="max-w-[240px] space-y-2">
            <p className="font-semibold text-sm">Truth Verification</p>
            <p className="text-xs text-muted-foreground">
              Analyze content to identify and verify factual claims against global news and data sources.
            </p>
          </div>
          <div className="w-full mt-2">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
              onClick={handleManualFactCheck}
              disabled={articleType !== "article" || isEditorEmpty}
            >
              <ShieldCheck className="h-4 w-4" />
              {factCheckJobId ? "Run New Check" : "Start Fact Check"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {status === 'processing' && (
            <Card className="p-8 flex flex-col items-center justify-center space-y-4 text-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <div>
                <p className="font-semibold text-base">Verifying Claims</p>
                <div className="h-10 flex items-center justify-center mt-2 px-4">
                  <p className="text-xs text-muted-foreground/80 italic animate-pulse leading-relaxed">
                    {LOADING_MESSAGES[loadingMessageIndex]}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFactCheckJobId(null);
                  setIsPollingActive(false);
                  setStatus('idle');
                }}
                className="mt-2 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/30 dark:hover:bg-red-900/20"
              >
                Stop Validation
              </Button>
            </Card>
          )}

          {status === 'failed' && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Verification Failed</p>
                <p className="text-xs opacity-90 leading-relaxed">{error || "The fact check service encountered an error."}</p>
                <Button variant="outline" size="sm" onClick={handleManualFactCheck} className="mt-3 h-8 text-xs border-destructive/30 hover:bg-destructive/10">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="space-y-4 animate-in fade-in duration-500">
              {seriousFindings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center bg-green-500/5 rounded-xl border border-green-500/10">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-green-700 dark:text-green-400">No Issues Found</p>
                    <p className="text-sm text-green-600/70 dark:text-green-500/70">AI did not detect any major factual contradictions.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleManualFactCheck} className="mt-2 h-8 text-xs">
                    Run New Check
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-3 text-sm">
                    <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                    <p>We found <strong>{seriousFindings.length}</strong> potential factual issues that might need correction.</p>
                  </div>

                  <div className="space-y-4">
                    {seriousFindings.map((finding: FactCheckFinding, idx: number) => (
                      <Card 
                        key={idx} 
                        className="p-4 border border-border/80 bg-muted/20 space-y-3 relative overflow-hidden cursor-pointer hover:bg-muted/40 transition-colors group"
                        onClick={() => handleScrollToFinding(finding.blockId || "")}
                      >
                        {finding.verdict === 'contradicted' && (
                          <div className="absolute top-0 right-0 w-1 h-full bg-orange-500 group-hover:bg-orange-600 transition-colors" />
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className={`capitalize bg-background text-[10px] h-5 px-1.5 ${finding.verdict === 'contradicted' ? 'border-orange-200 text-orange-700' : ''}`}>
                            {finding.verdict.replace("_", " ")}
                          </Badge>
                          <Badge variant={finding.severity === 'high' ? 'destructive' : 'secondary'} className="text-[9px] h-4 px-1 uppercase tracking-wider">
                            {finding.severity}
                          </Badge>
                        </div>

                        <div className={`p-3 rounded-lg border italic text-xs ${finding.verdict === 'contradicted' ? 'bg-orange-50/50 border-orange-100 text-orange-900/80' : 'bg-background border-border/60 text-muted-foreground'}`}>
                          "{finding.quote}"
                        </div>

                        <p className="text-sm font-medium leading-tight px-1">
                          {finding.reason}
                        </p>

                        <div className="p-3 rounded-lg bg-green-50/50 border border-green-100 text-green-900">
                          <p className="text-[9px] uppercase font-bold text-green-700/70 mb-1">Suggested Correction</p>
                          <p className="text-sm leading-snug">{finding.suggestedReplacement}</p>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button 
                            size="sm" 
                            className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs"
                            onClick={() => handleAccept(finding)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Accept
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 gap-1.5 text-xs border-muted-foreground/20 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                            onClick={() => handleReject(finding.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>

                        {/* {finding.sources && finding.sources.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40 mt-2">
                            {finding.sources.map((source: any, sIdx: number) => (
                              <a 
                                key={sIdx} 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                {source.title.length > 20 ? source.title.substring(0, 20) + '...' : source.title}
                              </a>
                            ))}
                          </div>
                        )} */}
                      </Card>
                    ))}
                  </div>

                  <Button variant="outline" className="w-full text-xs h-9 gap-2" onClick={handleManualFactCheck}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verify Again
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'idle' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/20">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">How it works</p>
              <p className="text-xs text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                Validation extracts key claims from your article and searches the web for evidence. This helps prevent misinformation and improves accuracy.
              </p>
            </div>
          </div>

          {articleType !== "article" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted border">
              <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Not Available</p>
                <p className="text-xs text-muted-foreground">
                  Fact checking is currently optimized for long-form articles. Other content types are not supported yet.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-4 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Verified facts boost reader trust and SEO rankings.</span>
        </div>
      </div>
    </div>
  );
}
