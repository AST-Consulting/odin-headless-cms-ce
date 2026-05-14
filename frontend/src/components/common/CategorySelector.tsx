"use client";

import { useState, useCallback } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { getCategories } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";

interface CategorySelectorProps {
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
    propertyId?: string;
}

export function CategorySelector({
    selected,
    onChange,
    placeholder = "Select categories",
    className,
    propertyId
}: CategorySelectorProps) {
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const activePropertyId = propertyId || selectedProperty?._id;

    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = useCallback(async (query: string) => {
        if (!activePropertyId) return;

        try {
            setLoading(true);
            const res = await getCategories({
                propertyId: activePropertyId,
                search: query,
                limit: 15
            });

            const newCategories = res.data || [];

            setCategories(prev => {
                // Keep selected categories that are not in the new results to preserve their labels
                const selectedIds = new Set(selected);
                const newIds = new Set(newCategories.map((c: any) => c._id));
                const keptCategories = prev.filter((c: any) => selectedIds.has(c._id) && !newIds.has(c._id));
                return [...keptCategories, ...newCategories];
            });
        } catch (error) {
            console.error("Failed to fetch categories", error);
        } finally {
            setLoading(false);
        }
    }, [activePropertyId, selected]);


    // Format options for MultiSelect
    const options = categories.map(cat => ({
        value: cat._id,
        label: cat.title
    }));

    // Pass loading state to placeholder if needed, or handle externally
    const displayPlaceholder = loading && categories.length === 0 ? "Loading..." : placeholder;

    return (
        <MultiSelect
            options={options}
            selected={selected}
            onChange={onChange}
            placeholder={displayPlaceholder}
            className={className}
            onSearch={handleSearch}
        />
    );
}
