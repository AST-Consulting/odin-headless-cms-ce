"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderTree, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Article } from "@/lib/types";

interface CategoryDistributionProps {
  articles: Article[];
  loading?: boolean;
}

interface CategoryStats {
  name: string;
  id: string;
  count: number;
}

const CATEGORY_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
];

export function CategoryDistribution({
  articles,
  loading,
}: CategoryDistributionProps) {
  const { categoryStats, totalArticles, displayedTotal } = useMemo(() => {
    const stats = new Map<string, CategoryStats>();

    articles.forEach((article) => {
      // Handle primaryCategory
      if (article.primaryCategory) {
        const category = article.primaryCategory;
        const isObject = typeof category === "object";
        const key = isObject ? category.id : category;
        const name = isObject ? (category.name || category.title || "Unknown") : category;

        const existing = stats.get(key);
        if (existing) {
          existing.count++;
        } else {
          stats.set(key, { name, id: key, count: 1 });
        }
      }
    });

    const allCategories = Array.from(stats.values()).sort((a, b) => b.count - a.count);
    const total = allCategories.reduce((sum, cat) => sum + cat.count, 0);
    const top6 = allCategories.slice(0, 6);
    const top6Total = top6.reduce((sum, cat) => sum + cat.count, 0);

    return {
      categoryStats: top6,
      totalArticles: total,
      displayedTotal: top6Total,
    };
  }, [articles]);

  const maxCount = categoryStats[0]?.count || 1;

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">
              Category Distribution
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Content by category
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-20 animate-pulse bg-muted rounded" />
                <div className="h-4 w-full animate-pulse bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : categoryStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No category data available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {categoryStats.map((category, index) => {
              const percentage = (category.count / maxCount) * 100;
              const sharePercentage = totalArticles > 0 ? (category.count / totalArticles) * 100 : 0;
              const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

              return (
                <div
                  key={category.id}
                  className="group/item hover:bg-muted/30 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", color)} />
                      <span className="text-sm font-medium truncate max-w-[140px]">
                        {category.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {sharePercentage.toFixed(0)}%
                      </span>
                      <span className="font-semibold min-w-[24px] text-right">
                        {category.count}
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        color
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Show "Others" if there are more categories */}
            {totalArticles > displayedTotal && (
              <div className="pt-2 border-t border-border/50 text-sm text-muted-foreground">
                + {totalArticles - displayedTotal} in other categories
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
