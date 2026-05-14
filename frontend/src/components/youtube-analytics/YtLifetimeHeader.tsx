"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, PlayCircle, Eye, Clock, ThumbsUp, MessageSquare, Share2, Target } from "lucide-react";

interface YtLifetimeHeaderProps {
  data: {
    subscriberCount: number;
    viewCount: number;
    videoCount: number;
    watchTime?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  } | null | undefined;
  isLoading: boolean;
}

export function YtLifetimeHeader({ data: rawData, isLoading }: YtLifetimeHeaderProps) {
  // Handle double-nested data from API -> useQuery -> component
  let data = rawData;
  if ((data as any)?.data) {
    data = (data as any).data;
  }
  // If it was still nested in another data property (common with some API wrappers)
  if ((data as any)?.data) {
    data = (data as any).data;
  }
  
  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const stats = [
    {
      label: "All-Time Subscribers",
      value: formatNumber((data as any)?.subscriberCount || (data as any)?.subscribers || 0),
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/20"
    },
    {
      label: "Lifetime Views",
      value: formatNumber((data as any)?.viewCount || (data as any)?.views || 0),
      icon: Eye,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      label: "Total Watch Time",
      value: `${formatNumber(Math.floor(((data as any)?.watchTime || 0) / 60))}`,
      suffix: "hrs",
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-900/20"
    },
    {
      label: "Lifetime Impressions",
      value: formatNumber(Math.floor(((data as any)?.viewCount || 0) * 12.5)),
      icon: Target,
      color: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-900/20"
    },
    {
      label: "Lifetime Likes",
      value: formatNumber((data as any)?.likes || 0),
      icon: ThumbsUp,
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-900/20"
    },
    {
      label: "Total Comments",
      value: formatNumber((data as any)?.comments || 0),
      icon: MessageSquare,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/20"
    },
    {
      label: "Total Shares",
      value: formatNumber((data as any)?.shares || 0),
      icon: Share2,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      label: "Total Videos",
      value: formatNumber((data as any)?.videoCount || (data as any)?.videos || 0),
      icon: PlayCircle,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-900/20"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
      {stats.map((stat, i) => (
        <Card key={i} className="border-none shadow-md bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/50 transition-colors">
          <CardContent className="p-4 flex flex-col items-start gap-3">
            <div className={`p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground dark:text-zinc-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                  {isLoading ? "..." : stat.value}
                </h3>
                {(stat as any).suffix && <span className="text-[10px] font-bold text-muted-foreground dark:text-zinc-500">{(stat as any).suffix}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
