"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTags } from "@/lib/api";
import { Tag } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";

import { TagTable } from "@/components/tables/TagTable";
import { FilterBar } from "@/components/common/FilterBar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function TagsPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);

    // Draft filter states
    const [draftSearch, setDraftSearch] = useState("");
    const [draftDescription, setDraftDescription] = useState("");
    const [draftRank, setDraftRank] = useState("");

    // Applied filter states
    const [appliedSearch, setAppliedSearch] = useState("");
    const [appliedDescription, setAppliedDescription] = useState("");
    const [appliedRank, setAppliedRank] = useState("");

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [cursors, setCursors] = useState<Record<number, any>>({ 0: null });
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [sort, setSort] = useState(searchParams.get("sort") || "updatedAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get("sortOrder") as "asc" | "desc") || "desc");

    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const router = useRouter();

    const hasActiveDraftFilters = draftSearch.length > 0 || draftDescription.length > 0 || draftRank.length > 0;
    const hasAppliedFilters = appliedSearch.length > 0 || appliedDescription.length > 0 || appliedRank.length > 0;

    const handleApplyFilter = () => {
        setAppliedSearch(draftSearch);
        setAppliedDescription(draftDescription);
        setAppliedRank(draftRank);
        setPage(1);
    };

    const handleClearAll = () => {
        setDraftSearch("");
        setDraftDescription("");
        setDraftRank("");
        setAppliedSearch("");
        setAppliedDescription("");
        setAppliedRank("");
        setPage(1);
    };

    const delayedRefresh = async (delayMs = 700) => {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        fetchTags();
    };

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (appliedSearch) params.set("search", appliedSearch);
        if (appliedDescription) params.set("description", appliedDescription);
        if (appliedRank) params.set("rank", appliedRank);
        if (sort !== "updatedAt") params.set("sort", sort);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newPath = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(newPath);
    }, [appliedSearch, appliedDescription, appliedRank, sort, sortOrder, pathname, router]);

    // Reset cursors on filter/limit/sort changes
    useEffect(() => {
        setCursors({ 0: null });
        setPage(1);
    }, [appliedSearch, appliedDescription, appliedRank, selectedProperty, limit, sort, sortOrder]);

    const fetchTags = useCallback(async () => {
        if (!selectedProperty?._id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let cursorToSend: any = undefined;

            // if sequential pagination is used
            if (page > 1 && cursors[page - 1]) {
                cursorToSend = cursors[page - 1];
            } else {
                // random jump -> reset cursors
                cursorToSend = undefined;
            }
            const res = await getTags({
                propertyId: selectedProperty._id,
                search: appliedSearch || undefined,
                description: appliedDescription || undefined,
                rank: appliedRank && !isNaN(parseInt(appliedRank)) ? parseInt(appliedRank) : undefined,
                page,
                limit,
                sort,
                sortOrder,
                lastSortValues: cursorToSend,
            });
            setTags(res.data);
            setTotal(res.total || 0);

            if (res.lastSortValues) {
                setCursors(prev => ({
                    ...prev,
                    [page]: res.lastSortValues ?? null
                }));
            }
        } catch (error) {
            console.error("Failed to fetch tags", error);
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, appliedSearch, appliedDescription, appliedRank, page, limit, sort, sortOrder]);

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    const handleEdit = (tag: Tag) => {
        router.push(`/tags/edit/${tag._id}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">
                    TAGS ({total})
                </h1>
                <Button onClick={() => router.push("/tags/create")} size="icon" className="rounded-full h-10 w-10">
                    <Plus className="h-6 w-6" />
                </Button>
            </div>

            <FilterBar onClear={handleClearAll} showClear={hasAppliedFilters}>
                <div className="flex flex-wrap gap-3 items-center w-full">
                    {/* Tag Name filter */}
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Tag Name"
                            value={draftSearch}
                            onChange={(e) => setDraftSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                            className="w-full pr-8"
                        />
                        {draftSearch && (
                            <button
                                type="button"
                                onClick={() => { setDraftSearch(""); setAppliedSearch(""); setPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Description filter */}
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Description"
                            value={draftDescription}
                            onChange={(e) => setDraftDescription(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                            className="w-full pr-8"
                        />
                        {draftDescription && (
                            <button
                                type="button"
                                onClick={() => { setDraftDescription(""); setAppliedDescription(""); setPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Rank filter */}
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Rank"
                            type="number"
                            value={draftRank}
                            onChange={(e) => setDraftRank(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                            className="w-full pr-8"
                        />
                        {draftRank && (
                            <button
                                type="button"
                                onClick={() => { setDraftRank(""); setAppliedRank(""); setPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <Button
                        onClick={handleApplyFilter}
                        size="sm"
                        className="h-10 px-4 gap-2"
                        disabled={!hasActiveDraftFilters && !hasAppliedFilters}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Apply Filter
                    </Button>

                    {hasAppliedFilters && (
                        <Button
                            variant="ghost"
                            onClick={handleClearAll}
                            size="sm"
                            className="h-10 text-muted-foreground hover:text-foreground gap-1"
                        >
                            <X className="h-4 w-4" />
                            Clear All
                        </Button>
                    )}
                </div>
            </FilterBar>

            <TagTable
                data={tags}
                loading={loading}
                onRefresh={delayedRefresh}
                onEdit={handleEdit}
                page={page}
                limit={limit}
                total={total}
                onPageChange={setPage}
                onLimitChange={setLimit}
                sort={sort}
                sortOrder={sortOrder}
                onSort={(newSort, newOrder) => {
                    setSort(newSort);
                    setSortOrder(newOrder);
                }}
            />
        </div>
    );
}
