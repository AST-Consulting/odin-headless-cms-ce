"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Sparkles, BarChart3 } from "lucide-react";
import { TrendingSection } from "./components/TrendingSection";
import { AiIdeasSection } from "./components/AiIdeasSection";
import { ExploreTrendsSection } from "./components/ExploreTrendsSection";

export default function IdeasPage() {
  const router = useRouter();

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
            metadata: {
              props: {
                backgroundColor: "default",
                textColor: "default",
                textAlignment: "left",
              },
              children: [],
            },
            order: 1,
          },
        ],
        selectedBlockId: null,
        seoData: null,
        tags: [],
        categories: [],
        primaryCategory: null,
        primaryCategorySlug: null,
        authors: [],
        articleTitle: topicTitle,
        currentArticleId: null,
        slug: "",
        status: "draft",
        images: [],
        articleType: "article",
      });
      router.push("/editor");
    },
    [router]
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ideas & Trends</h1>
        <p className="text-muted-foreground mt-1">
          Discover trending topics and generate story ideas to fuel your newsroom
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trending" className="space-y-6">
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

        <TabsContent value="trending" className="mt-6">
          <TrendingSection onCreateDraft={handleCreateDraft} />
        </TabsContent>

        <TabsContent value="ai-ideas" className="mt-6">
          <AiIdeasSection onCreateDraft={handleCreateDraft} />
        </TabsContent>

        <TabsContent value="explore" className="mt-6">
          <ExploreTrendsSection onCreateDraft={handleCreateDraft} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
