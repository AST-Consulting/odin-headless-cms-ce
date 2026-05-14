"use client";

import React from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Film, Users, Star, ListChecks } from "lucide-react";
import { AiFormattingToolbar } from "./AiFormattingToolbar";

interface MovieReviewEditorProps {
  editor: any;
  theme: string;
  titleDraft: string;
  setTitleDraft: (title: string) => void;
  syncTitle: (title: string) => void;
  setIsDirty: (dirty: boolean) => void;
  scheduleAutosave: () => void;
  handleEditorChange: () => void;
  articleStats: { words: number; readingMinutes: number };
}

export function MovieReviewEditor({
  editor,
  theme,
  titleDraft,
  setTitleDraft,
  syncTitle,
  setIsDirty,
  scheduleAutosave,
  handleEditorChange,
  articleStats,
}: MovieReviewEditorProps) {

  const addCastMember = () => {
    if (!editor) return;
    editor.focus();
    const selection = editor.getTextCursorPosition();
    let newBlocks;
    if (selection) {
      newBlocks = editor.insertBlocks([{ type: "movieCast", content: "" }], selection.block.id, "after");
    } else {
      newBlocks = editor.insertBlocks([{ type: "movieCast", content: "" }], editor.document[editor.document.length - 1].id, "after");
    }
    if (newBlocks && newBlocks.length > 0) {
      editor.setTextCursorPosition(newBlocks[0], "start");
    }
  };

  const addRatingCard = () => {
    if (!editor) return;
    editor.focus();
    const selection = editor.getTextCursorPosition();
    let newBlocks;
    if (selection) {
      newBlocks = editor.insertBlocks([{ type: "movieRating", content: "" }], selection.block.id, "after");
    } else {
      newBlocks = editor.insertBlocks([{ type: "movieRating", content: "" }], editor.document[editor.document.length - 1].id, "after");
    }
    if (newBlocks && newBlocks.length > 0) {
      editor.setTextCursorPosition(newBlocks[0], "start");
    }
  };

  const addPlotSection = () => {
    if (!editor) return;
    editor.focus();
    const newBlocks = editor.insertBlocks(
      [
        { type: "heading", props: { level: 2 }, content: "The Plot" },
        { type: "paragraph", content: "Write about the movie plot here..." }
      ],
      editor.document[editor.document.length - 1].id,
      "after"
    );
    if (newBlocks && newBlocks.length > 1) {
      editor.setTextCursorPosition(newBlocks[1], "start");
    }
  };

  return (
    <div className="flex flex-col h-full bg-blue-50/5 dark:bg-background">
      {/* Movie Specialized Toolbar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-6 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-blue-500" />
          <span className="font-bold text-sm">Movie Review Editor</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-blue-200 bg-blue-50/50 hover:bg-blue-100 dark:border-blue-950 dark:bg-blue-950/20"
            onClick={addCastMember}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Add Cast
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-yellow-200 bg-yellow-50/50 hover:bg-yellow-100 dark:border-yellow-950 dark:bg-yellow-950/20"
            onClick={addRatingCard}
          >
            <Star className="w-3.5 h-3.5 text-yellow-600" />
            Add Rating
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-muted-200 bg-muted/50 hover:bg-muted/80"
            onClick={addPlotSection}
          >
            <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
            Add Plot
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="pt-6 pb-2 px-[54px] max-w-4xl mx-auto">
          <Input
            value={titleDraft}
            onChange={(e) => {
              setTitleDraft(e.target.value);
              syncTitle(e.target.value);
              setIsDirty(true);
              scheduleAutosave();
            }}
            placeholder="Movie Title (e.g. Inception Movie Review)"
            className="text-4xl font-bold border-none px-0 focus-visible:ring-0 placeholder:opacity-20 h-auto py-4 bg-transparent mb-2"
          />
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-8 border-b pb-4">
             <div className="flex items-center gap-1">
                <Film size={12} />
                Format: Title → Cast → Review → Verdict
             </div>
             <div>•</div>
             <div>{articleStats.words} words</div>
             <div>•</div>
             <div>{articleStats.readingMinutes} min read</div>
          </div>
        </div>

        <BlockNoteView
          editor={editor}
          theme={theme === "dark" ? "dark" : "light"}
          onChange={handleEditorChange}
          slashMenu={false}
          className="min-h-[500px]"
        >
          <SuggestionMenuController
            suggestionMenuComponent={undefined}
            triggerCharacter={"/"}
            getItems={async (query) =>
              getDefaultReactSlashMenuItems(editor).filter((item) =>
                item.title.toLowerCase().includes(query.toLowerCase())
              )
            }
          />
          <AiFormattingToolbar />
        </BlockNoteView>
      </div>
    </div>
  );
}
