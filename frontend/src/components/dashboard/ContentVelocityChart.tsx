"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import type { Article } from "@/lib/types";

interface ContentVelocityChartProps {
  articles: Article[];
  dateRange: "1day" | "7days" | "30days";
  loading?: boolean;
}

interface ChartDataPoint {
  date: string;
  label: string;
  count: number;
}

export function ContentVelocityChart({
  articles,
  dateRange,
  loading,
}: ContentVelocityChartProps) {
  const chartData = useMemo(() => {
    const now = new Date();
    const data: ChartDataPoint[] = [];

    // Determine number of intervals based on date range
    const intervals =
      dateRange === "1day" ? 24 : dateRange === "7days" ? 7 : 30;
    const isHourly = dateRange === "1day";

    for (let i = intervals - 1; i >= 0; i--) {
      const date = new Date(now);
      if (isHourly) {
        date.setHours(date.getHours() - i);
        date.setMinutes(0, 0, 0);
      } else {
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
      }

      const label = isHourly
        ? date.toLocaleTimeString("en-US", { hour: "numeric" })
        : date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });

      data.push({
        date: date.toISOString(),
        label,
        count: 0,
      });
    }

    // Count articles per interval
    articles.forEach((article) => {
      const articleDate = new Date(article.createdAt);
      data.forEach((point) => {
        const pointDate = new Date(point.date);
        const nextPointIndex = data.indexOf(point) + 1;
        const nextDate =
          nextPointIndex < data.length
            ? new Date(data[nextPointIndex].date)
            : now;

        if (articleDate >= pointDate && articleDate < nextDate) {
          point.count++;
        }
      });
    });

    return data;
  }, [articles, dateRange]);

  const totalArticles = chartData.reduce((sum, point) => sum + point.count, 0);
  const avgPerInterval = totalArticles / chartData.length || 0;

  return (
    <Card className="col-span-2 overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Content Velocity
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Publishing activity over time
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{totalArticles}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500">{avgPerInterval.toFixed(1)}</span>
              <span>avg/{dateRange === "1day" ? "hr" : "day"}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[200px] w-full mt-4">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="animate-pulse bg-muted rounded h-full w-full" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  formatter={(value: number) => [`${value} articles`, "Published"]}
                />
                <Area
                  dataKey="count"
                  type="monotone"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorVelocity)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "hsl(var(--primary))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
