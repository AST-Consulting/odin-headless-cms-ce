"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GaOverview } from "@/lib/ga-types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function calcDelta(current: number, previous: number): { delta: string; trend: "up" | "down" | "neutral" } {
  if (!previous || previous === 0) return { delta: "—", trend: "neutral" };
  const diff = ((current - previous) / previous) * 100;
  const trend = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
  return { delta: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`, trend };
}

interface KpiItemProps {
  title: string;
  value: string;
  prevValue?: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  /** For bounce rate, down is actually good */
  invertTrend?: boolean;
}

function KpiItem({ title, value, prevValue, delta, trend, invertTrend }: KpiItemProps) {
  const effectiveTrend = invertTrend
    ? trend === "up" ? "down" : trend === "down" ? "up" : "neutral"
    : trend;

  const TrendIcon = effectiveTrend === "up" ? TrendingUp : effectiveTrend === "down" ? TrendingDown : Minus;
  const trendColor =
    effectiveTrend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : effectiveTrend === "down"
      ? "text-red-500 dark:text-red-400"
      : "text-muted-foreground";

  return (
    <Card className="p-4 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {delta !== "—" && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
          <TrendIcon className="w-3 h-3" />
          <span title={`Previous: ${prevValue}`}>{delta} vs {prevValue} prev</span>
        </div>
      )}
    </Card>
  );
}

interface GaKpiCardsProps {
  data: GaOverview | null | undefined;
  isLoading: boolean;
}

export function GaKpiCards({ data, isLoading }: GaKpiCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="p-4 animate-pulse space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const kpis: KpiItemProps[] = [
    {
      title: "Pageviews",
      value: formatNumber(data.pageviews.current),
      prevValue: formatNumber(data.pageviews.previous),
      ...calcDelta(data.pageviews.current, data.pageviews.previous),
    },
    {
      title: "Total Users",
      value: formatNumber(data.totalUsers.current),
      prevValue: formatNumber(data.totalUsers.previous),
      ...calcDelta(data.totalUsers.current, data.totalUsers.previous),
    },
    {
      title: "New Users",
      value: formatNumber(data.newUsers.current),
      prevValue: formatNumber(data.newUsers.previous),
      ...calcDelta(data.newUsers.current, data.newUsers.previous),
    },
    {
      title: "Sessions",
      value: formatNumber(data.sessions.current),
      prevValue: formatNumber(data.sessions.previous),
      ...calcDelta(data.sessions.current, data.sessions.previous),
    },
    {
      title: "Avg Session Duration",
      value: formatDuration(data.avgSessionDuration.current),
      prevValue: formatDuration(data.avgSessionDuration.previous),
      ...calcDelta(data.avgSessionDuration.current, data.avgSessionDuration.previous),
    },
    {
      title: "Bounce Rate",
      value: formatPercent(data.bounceRate.current),
      prevValue: formatPercent(data.bounceRate.previous),
      ...calcDelta(data.bounceRate.current, data.bounceRate.previous),
      invertTrend: true,
    },
    {
      title: "Pages / Session",
      value: data.pagesPerSession.current.toFixed(2),
      prevValue: data.pagesPerSession.previous.toFixed(2),
      ...calcDelta(data.pagesPerSession.current, data.pagesPerSession.previous),
    },
    {
      title: "Engaged Sessions",
      value: formatNumber(data.engagedSessions.current),
      prevValue: formatNumber(data.engagedSessions.previous),
      ...calcDelta(data.engagedSessions.current, data.engagedSessions.previous),
    },
    {
      title: "Engagement Rate",
      value: formatPercent(data.engagementRate.current),
      prevValue: formatPercent(data.engagementRate.previous),
      ...calcDelta(data.engagementRate.current, data.engagementRate.previous),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <KpiItem key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
