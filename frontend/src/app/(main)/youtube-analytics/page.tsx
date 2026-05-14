"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePropertyStore } from "@/lib/store";
import { 
  fetchYTOverview, 
  fetchYTTrends, 
  fetchYTTopVideos, 
  fetchYTReports,
  fetchYTTrafficSources,
  fetchYTDimension,
  fetchYTLifetimeStats
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Download, Youtube, Calendar } from "lucide-react";
import { YtKpiCards } from "@/components/youtube-analytics/YtKpiCards";
import { YtGrowthChart } from "@/components/youtube-analytics/YtGrowthChart";
import { YtVideoTable } from "@/components/youtube-analytics/YtVideoTable";
import { YtAudienceWidgets } from "@/components/youtube-analytics/YtAudienceWidgets";
import { YtTrafficSources } from "@/components/youtube-analytics/YtTrafficSources";
import { YtDeviceGeography } from "@/components/youtube-analytics/YtDeviceGeography";
import { YtDeviceTraffic } from "@/components/youtube-analytics/YtDeviceTraffic";
import { YtLifetimeHeader } from "@/components/youtube-analytics/YtLifetimeHeader";

export default function YouTubeAnalyticsPage() {
  const { selectedProperty } = usePropertyStore();
  const [range, setRange] = useState<string>("28");

  const getDates = (selectedRange: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (selectedRange === "thisYear") {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    } else if (selectedRange === "lastYear") {
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31);
    } else {
      const numDays = parseInt(selectedRange);
      start.setDate(today.getDate() - numDays);
      end = today;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const dates = getDates(range);
  const propertyId = selectedProperty?._id;

  // Queries
  const { data: lifetimeData, isLoading: isLifetimeLoading, refetch: refetchLifetime } = useQuery({
    queryKey: ["yt-lifetime", propertyId],
    queryFn: async () => {
      const data = await fetchYTLifetimeStats(propertyId!);
      console.log("YouTube Lifetime Data:", data);
      return data;
    },
    enabled: !!propertyId,
  });

  const { data: overviewData, isLoading: isOverviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ["yt-overview", propertyId, range],
    queryFn: async () => {
      const data = await fetchYTOverview(propertyId!, dates.start, dates.end);
      console.log("YouTube Overview Data:", data);
      return data;
    },
    enabled: !!propertyId,
  });

  const { data: trendData, isLoading: isTrendLoading, refetch: refetchTrends } = useQuery({
    queryKey: ["yt-trends", propertyId, range],
    queryFn: () => fetchYTTrends(propertyId!, dates.start, dates.end),
    enabled: !!propertyId,
  });

  const { data: topVideos, isLoading: isVideosLoading, refetch: refetchTopVideos } = useQuery({
    queryKey: ["yt-top-videos", propertyId, range],
    queryFn: () => fetchYTTopVideos(propertyId!, 20, dates.start, dates.end),
    enabled: !!propertyId,
  });

  const { data: trafficData, isLoading: isTrafficLoading, refetch: refetchTraffic } = useQuery({
    queryKey: ["yt-traffic", propertyId, range],
    queryFn: () => fetchYTTrafficSources(propertyId!, dates.start, dates.end),
    enabled: !!propertyId,
  });

  const { data: geoData, isLoading: isGeoLoading, refetch: refetchGeo } = useQuery({
    queryKey: ["yt-geo", propertyId, range],
    queryFn: () => fetchYTDimension(propertyId!, "country", dates.start, dates.end),
    enabled: !!propertyId,
  });

  const { data: deviceData, isLoading: isDeviceLoading, refetch: refetchDevice } = useQuery({
    queryKey: ["yt-device", propertyId, range],
    queryFn: () => fetchYTDimension(propertyId!, "deviceType", dates.start, dates.end),
    enabled: !!propertyId,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchLifetime(),
        refetchOverview(),
        refetchTrends(),
        refetchTopVideos(),
        refetchTraffic(),
        refetchGeo(),
        refetchDevice(),
      ]);
    } finally {
      // Keep animation for a moment for better feedback
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-zinc-50 dark:bg-[#09090b] min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/50">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">Channel Analytics</h1>
          <p className="text-muted-foreground dark:text-zinc-500 text-sm font-medium mt-1">Real-time performance overview for your content ecosystem.</p>
        </div>

        <div className="flex items-center gap-3">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[140px] bg-white dark:bg-zinc-900 border-none shadow-sm h-10 font-bold">
                <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="28">Last 28 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="lastYear">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              className="bg-white dark:bg-zinc-900 border-none shadow-sm h-10 w-10 transition-all hover:scale-110 active:scale-95" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("w-4 h-4 transition-all", isRefreshing && "animate-spin text-blue-600")} />
            </Button>
        </div>
      </div>

      {/* Lifetime Context Row */}
      <YtLifetimeHeader data={lifetimeData} isLoading={isLifetimeLoading} />

       {/* Growth Overview Chart */}
      <YtGrowthChart data={trendData} isLoading={isTrendLoading} />

      {/* KPI Cards Row (Performance) */}
      <YtKpiCards data={overviewData} isLoading={isOverviewLoading} />

      {/* Mid Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
           <YtVideoTable data={topVideos} isLoading={isVideosLoading} />
        </div>
        <div>
           <YtAudienceWidgets data={overviewData} isLoading={isOverviewLoading} />
        </div>
      </div>

      {/* Bottom Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <YtTrafficSources data={trafficData} isLoading={isTrafficLoading} />
         <YtDeviceGeography deviceData={null} geoData={geoData} isLoading={isGeoLoading} />
         <YtDeviceTraffic data={deviceData} isLoading={isDeviceLoading} />
      </div>
    </div>
  );
}
