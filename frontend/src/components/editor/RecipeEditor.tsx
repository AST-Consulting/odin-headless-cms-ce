"use client";

import React from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Utensils, ListChecks, Timer, ChefHat } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { AiFormattingToolbar } from "./AiFormattingToolbar";
import { getImagePickerSlashCommand } from "./imagePickerSlashCommand";
import { getFeaturedImageSlashCommand } from "./featuredImageSlashCommand";
import { getTimestampSlashCommand } from "./TimestampBlock";
import { getTwitterSlashCommand } from "./twitterSlashCommand";
import { getYouTubeSlashCommand } from "./youtubeSlashCommand";
import { getInstagramSlashCommand } from "./instagramSlashCommand";
import { getSoundCloudSlashCommand } from "./soundcloudSlashCommand";
import { getSnapchatSlashCommand } from "./snapchatSlashCommand";
import { getVideoEmbedSlashCommand } from "./videoEmbedSlashCommand";
import { getFaqSlashCommand } from "./faqSlashCommand";
import { getPollSlashCommand } from "./pollSlashCommand";

interface RecipeEditorProps {
  editor: any;
  theme: string;
  titleDraft: string;
  setTitleDraft: (title: string) => void;
  syncTitle: (title: string) => void;
  setIsDirty: (dirty: boolean) => void;
  editCounterRef: React.MutableRefObject<number>;
  scheduleAutosave: () => void;
  handleEditorChange: () => void;
  setIsImagePickerOpen: (open: boolean) => void;
  setIsFeaturedImagePickerOpen: (open: boolean) => void;
  setIsFaqPickerOpen: (open: boolean) => void;
  setIsPollPickerOpen: (open: boolean) => void;
  handleTwitterEmbed: () => void;
  handleYouTubeEmbed: () => void;
  handleInstagramEmbed: () => void;
  handleSoundCloudEmbed: () => void;
  handleSnapchatEmbed: () => void;
  handleVideoEmbed: () => void;
  articleStats: { words: number; readingMinutes: number };
}

export function RecipeEditor({
  editor,
  theme,
  titleDraft,
  setTitleDraft,
  syncTitle,
  setIsDirty,
  editCounterRef,
  scheduleAutosave,
  handleEditorChange,
  setIsImagePickerOpen,
  setIsFeaturedImagePickerOpen,
  setIsFaqPickerOpen,
  setIsPollPickerOpen,
  handleTwitterEmbed,
  handleYouTubeEmbed,
  handleInstagramEmbed,
  handleSoundCloudEmbed,
  handleSnapchatEmbed,
  handleVideoEmbed,
  articleStats,
}: RecipeEditorProps) {

  const addIngredient = () => {
    if (!editor) return;
    editor.focus();
    const selection = editor.getTextCursorPosition();
    if (selection) {
      editor.insertBlocks([{ type: "recipeIngredient", content: "" }], selection.block, "after");
    } else {
      editor.insertBlocks([{ type: "recipeIngredient", content: "" }], editor.document[editor.document.length - 1], "after");
    }
  };

  const addStep = () => {
    if (!editor) return;
    editor.focus();
    const selection = editor.getTextCursorPosition();
    if (selection) {
      editor.insertBlocks([{ type: "howToStep", content: "" }], selection.block, "after");
    } else {
      editor.insertBlocks([{ type: "howToStep", content: "" }], editor.document[editor.document.length - 1], "after");
    }
  };

  return (
    <div className="flex flex-col h-full bg-orange-50/5 dark:bg-background">
      {/* Recipe Specialized Toolbar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-6 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-sm">Recipe Editor</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-orange-200 bg-orange-50/50 hover:bg-orange-100 dark:border-orange-950 dark:bg-orange-950/20"
            onClick={addIngredient}
          >
            <Utensils className="w-3.5 h-3.5 text-orange-600" />
            Add Ingredient
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-blue-200 bg-blue-50/50 hover:bg-blue-100 dark:border-blue-950 dark:bg-blue-950/20"
            onClick={addStep}
          >
            <ListChecks className="w-3.5 h-3.5 text-blue-600" />
            Add Step
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Align with .bn-editor's 54px inline padding */}
        <div className="pt-6 pb-2 px-[54px] max-w-4xl mx-auto">
          <Input
            value={titleDraft}
            onChange={(e) => {
              setTitleDraft(e.target.value);
              setIsDirty(true);
              editCounterRef.current += 1;
              scheduleAutosave();
            }}
            onBlur={() => syncTitle(titleDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                syncTitle(titleDraft);
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Enter delicious recipe name..."
            className="h-12 text-2xl font-bold border-none bg-transparent placeholder:text-muted-foreground/30 px-0 focus-visible:ring-0"
          />

          <div className="flex gap-4 mb-8 mt-2 pb-4 border-b border-orange-100 dark:border-orange-900/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="w-3.5 h-3.5" />
              <span>Format: Overview → Details → Ingredients → Steps</span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <BlockNoteView
            key="recipe-blocknote-view"
            editor={editor}
            theme={theme === "dark" ? "dark" : "light"}
            className="blocknote-editor recipe-mode"
            onChange={handleEditorChange}
            slashMenu={false}
          >
            <SuggestionMenuController
              key="recipe-suggestion-menu"
              triggerCharacter="/"
              getItems={async (query) => {
                const { user } = useAuthStore.getState();
                const items = [
                  ...getDefaultReactSlashMenuItems(editor).filter(
                    (item) => item.title !== "Image" && item.title !== "Video"
                  ),
                  {
                    title: "Ingredient",
                    onItemClick: () => addIngredient(),
                    group: "Recipe",
                    icon: <Utensils size={18} />,
                  },
                  {
                    title: "How-To Step",
                    onItemClick: () => addStep(),
                    group: "Recipe",
                    icon: <ListChecks size={18} />,
                  },
                  getImagePickerSlashCommand(() => setIsImagePickerOpen(true)),
                  getFeaturedImageSlashCommand(() => setIsFeaturedImagePickerOpen(true)),
                  getTimestampSlashCommand(editor, user ? { id: user.id, name: user.name, slug: user.slug ?? "" } : null),
                  getTwitterSlashCommand(handleTwitterEmbed),
                  getYouTubeSlashCommand(handleYouTubeEmbed),
                  getInstagramSlashCommand(handleInstagramEmbed),
                  getSoundCloudSlashCommand(handleSoundCloudEmbed),
                  getSnapchatSlashCommand(handleSnapchatEmbed),
                  getVideoEmbedSlashCommand(handleVideoEmbed),
                  getFaqSlashCommand(() => setIsFaqPickerOpen(true)),
                  getPollSlashCommand(() => setIsPollPickerOpen(true)),
                ];
                return items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()));
              }}
            />
            <AiFormattingToolbar key="recipe-ai-formatting" />
          </BlockNoteView>
        </div>

        <div className="mt-8 px-[54px] pb-10 pt-4 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground/70 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <span>
              <span className="font-medium text-muted-foreground">{articleStats.words.toLocaleString()}</span> {articleStats.words === 1 ? "word" : "words"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-medium text-muted-foreground">{articleStats.readingMinutes}</span> min read
            </span>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/20 px-2.5 py-1 rounded-full text-orange-600 dark:text-orange-400 font-medium">
            Recipe Content
          </div>
        </div>
      </div>
    </div>
  );
}
