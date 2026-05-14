import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
}

export function KpiCard({ title, value, delta, trend = "neutral", description }: KpiCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-600";

  return (
    <Card className="p-6">
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="text-3xl font-bold">{value}</div>
        {delta && (
          <div className={cn("flex items-center gap-1 text-sm font-medium", trendColor)}>
            <TrendIcon className="w-4 h-4" />
            <span>{delta}</span>
          </div>
        )}
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
    </Card>
  );
}

