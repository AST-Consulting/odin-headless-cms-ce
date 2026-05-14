"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Bot, X, MessageSquare, Lightbulb, Search, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatTab } from "./ChatTab";
import { SuggestionsTab } from "./SuggestionsTab";
import { SeoTab } from "./SeoTab";
import { ValidationTab } from "./ValidationTab";
import { FactCheckTab } from "./FactCheckTab";

export function MobileAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("seo");
  const [chatPrompt, setChatPrompt] = useState("");

  // Swipe to dismiss state
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
    const deltaY = touchCurrentY.current - touchStartY.current;

    // Only allow downward swipe and apply transform
    if (deltaY > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const deltaY = touchCurrentY.current - touchStartY.current;

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s ease-out';

      // If swiped down more than 100px, close the sheet
      if (deltaY > 100) {
        sheetRef.current.style.transform = `translateY(100%)`;
        setTimeout(() => setIsOpen(false), 300);
      } else {
        // Reset position
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
  }, []);

  // Reset transform when sheet opens
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(0)';
    }
  }, [isOpen]);

  const handleSuggestArticle = (trendTitle: string, trendData?: string) => {
    const prompt = `Suggest 3-5 article topic ideas based on this trending topic: "${trendTitle}"${trendData ? `\n\nAdditional context: ${trendData}` : ""}`;
    setChatPrompt(prompt);
    setActiveTab("chat");
  };

  return (
    <>
      {/* Floating Action Button - only visible on mobile (below lg breakpoint) */}
      <Button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        size="icon"
        aria-label="Open AI Assistant"
      >
        <Bot className="h-6 w-6" />
      </Button>

      {/* Bottom Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="bottom"
          hideCloseButton
          className="h-[85vh] flex flex-col p-0"
          ref={sheetRef}
        >
          {/* Drag Handle - Swipeable area */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          <SheetHeader className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <SheetTitle>AI Assistant</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
                aria-label="Close AI Assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-5 gap-1 bg-muted/50 p-1 h-auto rounded-lg">
                <TabsTrigger
                  value="validation"
                  className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-background"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Validation</span>
                </TabsTrigger>
                <TabsTrigger
                  value="fact-check"
                  className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-background"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Fact-Check</span>
                </TabsTrigger>
                <TabsTrigger
                  value="seo"
                  className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-background"
                >
                  <Search className="h-4 w-4" />
                  <span>SEO</span>
                </TabsTrigger>
                <TabsTrigger
                  value="chat"
                  className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-background"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </TabsTrigger>
                <TabsTrigger
                  value="suggestions"
                  className="flex flex-col items-center gap-1 py-2 text-xs data-[state=active]:bg-background"
                >
                  <Lightbulb className="h-4 w-4" />
                  <span>Ideas</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="validation"
                className="mt-3 flex-1 min-h-0 overflow-y-auto p-1"
              >
                <ValidationTab />
              </TabsContent>
              <TabsContent
                value="fact-check"
                className="mt-3 flex-1 min-h-0 overflow-y-auto p-1"
              >
                <FactCheckTab />
              </TabsContent>
              <TabsContent
                value="seo"
                className="mt-3 flex-1 min-h-0 overflow-y-auto p-1"
              >
                <SeoTab />
              </TabsContent>
              <TabsContent
                value="chat"
                className="mt-3 flex-1 min-h-0 overflow-y-auto p-1"
              >
                <ChatTab
                  initialPrompt={chatPrompt}
                  onPromptUsed={() => setChatPrompt("")}
                />
              </TabsContent>
              <TabsContent
                value="suggestions"
                className="mt-3 flex-1 min-h-0 overflow-y-auto p-1"
              >
                <SuggestionsTab />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
