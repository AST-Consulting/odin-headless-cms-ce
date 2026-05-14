"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { getCategories } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CategoryNameSelectorProps {
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
    propertyId?: string;
    compact?: boolean;
    maxDisplayed?: number;
}

export function CategoryNameSelector({
    selected,
    onChange,
    placeholder = "Select categories",
    className,
    propertyId,
    compact,
    maxDisplayed
}: CategoryNameSelectorProps) {
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const activePropertyId = propertyId || selectedProperty?._id;

    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [lastSortValues, setLastSortValues] = useState<any[] | null>(null);
    const lastQuery = useRef("");

    // Use ref to access current selected items inside useCallback without triggering re-creation
    const selectedRef = (useRef<string[]>(selected));
    useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    const handleSearch = useCallback(async (query: string) => {
        if (!activePropertyId) return;

        try {
            setLoading(true);
            
            const isNewSearch = query !== lastQuery.current;
            
            if (isNewSearch) {
                lastQuery.current = query;
                setPage(1);
                setLastSortValues(null);
            }

            const targetPage = isNewSearch ? 1 : page;
            const targetSortValues = isNewSearch ? null : lastSortValues;

            // Fetch categories with alphabetical sorting
            const params = {
                propertyId: activePropertyId,
                search: query,
                page: targetPage,
                limit: 15,
                sort: 'slug',
                sortOrder: 'asc' as const,
                lastSortValues: targetSortValues || undefined
            };

            const res = await getCategories(params);
            const newCategories = res.data || [];
            
            setHasMore(newCategories.length >= 15);
            setLastSortValues(res.lastSortValues || null);

            setCategories(prev => {
                const combined = isNewSearch ? newCategories : [...prev, ...newCategories];
                
                // Keep selected categories (by ID) even if not in response
                const selectedIds = new Set(selectedRef.current);
                const resultsIds = new Set(combined.map((c: any) => c._id || c.id));
                const keptFromPrev = prev.filter((c: any) => 
                    (selectedIds.has(c._id) || selectedIds.has(c.id)) && !resultsIds.has(c._id || c.id)
                );

                const totalCombined = [...keptFromPrev, ...combined];

                // De-duplicate by ID
                const uniqueMap = new Map();
                totalCombined.forEach(cat => {
                    const id = cat._id || cat.id;
                    if (!uniqueMap.has(id)) {
                        uniqueMap.set(id, cat);
                    }
                });
                return Array.from(uniqueMap.values());
            });
        } catch (error) {
            console.error("Failed to fetch categories", error);
        } finally {
            setLoading(false);
        }
    }, [activePropertyId, page]);

    const handleLoadMore = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setPage(prev => prev + 1);
    };

    // Trigger search when page changes (pagination)
    useEffect(() => {
        if (page > 1) {
            handleSearch(lastQuery.current);
        }
    }, [page]); // Only depend on page to avoid re-fetch on selection change

    // Initial fetch for selected categories to ensure labels are visible
    useEffect(() => {
        const fetchInitialCategories = async () => {
            if (!selected || selected.length === 0 || !activePropertyId) return;

            // Check if we already have all selected categories in the list
            const currentIds = new Set(categories.map(c => c._id || c.id));
            const missingIds = selected.filter(id => !currentIds.has(id));

            if (missingIds.length === 0) return;

            try {
                // Since there's no "getMultipleCategoriesByIds" we fetch them individually
                // or use the getCategories with search if possible, but getCategoryById is safer
                const { getCategoryById } = await import("@/lib/api");
                const fetched = await Promise.all(
                    missingIds.map(id => getCategoryById(id).catch(() => null))
                );

                const validFetched = fetched.filter(Boolean);
                if (validFetched.length > 0) {
                    setCategories(prev => {
                        const prevIds = new Set(prev.map(c => c._id || c.id));
                        const brandNew = validFetched.filter((c: any) => !prevIds.has(c._id || c.id));
                        return [...prev, ...brandNew];
                    });
                }
            } catch (error) {
                console.error("Failed to fetch initial categories", error);
            }
        };

        fetchInitialCategories();
        // Only run once or when selected IDs change significantly
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePropertyId]);

    // Format options for MultiSelect using ID as value
    // Ensure uniqueness by ID
    const uniqueCategories = Array.from(new Map(categories.map(cat => [cat._id || cat.id, cat])).values())
        .sort((a, b) => (a.slug || "").localeCompare(b.slug || ""));

    const options = uniqueCategories.map(cat => ({
        value: cat._id || cat.id, // Use ID as value
        label: cat.title
    }));

    // Pass loading state to placeholder if needed
    const displayPlaceholder = loading && categories.length === 0 ? "Loading..." : placeholder;

    return (
        <MultiSelect
            options={options}
            selected={selected}
            onChange={onChange}
            placeholder={displayPlaceholder}
            className={className}
            onSearch={handleSearch}
            compact={compact}
            maxDisplayed={maxDisplayed}
            footer={hasMore && (
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-primary hover:bg-primary/10 h-9"
                    onClick={handleLoadMore}
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        "Load More Categories"
                    )}
                </Button>
            )}
        />
    );
}
