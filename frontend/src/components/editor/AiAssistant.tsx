"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatTab } from "./ChatTab";
import { TrendingNowTab } from "./TrendingNowTab";
import { SuggestionsTab } from "./SuggestionsTab";
import { SeoTab } from "./SeoTab";
import { ValidationTab } from "./ValidationTab";
import { FactCheckTab } from "./FactCheckTab";
import { RepurposeQuickPanel } from "./RepurposeQuickPanel";

import { PanelRight, PanelRightClose, MessageSquare, Lightbulb, Search, TrendingUp, CheckCircle2, ShieldCheck, Share2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider, TooltipTrigger, TooltipContent } from "@radix-ui/react-tooltip";
import { Tooltip } from "../ui/tooltip";
import { havePermission, useAuthStore } from "@/lib/auth";


interface AiAssistantProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  articleId?: string;
}

export function AiAssistant({ isCollapsed = false, onToggle, articleId }: AiAssistantProps) {
  const { user } = useAuthStore();
  const canRepurpose =
    !!articleId && havePermission(user, "repurpose", "read");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("seo");
  const [chatPrompt, setChatPrompt] = useState("");

  const handleSuggestArticle = (trendTitle: string, trendData?: string) => {
    const prompt = `Suggest 3-5 article topic ideas based on this trending topic: "${trendTitle}"${trendData ? `\n\nAdditional context: ${trendData}` : ''}`;
    setChatPrompt(prompt);
    setActiveTab("chat");
  };

  if (isCollapsed) {
    return (
      <Card className="flex flex-col h-full items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="p-2 h-8 w-8"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
        <div className="mt-4 [writing-mode:vertical-lr] rotate-180 text-sm font-semibold text-muted-foreground whitespace-nowrap">
          AI Assistant
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-0">
        <CardTitle className="text-base font-semibold">AI Assistant</CardTitle>
        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2 h-8 w-8"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0 pt-0">
        <TooltipProvider>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className={`grid w-full ${canRepurpose ? "grid-cols-7" : "grid-cols-6"} gap-2 bg-transparent p-1 h-auto`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="validation"
                    className="aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-foreground aria-selected:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg p-3 border border-transparent"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Content Validator</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="video"
                    className="aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-foreground aria-selected:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg p-3 border border-transparent"
                  >
                    <Film className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Video Generator</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="fact-check"
                    className="aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-foreground aria-selected:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg p-3 border border-transparent"
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Fact Validation</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="seo"
                    className="aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-foreground aria-selected:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg p-3 border border-transparent"
                  >
                    <Search className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>SEO & Metadata</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="chat"
                    className="aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-foreground aria-selected:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg p-3 border border-transparent"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>AI Chat</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="suggestions"
                    className="aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-foreground aria-selected:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg p-3 border border-transparent"
                  >
                    <Lightbulb className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Suggestions</p>
                </TooltipContent>
              </Tooltip>

              {canRepurpose && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value="repurpose"
                      className="aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-foreground aria-selected:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg p-3 border border-transparent"
                    >
                      <Share2 className="h-5 w-5" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Repurpose</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/*
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="trends"
                    className="aria-selected:bg-gray-200 dark:aria-selected:bg-gray-700 aria-selected:text-foreground aria-selected:shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg p-3 border border-transparent"
                  >
                    <TrendingUp className="h-5 w-5" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Trending Topics</p>
                </TooltipContent>
              </Tooltip>
              */}
            </TabsList>
            <TabsContent value="chat" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 p-1">
              <ChatTab initialPrompt={chatPrompt} onPromptUsed={() => setChatPrompt("")} />
            </TabsContent>
            <TabsContent value="suggestions" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 p-1">
              <SuggestionsTab />
            </TabsContent>
            <TabsContent value="seo" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 p-1">
              <SeoTab />
            </TabsContent>
            {/* 
            <TabsContent value="trends" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 p-1">
              <TrendingNowTab onSuggestArticle={handleSuggestArticle} />
            </TabsContent>
            */}
            <TabsContent value="validation" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 p-1">
              <ValidationTab />
            </TabsContent>
            <TabsContent value="fact-check" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 p-1">
              <FactCheckTab />
            </TabsContent>
            {canRepurpose && (
              <TabsContent value="repurpose" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 p-1">
                <RepurposeQuickPanel articleId={articleId} />
              </TabsContent>
            )}
            <TabsContent value="video" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 p-1">
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">
                  Generate article videos with Odin native workflow.
                </p>
                <Button onClick={() => router.push("/video-generator")}>Open Video Generator</Button>
              </div>
            </TabsContent>
          </Tabs>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
