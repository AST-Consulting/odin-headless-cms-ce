"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  FileEdit,
  Eye,
  CheckCircle,
  Clock,
  FilePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Article } from "@/lib/types";

interface ActivityFeedProps {
  articles: Article[];
  loading?: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { icon: typeof FileEdit; color: string; badgeColor: string; label: string }
> = {
  draft: { icon: FileEdit, color: "text-white bg-slate-500", badgeColor: "text-slate-500 bg-slate-500/10", label: "Draft" },
  review: { icon: Eye, color: "text-white bg-amber-500", badgeColor: "text-amber-500 bg-amber-500/10", label: "In Review" },
  scheduled: { icon: Clock, color: "text-white bg-blue-500", badgeColor: "text-blue-500 bg-blue-500/10", label: "Scheduled" },
  published: {
    icon: CheckCircle,
    color: "text-white bg-emerald-500",
    badgeColor: "text-emerald-500 bg-emerald-500/10",
    label: "Published",
  },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-red-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityFeed({ articles, loading }: ActivityFeedProps) {
  const recentArticles = articles
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 5);

  return (
    <Card className="col-span-2 overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Recent Activity
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Latest content updates
              </p>
            </div>
          </div>
          {!loading && recentArticles.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {recentArticles.length} updates
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-9 h-9 rounded-full animate-pulse bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse bg-muted rounded" />
                  <div className="h-3 w-1/2 animate-pulse bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : recentArticles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FilePlus className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentArticles.map((article, index) => {
              const updaterName = article.updatedBy?.name || article.createdBy?.name || "Unknown";
              const statusConfig = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={article._id}
                  className={cn(
                    "flex items-start gap-3 p-3 -mx-3 rounded-lg transition-all duration-200",
                    "hover:bg-muted/50 group/item cursor-pointer"
                  )}
                >
                  {/* Avatar with status indicator */}
                  <div className="relative">
                    {article.updatedBy?.id || article.createdBy?.id ? (
                      <Link href={`/users/edit/${article.updatedBy?.id || article.createdBy?.id}`}>
                        <Avatar className="w-9 h-9 hover:opacity-80 transition-opacity">
                          <AvatarFallback
                            className={cn(
                              "text-xs font-medium text-white",
                              getAvatarColor(updaterName)
                            )}
                          >
                            {getInitials(updaterName)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <Avatar className="w-9 h-9">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-medium text-white",
                            getAvatarColor(updaterName)
                          )}
                        >
                          {getInitials(updaterName)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-background",
                        statusConfig.color
                      )}
                    >
                      <StatusIcon className="w-2.5 h-2.5" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm">
                          {article.updatedBy?.id || article.createdBy?.id ? (
                            <Link
                              href={`/users/edit/${article.updatedBy?.id || article.createdBy?.id}`}
                              className="font-medium hover:text-primary hover:underline transition-colors"
                            >
                              {updaterName}
                            </Link>
                          ) : (
                            <span className="font-medium">{updaterName}</span>
                          )}
                          <span className="text-muted-foreground">
                            {" "}
                            updated
                          </span>
                        </p>
                        <Link
                          href={`/editor/${article._id}`}
                          className="text-sm font-medium truncate mt-0.5 block hover:text-primary hover:underline transition-colors"
                        >
                          {article.title}
                        </Link>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(article.updatedAt)}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs h-5 px-2",
                          statusConfig.badgeColor
                        )}
                      >
                        {statusConfig.label}
                      </Badge>
                      {article.primaryCategory && (
                        <Badge variant="outline" className="text-xs h-5 px-2">
                          {typeof article.primaryCategory === "object"
                            ? (article.primaryCategory.name || article.primaryCategory.title || "Unknown")
                            : article.primaryCategory}
                        </Badge>
                      )}
                    </div>
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
