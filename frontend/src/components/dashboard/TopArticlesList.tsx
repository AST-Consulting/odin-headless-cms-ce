"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startArticleFactValidation, getFactValidationStatus } from "@/lib/api";
import { useDashboardFactCheckStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  ShieldAlert,
} from "lucide-react";

function decodeTitle(title: string) {
  if (!title) return "";
  return title
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function getTimeSince(dateStr: string) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

function getCategory(article: any) {
  if (article.primaryCategory && typeof article.primaryCategory === "object") {
    return article.primaryCategory.name || article.primaryCategory.title || "";
  }
  if (
    article.categories &&
    article.categories.length > 0 &&
    typeof article.categories[0] === "object"
  ) {
    return article.categories[0].name || article.categories[0].title || "";
  }
  if (typeof article.primaryCategory === "string") {
    return article.primaryCategory;
  }
  return "";
}

function getSeriousFindings(result: any) {
  return (result?.findings || []).filter(
    (finding: any) =>
      ["contradicted", "outdated", "unsupported"].includes(finding?.verdict) &&
      finding?.severity !== "low" &&
      finding?.confidence >= 0.78 &&
      finding?.reason &&
      finding?.suggestedReplacement
  );
}

function getStatusMeta(entry: any, alertCount: number) {
  if (entry?.status === "processing") {
    return {
      badgeLabel: "Checking",
      className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
      showBadge: true,
    };
  }

  if (entry?.status === "failed") {
    return {
      badgeLabel: "Failed",
      className: "border-red-500/25 bg-red-500/10 text-red-300",
      showBadge: true,
    };
  }

  if (entry?.status === "completed" && alertCount > 0) {
    return {
      badgeLabel: `${alertCount} Alert${alertCount > 1 ? "s" : ""}`,
      className: "border-orange-500/25 bg-orange-500/10 text-orange-300",
      showBadge: true,
    };
  }

  if (entry?.status === "completed") {
    return {
      badgeLabel: "Clear",
      className: "border-green-500/25 bg-green-500/10 text-green-300",
      showBadge: true,
    };
  }

  return {
    badgeLabel: "Checking",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    showBadge: true,
  };
}

export function TopArticlesList({ articles = [] }: { articles: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "alerts">("all");
  const factEntries = useDashboardFactCheckStore((state) => state.entries);
  const queueCheck = useDashboardFactCheckStore((state) => state.queueCheck);
  const startCheck = useDashboardFactCheckStore((state) => state.startCheck);
  const completeCheck = useDashboardFactCheckStore((state) => state.completeCheck);
  const failCheck = useDashboardFactCheckStore((state) => state.failCheck);

  const rankedArticles = useMemo(
    () =>
      articles.length > 0
        ? [...articles]
          .sort((a, b) => {
            const aPerformance =
              (a.metricsLatest?.clicks || a.metrics?.gsc?.clicks || 0) +
              (a.metricsLatest?.pv || a.metrics?.ga4?.views || 0);
            const bPerformance =
              (b.metricsLatest?.clicks || b.metrics?.gsc?.clicks || 0) +
              (b.metricsLatest?.pv || b.metrics?.ga4?.views || 0);
            return bPerformance - aPerformance;
          })
          .slice(0, 5)
        : [],
    [articles]
  );

  const factAlertCount = rankedArticles.filter((article) => {
    const entry = factEntries[article._id];
    return getSeriousFindings(entry?.result).length > 0;
  }).length;

  const displayArticles =
    activeTab === "alerts"
      ? rankedArticles.filter((article) => {
        const entry = factEntries[article._id];
        return getSeriousFindings(entry?.result).length > 0;
      })
      : rankedArticles;

  const handleFactCheck = (articleId: string) => {
    if (factEntries[articleId]) return;
    queueCheck(articleId);

    startArticleFactValidation(articleId, "strict")
      .then((response) => {
        startCheck(articleId, response.jobId);
      })
      .catch((error: any) => {
        failCheck(articleId, error?.message || "Fact check failed");
      });
  };

  useEffect(() => {
    const processingEntries = Object.entries(factEntries).filter(
      ([, entry]) => entry.status === "processing" && entry.jobId
    );

    if (processingEntries.length === 0) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      await Promise.all(
        processingEntries.map(async ([articleId, entry]) => {
          if (!entry.jobId) {
            return;
          }

          try {
            const job = await getFactValidationStatus(entry.jobId);
            if (cancelled) {
              return;
            }

            if (job.status === "completed") {
              completeCheck(articleId, job.result);
            } else if (job.status === "failed") {
              failCheck(articleId, job.error || "Fact check failed");
            }
          } catch (error: any) {
            if (cancelled) {
              return;
            }
            failCheck(articleId, error?.message || "Fact check failed");
          }
        })
      );
    };

    poll();
    const interval = setInterval(poll, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [completeCheck, failCheck, factEntries]);

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "all" | "alerts")}
        className="w-full"
      >
        <TabsList className="bg-muted/50 h-auto p-1">
          <TabsTrigger value="all" className="text-sm px-4 py-1.5">
            All Articles ({rankedArticles.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-sm px-4 py-1.5">
            Fact Alerts ({factAlertCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-12 gap-2 px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <div className="col-span-4">Article</div>
        <div className="col-span-1 text-right">Impressions</div>
        <div className="col-span-1 text-right">Clicks</div>
        <div className="col-span-2 text-center">CTR</div>
        <div className="col-span-1 text-right">PV</div>
        <div className="col-span-1 text-right">UV</div>
        <div className="col-span-2 text-right">Action</div>
      </div>

      <div className="space-y-3">
        {displayArticles.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {activeTab === "alerts"
                ? "No fact alerts yet."
                : "No articles to display yet."}
            </CardContent>
          </Card>
        )}

        {displayArticles.map((article, i) => {
          const articleId = article._id || String(i);
          const entry = factEntries[articleId];
          const findings = getSeriousFindings(entry?.result);
          const impressions =
            article.metricsLatest?.impressions || article.metrics?.gsc?.impressions || 0;
          const clicks = article.metricsLatest?.clicks || article.metrics?.gsc?.clicks || 0;
          const ctr = article.metricsLatest?.ctr
            ? Number(article.metricsLatest.ctr).toFixed(2)
            : article.metrics?.gsc?.ctr
              ? Number(article.metrics.gsc.ctr).toFixed(2)
              : "0.00";
          const pv = article.metricsLatest?.pv || article.metrics?.ga4?.views || 0;
          const uv =
            article.metricsLatest?.uv ||
            article.metrics?.ga4?.activeUsers ||
            article.metrics?.ga4?.visitors ||
            0;
          const category = getCategory(article);
          const publishedAgo = getTimeSince(article.createdAt);
          const ctrBarWidth = Math.min(parseFloat(ctr) * 20, 100);
          const isExpanded = expandedId === articleId;
          const isHindiResult = entry?.result?.language === "hi";
          const statusMeta = getStatusMeta(entry, findings.length);

          return (
            <Card
              key={articleId}
              className="overflow-hidden border-border/70 bg-card/70"
            >
              <CardContent className="p-0">
                <div
                  className="grid grid-cols-12 gap-2 items-center px-4 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : articleId)}
                >
                  <div className="col-span-4 min-w-0">
                    <p
                      className={`font-medium text-sm leading-tight ${isExpanded ? "line-clamp-none" : "line-clamp-1"
                        }`}
                    >
                      {decodeTitle(article.title)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {category ? `${category} · ` : ""}
                      Published {publishedAgo}
                    </p>
                  </div>

                  <div className="col-span-1 text-right text-sm font-medium tabular-nums">
                    {formatNumber(impressions)}
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium tabular-nums">
                    {formatNumber(clicks)}
                  </div>

                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${ctrBarWidth}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {ctr}%
                    </span>
                  </div>

                  <div className="col-span-1 text-right text-sm font-medium tabular-nums">
                    {formatNumber(pv)}
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium tabular-nums">
                    {formatNumber(uv)}
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {!entry ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFactCheck(articleId);
                        }}
                      >
                        Fact Check
                      </Button>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`text-[11px] px-2.5 py-1 ${statusMeta.className}`}
                      >
                        {entry?.status === "processing" && (
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        )}
                        {statusMeta.badgeLabel}
                      </Badge>
                    )}

                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""
                        }`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/70 px-4 py-4 bg-muted/10">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <Card className="border-border/70 bg-card/60">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              GSC + Analytics
                            </p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                              { label: "Impressions", value: formatNumber(impressions) },
                              { label: "Clicks", value: formatNumber(clicks) },
                              { label: "CTR", value: `${ctr}%` },
                              { label: "Page Views", value: formatNumber(pv) },
                              { label: "Users", value: formatNumber(uv) },
                            ].map((item) => (
                              <div key={item.label} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {item.label}
                                </p>
                                <p className="mt-2 text-xl font-semibold tabular-nums">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-border/70 bg-card/60">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Fact Check
                              </p>
                            </div>
                            {entry?.lastCheckedAt && (
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(entry.lastCheckedAt).toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>

                          {entry?.status === "processing" && (
                            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 flex items-center gap-3 text-amber-200">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Fact check is running...</span>
                            </div>
                          )}

                          {entry?.status === "failed" && (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 flex items-start gap-3 text-red-200">
                              <AlertCircle className="w-4 h-4 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium">Fact check failed</p>
                                <p className="text-xs text-red-200/80 mt-1">
                                  {entry.error || "Automatic fact check could not complete."}
                                </p>
                              </div>
                            </div>
                          )}

                          {entry?.status === "completed" && findings.length === 0 && (
                            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 flex items-start gap-3 text-green-200">
                              <CheckCircle2 className="w-4 h-4 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium">
                                  {isHindiResult
                                    ? "कोई गंभीर तथ्यात्मक त्रुटि नहीं मिली"
                                    : "No serious factual issue found"}
                                </p>
                                <p className="text-xs text-green-200/80 mt-1">
                                  {isHindiResult
                                    ? "केवल स्पष्ट तथ्यात्मक त्रुटियां ही दिखाई जाती हैं।"
                                    : "Only clear factual errors are shown here."}
                                </p>
                              </div>
                            </div>
                          )}

                          {findings.length > 0 && (
                            <div className="space-y-3">
                              {findings.map((finding: any) => (
                                <div
                                  key={finding.id}
                                  className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-4"
                                >
                                  <div className="flex items-center gap-2 mb-3">
                                    <ShieldAlert className="w-4 h-4 text-orange-300" />
                                    <Badge
                                      variant="outline"
                                      className="border-orange-500/30 bg-orange-500/10 text-orange-200"
                                    >
                                      {finding.verdict.replace("_", " ")}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-medium leading-snug text-foreground">
                                    "{finding.quote}"
                                  </p>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {finding.reason}
                                  </p>
                                  <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-3">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                      Correction
                                    </p>
                                    <p className="mt-1 text-sm">{finding.suggestedReplacement}</p>
                                  </div>
                                  {/* {finding.sources?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {finding.sources.map((source: any, index: number) => (
                                        <a
                                          key={`${finding.id}-${index}`}
                                          href={source.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-border"
                                          onClick={(event) => event.stopPropagation()}
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          <span>{source.title}</span>
                                        </a>
                                      ))}
                                    </div>
                                  )} */}
                                </div>
                              ))}
                            </div>
                          )}

                          {!entry && (
                            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                              Fact check will appear here once processing completes.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
