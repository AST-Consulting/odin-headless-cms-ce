"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Loader2, ArrowRight } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetHeader,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { getArticles } from "@/lib/api";
import { Article } from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";
import { usePropertyStore } from "@/lib/store";

interface ArticleSearchPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ArticleSearchPalette({ open, onOpenChange }: ArticleSearchPaletteProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const debouncedSearch = useDebounce(search, 300);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Swipe to dismiss state (for mobile)
    const touchStartY = useRef<number>(0);
    const touchCurrentY = useRef<number>(0);

    // Check if mobile on mount
    useEffect(() => {
        setMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768); // md breakpoint
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fetch articles when search term changes
    useEffect(() => {
        const fetchArticles = async () => {
            if (!debouncedSearch.trim()) {
                setArticles([]);
                return;
            }
            if (!selectedProperty) return;
            try {
                setLoading(true);
                const result = await getArticles({
                    page: 1,
                    limit: 10,
                    search: debouncedSearch,
                    sort: 'updatedAt',
                    sortOrder: 'desc',
                    fields: '_id,title,status,type,updatedAt,slug',
                    propertyId: selectedProperty._id,
                });
                setArticles(result.data);
                setSelectedIndex(0);
            } catch (error) {
                console.error("Failed to search articles:", error);
                setArticles([]);
            } finally {
                setLoading(false);
            }
        };

        fetchArticles();
    }, [debouncedSearch, selectedProperty]);

    // Handle keyboard navigation
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, articles.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" && articles[selectedIndex]) {
                e.preventDefault();
                handleSelectArticle(articles[selectedIndex]);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, articles, selectedIndex]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setSearch("");
            setArticles([]);
            setSelectedIndex(0);
        }
    }, [open]);

    // Swipe handlers (for mobile)
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
                onOpenChange(false);
            } else {
                // Reset position
                sheetRef.current.style.transform = 'translateY(0)';
            }
        }
    }, [onOpenChange]);

    const handleSelectArticle = (article: Article) => {
        onOpenChange(false);
        router.push(`/editor/${article._id}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "published":
                return "text-green-600 bg-green-50 dark:bg-green-900/20";
            case "draft":
                return "text-gray-600 bg-gray-50 dark:bg-gray-900/20";
            case "review":
                return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20";
            case "scheduled":
                return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
            default:
                return "text-gray-600 bg-gray-50 dark:bg-gray-900/20";
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return '';
        }
    };

    // Shared content component
    const SearchContent = () => (
        <>
            <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : !search.trim() ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Search className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm">Start typing to search articles...</p>
                        <p className="text-xs mt-1">Use ↑↓ arrows to navigate, Enter to select</p>
                    </div>
                ) : articles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileText className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm">No articles found</p>
                        <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                ) : (
                    <div className="py-2">
                        {articles.map((article, index) => (
                            <button
                                key={article._id}
                                onClick={() => handleSelectArticle(article)}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-accent transition-colors ${index === selectedIndex ? "bg-accent" : ""
                                    }`}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 text-left overflow-hidden">
                                    <div className="font-medium truncate">{article.title}</div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                        <span className={`px-2 py-0.5 rounded-full ${getStatusColor(article.status)}`}>
                                            {article.status}
                                        </span>
                                        {article.type && (
                                            <span className="capitalize">{article.type.replace('_', ' ')}</span>
                                        )}
                                        {article.updatedAt && (
                                            <>
                                                <span>•</span>
                                                <span>{formatDate(article.updatedAt)}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                    <span>Press ESC to close</span>
                    <span>⌘K to reopen</span>
                </div>
            </div>
        </>
    );

    if (!mounted) {
        return null;
    }

    // Desktop: Use Dialog (centered modal)
    if (!isMobile) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-4 py-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search articles..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                autoFocus
                            />
                        </div>
                    </DialogHeader>
                    <SearchContent />
                </DialogContent>
            </Dialog>
        );
    }

    // Mobile: Use Sheet (bottom drawer)
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
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

                {/* Search Header */}
                <SheetHeader className="px-4 py-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search articles..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            autoFocus
                        />
                    </div>
                </SheetHeader>

                <SearchContent />
            </SheetContent>
        </Sheet>
    );
}
