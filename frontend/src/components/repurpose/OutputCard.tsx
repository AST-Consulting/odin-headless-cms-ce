"use client";

import { ReactNode, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OutputCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  copyText?: string | (() => string);
  onRegenerate?: () => void | Promise<void>;
  isRegenerating?: boolean;
  isLoading?: boolean;
  children: ReactNode;
  headerActions?: ReactNode;
  accent?: "primary" | "success" | "warning" | "destructive";
}

const ACCENT_BG: Record<NonNullable<OutputCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function OutputCard({
  title,
  subtitle,
  icon: Icon,
  copyText,
  onRegenerate,
  isRegenerating,
  isLoading,
  children,
  headerActions,
  accent = "primary",
}: OutputCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = typeof copyText === "function" ? copyText() : copyText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${title} copied`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <Card
      className={cn(
        "flex flex-col h-full",
        "dark:bg-gradient-to-br dark:from-[hsl(230_25%_11%)] dark:to-[hsl(230_25%_8%)]",
        "dark:border-[hsl(230_20%_20%/0.6)]"
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              ACCENT_BG[accent]
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {headerActions}
          {copyText && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleCopy}
              disabled={isLoading || isRegenerating}
              aria-label="Copy"
              title="Copy"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
          {onRegenerate && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onRegenerate()}
              disabled={isLoading || isRegenerating}
              aria-label="Regenerate"
              title="Regenerate this format"
            >
              {isRegenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "flex-1 pt-0",
          (isLoading || isRegenerating) && "opacity-60"
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
