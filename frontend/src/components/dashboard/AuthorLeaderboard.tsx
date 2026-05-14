"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Article } from "@/lib/types";

interface AuthorLeaderboardProps {
  articles: Article[];
  loading?: boolean;
}

interface AuthorStats {
  name: string;
  id: string;
  count: number;
}

const RANK_CONFIG = [
  { icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10" },
  { icon: Medal, color: "text-slate-400", bg: "bg-slate-400/10" },
  { icon: Award, color: "text-orange-600", bg: "bg-orange-600/10" },
];

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
    "bg-cyan-500",
    "bg-teal-500",
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

export function AuthorLeaderboard({ articles, loading }: AuthorLeaderboardProps) {
  const authorStats = useMemo(() => {
    const stats = new Map<string, AuthorStats>();

    articles.forEach((article) => {
      // Prefer authors array if present, otherwise fall back to user field
      if (article.authors && article.authors.length > 0) {
        article.authors.forEach((author) => {
          if (!author?.name) return;
          const key = author.id || author.name;
          const existing = stats.get(key);
          if (existing) {
            existing.count++;
          } else {
            stats.set(key, {
              name: author.name,
              id: author.id,
              count: 1,
            });
          }
        });
      } else if (article.user?.name) {
        // Fallback to user field only if no authors
        const key = article.user.id || article.user.name;
        const existing = stats.get(key);
        if (existing) {
          existing.count++;
        } else {
          stats.set(key, {
            name: article.user.name,
            id: article.user.id,
            count: 1,
          });
        }
      }
    });

    return Array.from(stats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [articles]);

  const maxCount = authorStats[0]?.count || 1;

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">
              Top Contributors
            </CardTitle>
            <p className="text-sm text-muted-foreground">Most active authors</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full animate-pulse bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 animate-pulse bg-muted rounded" />
                  <div className="h-2 w-full animate-pulse bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : authorStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No author data available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {authorStats.map((author, index) => {
              const RankIcon = RANK_CONFIG[index]?.icon;
              const rankConfig = RANK_CONFIG[index];
              const percentage = (author.count / maxCount) * 100;

              return (
                <div
                  key={author.id}
                  className="flex items-center gap-3 group/item hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  {/* Rank Badge */}
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      rankConfig
                        ? cn(rankConfig.bg, rankConfig.color)
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {RankIcon ? (
                      <RankIcon className="w-3.5 h-3.5" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Avatar */}
                  {author.id ? (
                    <Link href={`/users/edit/${author.id}`}>
                      <Avatar className="w-8 h-8 hover:opacity-80 transition-opacity">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-medium text-white",
                            getAvatarColor(author.name)
                          )}
                        >
                          {getInitials(author.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback
                        className={cn(
                          "text-xs font-medium text-white",
                          getAvatarColor(author.name)
                        )}
                      >
                        {getInitials(author.name)}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      {author.id ? (
                        <Link
                          href={`/users/edit/${author.id}`}
                          className="text-sm font-medium truncate hover:text-primary hover:underline transition-colors"
                        >
                          {author.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium truncate">
                          {author.name}
                        </span>
                      )}
                      <span className="text-sm font-bold text-primary">
                        {author.count}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
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
