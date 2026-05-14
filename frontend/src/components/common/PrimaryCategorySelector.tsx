"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Combobox } from "@/components/ui/combobox";
import { getCategories, getCategoryById } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";

interface PrimaryCategorySelectorProps {
    selected: string | null;
    onChange: (selected: string | null) => void;
    onCategoryChange?: (category: any) => void;
    placeholder?: string;
    className?: string;
    propertyId?: string;
}

export function PrimaryCategorySelector({
    selected,
    onChange,
    onCategoryChange,
    placeholder = "Select primary category",
    className,
    propertyId
}: PrimaryCategorySelectorProps) {
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const activePropertyId = propertyId || selectedProperty?._id;

    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [lastSortValues, setLastSortValues] = useState<any[] | null>(null);
    const lastQuery = useRef("");

    // Use ref to access current selected items inside useCallback without triggering re-creation
    const selectedRef = useRef<string | null>(selected);
    useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    const handleSearch = useCallback(async (query: string) => {
        if (!activePropertyId) return;

        try {
            setLoading(true);
            
            // Check if search query changed
            const isNewSearch = query !== lastQuery.current;
            
            if (isNewSearch) {
                lastQuery.current = query;
                setPage(1);
                setLastSortValues(null);
            }

            const targetPage = isNewSearch ? 1 : page;
            const targetSortValues = isNewSearch ? null : lastSortValues;

            const res = await getCategories({
                propertyId: activePropertyId,
                search: query,
                page: targetPage,
                limit: 15,
                sort: 'slug',
                sortOrder: 'asc',
                lastSortValues: targetSortValues || undefined
            });

            const newCategories = res.data || [];
            
            setHasMore(newCategories.length >= 15);
            setLastSortValues(res.lastSortValues || null);

            setCategories(prev => {
                const combined = isNewSearch ? newCategories : [...prev, ...newCategories];
                
                // Keep the current selected category in the list even if it's not in the new search results
                // to maintain the label display
                const currentSelected = selectedRef.current;

                if (currentSelected) {
                    const existsInCombined = combined.some((c: any) => c._id === currentSelected);
                    if (!existsInCombined) {
                        const existingInPrev = prev.find((c: any) => c._id === currentSelected);
                        if (existingInPrev) {
                            return [existingInPrev, ...combined];
                        }
                    }
                }

                return combined;
            });
        } catch (error) {
            console.error("Failed to fetch categories", error);
        } finally {
            setLoading(false);
        }
    }, [activePropertyId]);

    // Fetch selected category when selected ID changes
    useEffect(() => {
        const fetchSelectedCategory = async () => {
            if (!selected || !activePropertyId) return;

            // Check if the selected category is already in the list
            const existsInList = categories.some((c: any) => c._id === selected);
            if (existsInList) return;

            try {
                setLoading(true);
                // Fetch the specific category by ID
                const selectedCategory = await getCategoryById(selected);

                if (selectedCategory) {
                    setCategories(prev => {
                        // Add the selected category if it's not already in the list
                        const exists = prev.some((c: any) => c._id === selected);
                        if (!exists) {
                            return [selectedCategory, ...prev];
                        }
                        return prev;
                    });
                }
            } catch (error) {
                console.error("Failed to fetch selected category", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSelectedCategory();
    }, [selected, activePropertyId, categories]);

    // Initial fetch to populate list
    useEffect(() => {
        handleSearch("");
    }, [activePropertyId]); // Only fetch on property change

    // Trigger search when page changes (pagination)
    useEffect(() => {
        if (page > 1) {
            handleSearch(lastQuery.current);
        }
    }, [page]);

    // Format options for Combobox using _id as value
    // Ensure uniqueness by id
    const uniqueCategories = Array.from(new Map(categories.map(cat => [cat._id, cat])).values())
        .sort((a, b) => (a.slug || "").localeCompare(b.slug || ""));

    const options = uniqueCategories.map(cat => ({
        value: cat._id, // Use _id as value for API compatibility
        label: cat.title
    }));

    return (
        <Combobox
            options={options}
            value={selected || undefined}
            onChange={(val) => {
                onChange(val);
                if (onCategoryChange) {
                    const category = categories.find(c => c._id === val);
                    onCategoryChange(category || null);
                }
            }}
            placeholder={loading && categories.length === 0 ? "Loading..." : placeholder}
            searchPlaceholder="Search categories..."
            className={className}
            onSearch={handleSearch}
            footer={
                hasMore && (
                    <button
                        type="button"
                        className="w-full text-xs text-primary hover:underline py-1 text-center"
                        onClick={(e) => {
                            e.stopPropagation();
                            setPage(prev => prev + 1);
                        }}
                        disabled={loading}
                    >
                        {loading ? "Loading..." : "Load More"}
                    </button>
                )
            }
        />
    );
}
