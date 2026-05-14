"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Lock, Unlock } from "lucide-react";
import { getAllSections, getSectionById, createContentPriority, updateSection } from "@/lib/api";
import { Article } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import StoryTile from "@/components/sections/StoryTile";
import ListContainer from "@/components/sections/ListContainer";

interface MapStoryToArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: Article | null;
}

type StoryItem = {
  id: string;
  name: string;
  url: string;
  contentType: string;
  contentRank: number;
  slug: string;
  title: string;
};

export function MapStoryToArticleDialog({
  open,
  onOpenChange,
  article,
}: MapStoryToArticleDialogProps) {
  const { toast } = useToast();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [priorityList, setPriorityList] = useState<StoryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fixedArticleIds, setFixedArticleIds] = useState<string[]>([]);
  const [isUpdatingFixed, setIsUpdatingFixed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch sections for articles
  const { data: sectionsData } = useQuery({
    queryKey: ["sections"],
    queryFn: () => getAllSections(),
    enabled: open,
  });

  // Fetch section by ID when selected
  const { data: sectionData } = useQuery({
    queryKey: ["section", selectedSection],
    queryFn: () => getSectionById({ sectionId: selectedSection! }),
    enabled: !!selectedSection && open,
  });

  useEffect(() => {
    if (sectionsData?.data && Array.isArray(sectionsData.data)) {
      // Sections are loaded, ready for selection
    }
  }, [sectionsData]);

  useEffect(() => {
    if (sectionData?.data) {
      const existingPriority = sectionData.data.contentPriority || [];
      setPriorityList(existingPriority);
      setFixedArticleIds(sectionData.data.fixedArticleIds || []);
      
      // Add article to priority list if it's not already there
      if (article && open) {
        const articleItem: StoryItem = {
          id: article._id,
          name: article.title,
          url: article.slug || "",
          contentType: "articles",
          contentRank: 0,
          slug: article.slug || "",
          title: article.title,
        };

        // Check if article is already in priority list
        const exists = existingPriority.some((item: any) => item.id === articleItem.id);
        if (!exists) {
          setPriorityList((prev) => [...prev, articleItem]);
        }
      }
    }
  }, [sectionData, article, open]);

  const handleSectionChange = (sectionId: string) => {
    if (sectionId === "__no-sections__" || sectionId === "__select-type-first__") {
      return;
    }
    setSelectedSection(sectionId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id.toString());
  };

  const findStoryById = (id: string, list: StoryItem[]) => {
    const idStr = id.toString();
    const cleanId = idStr.includes("-") ? idStr.split("-")[1] : idStr;
    return list?.find((story) => story.id.toString() === cleanId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Dragging from story list to priority list
    if (
      active.id.toString().includes("item") &&
      over?.id.toString().includes("priority-list") &&
      active &&
      over &&
      active.id !== over.id
    ) {
      const item_id = active.id.toString().split("-")[1];
      const getItemById = findStoryById(item_id, storyList) || findStoryById(item_id, priorityList);

      if (
        getItemById &&
        !priorityList.some((item) => item.id === getItemById.id)
      ) {
        const updatedPriorityList = [...priorityList, getItemById];
        setPriorityList(updatedPriorityList);
      }
    }

    // Dropping back into story list
    if (
      active.id.toString().includes("item") &&
      over?.id.toString().includes("story-list") &&
      active &&
      over &&
      active.id !== over.id
    ) {
      const item_id = active.id.toString().split("-")[1];
      const getItemById = findStoryById(item_id, storyList) || findStoryById(item_id, priorityList);

      if (getItemById && !storyList.some((item) => item.id === getItemById.id)) {
        const updatedPriorityList = priorityList.filter(
          (item) => item.id !== getItemById.id
        );
        setPriorityList(updatedPriorityList);
      }
    }

    // Reordering within priority list
    if (
      active.id.toString().includes("item") &&
      over?.id.toString().includes("item") &&
      active &&
      over &&
      active.id !== over.id
    ) {
      const oldIndex = priorityList.findIndex(
        (item) => item.id === active.id.toString().split("-")[1]
      );
      const newIndex = priorityList.findIndex(
        (item) => item.id === over.id.toString().split("-")[1]
      );
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const updatedPriorityList = arrayMove(priorityList, oldIndex, newIndex);
        setPriorityList(updatedPriorityList);
      }
    }

    setActiveId(null);
  };

  const handleSave = async () => {
    if (!selectedSection) {
      toast({
        title: "Error",
        description: "Please select a section first",
        variant: "destructive",
      });
      return;
    }

    if (priorityList.length === 0) {
      toast({
        title: "Error",
        description: "Priority list is empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const contentIds = priorityList.map((item) => item.id);
      await createContentPriority({
        ids: contentIds,
        sectionId: selectedSection,
        contentType: "articles",
      });

      toast({
        title: "Success",
        description: "Article mapped to section successfully",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to save priority:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to map article to section",
        variant: "destructive",
      });
    }
  };

  const handleFixArticle = async (articleId: string) => {
    if (!selectedSection) {
      toast({
        title: "Error",
        description: "Please select a section first",
        variant: "destructive",
      });
      return;
    }
    setIsUpdatingFixed(true);
    try {
      const newFixedIds = [...fixedArticleIds, articleId];
      await updateSection(selectedSection, { fixedArticleIds: newFixedIds });
      setFixedArticleIds(newFixedIds);
      toast({
        title: "Success",
        description: "Article fixed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fix article",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingFixed(false);
    }
  };

  const handleUnfixArticle = async (articleId: string) => {
    if (!selectedSection) {
      toast({
        title: "Error",
        description: "Please select a section first",
        variant: "destructive",
      });
      return;
    }
    setIsUpdatingFixed(true);
    try {
      const newFixedIds = fixedArticleIds.filter((id) => id !== articleId);
      await updateSection(selectedSection, { fixedArticleIds: newFixedIds });
      setFixedArticleIds(newFixedIds);
      toast({
        title: "Success",
        description: "Article unfixed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unfix article",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingFixed(false);
    }
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedSection(null);
      setPriorityList([]);
      setActiveId(null);
      setFixedArticleIds([]);
    }
  }, [open]);

  const sections = sectionsData?.data && Array.isArray(sectionsData.data)
    ? sectionsData.data.map((section: any) => ({
        id: section._id,
        name: section.title,
      }))
    : [];

  // Create article item for story list - always show in story list
  const articleItem: StoryItem | null = article ? {
    id: article._id,
    name: article.title,
    url: article.slug || "",
    contentType: "articles",
    contentRank: 0,
    slug: article.slug || "",
    title: article.title,
  } : null;

  // Story list always contains the article (source list)
  const storyList = articleItem ? [articleItem] : [];
  
  // Filter out the article from story list if it's already in priority list (for display purposes)
  const displayStoryList = storyList.filter(
    (item) => !priorityList.some((priorityItem) => priorityItem.id === item.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map Your Story to Section</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Choose Section Dropdown */}
          <div>
            <Label htmlFor="section-select">Choose Section</Label>
            <Select
              value={selectedSection || ""}
              onValueChange={handleSectionChange}
            >
              <SelectTrigger id="section-select" className="mt-2">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {sections.length === 0 ? (
                  <SelectItem value="__no-sections__" disabled>
                    No sections available
                  </SelectItem>
                ) : (
                  sections.map((section: any) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Content Priority Banner */}
          <div className="bg-red-600 text-white px-4 py-2 rounded-md">
            <h3 className="font-semibold">Content Priority</h3>
          </div>

          {/* Two Column Layout */}
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column - Story List */}
              <ListContainer
                id="story-list"
                title="Story List"
                search={false}
              >
                <p className="text-xs text-muted-foreground mb-4">
                  (Drag & drop from story list to prioritize the story)
                </p>
                {displayStoryList.length > 0 ? (
                  <SortableContext
                    items={displayStoryList.map((item: any) => `item-${item.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-4">
                      {displayStoryList.map((story: any) => (
                        <StoryTile
                          key={story.id}
                          story={story}
                          id={`item-${story.id}`}
                        />
                      ))}
                    </div>
                  </SortableContext>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    {articleItem ? "Article has been added to priority list" : "No article selected"}
                  </p>
                )}
              </ListContainer>

              {/* Right Column - Story Priority List */}
              <ListContainer
                id="priority-list"
                title="Story Priority List"
                save={true}
                saveFunction={handleSave}
              >
                <p className="text-xs text-muted-foreground mb-4">
                  (Drag & drop from story list to prioritize the story)
                </p>
                {priorityList.length > 0 ? (
                  <SortableContext
                    items={priorityList.map((item: any) => `item-${item.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-4">
                      {priorityList.map((story: any) => {
                        const storyId = story.id.toString();
                        const isFixed = fixedArticleIds.includes(storyId);
                        return (
                          <div key={story.id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <StoryTile
                                story={story}
                                id={`item-${story.id}`}
                                isFixed={isFixed}
                              />
                            </div>
                            <Button
                              type="button"
                              variant={isFixed ? "default" : "outline"}
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isFixed) {
                                  handleUnfixArticle(storyId);
                                } else {
                                  handleFixArticle(storyId);
                                }
                              }}
                              disabled={isUpdatingFixed || !selectedSection}
                              title={isFixed ? "Unfix article" : "Fix article"}
                            >
                              {isFixed ? (
                                <Unlock className="h-4 w-4" />
                              ) : (
                                <Lock className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </SortableContext>
                ) : (
                  <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg p-8 text-center">
                    <p className="text-muted-foreground">
                      {selectedSection
                        ? "Drag the story from the left to add it to the priority list"
                        : "Choose a section first"}
                    </p>
                  </div>
                )}
              </ListContainer>
            </div>
            <DragOverlay>
              {activeId ? (
                <div className="bg-muted rounded-lg p-3 border shadow-lg">
                  {storyList.find(
                    (item) => `item-${item.id}` === activeId
                  )?.name || priorityList.find(
                    (item) => `item-${item.id}` === activeId
                  )?.name || "Dragging..."}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </DialogContent>
    </Dialog>
  );
}

