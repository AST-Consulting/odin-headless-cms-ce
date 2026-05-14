"use client";

import { useState } from "react";
import { VideoGeneratorPanel } from "@/components/video-generator/VideoGeneratorPanel";
import { VideoGeneratorHistory } from "@/components/video-generator/VideoGeneratorHistory";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "generator" as const, label: "Generator" },
  { id: "history" as const, label: "History" },
];

export default function VideoGeneratorPage() {
  const [activeTab, setActiveTab] = useState<"generator" | "history">("generator");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Native Video Generator</h1>
        <p className="text-sm text-muted-foreground">
          Generate and publish article videos within Odin CMS workflow.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border/60" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "generator" && <VideoGeneratorPanel />}
      {activeTab === "history" && <VideoGeneratorHistory />}
    </div>
  );
}
