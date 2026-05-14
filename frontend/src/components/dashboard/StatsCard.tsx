"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  trend,
  loading,
}: StatsCardProps) {
  const TrendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
      ? TrendingDown
      : Minus;

  const trendColor =
    trend?.direction === "up"
      ? "text-emerald-500"
      : trend?.direction === "down"
      ? "text-rose-500"
      : "text-muted-foreground";

  return (
    <Card className="p-5 overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-to-br from-card to-card/80 relative">
      {/* Background decoration */}
      <div
        className={cn(
          "absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform duration-300 group-hover:scale-110",
          iconBg
        )}
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
          {trend && !loading && (
            <div className={cn("flex items-center gap-1 text-sm font-medium", trendColor)}>
              <TrendIcon className="w-4 h-4" />
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        <div className="mt-4">
          {loading ? (
            <>
              <div className="h-8 w-20 animate-pulse bg-muted rounded mb-1" />
              <div className="h-4 w-24 animate-pulse bg-muted rounded" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground">{title}</div>
              {subtitle && (
                <div className="text-xs text-muted-foreground mt-1">
                  {subtitle}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
