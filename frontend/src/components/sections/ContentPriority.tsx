"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  UniqueIdentifier,
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Unlock, X } from "lucide-react";
import {
  getAllSections,
  getSectionById,
  createContentPriority,
  getArticles,
  updateSection,
  getArticleById,
} from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { truncateWithEllipsis } from "@/lib/utils";
import { usePropertyStore } from "@/lib/store";
import StoryTile from "./StoryTile";
import ListContainer from "./ListContainer";


type StoryItem = {
  id: UniqueIdentifier;
  name: string;
  url: string;
  contentType: string;
  contentRank: number;
  slug: string;
  title: string;
  type?: string;
  authors?: any[];
  primaryCategory?: any;
  categories?: any[];
  fullSlug?: string;
};

import { Article } from "@/lib/types";

const ContentPriority = ({ 
  selectedArticleId, 
  initialArticle 
}: { 
  selectedArticleId?: string;
  initialArticle?: Article;
}) => {
  const queryClient = useQueryClient();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [priorityList, setPriorityList] = useState<StoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [fixedArticleIds, setFixedArticleIds] = useState<string[]>([]);
  const [articlesPool, setArticlesPool] = useState<any[]>([]);
  const [lastSortValues, setLastSortValues] = useState<any[] | undefined>(undefined);
  const [isPoolFetching, setIsPoolFetching] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [singleArticle, setSingleArticle] = useState<StoryItem | null>(null);

  const searchParams = useSearchParams();
  const [hasProcessedArticleParam, setHasProcessedArticleParam] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch all sections for the selected property
  const { data: sectionsData } = useQuery({
    queryKey: ["sections", "all", selectedProperty?._id],
    queryFn: () => getAllSections({ propertyId: selectedProperty?._id }),
    enabled: !!selectedProperty,
  });

  // Fetch section by ID when selected
  const { data: sectionData } = useQuery({
    queryKey: ["section", selectedSection],
    queryFn: () => getSectionById({ sectionId: selectedSection! }),
    enabled: !!selectedSection,
  });

  // Create content priority mutation
  const createPriorityMutation = useMutation({
    mutationFn: createContentPriority,
    onSuccess: () => {
      toast.success("Content priority saved successfully");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["section", selectedSection] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Update fixed article IDs mutation
  const updateFixedMutation = useMutation({
    mutationFn: ({ sectionId, fixedIds }: { sectionId: string; fixedIds: string[] }) =>
      updateSection(sectionId, { fixedArticleIds: fixedIds }),
    onSuccess: () => {
      toast.success("Fixed articles updated successfully");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["section", selectedSection] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update fixed articles: ${error.message}`);
    },
  });

  useEffect(() => {
    if (sectionsData?.data && Array.isArray(sectionsData.data)) {
      const formattedSections = sectionsData.data.map((section: any) => ({
        id: section._id,
        name: section.title,
        count: section.count,
        rank: section.rank ?? 0,
      }));
      setSections(formattedSections);

      // Auto-select Home if articleId exists and no section is selected
      const articleId = searchParams.get("articleId");
      if (articleId && !selectedSection) {
        // Find all sections that look like "Home"
        const homeSections = formattedSections.filter((s: any) =>
          s.name.toLowerCase() === "home" ||
          s.name.toLowerCase().includes("top home") ||
          s.name.toLowerCase().includes("home section")
        );

        if (homeSections.length > 0) {
          // Sort them by rank (lower rank = higher priority/top)
          // If ranks are equal, title order acts as a fallback
          const topHome = homeSections.sort((a, b) => a.rank - b.rank)[0];
          setSelectedSection(topHome.id);
        }
      }
    }
  }, [sectionsData, searchParams, selectedSection]);

  useEffect(() => {
    if (sectionData?.data) {
      const storyList = (sectionData.data.contentPriority || []).map((item: any) => ({
        ...item,
        type: item.contentType || item.type || "article",
        authors: item.authors || (item.author ? [item.author] : []),
        primaryCategory: item.primaryCategory || null,
        categories: item.categories || [],
        fullSlug: item.fullSlug || "",
      }));
      setPriorityList(storyList);
      setFixedArticleIds(sectionData.data.fixedArticleIds || []);
      setIsDirty(false); // Reset dirty state when new data is loaded
    }
  }, [sectionData]);

  // Warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Intercept internal link clicks for SPA navigation
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && isDirty) {
        const href = anchor.getAttribute("href");
        // Only warn for links that go somewhere else (internal SPA links usually have href starting with / or absolute)
        if (href && !href.startsWith("#") && anchor.target !== "_blank") {
          const confirmed = window.confirm("You have unsaved changes. Are you sure you want to leave?");
          if (!confirmed) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    document.addEventListener("click", handleAnchorClick, true);
    return () => document.removeEventListener("click", handleAnchorClick, true);
  }, [isDirty]);

  // Handle auto-adding article from query param
  useEffect(() => {
    const processArticleParam = async () => {
      const articleId = searchParams.get("articleId");
      if (articleId && !hasProcessedArticleParam && sectionData?.data) {
        // Safeguard: Ensure the current section is actually one of the "Home" sections
        const currentSectionName = sections.find(s => s.id === selectedSection)?.name.toLowerCase() || "";
        const isHome = currentSectionName.includes("home");

        if (!isHome) return;

        try {
          const article = await getArticleById(articleId);
          if (article) {
            const newItem: StoryItem = {
              id: article._id,
              name: article.title || "",
              url: (article as any).url || article.fullSlug || "",
              contentType: "articles",
              contentRank: 0,
              slug: article.slug || "",
              title: article.title || "",
              type: article.type,
              authors: article.authors,
              primaryCategory: article.primaryCategory,
              categories: article.categories,
              fullSlug: article.fullSlug || "",
            };

            setPriorityList((prev) => {
              // If already there, remove from old position and move to top
              const filteredList = prev.filter((p) => p.id !== newItem.id);
              return [newItem, ...filteredList];
            });
            setIsDirty(true);
            setHasProcessedArticleParam(true);
            toast.info(`Added "${truncateWithEllipsis(newItem.title, 30)}" at the top`);
          }
        } catch (error) {
          console.error("Auto-add article failed:", error);
        }
      }
    };

    processArticleParam();
  }, [searchParams, sectionData, hasProcessedArticleParam, selectedSection, sections]);

  // Handle selectedArticleId prop
  useEffect(() => {
    const fetchSingleArticle = async () => {
      if (initialArticle) {
        setSingleArticle({
          id: initialArticle._id,
          name: initialArticle.title || "",
          url: (initialArticle as any).url || initialArticle.fullSlug || "",
          contentType: "articles",
          contentRank: 0,
          slug: initialArticle.slug || "",
          title: initialArticle.title || "",
          type: initialArticle.type,
          authors: initialArticle.authors,
          primaryCategory: initialArticle.primaryCategory,
          categories: initialArticle.categories,
          fullSlug: initialArticle.fullSlug || "",
        });
        return;
      }

      if (selectedArticleId) {
        setIsPoolFetching(true);
        try {
          const article = await getArticleById(selectedArticleId);
          if (article) {
            setSingleArticle({
              id: article._id,
              name: article.title || "",
              url: (article as any).url || article.fullSlug || "",
              contentType: "articles",
              contentRank: 0,
              slug: article.slug || "",
              title: article.title || "",
              type: article.type,
              authors: article.authors,
              primaryCategory: article.primaryCategory,
              categories: article.categories,
              fullSlug: article.fullSlug || "",
            });
          }
        } catch (error) {
          console.error("Failed to fetch single article:", error);
        } finally {
          setIsPoolFetching(false);
        }
      } else {
        setSingleArticle(null);
      }
    };

    fetchSingleArticle();
  }, [selectedArticleId, initialArticle]);

  const fetchArticlesPool = async (isInitial = false) => {
    if (!selectedSection || !selectedProperty?._id || selectedArticleId) return;

    setIsPoolFetching(true);
    try {
      const response = await getArticles({
        limit: 50,
        sort: "createdAt",
        sortOrder: "desc",
        status: "published",
        propertyId: selectedProperty._id,
        ...(searchTerm ? { search: searchTerm } : {}),
        lastSortValues: isInitial ? undefined : lastSortValues,
      });

      const newArticles = response.data;
      if (isInitial) {
        setArticlesPool(newArticles);
      } else {
        setArticlesPool(prev => {
          const existingIds = new Set(prev.map(a => a._id));
          const uniqueNew = newArticles.filter(a => !existingIds.has(a._id));
          return [...prev, ...uniqueNew];
        });
      }
      setLastSortValues(response.lastSortValues);
    } catch (error) {
      console.error("Failed to fetch articles:", error);
    } finally {
      setIsPoolFetching(false);
    }
  };

  // Reset and initial fetch when section or search changes
  useEffect(() => {
    if (selectedSection && selectedProperty?._id) {
      setArticlesPool([]);
      setLastSortValues(undefined);
      fetchArticlesPool(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection, selectedProperty?._id, searchTerm]);

  // Derived filtered articles that CAN be added (not already in priorityList)
  const availableArticles = articlesPool.filter(
    (item: any) => !priorityList.some((p) => p.id === item._id)
  );

  // Auto-refill pool when available buffer is low
  useEffect(() => {
    if (availableArticles.length < 20 && !isPoolFetching && !!lastSortValues) {
      fetchArticlesPool(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableArticles.length, isPoolFetching, lastSortValues]);

  // The actual 10 articles shown in the UI
  const storyList: StoryItem[] = selectedArticleId 
    ? (singleArticle && !priorityList.some(p => p.id === singleArticle.id) ? [singleArticle] : [])
    : availableArticles.slice(0, 10).map((item: any) => ({
    id: item._id,
    name: item.title || item.headline || item.name || "",
    url: item.url || item.fullSlug || "",
    contentType: "articles",
    contentRank: item.contentRank || 0,
    slug: item.slug || "",
    title: item.title || item.name || "",
    type: item.type,
    authors: item.authors,
    primaryCategory: item.primaryCategory,
    categories: item.categories,
    fullSlug: item.fullSlug || "",
  }));

  const handleSectionChange = (sectionId: string) => {
    // Prevent setting placeholder values
    if (sectionId === "__no-sections__") {
      return;
    }

    if (isDirty) {
      const confirmed = window.confirm("You have unsaved changes. Switching sections will lose these changes. Continue?");
      if (!confirmed) return;
    }

    setSelectedSection(sectionId);
    // Reset lists when switching section
    setPriorityList([]);
    setFixedArticleIds([]);
    setIsDirty(false);
  };

  const findStoryById = (id: UniqueIdentifier, list: StoryItem[]) => {
    const idStr = id.toString();
    const cleanId = idStr.includes("-") ? idStr.split("-")[1] : idStr;
    return list?.find((story) => story.id.toString() === cleanId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeIdStr = active.id.toString();
    const overIdStr = over.id.toString();
    const activeData = active.data.current;
    const overData = over.data.current;

    const itemId = activeIdStr.split("-")[1];

    const isOverPriorityList = overIdStr.includes("priority-list");
    const isOverStoryList = overIdStr.includes("story-list");
    const isOverItem = overIdStr.includes("item");

    // 1. Adding from Story List to Priority List
    if (activeIdStr.includes("item") && storyList.some(s => s.id === itemId)) {
      if (isOverPriorityList || (isOverItem && priorityList.some(p => p.id === overIdStr.split("-")[1]))) {
        const newItem = findStoryById(itemId, storyList);
        if (newItem && !priorityList.some(p => p.id === newItem.id)) {
          if (isOverItem) {
            const overIndex = priorityList.findIndex(p => p.id === overIdStr.split("-")[1]);
            const newList = [...priorityList];
            newList.splice(overIndex, 0, newItem);
            setPriorityList(newList);
          } else {
            setPriorityList([...priorityList, newItem]);
          }
          setIsDirty(true);
        }
      }
    }
    // 2. Removing from Priority List to Story List
    else if (activeIdStr.includes("item") && priorityList.some(p => p.id === itemId)) {
      if (isOverStoryList || (isOverItem && storyList.some(s => s.id === overIdStr.split("-")[1]))) {
        setPriorityList(priorityList.filter(p => p.id !== itemId));
        setIsDirty(true);
      }
    }

    // 3. Reordering within Priority List
    if (
      activeIdStr.includes("item") &&
      isOverItem &&
      priorityList.some(p => p.id === itemId) &&
      priorityList.some(p => p.id === overIdStr.split("-")[1])
    ) {
      const oldIndex = priorityList.findIndex(p => p.id === itemId);
      const newIndex = priorityList.findIndex(p => p.id === overIdStr.split("-")[1]);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setPriorityList(arrayMove(priorityList, oldIndex, newIndex));
        setIsDirty(true);
      }
    }

    setActiveId(null);
  };

  const findDraggedStory = () => {
    if (!activeId) return null;
    return (
      findStoryById(activeId, storyList) ||
      findStoryById(activeId, priorityList)
    );
  };

  const savePriorityList = () => {
    if (!selectedSection) {
      toast.error("Please select a section first");
      return;
    }

    const sectionConfig = sections.find((s) => s.id === selectedSection);
    const maxAllowed = sectionConfig?.count || 10;

    const topArticles = priorityList.slice(0, maxAllowed);
    const contentIds = topArticles.map((item) => item.id);

    createPriorityMutation.mutate({
      ids: contentIds as string[],
      sectionId: selectedSection,
      contentType: "articles",
    });
  };

  const handleFixArticle = (articleId: string) => {
    if (!selectedSection) {
      toast.error("Please select a section first");
      return;
    }
    const newFixedIds = [...fixedArticleIds, articleId];
    setFixedArticleIds(newFixedIds);
    updateFixedMutation.mutate({
      sectionId: selectedSection,
      fixedIds: newFixedIds,
    });
  };

  const handleUnfixArticle = (articleId: string) => {
    if (!selectedSection) {
      toast.error("Please select a section first");
      return;
    }
    const newFixedIds = fixedArticleIds.filter((id) => id !== articleId);
    setFixedArticleIds(newFixedIds);
    updateFixedMutation.mutate({
      sectionId: selectedSection,
      fixedIds: newFixedIds,
    });
  };

  const handleFixAllArticles = () => {
    if (!selectedSection) {
      toast.error("Please select a section first");
      return;
    }
    if (priorityList.length === 0) {
      toast.error("No articles in priority list to fix");
      return;
    }
    const allArticleIds = priorityList.map((item) => item.id.toString());
    const newFixedIds = Array.from(new Set([...fixedArticleIds, ...allArticleIds]));
    setFixedArticleIds(newFixedIds);
    updateFixedMutation.mutate({
      sectionId: selectedSection,
      fixedIds: newFixedIds,
    });
  };

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl md:text-2xl">Manage Content Priority</CardTitle>
        <CardDescription>
          Drag & Drop to prioritize stories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="section">Choose Section</Label>
              <Select
                value={selectedSection || ""}
                onValueChange={handleSectionChange}
              >
                <SelectTrigger id="section">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.length === 0 ? (
                    <SelectItem value="__no-sections__" disabled>
                      No sections available
                    </SelectItem>
                  ) : (
                    sections.map((section: any) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name} ({section.count})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted/50 p-3 sm:p-4 md:p-6 rounded-lg">
            {/* <div className="text-center mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-2">
                Manage Content Priority
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Drag & Drop to prioritize stories
              </p>
            </div> */}
            <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
              <DndContext
                sensors={sensors}
                collisionDetection={rectIntersection}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <ListContainer
                  id="story-list"
                  title="Articles List"
                  search={!selectedArticleId}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                >
                  {isPoolFetching && articlesPool.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6 text-sm">
                      Loading articles...
                    </p>
                  ) : (
                    <SortableContext
                      items={storyList.map((item: any) => `item-${item.id}`)}
                    >
                      <div className="flex flex-col gap-4">
                        {storyList.length === 0 ? (
                          <p className="text-muted-foreground text-center py-6 text-sm">
                            {selectedSection ? "No articles found" : "Select a section first"}
                          </p>
                        ) : (
                          storyList.map((story: any) => (
                            <StoryTile
                              key={story.id}
                              story={story}
                              id={`item-${story.id}`}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  )}
                </ListContainer>

                <ListContainer
                  id="priority-list"
                  title={`Story Priority List (${priorityList.length}/${sections.find((s) => s.id === selectedSection)?.count || 0
                    })`}
                  save={true}
                  saveFunction={savePriorityList}
                >
                  {/* {selectedSection && priorityList.length > 0 && (
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFixAllArticles}
                        className="flex items-center gap-2 h-9"
                        disabled={updateFixedMutation.isPending}
                        title="Fix all articles"
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    </div>
                  )} */}
                  {priorityList?.length > 0 ? (
                    <SortableContext
                      items={
                        priorityList?.length > 0
                          ? priorityList?.map((item: any) => `item-${item.id}`)
                          : []
                      }
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-col gap-4 sm:gap-6">
                        {priorityList?.map((story: any, index: number) => {
                          const storyId = story.id.toString();
                          // const isFixed = fixedArticleIds.includes(storyId);
                          return (
                            <div key={story.id} className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-muted rounded-full text-xs font-bold text-muted-foreground border">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <StoryTile
                                  story={story}
                                  id={`item-${story.id}`}
                                // isFixed={isFixed}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPriorityList(priorityList.filter((p) => p.id !== story.id));
                                  setIsDirty(true);
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                                title="Remove from list"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              {/* {(
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
                                  disabled={updateFixedMutation.isPending || !selectedSection}
                                  title={isFixed ? "Unfix article" : "Fix article"}
                                  className="shrink-0 h-9 w-9"
                                >
                                  {isFixed ? (
                                    <Unlock className="h-4 w-4" />
                                  ) : (
                                    <Lock className="h-4 w-4" />
                                  )}
                                </Button>
                              )} */}
                            </div>
                          );
                        })}
                      </div>
                    </SortableContext>
                  ) : (
                    <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm">
                      Choose a Section First
                    </p>
                  )}
                </ListContainer>
                <DragOverlay>
                  {activeId ? (
                    <div className="bg-muted rounded-lg p-3 border shadow-lg">
                      {findDraggedStory()?.name || "Dragging..."}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContentPriority;

