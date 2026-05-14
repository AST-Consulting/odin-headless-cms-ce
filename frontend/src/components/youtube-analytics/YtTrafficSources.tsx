"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Share2, Info, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface YtTrafficSourcesProps {
  data: any[] | null | undefined;
  isLoading: boolean;
}

export function YtTrafficSources({ data: rawData, isLoading }: YtTrafficSourcesProps) {
  // Peeling logic for nested API data
  let data = rawData;
  if ((data as any)?.data) {
    data = (data as any).data;
  }

  const formattedData = (data ?? []).map(item => ({
    name: item.source || item.label || "Direct",
    value: Number(item.views || 0),
  })).sort((a, b) => b.value - a.value);

  const totalViews = formattedData.reduce((acc, curr) => acc + Number(curr.value), 0);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  return (
    <Card className="border-none shadow-md bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
           Traffic Sources
           <ArrowUpRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[250px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="space-y-5">
            {formattedData.map((source, i) => {
              const percentage = totalViews > 0 ? (source.value / totalViews) * 100 : 0;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-600 dark:text-zinc-400">{source.name}</span>
                    <span className="font-black text-zinc-900 dark:text-white">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
