"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Combobox } from "@/components/ui/combobox";
import { getAuthors } from "@/lib/api";
import { AuthorStub } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AuthorSelectorProps {
    selected: AuthorStub[];
    onChange: (selected: AuthorStub[]) => void;
    placeholder?: string;
    className?: string;
    propertyId?: string;
}

export function AuthorSelector({
    selected,
    onChange,
    placeholder = "Select author",
    className,
    propertyId,
}: AuthorSelectorProps) {
    const getSafeId = (author: any) => {
        if (!author) return "";
        if (typeof author === 'string') return author;
        const idVal = author._id || author.id;
        if (typeof idVal === 'string') return idVal;
        if (idVal && typeof idVal === 'object' && '$oid' in idVal) return idVal.$oid;
        return idVal || "";
    };

    const [authors, setAuthors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [lastSortValues, setLastSortValues] = useState<any[] | null>(null);
    const lastQuery = useRef("");

    // Get the single selected author from the array
    const selectedAuthor = selected.length > 0 ? selected[0] : null;

    // Initial load or sync selected author to internal state to ensure it shows up in options
    useEffect(() => {
        if (selectedAuthor && selectedAuthor.id) {
            setAuthors(prev => {
                const prevIds = new Set(prev.map(a => getSafeId(a)));
                if (!prevIds.has(getSafeId(selectedAuthor.id))) {
                    return [...prev, {
                        _id: selectedAuthor.id,
                        name: selectedAuthor.name,
                        slug: selectedAuthor.slug,
                        profileUrl: selectedAuthor.profileUrl
                    }];
                }
                return prev;
            });
        }
    }, [selectedAuthor]);

    const handleSearch = useCallback(async (query: string) => {
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

            const res = await getAuthors({
                search: query,
                page: targetPage,
                limit: 15,
                sort: 'slug',
                sortOrder: 'asc',
                propertyId,
                lastSortValues: targetSortValues || undefined
            });

            const newAuthors = res.data || [];
            setHasMore(newAuthors.length >= 15);
            setLastSortValues(res.lastSortValues || null);

            setAuthors(prev => {
                const combined = isNewSearch ? newAuthors : [...prev, ...newAuthors];
                
                // Deduplicate by name to handle cases where same author has multiple IDs
                const authorMap = new Map();
                const currentSelectedId = selectedAuthor?.id ? getSafeId(selectedAuthor.id) : null;

                combined.forEach(a => {
                    const id = getSafeId(a);
                    const name = a.name || a.email || "Unknown";
                    
                    // Prefer the already selected ID if there are name collisions
                    if (!authorMap.has(name) || id === currentSelectedId) {
                        authorMap.set(name, a);
                    }
                });

                return Array.from(authorMap.values());
            });
        } catch (error) {
            console.error("Failed to fetch authors", error);
        } finally {
            setLoading(false);
        }
    }, [selectedAuthor, page, propertyId]);

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

    // Format options for Combobox and deduplicate
    // Ensure uniqueness by ID to avoid key collisions
    const uniqueAuthors = Array.from(new Map(authors.map(a => [getSafeId(a), a])).values())
        .sort((a, b) => (a.slug || "").localeCompare(b.slug || ""));

    const options = uniqueAuthors.map(author => ({
        value: getSafeId(author),
        label: author.name || author.email || "Unknown"
    }));

    // Handle change from Combobox (which returns string | null)
    const handleChange = (selectedId: string | null) => {
        if (!selectedId) {
            onChange([]);
            return;
        }

        // Map selected ID back to AuthorStub object and put it in an array (single item)
        const author = authors.find(a => getSafeId(a) === selectedId);
        if (author) {
            onChange([{
                id: getSafeId(author),
                name: author.name || author.email || "Unknown",
                slug: author.slug,
                profileUrl: author.profileUrl
            }]);
        } else if (selectedAuthor && getSafeId(selectedAuthor.id) === selectedId) {
            // Keep existing selection if it matches
            onChange([selectedAuthor]);
        } else {
            // Fallback for unknown author
            onChange([{
                id: selectedId,
                name: "Unknown"
            }]);
        }
    };

    const displayPlaceholder = loading && authors.length === 0 ? "Loading..." : placeholder;

    return (
        <Combobox
            options={options}
            value={selectedAuthor ? getSafeId(selectedAuthor.id) : undefined}
            onChange={handleChange}
            placeholder={displayPlaceholder}
            className={className}
            onSearch={handleSearch}
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
                        "Load More Authors"
                    )}
                </Button>
            )}
        />
    );
}
