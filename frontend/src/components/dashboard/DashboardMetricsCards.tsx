import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart2, MousePointer2, Percent, TrendingUp, Sparkles, Eye, Users } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendLabel?: string;
  trendDirection?: "up" | "down" | "neutral";
  icon: React.ElementType;
  iconBg?: string;
  iconColor?: string;
  subValue?: string;
}

export function MetricCard({
  title,
  value,
  trend,
  trendLabel,
  trendDirection = "neutral",
  icon: Icon,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
  subValue,
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          {trend && (
            <Badge
              variant={trendDirection === "up" ? "secondary" : trendDirection === "down" ? "destructive" : "outline"}
              className={trendDirection === "up" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
            >
              {trendDirection === "up" ? "↑" : trendDirection === "down" ? "↓" : ""} {trend}
            </Badge>
          )}
        </div>

        <div>
          <h3 className="text-3xl font-bold tracking-tight mb-1">{value}</h3>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {(trendLabel || subValue) && (
            <p className="text-xs text-muted-foreground mt-1">
              {subValue && <span className="mr-2 text-foreground font-medium">{subValue}</span>}
              {trendLabel}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardMetricsCards({ summary }: { summary?: { totalArticles?: number; totalClicks?: number; totalImpressions?: number; totalVisiter?: number; totalViews?: number; avgCtr?: string } }) {
  const totalArticles = summary?.totalArticles || 0;
  const totalClicks = summary?.totalClicks ? formatNumber(summary.totalClicks) : "0";
  const totalImpressions = summary?.totalImpressions ? formatNumber(summary.totalImpressions) : "0";
  const totalViews = summary?.totalViews ? formatNumber(summary.totalViews) : "0";
  const totalVisiter = summary?.totalVisiter ? formatNumber(summary.totalVisiter) : "0";
  const avgCtr = summary?.avgCtr || "0.00%";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <MetricCard
        title="My Total Articles"
        value={totalArticles}
        icon={FileText}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        trendLabel="published in period"
      />
      <MetricCard
        title="Total Clicks"
        value={totalClicks}
        icon={MousePointer2}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        trendLabel="from search results"
      />
      <MetricCard
        title="Impressions"
        value={totalImpressions}
        icon={BarChart2}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        trendLabel="in search results"
      />
      <MetricCard
        title="Page Views"
        value={totalViews}
        icon={Eye}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        trendLabel="total page views"
      />
      <MetricCard
        title="Unique Visitors"
        value={totalVisiter}
        icon={Users}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        trendLabel="total unique visitors"
      />
      <MetricCard
        title="Average CTR"
        value={avgCtr}
        icon={Percent}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        trendLabel="click-through rate"
      />
    </div>
  );
}
