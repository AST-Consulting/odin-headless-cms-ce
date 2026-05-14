"use client";

import { useEffect, useState } from "react";
import { BlockNoteEditorComponent } from "@/components/editor/BlockNoteEditor";
import { AiAssistant } from "@/components/editor/AiAssistant";
import { MobileAiAssistant } from "@/components/editor/MobileAiAssistant";
import { EditorContextProvider } from "@/components/editor/EditorContext";
import { useEditorStore, usePropertyStore, useLayoutStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

export default function EditorPage() {
  const router = useRouter();
  const isAssistantCollapsed = useLayoutStore((s) => s.assistantCollapsed);
  const [isChecking, setIsChecking] = useState(true);
  const { resetEditor, setAuthors } = useEditorStore();
  const { width: assistantWidth, isResizing, handleResizeStart } = useResizablePanel();

  const handleAssistantToggle = () => {
    if (isAssistantCollapsed) {
      useLayoutStore.getState().expandAssistant();
    } else {
      useLayoutStore.getState().setAssistantCollapsed(true);
    }
  };

  useEffect(() => {
    const handleAutoCreate = async () => {
      const { currentArticleId } = useEditorStore.getState();

      if (currentArticleId) {
        // If we have an active article, redirect to its editor page
        router.replace(`/editor/${currentArticleId}`);
        return;
      }

      // Automatically create a new article if none exists
      try {
        const { user } = useAuthStore.getState();
        const { selectedProperty } = usePropertyStore.getState();
        const { saveArticle, getOrganizationDetails } = await import("@/lib/api");

        if (!user) return;

        let organizationId = user.organizationId;
        if (!organizationId) {
          try {
            const orgData = await getOrganizationDetails();
            organizationId = orgData.data._id;
          } catch (e) {
            console.error("Failed to get org ID", e);
          }
        }

        // Use store values if pre-populated (e.g. from Ideas page), else fallback to defaults
        const storeState = useEditorStore.getState();
        const title = storeState.articleTitle || "Untitled Article";
        const richBlocks = storeState.blocks.length > 0
          ? storeState.blocks
          : [
              {
                id: crypto.randomUUID(),
                type: "heading" as const,
                content: [{ type: "text", text: "Untitled Article", styles: {} }],
                metadata: { props: { level: 1 }, children: [] },
                order: 0,
              },
              {
                id: crypto.randomUUID(),
                type: "paragraph" as const,
                content: [{ type: "text", text: "Start writing...", styles: {} }],
                metadata: { props: {}, children: [] },
                order: 1,
              },
            ];
        const articleType = storeState.articleType || "article";

        const response = await saveArticle({
          title,
          richBlocks,
          status: "draft",
          organizationId: organizationId || "",
          propertyId: selectedProperty?._id || user.propertyId,
          type: articleType,
          lang: "en",
          authors: [{
            id: user.id,
            name: user.name,
            slug: user.slug || ""
          }]
        });

        const articleId = response._id || response.data?._id;
        if (articleId) {
          useEditorStore.getState().setCurrentArticleId(articleId);
          router.replace(`/editor/${articleId}`);
        }
      } catch (error) {
        console.error("Failed to auto-create article:", error);
        setIsChecking(false);
      }
    };

    handleAutoCreate();
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <EditorContextProvider>
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-0 h-[calc(100vh-8rem)] items-stretch max-w-full overflow-hidden">
        <div className="flex-1 min-w-0 lg:min-w-[380px] w-full h-full">
          <BlockNoteEditorComponent />
        </div>
        {/* Resize handle — desktop only, hidden when collapsed */}
        {!isAssistantCollapsed && (
          <div
            onMouseDown={handleResizeStart}
            className="hidden lg:flex w-6 cursor-col-resize items-center justify-center flex-shrink-0 group"
          >
            <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
          </div>
        )}
        {/* Desktop AI Assistant */}
        <div
          style={!isAssistantCollapsed ? { flexBasis: assistantWidth, maxWidth: assistantWidth, minWidth: 280 } : undefined}
          className={`h-full hidden lg:block lg:sticky lg:top-6 ${
            isAssistantCollapsed ? "lg:w-16 flex-shrink-0" : ""
          } ${!isResizing ? "transition-[width] duration-300 ease-in-out" : ""}`}
        >
          <AiAssistant
            isCollapsed={isAssistantCollapsed}
            onToggle={handleAssistantToggle}
          />
        </div>
      </div>
      {/* Mobile AI Assistant with FAB */}
      <MobileAiAssistant />
    </EditorContextProvider>
  );
}

