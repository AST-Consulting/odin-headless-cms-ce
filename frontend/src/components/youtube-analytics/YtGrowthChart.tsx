"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart
} from "recharts";
import { Loader2, Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface YtGrowthChartProps {
  data: any[] | null | undefined;
  isLoading: boolean;
}

const METRICS = [
  { id: "views", label: "Views", color: "#2563eb", yAxis: "left" },
  { id: "watchTime", label: "Watch Time", color: "#10b981", yAxis: "right" },
  { id: "subscribers", label: "Subscribers", color: "#8b5cf6", yAxis: "left" },
  { id: "ctr", label: "CTR", color: "#f59e0b", yAxis: "right" },
];

export function YtGrowthChart({ data: rawData, isLoading }: YtGrowthChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<string[]>(["views", "watchTime", "subscribers", "ctr"]);

  // Peeling logic for nested API data
  let data = rawData;
  if ((data as any)?.data) {
    data = (data as any).data;
  }

  const toggleMetric = (id: string) => {
    setActiveMetrics(prev => 
      prev.includes(id) 
        ? prev.filter(m => m !== id) 
        : [...prev, id]
    );
  };

  const formattedData = (data ?? []).map(item => {
    // YouTube returns date in YYYY-MM-DD format
    let month = "";
    let day = "";
    
    if (item.date && item.date.includes('-')) {
      const parts = item.date.split('-');
      month = parts[1];
      day = parts[2];
    } else if (item.date && item.date.length >= 8) {
      // Fallback for YYYYMMDD
      month = item.date.slice(4, 6);
      day = item.date.slice(6, 8);
    }
    
    return {
      ...item,
      formattedDate: month && day ? `${month}/${day}` : item.date,
      views: item.views || 0,
      watchTime: (item.watchTime || 0) / 60, // Convert to hours
      subscribers: (item.subscribersGained || 0) - (item.subscribersLost || 0),
      ctr: parseFloat(item.ctr) || 0,
    };
  });

  const formatYAxis = (value: number): string => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toString();
  };

  return (
    <Card className="border-none shadow-md bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/50 mb-8 transition-colors">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 space-y-4 sm:space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
            Growth Overview
          </CardTitle>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground dark:text-zinc-500 italic">
             <Info className="w-3 h-3" />
             Data delayed by 24–48 hours
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 p-1 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          {METRICS.map(m => (
            <button 
              key={m.id}
              onClick={() => toggleMetric(m.id)}
              className={cn(
                "flex items-center gap-2 text-xs transition-all px-3 py-1.5 rounded-md font-medium",
                activeMetrics.includes(m.id) 
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white" 
                  : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              )}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.label}
            </button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={formattedData}>
                <defs>
                  {METRICS.map(m => (
                    <linearGradient key={`grad-${m.id}`} id={`color${m.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={m.color} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="formattedDate" 
                  tick={{ fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={formatYAxis}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(v) => v >= 1 ? formatYAxis(v) : v.toFixed(2)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.96)",
                    backdropFilter: "blur(8px)",
                    border: "none",
                    borderRadius: "16px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                    fontSize: 12,
                  }}
                  itemStyle={{ fontWeight: 600, padding: '2px 0' }}
                />
                
                {activeMetrics.map(m => (
                  <Area
                    key={m}
                    yAxisId={METRICS.find(met => met.id === m)?.yAxis}
                    name={METRICS.find(met => met.id === m)?.label}
                    type="monotone"
                    dataKey={m}
                    stroke={METRICS.find(met => met.id === m)?.color}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill={`url(#color${m})`}
                    animationDuration={1500}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
