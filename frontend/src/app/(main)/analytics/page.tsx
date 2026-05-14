"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePropertyStore } from "@/lib/store";
import { fetchGARealtime, fetchGAOverview, fetchAnalyticsReports, fetchGATopArticles, fetchGADimension, fetchGATrafficSources, fetchGATrends } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3, Users, Globe, Smartphone, ArrowUpDown, AlertCircle, Wifi } from "lucide-react";
import { RealtimeWidget } from "@/components/analytics/RealtimeWidget";
import { GaKpiCards } from "@/components/analytics/GaKpiCards";
import { TrendChart, DimensionBarChart, DimensionDonut } from "@/components/analytics/GaCharts";
import { DataTable } from "@/components/tables/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import type { GaDateRange } from "@/lib/ga-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(secs: number) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${s}s`;
}

// ─── Column definitions ────────────────────────────────────────────────────────

const deskColumns: ColumnDef<any>[] = [
  { accessorKey: "desk", header: "Author" },
  { accessorKey: "numberOfStories", header: "Articles" },
  {
    accessorKey: "totalPageviews",
    header: "Pageviews",
    cell: ({ row }) => formatNumber(row.getValue("totalPageviews")),
  },
  {
    accessorKey: "totalUsers",
    header: "Users",
    cell: ({ row }) => formatNumber(row.getValue("totalUsers")),
  },
  {
    accessorKey: "avgTimeOnPage",
    header: "Avg Time",
    cell: ({ row }) => formatDuration(row.getValue("avgTimeOnPage")),
  },
];

const categoryColumns: ColumnDef<any>[] = [
  { accessorKey: "category", header: "Category", cell: ({ row }) => row.getValue("category") || "Uncategorized" },
  { accessorKey: "numberOfStories", header: "Articles" },
  {
    accessorKey: "totalPageviews",
    header: "Pageviews",
    cell: ({ row }) => formatNumber(row.getValue("totalPageviews")),
  },
  {
    accessorKey: "totalUsers",
    header: "Users",
    cell: ({ row }) => formatNumber(row.getValue("totalUsers")),
  },
  {
    accessorKey: "avgTimeOnPage",
    header: "Avg Time",
    cell: ({ row }) => formatDuration(row.getValue("avgTimeOnPage")),
  },
];

const topArticleColumns: ColumnDef<any>[] = [
  { accessorKey: "title", header: "Title", cell: ({ row }) => (
    <span className="text-sm line-clamp-1 max-w-xs" title={row.getValue("title")}>
      {row.getValue("title") || row.original.path}
    </span>
  )},
  { accessorKey: "views", header: "Pageviews", cell: ({ row }) => formatNumber(row.getValue("views")) },
  { accessorKey: "users", header: "Users", cell: ({ row }) => formatNumber(row.getValue("users")) },
  { accessorKey: "avgDuration", header: "Avg Time", cell: ({ row }) => formatDuration(row.getValue("avgDuration")) },
  { accessorKey: "bounceRate", header: "Bounce %", cell: ({ row }) => `${((row.getValue("bounceRate") as number) * 100).toFixed(1)}%` },
];

const trafficColumns: ColumnDef<any>[] = [
  { accessorKey: "channelGroup", header: "Channel" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "medium", header: "Medium" },
  { accessorKey: "sessions", header: "Sessions", cell: ({ row }) => formatNumber(row.getValue("sessions")) },
  { accessorKey: "users", header: "Users", cell: ({ row }) => formatNumber(row.getValue("users")) },
  { accessorKey: "pageviews", header: "Pageviews", cell: ({ row }) => formatNumber(row.getValue("pageviews")) },
  { accessorKey: "bounceRate", header: "Bounce %", cell: ({ row }) => `${((row.getValue("bounceRate") as number) * 100).toFixed(1)}%` },
];

// ─── Date range label helper ───────────────────────────────────────────────────

const DATE_RANGES: { label: string; value: GaDateRange }[] = [
  { label: "Last 7 days", value: "7daysAgo" },
  { label: "Last 30 days", value: "30daysAgo" },
  { label: "Last 90 days", value: "90daysAgo" },
];

// ─── No GA connection banner ───────────────────────────────────────────────────

function NoGaConnection() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-orange-500" />
      </div>
      <div>
        <p className="text-lg font-semibold">Google Analytics Not Connected</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Connect your GA4 property from <strong>Settings → Integrations</strong> to see real-time analytics data here.
        </p>
      </div>
      <Badge variant="outline" className="text-orange-600 border-orange-300">Action Required</Badge>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { selectedProperty } = usePropertyStore();
  const propertyId = selectedProperty?._id ?? null;

  const [dateRange, setDateRange] = useState<GaDateRange>("30daysAgo");
  const startDate = dateRange;
  const endDate = "today";

  // ── Queries ──

  const { data: realtime, isLoading: loadingRealtime } = useQuery({
    queryKey: ["ga-realtime", propertyId],
    queryFn: () => fetchGARealtime(propertyId!),
    enabled: !!propertyId,
    refetchInterval: 60_000,
  });

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["ga-overview", propertyId, startDate],
    queryFn: () => fetchGAOverview(propertyId!, startDate, endDate),
    enabled: !!propertyId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ["ga-reports", propertyId, startDate],
    queryFn: () => fetchAnalyticsReports(propertyId!, startDate, endDate),
    enabled: !!propertyId,
    staleTime: 25 * 60 * 1000,
  });

  const { data: topArticles, isLoading: loadingTopArticles } = useQuery({
    queryKey: ["ga-top-articles", propertyId, startDate],
    queryFn: () => fetchGATopArticles(propertyId!, startDate, endDate, 25),
    enabled: !!propertyId,
    staleTime: 25 * 60 * 1000,
  });

  const { data: deviceData, isLoading: loadingDevice } = useQuery({
    queryKey: ["ga-dim-device", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "deviceCategory", startDate, endDate),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: browserData, isLoading: loadingBrowser } = useQuery({
    queryKey: ["ga-dim-browser", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "browser", startDate, endDate, 10),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: osData, isLoading: loadingOs } = useQuery({
    queryKey: ["ga-dim-os", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "operatingSystem", startDate, endDate, 10),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: ageData, isLoading: loadingAge } = useQuery({
    queryKey: ["ga-dim-age", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "userAgeBracket", startDate, endDate),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: genderData, isLoading: loadingGender } = useQuery({
    queryKey: ["ga-dim-gender", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "userGender", startDate, endDate),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: newVsReturning, isLoading: loadingNvR } = useQuery({
    queryKey: ["ga-dim-nvr", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "newVsReturning", startDate, endDate),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: languageData, isLoading: loadingLang } = useQuery({
    queryKey: ["ga-dim-lang", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "language", startDate, endDate, 15),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: countryData, isLoading: loadingCountry } = useQuery({
    queryKey: ["ga-dim-country", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "country", startDate, endDate, 20),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: cityData, isLoading: loadingCity } = useQuery({
    queryKey: ["ga-dim-city", propertyId, startDate],
    queryFn: () => fetchGADimension(propertyId!, "city", startDate, endDate, 20),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  const { data: trafficSources, isLoading: loadingTraffic } = useQuery({
    queryKey: ["ga-traffic", propertyId, startDate],
    queryFn: () => fetchGATrafficSources(propertyId!, startDate, endDate),
    enabled: !!propertyId,
    staleTime: 25 * 60 * 1000,
  });

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ["ga-trends", propertyId, startDate],
    queryFn: () => fetchGATrends(propertyId!, startDate, endDate),
    enabled: !!propertyId,
    staleTime: 60 * 60 * 1000,
  });

  if (!propertyId) return <NoGaConnection />;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Google Analytics data for <span className="font-medium">{selectedProperty?.domain}</span>
          </p>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as GaDateRange)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Realtime strip + KPIs ── */}
      <div className="flex flex-col-reverse lg:flex-row gap-4 mb-6 items-stretch">
        <div className="w-full lg:w-3/4">
          <TrendChart data={trends} isLoading={loadingTrends} />
        </div>
        <div className="w-full lg:w-1/4">
          <RealtimeWidget data={realtime} isLoading={loadingRealtime} />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <GaKpiCards data={overview} isLoading={loadingOverview} />

      {/* ── Tabs ── */}
      <Tabs defaultValue="content">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="content" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Content
          </TabsTrigger>
          <TabsTrigger value="audience" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Audience
          </TabsTrigger>
          <TabsTrigger value="geography" className="gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Geography
          </TabsTrigger>
          <TabsTrigger value="technology" className="gap-1.5">
            <Smartphone className="w-3.5 h-3.5" /> Technology
          </TabsTrigger>
          <TabsTrigger value="traffic" className="gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5" /> Traffic Sources
          </TabsTrigger>
        </TabsList>
        <Link href="/analytics/realtime" className="shrink-0">
          <Button variant="outline" className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
            <Wifi className="w-4 h-4 animate-pulse" />
            Realtime Pages View
          </Button>
        </Link>
      </div>

        {/* ── Content Performance ── */}
        <TabsContent value="content" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Author-wise Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReports ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : (
                  <DataTable columns={deskColumns} data={reports?.deskReport ?? []} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category-wise Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReports ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : (
                  <DataTable columns={categoryColumns} data={reports?.categoryReport ?? []} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Articles</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTopArticles ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : (
                <DataTable columns={topArticleColumns} data={topArticles ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Audience ── */}
        <TabsContent value="audience" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DimensionDonut data={newVsReturning} isLoading={loadingNvR} title="New vs Returning" />
            <DimensionDonut data={genderData} isLoading={loadingGender} title="Gender" />
            <DimensionBarChart data={ageData} isLoading={loadingAge} title="Age Groups" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DimensionBarChart data={languageData} isLoading={loadingLang} title="Top Languages" />
            <Card>
              <CardHeader><CardTitle className="text-base">Language Table</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { accessorKey: "label", header: "Language" },
                    { accessorKey: "users", header: "Users", cell: ({ row }) => formatNumber(row.getValue("users")) },
                    { accessorKey: "pageviews", header: "Pageviews", cell: ({ row }) => formatNumber(row.getValue("pageviews")) },
                  ]}
                  data={languageData ?? []}
                />
              </CardContent>
            </Card>
          </div>
          {(!ageData?.length && !genderData?.length) && (
            <p className="text-sm text-center text-muted-foreground py-4">
              Age and gender data require Google Signals to be enabled in your GA4 property settings.
            </p>
          )}
        </TabsContent>

        {/* ── Geography ── */}
        <TabsContent value="geography" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DimensionBarChart data={countryData} isLoading={loadingCountry} title="Top Countries" />
            <DimensionBarChart data={cityData} isLoading={loadingCity} title="Top Cities" />
          </div>
        </TabsContent>

        {/* ── Technology ── */}
        <TabsContent value="technology" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DimensionDonut data={deviceData} isLoading={loadingDevice} title="Device Category" />
            <DimensionBarChart data={browserData} isLoading={loadingBrowser} title="Browsers" />
            <DimensionBarChart data={osData} isLoading={loadingOs} title="Operating Systems" />
          </div>
        </TabsContent>

        {/* ── Traffic Sources ── */}
        <TabsContent value="traffic" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DimensionDonut
              data={(trafficSources ?? []).map((t: any) => ({ label: t.channelGroup, pageviews: t.sessions }))}
              isLoading={loadingTraffic}
              title="Traffic by Channel"
            />
            <Card>
              <CardHeader><CardTitle className="text-base">Source / Medium Breakdown</CardTitle></CardHeader>
              <CardContent>
                <DataTable columns={trafficColumns} data={trafficSources ?? []} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
