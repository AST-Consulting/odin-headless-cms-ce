import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot } from "lucide-react";
import Link from "next/link";
import { 
  DashboardMetricsCards, 
  AuthorContentVelocityChart, 
  WritingShortcuts, 
  RankingOpportunities, 
  TopArticlesList 
} from "@/components/dashboard";

export default function Dashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-serif mb-1">Welcome back, Sofia.</h1>
          <p className="text-muted-foreground">
            You have <span className="font-semibold text-foreground">3 drafts in progress</span> and 1 article pending AI review.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden border-border bg-background sm:flex">
            24h
          </Button>
          <Button variant="default" className="bg-foreground text-background">
            7 days
          </Button>
          <Button variant="outline" className="hidden border-border bg-background sm:flex">
            30 days
          </Button>
        </div>
      </div>

      {/* AI Alert Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 rounded-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-400 text-sm">AI Writing Agent ready</h4>
            <p className="text-blue-700 dark:text-blue-300 text-sm">{`Your SEO agent finished reviewing "React 19 Deep Dive" — 4 suggestions waiting for you.`}</p>
          </div>
        </div>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
          View Suggestions <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Row 1: KPI Cards */}
      <DashboardMetricsCards />

      {/* Row 2: Performance Graph & Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: PV Graph */}
        <AuthorContentVelocityChart chartData={[]} days={7} />
        
        {/* Right: AI Agent Writing Shortcuts */}
        <WritingShortcuts />
      </div>

      {/* Row 3: AI Ranking Opportunities */}
      <RankingOpportunities opportunities={[]} />

      {/* Row 4: Top Performing Articles List */}
      <TopArticlesList articles={[]} />

    </div>
  );
}
