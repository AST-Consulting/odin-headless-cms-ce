import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function RankingOpportunities({ opportunities = [] }: { opportunities: any[] }) {
  // Simple HTML entity decoder that safely works in Next.js SSR
  const decodeTitle = (title: string) => {
    if (!title) return "";
    return title
      .replace(/&#8216;/g, "'")
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
  };

  // Map real article metrics into the display format
  const displayOpportunities = opportunities.map(opp => {
    const avgPos = opp.metricsLatest?.position || opp.metrics?.gsc?.position || 0;
    const impressions = opp.metricsLatest?.impressions || opp.metrics?.gsc?.impressions || 0;
    const ctr = opp.metricsLatest?.ctr || opp.metrics?.gsc?.ctr || 0;
    const clicks = opp.metricsLatest?.clicks || opp.metrics?.gsc?.clicks || 0;

    return {
      title: decodeTitle(opp.title),
      avgPos,
      impressions: impressions.toLocaleString(),
      ctr: `${Number(ctr).toFixed(2)}%`,
      clicks: clicks.toLocaleString(),
      action: "+ Improve Title, headings & meta desc",
    };
  });

  return (
    <Card className="col-span-1 lg:col-span-3 border-zinc-800 bg-zinc-950 text-white shadow-xl shadow-zinc-900/50">
      <CardHeader className="pb-4 border-b border-zinc-800/50">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-3 text-lg font-bold">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Ranking Opportunities
            <Badge className="bg-emerald-900/30 text-emerald-400 border border-emerald-800 text-xs uppercase tracking-wider rounded-sm px-1.5 py-0">
              AI Detected
            </Badge>
          </CardTitle>
          <p className="text-sm text-zinc-400 mt-2">
            Articles ranking position 5-15 that could reach page 1 with a small update. High-value, low-effort wins.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayOpportunities.length > 0 ? displayOpportunities.map((opp, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between hover:bg-zinc-800/60 transition-colors"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-zinc-100 text-[15px] leading-snug w-3/4">
                    {opp.title}
                  </h3>
                  <div className="text-right">
                    <div className="text-xl font-bold text-emerald-400 leading-none">
                      {opp.avgPos.toFixed(1)}
                    </div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">avg pos</span>
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-zinc-500 mb-5">
                  <span>Impr: <span className="text-zinc-300 font-medium">{opp.impressions}</span></span>
                  <span>CTR: <span className="text-zinc-300 font-medium">{opp.ctr}</span></span>
                  <span>Clicks: <span className="text-zinc-300 font-medium">{opp.clicks}</span></span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full justify-start text-xs border-emerald-900 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 transition-colors"
              >
                {opp.action}
              </Button>
            </div>
          )) : (
            <div className="col-span-3 py-6 text-center text-zinc-500 text-sm">
              Currently no immediate ranking opportunities found within this timeframe. Great job!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
