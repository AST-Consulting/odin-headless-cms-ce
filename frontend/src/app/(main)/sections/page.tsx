"use client";

import { useState, useEffect } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getAllSections } from "@/lib/api";
import { SectionsTable } from "@/components/tables/SectionsTable";
import { useQuery } from "@tanstack/react-query";
import { usePropertyStore } from "@/lib/store";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterBar } from "@/components/common/FilterBar";
import { useCallback } from "react";

interface Section {
    _id: string;
    title: string;
    status?: string;
    rank?: number;
    createdBy: {
        name: string;
        userType: string;
    };
    updatedBy: {
        name: string;
        userType: string;
    };
    createdAt: string;
    updatedAt: string;
}

export default function SectionsPage() {
    // Draft filter states
    // Draft filter states
    const [draftSearch, setDraftSearch] = useState("");

    // Applied filter states
    const [appliedSearch, setAppliedSearch] = useState("");

    const [isRefreshing, setIsRefreshing] = useState(false);
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

    const hasActiveDraftFilters = draftSearch.length > 0;
    const hasAppliedFilters = appliedSearch.length > 0;

    const handleApplyFilter = () => {
        setAppliedSearch(draftSearch);
        setPage(1);
    };

    const handleClearAll = () => {
        setDraftSearch("");
        setAppliedSearch("");
        setPage(1);
    };

    const delayedRefresh = async (delayMs = 700) => {
        setIsRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        await refetch();
        setIsRefreshing(false);
    };

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (appliedSearch) params.set("search", appliedSearch);
        if (sort !== "updatedAt") params.set("sort", sort);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newPath = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(newPath);
    }, [appliedSearch, sort, sortOrder, pathname, router]);

    // Reset cursors on filter/limit/sort changes
    useEffect(() => {
        setCursors({ 0: null });
        setPage(1);
    }, [appliedSearch, limit, selectedProperty, sort, sortOrder]);

    // filtering according to property
    const { data: sectionsData, isLoading, refetch } = useQuery({
        queryKey: ["sections", appliedSearch, selectedProperty?._id, page, limit, sort, sortOrder],
        queryFn: () => getAllSections({
            propertyId: selectedProperty?._id,
            page,
            limit,
            sort,
            sortOrder,
            lastSortValues: (page > 1 && cursors[page - 1]) ? cursors[page - 1] : undefined,
        }),
        enabled: !!selectedProperty, // Only fetch when property is selected
    });

    // Update cursors when data changes
    useEffect(() => {
        if (sectionsData?.lastSortValues) {
            setCursors(prev => ({
                ...prev,
                [page]: sectionsData.lastSortValues ?? null
            }));
        }
        if (sectionsData?.total !== undefined) {
            setTotal(sectionsData.total);
        }
    }, [sectionsData, page]);

    // Extract sections from API response
    const sections = Array.isArray(sectionsData?.data) ? sectionsData.data : [];

    const handleEdit = (section: Section) => {
        router.push(`/sections/edit/${section._id}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">
                    SECTIONS ({total})
                </h1>
                <Button
                    onClick={() => router.push("/sections/create")}
                    size="icon"
                    className="rounded-full h-10 w-10"
                >
                    <Plus className="h-6 w-6" />
                </Button>
            </div>

            <FilterBar onClear={handleClearAll} showClear={hasAppliedFilters}>
                <div className="flex flex-wrap gap-3 items-center w-full">
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Search by title"
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

            <SectionsTable
                data={sections}
                loading={isLoading || isRefreshing}
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
