"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert, 
  AlertTriangle,
  Check,
  X
} from "lucide-react";
import { getFactValidationStatus } from "@/lib/api";
import type { FactCheckResult, FactCheckFinding } from "@/lib/types";
import { useEditorContext } from "./EditorContext";
import { useEditorStore } from "@/lib/store";
import { toast } from "sonner";

interface FactCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  onConfirmPublish: () => void;
  onCancel: () => void;
}

export function FactCheckDialog({
  open,
  onOpenChange,
  jobId,
  onConfirmPublish,
  onCancel,
}: FactCheckDialogProps) {
  const { editor, atomicReplaceQuote } = useEditorContext();
  const { 
    factCheckResult, 
    setFactCheckResult,
    setFactCheckJobId
  } = useEditorStore((s) => ({
    factCheckResult: s.factCheckResult,
    setFactCheckResult: s.setFactCheckResult,
    setFactCheckJobId: s.setFactCheckJobId,
  }));
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>('processing');
  const [error, setError] = useState<string | null>(null);

  const handleAccept = (finding: FactCheckFinding) => {
    if (!editor || !finding.blockId || !atomicReplaceQuote) {
      if (!finding.blockId) toast.warning("Cannot auto-replace: Block ID missing");
      return;
    }
    
    // Use the unified atomic replace logic from EditorContext
    const success = atomicReplaceQuote(finding.blockId, finding.quote, finding.suggestedReplacement, finding.id);
    
    if (success) {
      // Remove from global list
      setFactCheckResult({
        ...factCheckResult!,
        findings: factCheckResult!.findings.filter(f => f.id !== finding.id)
      });
      toast.success("Fact correction applied");
    } else {
      toast.error("Failed to apply correction: claim not found in block");
    }
  };

  const handleScrollToFinding = (blockId: string) => {
    if (!editor || !blockId) return;
    try {
      // Close dialog first so user can see the editor
      onOpenChange(false);
      
      const block = editor.getBlock(blockId);
      if (block) {
        editor.setTextCursorPosition(blockId, "start");
        const domElement = document.querySelector(`[data-id="${blockId}"]`);
        if (domElement) {
          domElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a temporary subtle flash highlight to show exactly where the user landed
          domElement.animate([
            { backgroundColor: 'rgba(249, 115, 22, 0.2)' },
            { backgroundColor: 'transparent' }
          ], { duration: 1500, iterations: 1 });
        }
      }
    } catch (e) {
      console.error("Failed to scroll to block:", e);
    }
  };

  const handleReject = (findingId: string) => {
    setFactCheckResult({
      ...factCheckResult!,
      findings: factCheckResult!.findings.filter(f => f.id !== findingId)
    });
    toast.info("Finding dismissed");
  };

  useEffect(() => {
    if (!open) return;

    if (factCheckResult) {
      setStatus('completed');
    } else if (jobId) {
      setStatus('processing');
    } else {
      setStatus('completed'); // No job and no result usually means no findings or initial state
    }
  }, [open, jobId, factCheckResult]);

  const seriousFindings = factCheckResult?.findings.filter((f: FactCheckFinding) => 
    (["contradicted", "outdated", "unsupported", "needs_review"].includes(f.verdict)) && 
    (f.severity !== "low" || f.verdict === "contradicted")
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-500" />
            AI Fact Check Validation
          </DialogTitle>
          <DialogDescription>
            {status === 'processing' 
              ? "Scanning content for factual accuracy and contradictions..." 
              : "Review findings before confirming publication."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4">
          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">Verifying claims from the article...</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">Fact check server unavailable</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          )}

          {status === 'completed' && (
            <>
              {seriousFindings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">No Serious Issues Found</p>
                    <p className="text-sm text-muted-foreground">AI did not detect any major factual contradictions.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-3 text-sm">
                    <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                    <p>We found <strong>{seriousFindings.length}</strong> potential factual issues that might need correction.</p>
                  </div>

                  <div className="space-y-4">
                    {seriousFindings.map((finding: FactCheckFinding, idx: number) => (
                      <div 
                        key={idx} 
                        className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-3 relative overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => handleScrollToFinding(finding.blockId || "")}
                      >
                        {finding.verdict === 'contradicted' && (
                          <div className="absolute top-0 right-0 w-1.5 h-full bg-orange-500 group-hover:bg-orange-600 transition-colors" />
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className={`capitalize bg-background ${finding.verdict === 'contradicted' ? 'border-orange-200 text-orange-700' : ''}`}>
                            {finding.verdict.replace("_", " ")}
                          </Badge>
                          <Badge variant={finding.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {finding.severity} severity
                          </Badge>
                        </div>
                        
                        <div className={`p-3 rounded-lg border italic text-sm ${finding.verdict === 'contradicted' ? 'bg-orange-50/50 border-orange-100 text-orange-900/80' : 'bg-background border-border/60 text-muted-foreground'}`}>
                          "{finding.quote}"
                        </div>
                        
                        <p className="text-sm font-medium leading-tight px-1">
                          {finding.reason}
                        </p>

                        <div className="p-3 rounded-lg bg-green-50/50 border border-green-100 text-green-900">
                          <p className="text-[10px] uppercase font-bold text-green-700/70 mb-1">Suggested Correction</p>
                          <p className="text-sm">{finding.suggestedReplacement}</p>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button 
                            size="sm" 
                            className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white gap-2"
                            onClick={() => handleAccept(finding)}
                          >
                            <Check className="h-4 w-4" />
                            Accept Change
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-9 gap-2 border-muted-foreground/20 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                            onClick={() => handleReject(finding.id)}
                          >
                            <X className="h-4 w-4" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirmPublish} 
            disabled={status === 'processing'}
            className={status === 'completed' && seriousFindings.length > 0 ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
          >
            {status === 'processing' ? 'Wait for AI...' : 'Publish Anyway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
