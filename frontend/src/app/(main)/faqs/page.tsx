"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFAQs, getCategories } from "@/lib/api";
import { FAQ, Category } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { FAQTable } from "@/components/tables/FAQTable";
import { FilterBar } from "@/components/common/FilterBar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function FAQsPage() {
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Draft filter states
    const [draftSearch, setDraftSearch] = useState("");
    const [draftRank, setDraftRank] = useState("");
    const [draftCategory, setDraftCategory] = useState<string>("all");

    // Applied filter states
    const [appliedSearch, setAppliedSearch] = useState("");
    const [appliedRank, setAppliedRank] = useState("");
    const [appliedCategory, setAppliedCategory] = useState<string>("all");

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

    const hasActiveDraftFilters = draftSearch.length > 0 || draftRank.length > 0 || draftCategory !== "all";
    const hasAppliedFilters = appliedSearch.length > 0 || appliedRank.length > 0 || appliedCategory !== "all";

    const handleApplyFilter = () => {
        setAppliedSearch(draftSearch);
        setAppliedRank(draftRank);
        setAppliedCategory(draftCategory);
        setPage(1);
    };

    const handleClearAll = () => {
        setDraftSearch("");
        setDraftRank("");
        setDraftCategory("all");
        setAppliedSearch("");
        setAppliedRank("");
        setAppliedCategory("all");
        setPage(1);
    };

    const delayedRefresh = async (delayMs = 700) => {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        fetchFAQs();
    };

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (appliedSearch) params.set("search", appliedSearch);
        if (appliedRank) params.set("rank", appliedRank);
        if (appliedCategory !== "all") params.set("categoryId", appliedCategory);
        if (sort !== "updatedAt") params.set("sort", sort);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newPath = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(newPath);
    }, [appliedSearch, appliedRank, appliedCategory, sort, sortOrder, pathname, router]);

    // Reset cursors on filter/limit/sort changes
    useEffect(() => {
        setCursors({ 0: null });
        setPage(1);
    }, [appliedSearch, appliedRank, appliedCategory, limit, selectedProperty, sort, sortOrder]);

    const fetchCategories = useCallback(async () => {
        if (!selectedProperty?._id) {
            setLoading(false);
            return;
        }
        try {
            const res = await getCategories({ propertyId: selectedProperty._id, limit: 100 });
            setCategories(res.data);
        } catch (error) {
            console.error("Failed to fetch categories", error);
        }
    }, [selectedProperty]);

    const fetchFAQs = useCallback(async () => {
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

            const res = await getFAQs({
                propertyId: selectedProperty._id,
                search: appliedSearch || undefined,
                rank: appliedRank && !isNaN(parseInt(appliedRank)) ? parseInt(appliedRank) : undefined,
                categoryId: appliedCategory !== "all" ? appliedCategory : undefined,
                page,
                limit,
                sort,
                sortOrder,
                lastSortValues: cursorToSend,
            });
            setFaqs(res.data);
            setTotal(res.total || 0);

            if (res.lastSortValues) {
                setCursors(prev => ({
                    ...prev,
                    [page]: res.lastSortValues ?? null
                }));
            }
        } catch (error) {
            console.error("Failed to fetch FAQs", error);
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, appliedSearch, appliedRank, appliedCategory, page, limit, sort, sortOrder]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetchFAQs();
    }, [fetchFAQs]);

    const handleEdit = (faq: FAQ) => {
        router.push(`/faqs/edit/${faq._id}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">
                    FAQS ({total})
                </h1>
                <Button onClick={() => router.push("/faqs/create")} size="icon" className="rounded-full h-10 w-10">
                    <Plus className="h-6 w-6" />
                </Button>
            </div>

            <FilterBar onClear={handleClearAll} showClear={hasAppliedFilters}>
                <div className="flex flex-wrap gap-3 items-center w-full">
                    {/* Question filter */}
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Question"
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

                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Select
                            value={draftCategory}
                            onValueChange={(value) => setDraftCategory(value)}
                        >
                            <SelectTrigger className="w-full pr-10">
                                <SelectValue placeholder="Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map((category) => (
                                    <SelectItem key={category._id} value={category._id}>
                                        {category.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {draftCategory !== "all" && (
                            <button
                                type="button"
                                onClick={() => { setDraftCategory("all"); setAppliedCategory("all"); setPage(1); }}
                                className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
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

            <FAQTable
                data={faqs}
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
