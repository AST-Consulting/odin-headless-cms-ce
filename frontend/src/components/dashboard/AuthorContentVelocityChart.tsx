"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, ArrowUpRight } from "lucide-react";

export function AuthorContentVelocityChart({ chartData = [], days = 30 }: { chartData: any[], days: number }) {
  const finalChartData = useMemo(() => {
    // Generate empty dates map for the last `days`
    const dataMap = new Map();
    const now = new Date();
    
    // Initialize map with 0s to maintain continuous chronological X-Axis
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      dataMap.set(dateKey, {
        date: date.toISOString(),
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        views: 0,
        published: 0,
      });
    }

    // Populate data from actual backend chartData
    chartData.forEach(dayStat => {
      // dayStat.date comes in as 'YYYY-MM-DD' from the backend facet
      const dateKey = dayStat.date;
      if (dataMap.has(dateKey)) {
        const item = dataMap.get(dateKey);
        item.views += dayStat.views || 0;
        item.published += dayStat.published || 0;
      }
    });

    return Array.from(dataMap.values());
  }, [chartData, days]);

  const totalViews = finalChartData.reduce((sum, point) => sum + point.views, 0);
  const totalPublished = finalChartData.reduce((sum, point) => sum + point.published, 0);

  // Custom Tooltip properly formatting both PV and Published counts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            padding: "8px 12px"
        }}>
          <p style={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: "4px" }}>{label}</p>
          <p className="text-sm font-medium text-primary">
            {`${payload[0]?.value?.toLocaleString() || 0} PVs`}
          </p>
          <p className="text-sm font-medium text-emerald-500">
            {`${payload[1]?.value || 0} Articles Published`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-1 lg:col-span-2 overflow-hidden group">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <LineChart className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Content Velocity
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Author Page Views & Publications ({days} days)
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold flex items-center justify-end gap-2">
               {totalViews.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">PVs</span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500">{totalPublished}</span>
              <span>published • {(totalViews / days).toFixed(0)} avg/day</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[250px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={finalChartData}>
              <defs>
                <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="plainline"
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              />
              <Line
                name="Page Views"
                yAxisId="left"
                dataKey="views"
                type="monotone"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "hsl(var(--primary))",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
              <Line 
                name="Articles Published"
                yAxisId="right"
                dataKey="published" 
                type="monotone"
                stroke="hsl(var(--emerald-500))" 
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "hsl(var(--emerald-500))",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
