"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, FileEdit, Eye, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusCounts {
  draft: number;
  review: number;
  scheduled: number;
  published: number;
}

interface PublishingPipelineProps {
  statusCounts: StatusCounts;
  loading?: boolean;
}

const STATUS_CONFIG = [
  {
    key: "draft" as const,
    label: "Draft",
    icon: FileEdit,
    color: "bg-slate-500",
    textColor: "text-slate-500",
    bgLight: "bg-slate-500/10",
  },
  {
    key: "review" as const,
    label: "In Review",
    icon: Eye,
    color: "bg-amber-500",
    textColor: "text-amber-500",
    bgLight: "bg-amber-500/10",
  },
  {
    key: "scheduled" as const,
    label: "Scheduled",
    icon: Clock,
    color: "bg-blue-500",
    textColor: "text-blue-500",
    bgLight: "bg-blue-500/10",
  },
  {
    key: "published" as const,
    label: "Published",
    icon: CheckCircle,
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
    bgLight: "bg-emerald-500/10",
  },
];

export function PublishingPipeline({
  statusCounts,
  loading,
}: PublishingPipelineProps) {
  const total = useMemo(
    () =>
      statusCounts.draft +
      statusCounts.review +
      statusCounts.scheduled +
      statusCounts.published,
    [statusCounts]
  );

  const getPercentage = (count: number) => {
    if (total === 0) return 0;
    return (count / total) * 100;
  };

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">
              Publishing Pipeline
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Content workflow status
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
          {loading ? (
            <div className="animate-pulse bg-muted-foreground/20 w-full" />
          ) : (
            STATUS_CONFIG.map((status) => {
              const percentage = getPercentage(statusCounts[status.key]);
              if (percentage === 0) return null;
              return (
                <div
                  key={status.key}
                  className={cn(
                    "h-full transition-all duration-500 ease-out",
                    status.color
                  )}
                  style={{ width: `${percentage}%` }}
                />
              );
            })
          )}
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-3">
          {STATUS_CONFIG.map((status) => {
            const count = statusCounts[status.key];
            const Icon = status.icon;
            return (
              <div
                key={status.key}
                className={cn(
                  "p-3 rounded-lg transition-all duration-200 hover:scale-[1.02]",
                  status.bgLight
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", status.textColor)} />
                  <span className="text-sm font-medium text-muted-foreground">
                    {status.label}
                  </span>
                </div>
                <div className={cn("text-2xl font-bold mt-1", status.textColor)}>
                  {loading ? (
                    <div className="h-8 w-12 animate-pulse bg-muted rounded" />
                  ) : (
                    count
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total articles</span>
          <span className="text-lg font-semibold">
            {loading ? "..." : total}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
