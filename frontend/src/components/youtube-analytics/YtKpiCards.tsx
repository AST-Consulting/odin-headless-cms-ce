"use client";

import { Card, CardContent } from "@/components/ui/card";
import { 
  Eye, 
  Clock, 
  Users, 
  ThumbsUp, 
  MessageSquare, 
  Target,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface YtKpiCardsProps {
  data: any | null | undefined;
  isLoading: boolean;
}

export function YtKpiCards({ data: rawData, isLoading }: YtKpiCardsProps) {
  // Handle nested data from API
  let data = rawData;
  if ((data as any)?.data) {
    data = (data as any).data;
  }

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const calculateTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const cards = [
    {
      title: "VIEWS",
      value: formatNumber(data?.views?.current || 0),
      trend: calculateTrend(data?.views?.current || 0, data?.views?.previous || 0),
      icon: Eye,
      color: "text-blue-600",
      bg: "bg-blue-50",
      label: "Total for period"
    },
    {
      title: "WATCH TIME",
      value: `${((data?.watchTime?.current || 0) / 60).toFixed(1)}K`,
      trend: calculateTrend(data?.watchTime?.current || 0, data?.watchTime?.previous || 0),
      icon: Clock,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      label: "Total for period",
      suffix: "hrs"
    },
    {
      title: "SUBSCRIBERS",
      value: formatNumber(data?.netSubscribers?.current || 0),
      trend: calculateTrend(data?.netSubscribers?.current || 0, data?.netSubscribers?.previous || 0),
      icon: Users,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      label: "New subscribers"
    },
    {
      title: "LIKES",
      value: formatNumber(data?.likes?.current || 0),
      trend: calculateTrend(data?.likes?.current || 0, data?.likes?.previous || 0),
      icon: ThumbsUp,
      color: "text-orange-600",
      bg: "bg-orange-50",
      label: "Total engagements"
    },
    {
      title: "AVG DURATION",
      value: data?.avgViewDuration?.current || "0:00",
      trend: calculateTrend(data?.avgViewDuration?.current || 0, data?.avgViewDuration?.previous || 0),
      icon: MessageSquare,
      color: "text-pink-600",
      bg: "bg-pink-50",
      label: "Across all content"
    },
    {
      title: "CTR",
      value: `${(data?.ctr?.current || 0).toFixed(1)}%`,
      trend: calculateTrend(data?.ctr?.current || 0, data?.ctr?.previous || 0),
      icon: Target,
      color: "text-teal-600",
      bg: "bg-teal-50",
      label: "Impression CTR"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {cards.map((card, i) => (
        <Card key={i} className="border-none shadow-md bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-muted-foreground dark:text-zinc-500 uppercase tracking-wider">{card.title}</span>
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                card.trend >= 0 
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" 
                  : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
              )}>
                {card.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(card.trend).toFixed(0)}%
              </div>
            </div>
            
            <div className="space-y-1">
               <div className="flex items-baseline gap-1">
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                    {isLoading ? "..." : card.value}
                  </h3>
                  {card.suffix && <span className="text-xs font-bold text-muted-foreground">{card.suffix}</span>}
               </div>
               <p className="text-[10px] text-muted-foreground">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
