"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getArticles, getCategories, getDashboardStats } from "@/lib/api";
import type { Article } from "@/lib/types";
import { useAuthStore } from "@/lib/auth";
import { useEditorStore, usePropertyStore } from "@/lib/store";
import { Sparkles, TrendingUp, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DashboardMetricsCards,
  AuthorContentVelocityChart,
  WritingShortcuts,
  RankingOpportunities,
  TopArticlesList,
} from "@/components/dashboard";
import { TrendingSection } from "./ideas/components/TrendingSection";
import { AiIdeasSection } from "./ideas/components/AiIdeasSection";
import { ExploreTrendsSection } from "./ideas/components/ExploreTrendsSection";

type DateRange = "1day" | "7days" | "30days";

interface StatusCounts {
  draft: number;
  review: number;
  scheduled: number;
  published: number;
}

const getDateRange = (range: DateRange): { gte: string; lte: string; daysNum: number } => {
  const now = new Date();
  const lte = now.toISOString().split("T")[0];

  let gte: Date;
  switch (range) {
    case "1day":
      gte = new Date(now);
      gte.setDate(gte.getDate() - 1);
      break;
    case "7days":
      gte = new Date(now);
      gte.setDate(gte.getDate() - 7);
      break;
    case "30days":
      gte = new Date(now);
      gte.setDate(gte.getDate() - 30);
      break;
  }

  return {
    gte: gte.toISOString().split("T")[0],
    lte,
    daysNum: range === "1day" ? 1 : range === "7days" ? 7 : 30,
  };
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>("7days");
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [topArticles, setTopArticles] = useState<Article[]>([]);
  const [opportunities, setOpportunities] = useState<Article[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    draft: 0,
    review: 0,
    scheduled: 0,
    published: 0,
  });

  const handleCreateDraft = useCallback(
    (topicTitle: string) => {
      useEditorStore.setState({
        blocks: [
          {
            id: crypto.randomUUID(),
            type: "heading",
            content: [{ type: "text", text: topicTitle, styles: {} }],
            metadata: { props: { level: 1 }, children: [] },
            order: 0,
          },
          {
            id: crypto.randomUUID(),
            type: "paragraph",
            content: [{ type: "text", text: "", styles: {} }],
            metadata: { props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, children: [] },
            order: 1,
          },
        ],
        selectedBlockId: null, seoData: null, tags: [], categories: [],
        primaryCategory: null, primaryCategorySlug: null, authors: [],
        articleTitle: topicTitle, currentArticleId: null, slug: "",
        status: "draft", images: [], articleType: "article",
      });
      router.push("/editor");
    },
    [router]
  );

  // Fetch all data
  useEffect(() => {
    const loadData = async () => {
      if (!selectedProperty?._id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { gte, lte, daysNum } = getDateRange(dateRange);
        const commonParams = {
          startDate: gte,
          endDate: lte,
          propertyId: selectedProperty._id,
          author: user?.id,
        };

        const isSuperAdminOrAdmin = user?.roles?.some(
          (role: any) => role.name === "SUPERADMIN" || role.name === "ADMINISTRATOR"
        );

        const statsParams = {
          propertyId: selectedProperty._id,
          days: daysNum,
          userId: isSuperAdminOrAdmin ? undefined : user?.id,
        };

        const [
          dashboardStats,
          draftResult,
          reviewResult,
          scheduledResult,
        ] = await Promise.all([
          getDashboardStats(statsParams),
          getArticles({ page: 1, limit: 1, status: "draft", ...commonParams, fields: "_id" }),
          getArticles({ page: 1, limit: 1, status: "review", ...commonParams, fields: "_id" }),
          getArticles({ page: 1, limit: 1, status: "scheduled", ...commonParams, fields: "_id" }),
        ]);

        const statsResult = dashboardStats.data || dashboardStats;

        setDashboardMetrics({
          totalArticles: statsResult.totals?.totalArticles || 0,
          totalViews: statsResult.totals?.totalViews || 0,
          totalVisiter: statsResult.totals?.totalVisitors || 0,
          totalClicks: statsResult.totals?.totalClicks || 0,
          totalImpressions: statsResult.totals?.totalImpressions || 0,
          avgCtr: statsResult.totals?.avgCtr || "0.00%",
        });

        setChartData(statsResult.chartData || []);

        const top5Articles = statsResult.topArticles || [];
        setTopArticles(top5Articles);

        let computedOpportunities = [...top5Articles]
          .filter((a: any) => {
            const pos = a.metricsLatest?.position || a.metrics?.gsc?.position || 0;
            return pos > 4;
          })
          .sort((a: any, b: any) => {
            const aCtr = a.metricsLatest?.ctr || a.metrics?.gsc?.ctr || 0;
            const bCtr = b.metricsLatest?.ctr || b.metrics?.gsc?.ctr || 0;
            return bCtr - aCtr;
          });

        if (computedOpportunities.length === 0) {
          computedOpportunities = [...top5Articles].sort((a: any, b: any) => {
            const aCtr = a.metricsLatest?.ctr || a.metrics?.gsc?.ctr || 0;
            const bCtr = b.metricsLatest?.ctr || b.metrics?.gsc?.ctr || 0;
            return bCtr - aCtr;
          });
        }

        computedOpportunities = computedOpportunities.slice(0, 3);
        setOpportunities(computedOpportunities);

        setStatusCounts({
          draft: draftResult.total,
          review: reviewResult.total,
          scheduled: scheduledResult.total,
          published: statsResult.totals?.totalArticles || 0,
        });

      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dateRange, selectedProperty]);

  const firstName = user?.name?.split(" ")[0] || "Sofia";

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Dashboard Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Welcome back, {firstName}.</h1>
        <p className="text-muted-foreground">
          You have <span className="font-semibold text-foreground">{statusCounts.draft} drafts in progress</span> and {statusCounts.review} article pending review.
        </p>
      </div>

      {/* Ideas & Trends */}
      <div className="min-w-0 overflow-hidden">
        <h2 className="text-2xl font-bold tracking-tight mb-1">Ideas & Trends</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Discover trending topics and generate story ideas to fuel your newsroom
        </p>
        <Tabs defaultValue="trending" className="space-y-6 min-w-0">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="trending" className="gap-1.5 data-[state=active]:shadow-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Trending Now</span>
            </TabsTrigger>
            <TabsTrigger value="ai-ideas" className="gap-1.5 data-[state=active]:shadow-sm">
              <Sparkles className="w-4 h-4" />
              <span>AI Ideas</span>
            </TabsTrigger>
            <TabsTrigger value="explore" className="gap-1.5 data-[state=active]:shadow-sm">
              <BarChart3 className="w-4 h-4" />
              <span>Explore Trends</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="trending" className="mt-6 min-w-0">
            <TrendingSection onCreateDraft={handleCreateDraft} />
          </TabsContent>
          <TabsContent value="ai-ideas" className="mt-6 min-w-0">
            <AiIdeasSection onCreateDraft={handleCreateDraft} />
          </TabsContent>
          <TabsContent value="explore" className="mt-6 min-w-0">
            <ExploreTrendsSection onCreateDraft={handleCreateDraft} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center justify-end">
        <Tabs
          value={dateRange}
          onValueChange={(value) => setDateRange(value as DateRange)}
        >
          <TabsList className="bg-muted/50">
            <TabsTrigger value="1day" className="text-xs sm:text-sm">24h</TabsTrigger>
            <TabsTrigger value="7days" className="text-xs sm:text-sm">7 days</TabsTrigger>
            <TabsTrigger value="30days" className="text-xs sm:text-sm">30 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards */}
      <DashboardMetricsCards
        summary={{
          totalArticles: dashboardMetrics?.totalArticles || 0,
          totalClicks: dashboardMetrics?.totalClicks || 0,
          totalImpressions: dashboardMetrics?.totalImpressions || 0,
          totalVisiter: dashboardMetrics?.totalVisiter || 0,
          totalViews: dashboardMetrics?.totalViews || 0,
          avgCtr: dashboardMetrics?.avgCtr || "0.00"
        }}
      />

      {/* Performance Chart */}
      <AuthorContentVelocityChart chartData={chartData} days={dateRange === "30days" ? 30 : dateRange === "7days" ? 7 : 1} />

      {/* Top Performing Articles */}
      <TopArticlesList articles={topArticles} />
    </div>
  );
}
