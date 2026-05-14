"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPolls } from "@/lib/api";
import { Poll } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { PollTable } from "@/components/tables/PollTable";
import { FilterBar } from "@/components/common/FilterBar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function PollsPage() {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);

    // Draft filter states
    const [draftSearch, setDraftSearch] = useState("");
    const [draftStatus, setDraftStatus] = useState<string>("all");

    // Applied filter states
    const [appliedSearch, setAppliedSearch] = useState("");
    const [appliedStatus, setAppliedStatus] = useState<string>("all");

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [sort, setSort] = useState(searchParams.get("sort") || "createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get("sortOrder") as "asc" | "desc") || "desc");

    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const router = useRouter();

    const hasActiveDraftFilters = draftSearch.length > 0 || draftStatus !== "all";
    const hasAppliedFilters = appliedSearch.length > 0 || appliedStatus !== "all";

    const handleApplyFilter = () => {
        setAppliedSearch(draftSearch);
        setAppliedStatus(draftStatus);
        setPage(1);
    };

    const handleClearAll = () => {
        setDraftSearch("");
        setDraftStatus("all");
        setAppliedSearch("");
        setAppliedStatus("all");
        setPage(1);
    };

    const fetchPolls = useCallback(async () => {
        if (!selectedProperty?._id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await getPolls({
                propertyId: selectedProperty._id,
                search: appliedSearch || undefined,
                status: appliedStatus !== "all" ? appliedStatus : undefined,
                page,
                limit,
                sort,
                sortOrder,
            });
            const rawRes = res as any;
            let pollsList: Poll[] = [];
            let totalCount = 0;

            if (Array.isArray(rawRes)) {
                pollsList = rawRes;
                totalCount = rawRes.length;
            } else if (rawRes && Array.isArray(rawRes.data)) {
                pollsList = rawRes.data;
                totalCount = rawRes.total !== undefined ? rawRes.total : rawRes.data.length;
            } else if (rawRes && rawRes.data && Array.isArray(rawRes.data.data)) {
                pollsList = rawRes.data.data;
                totalCount = rawRes.data.total !== undefined ? rawRes.data.total : rawRes.data.data.length;
            }

            setPolls(pollsList);
            setTotal(totalCount);
        } catch (error) {
            console.error("Failed to fetch polls", error);
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, appliedSearch, appliedStatus, page, limit, sort, sortOrder]);

    const delayedRefresh = async (delayMs = 500) => {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        fetchPolls();
    };

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (appliedSearch) params.set("search", appliedSearch);
        if (appliedStatus !== "all") params.set("status", appliedStatus);
        if (sort !== "createdAt") params.set("sort", sort);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newPath = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(newPath);
    }, [appliedSearch, appliedStatus, sort, sortOrder, pathname, router]);

    useEffect(() => {
        fetchPolls();
    }, [fetchPolls]);

    const handleEdit = (poll: Poll) => {
        router.push(`/polls/edit/${poll._id}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">
                    Polls ({total})
                </h1>
                <Button onClick={() => router.push("/polls/create")} size="icon" className="rounded-full h-10 w-10">
                    <Plus className="h-6 w-6" />
                </Button>
            </div>

            <FilterBar onClear={handleClearAll} showClear={hasAppliedFilters}>
                <div className="flex flex-wrap gap-3 items-center w-full">
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Search Polls..."
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

            <PollTable
                data={polls}
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
