"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCategories } from "@/lib/api";
import { Category } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { CategoryTable } from "@/components/tables/CategoryTable";

import { FilterBar } from "@/components/common/FilterBar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Draft filter states
    const [draftSearch, setDraftSearch] = useState("");
    const [draftSlug, setDraftSlug] = useState("");
    const [draftRank, setDraftRank] = useState("");

    // Applied filter states
    const [appliedSearch, setAppliedSearch] = useState("");
    const [appliedSlug, setAppliedSlug] = useState("");
    const [appliedRank, setAppliedRank] = useState("");

    const [cursors, setCursors] = useState<Record<number, any>>({ 0: null });

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [sort, setSort] = useState(searchParams.get("sort") || "updatedAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get("sortOrder") as "asc" | "desc") || "desc");

    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const router = useRouter();

    const hasActiveDraftFilters = draftSearch.length > 0 || draftSlug.length > 0 || draftRank.length > 0;
    const hasAppliedFilters = appliedSearch.length > 0 || appliedSlug.length > 0 || appliedRank.length > 0;

    const handleApplyFilter = () => {
        setAppliedSearch(draftSearch);
        setAppliedSlug(draftSlug);
        setAppliedRank(draftRank);
        setPage(1);
    };

    const handleClearAll = () => {
        setDraftSearch("");
        setDraftSlug("");
        setDraftRank("");
        setAppliedSearch("");
        setAppliedSlug("");
        setAppliedRank("");
        setPage(1);
    };

    const delayedRefresh = async (delayMs = 700) => {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        await fetchCategories();
    };

    const fetchCategories = useCallback(async () => {
        if (!selectedProperty?._id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let cursorToSend: any = undefined;

            if (page > 1 && cursors[page - 1]) {
                cursorToSend = cursors[page - 1];
            } else {
                cursorToSend = undefined;
            }

            const res = await getCategories({
                propertyId: selectedProperty._id,
                search: appliedSearch || undefined,
                slug: appliedSlug || undefined,
                rank: appliedRank && !isNaN(parseInt(appliedRank)) ? parseInt(appliedRank) : undefined,
                page,
                limit,
                sort,
                sortOrder,
                lastSortValues: cursorToSend,
            });
            setCategories(res.data);
            setTotal(res.total || 0);

            if (res.lastSortValues) {
                setCursors((prev) => ({
                    ...prev,
                    [page]: res.lastSortValues ?? null,
                }));
            }
        } catch (error) {
            console.error("Failed to fetch categories", error);
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, appliedSearch, appliedSlug, appliedRank, page, limit, sort, sortOrder]);

    // reset cursor when filters change
    useEffect(() => {
        setCursors({ 0: null });
        setPage(1);
    }, [appliedSearch, appliedSlug, appliedRank, selectedProperty, sort, sortOrder]);

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (appliedSearch) params.set("search", appliedSearch);
        if (appliedSlug) params.set("slug", appliedSlug);
        if (appliedRank) params.set("rank", appliedRank);
        if (sort !== "updatedAt") params.set("sort", sort);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newPath = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(newPath);
    }, [appliedSearch, appliedSlug, appliedRank, sort, sortOrder, pathname, router]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleEdit = (category: Category) => {
        router.push(`/categories/edit/${category._id}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">
                    CATEGORIES ({total})
                </h1>
                <Button onClick={() => router.push("/categories/create")} size="icon" className="rounded-full h-10 w-10">
                    <Plus className="h-6 w-6" />
                </Button>
            </div>

            <FilterBar onClear={handleClearAll} showClear={hasAppliedFilters}>
                <div className="flex flex-wrap gap-3 items-center w-full">
                    {/* Title filter */}
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Title"
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

                    {/* Slug filter */}
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Slug"
                            value={draftSlug}
                            onChange={(e) => setDraftSlug(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                            className="w-full pr-8"
                        />
                        {draftSlug && (
                            <button
                                type="button"
                                onClick={() => { setDraftSlug(""); setAppliedSlug(""); setPage(1); }}
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

            <CategoryTable
                onRefresh={delayedRefresh}
                data={categories}
                loading={loading}
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
