"use client";

import { useState, useCallback } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { getTags } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";

interface TagSelectorProps {
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
    propertyId?: string;
}

export function TagSelector({
    selected,
    onChange,
    placeholder = "Select tags",
    className,
    propertyId
}: TagSelectorProps) {
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const activePropertyId = propertyId || selectedProperty?._id;

    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = useCallback(async (query: string) => {
        if (!activePropertyId) return;

        try {
            setLoading(true);
            const res = await getTags({
                propertyId: activePropertyId,
                search: query,
                limit: 15
            });

            const newTags = res.data || [];

            setTags(prev => {
                // Keep selected tags that are not in the new results to preserve their labels
                const selectedIds = new Set(selected);
                const newIds = new Set(newTags.map((t: any) => t._id));
                const keptTags = prev.filter((t: any) => selectedIds.has(t._id) && !newIds.has(t._id));
                return [...keptTags, ...newTags];
            });
        } catch (error) {
            console.error("Failed to fetch tags", error);
        } finally {
            setLoading(false);
        }
    }, [activePropertyId, selected]);


    // Format options for MultiSelect
    const options = tags.map(tag => ({
        value: tag._id,
        label: tag.name
    }));

    const displayPlaceholder = loading && tags.length === 0 ? "Loading..." : placeholder;

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
