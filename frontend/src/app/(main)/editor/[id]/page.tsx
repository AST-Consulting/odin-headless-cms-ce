"use client";

import React, { useEffect, useState, useRef } from "react";
import { BlockNoteEditorComponent } from "@/components/editor/BlockNoteEditor";
import { AiAssistant } from "@/components/editor/AiAssistant";
import { MobileAiAssistant } from "@/components/editor/MobileAiAssistant";
import { EditorContextProvider } from "@/components/editor/EditorContext";
import { useEditorStore, useLayoutStore } from "@/lib/store";
import { getArticleById } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = React.use(params);
    const isAssistantCollapsed = useLayoutStore((s) => s.assistantCollapsed);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const loadedArticleId = useRef<string | null>(null);
    const { width: assistantWidth, isResizing, handleResizeStart } = useResizablePanel();

    const handleAssistantToggle = () => {
        if (isAssistantCollapsed) {
            useLayoutStore.getState().expandAssistant();
        } else {
            useLayoutStore.getState().setAssistantCollapsed(true);
        }
    };

    const {
        setBlocks,
        setSeoData,
        setTags,
        setCategories,
        setPrimaryCategory,
        setPrimaryCategorySlug,
        setArticleTitle,
        setCurrentArticleId,
        setSlug,
        setStatus,
        setAuthors,
        setImages,
        resetEditor,
        setArticleType,
        setFeaturedVideo,
        setEnglishHeadline,
        setScheduledAt,
        setWebStoryData,
        setRecipeData,
        setMovieReviewData
    } = useEditorStore();

    useEffect(() => {
        const loadArticle = async () => {
            // Prevent double loading
            if (loadedArticleId.current === unwrappedParams.id) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                // Wait for store to be ready before setting data
                const { waitForEditorHydration } = await import("@/lib/store");
                await waitForEditorHydration();

                loadedArticleId.current = unwrappedParams.id;
                // Reset editor first to ensure clean state
                resetEditor();

                const article = await getArticleById(unwrappedParams.id);

                setArticleTitle(article.title);
                setCurrentArticleId(article._id);
                useEditorStore.getState().setArticleUpdatedAt(article.updatedAt || null);
                setSlug(article.slug || "");
                setStatus(article.status);
                if (article.scheduledAt) {
                    const d = new Date(article.scheduledAt);
                    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                    setScheduledAt(local);
                }

                if (article.coverageStartTime) {
                    useEditorStore.getState().setCoverageStartTime(article.coverageStartTime);
                }
                if (article.coverageEndTime) {
                    useEditorStore.getState().setCoverageEndTime(article.coverageEndTime);
                }

                if (article.isSponsored) {
                    useEditorStore.getState().setIsSponsored(article.isSponsored);
                }
                if (article.isPremium) {
                    useEditorStore.getState().setIsPremium(article.isPremium);
                }

                // Set default author if none present
                if (!article.authors || article.authors.length === 0) {
                    const { user } = useAuthStore.getState();
                    if (user) {
                        setAuthors([{
                            id: user.id,
                            name: user.name,
                            slug: user.slug || ""
                        }]);
                    } else {
                        setAuthors([]);
                    }
                } else {
                    setAuthors(article.authors);
                }

                if (article.featuredMedia) {
                    setImages([{
                        url: article.featuredMedia.url || (article.featuredMedia as any).id,
                        id: article.featuredMedia.id || (article.featuredMedia as any)._id,
                        path: article.featuredMedia.path,
                        alt: article.featuredMedia.alt || article.title || "Featured Image",
                        caption: article.featuredMedia.caption || ""
                    }]);
                } else if (article.images && article.images.length > 0) {
                    setImages(article.images);
                } else if (article.header && article.header.includes('og:image')) {
                    // Fallback to extract image from meta tags in header
                    const match = article.header.match(/og:image" content="([^"]+)"/);
                    if (match && match[1]) {
                        setImages([{
                            url: match[1],
                            id: "meta-image",
                            alt: article.title || "Meta Image",
                            caption: "Extracted from meta tags"
                        }]);
                    }
                } else {
                    setImages([]);
                }
                
                if (article.featuredVideo) {
                    setFeaturedVideo({
                        url: article.featuredVideo.url || (article.featuredVideo as any).id,
                        id: article.featuredVideo.id || (article.featuredVideo as any)._id,
                        path: article.featuredVideo.path,
                        duration: article.featuredVideo.duration,
                        alt: article.featuredVideo.alt || article.title || "Featured Video",
                        caption: article.featuredVideo.caption || ""
                    });
                } else {
                    setFeaturedVideo(null);
                }

                if (article.richBlocks) {
                    if (article.richBlocks.length > 0) {
                        setBlocks(article.richBlocks);
                    } else {
                        console.warn('[EditArticlePage] Article has no rich blocks');
                        setBlocks([]);
                    }
                }

                // 1. Map SEO metadata (Defensive mapping for various field names)
                setSeoData({
                    title: article.metaTitle || article.seo?.title || article.title || "",
                    description: article.metaDescription || article.seo?.description || article.excerpt || ""
                });

                // 2. Map Tags (Normalize ID to _id for component compatibility)
                if (article.tags && Array.isArray(article.tags)) {
                    const tagStrings = article.tags.map((tag: any) => {
                        if (typeof tag === 'object') return tag.name || tag.title || tag.slug;
                        return tag;
                    }).filter(Boolean);
                    setTags(tagStrings);
                }

                // 3. Map Categories (Normalize ID to _id for component compatibility)
                if (article.categories && Array.isArray(article.categories)) {
                    const categoryIds = article.categories.map((cat: any) => {
                        if (typeof cat === 'object') return cat._id || cat.id;
                        return cat;
                    }).filter(Boolean);
                    setCategories(categoryIds);
                }

                // 4. Map Primary Category
                if (article.primaryCategory) {
                    const primaryCategoryId = typeof article.primaryCategory === 'object'
                        ? (article.primaryCategory._id || article.primaryCategory.id)
                        : article.primaryCategory;
                    setPrimaryCategory(primaryCategoryId);

                    if (typeof article.primaryCategory === 'object') {
                        setPrimaryCategorySlug((article.primaryCategory as any).fullSlug || (article.primaryCategory as any).slug || "");
                    }
                }

                // 5. Set article type from loaded article
                if (article.type) {
                    setArticleType(article.type);
                    if (article.type === 'web_story') {
                        if (article.webStoryData && Array.isArray(article.webStoryData.slides)) {
                            setWebStoryData({
                                slides: article.webStoryData.slides.map((s: any) => ({
                                    id: crypto.randomUUID(),
                                    templateId: s.templateId || "",
                                    templateData: s.templateData || {},
                                    duration: 7,
                                    elements: [],
                                    background: { type: 'color', content: '#000000' },
                                }))
                            });
                        } else {
                            setWebStoryData({ slides: [] });
                        }
                    }
                }

                // 6. Set English Headline
                if (article.englishHeadline) {
                    setEnglishHeadline(article.englishHeadline);
                }

                // 7. Set Recipe Data
                if (article.recipeData) {
                    setRecipeData(article.recipeData);
                }

                // 8. Set Movie Review Data
                if (article.movieReviewData) {
                    setMovieReviewData(article.movieReviewData);
                }
            } catch (error) {
                console.error("Failed to load article:", error);
                toast.error("Failed to load article");
                loadedArticleId.current = null; // Reset on error to allow retry
                router.push('/blogs');
            } finally {
                setIsLoading(false);
            }
        };


        if (unwrappedParams.id) {
            loadArticle();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unwrappedParams.id]);

    if (isLoading) {
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
                        articleId={unwrappedParams?.id}
                    />
                </div>
            </div>
            {/* Mobile AI Assistant with FAB */}
            <MobileAiAssistant />
        </EditorContextProvider>
    );
}
