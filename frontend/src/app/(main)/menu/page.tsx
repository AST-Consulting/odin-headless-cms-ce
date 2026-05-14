'use client'

import { getMenus } from '@/lib/api'
import type { Menu } from '@/lib/types'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, SlidersHorizontal, X } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { MenuTable } from '@/components/tables/MenuTable'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePropertyStore } from '@/lib/store'

const MenuComponent = () => {
    const router = useRouter()
    const [menus, setMenus] = useState<Menu[]>([])
    const [isLoading, setIsLoading] = useState(true)
    
    // Draft filter state
    const [draftSearchTitle, setDraftSearchTitle] = useState("")
    const [draftStatus, setDraftStatus] = useState<string>("all")

    // Applied filter state
    const [appliedSearchTitle, setAppliedSearchTitle] = useState("")
    const [appliedStatus, setAppliedStatus] = useState<string>("all")

    const hasActiveDraftFilters = draftSearchTitle.length > 0 || draftStatus !== "all";
    const hasAppliedFilters = appliedSearchTitle.length > 0 || appliedStatus !== "all";

    const handleApplyFilter = () => {
        setAppliedSearchTitle(draftSearchTitle);
        setAppliedStatus(draftStatus);
        setPage(1);
        setCursors({ 0: null });
    };

    const handleClearAll = () => {
        setDraftSearchTitle("");
        setDraftStatus("all");
        setAppliedSearchTitle("");
        setAppliedStatus("all");
        setPage(1);
        setCursors({ 0: null });
    };

    const selectedProperty = usePropertyStore((state) => state.selectedProperty)

    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [total, setTotal] = useState(0)
    const [cursors, setCursors] = useState<Record<number, any>>({ 0: null });
    const [sort, setSort] = useState(searchParams.get("sort") || "createdAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get("sortOrder") as "asc" | "desc") || "desc");

    const onSort = (newSort: string, order: "asc" | "desc") => {
        setSort(newSort);
        setSortOrder(order);
        setPage(1);
        setCursors({ 0: null });
    };

    const delayedRefresh = async (delayMs = 700) => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        loadMenus();
    }

    const loadMenus = useCallback(async () => {
        if (!selectedProperty?._id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true)
        try {
            let cursorToSend: any = undefined;

            // if sequential pagination is used
            if (page > 1 && cursors[page - 1]) {
                cursorToSend = cursors[page - 1];
            } else {
                //random jump -> reset cursors
                cursorToSend = undefined;

            }
            const params: any = {
                propertyId: selectedProperty._id,
                page,
                limit,
                lastSortValues: cursorToSend,
                sort,
                sortOrder
            }
            if (appliedStatus !== "all") {
                params.status = appliedStatus
            }
            if (appliedSearchTitle) {
                params.search = appliedSearchTitle
            }

            const response = await getMenus(params)

            // Handle both paginated and array responses
            if (Array.isArray(response)) {
                setMenus(response)
                setTotal(response.length)
            } else {
                setMenus(response.data || [])
                setTotal(response.total || 0)
                // Update cursors for the next page
                if (response.lastSortValues) {
                    setCursors(prev => ({ ...prev, [page]: response.lastSortValues ?? null }));
                }
            }
        } catch (error) {
            console.error('Failed to load menus:', error)
        } finally {
            setIsLoading(false)
        }
    }, [selectedProperty, appliedSearchTitle, appliedStatus, page, limit, sort, sortOrder])

    // Reset cursors when filters, limit or sort change
    useEffect(() => {
        setCursors({ 0: null });
        setPage(1);
    }, [appliedSearchTitle, appliedStatus, limit, selectedProperty, sort, sortOrder]);

    useEffect(() => {
        loadMenus()
    }, [loadMenus])

    // Sync sorting to URL
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (sort === "createdAt") params.delete("sort"); else params.set("sort", sort);
        if (sortOrder === "desc") params.delete("sortOrder"); else params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newPath = queryString ? `${pathname}?${queryString}` : pathname;

        // Only replace if the path has actually changed to avoid unnecessary re-renders
        if (window.location.search !== (queryString ? `?${queryString}` : '')) {
            router.replace(newPath, { scroll: false });
        }
    }, [sort, sortOrder, pathname, router, searchParams]);

    const handleEdit = (menu: Menu) => {
        router.push(`/menu/edit/${menu._id}`)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">
                    MENUS ({total})
                </h1>
                <Button onClick={() => router.push('/menu/create')} size="icon" className="rounded-full h-10 w-10">
                    <Plus className="h-6 w-6" />
                </Button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Input
                            placeholder="Search by title"
                            value={draftSearchTitle}
                            onChange={(e) => setDraftSearchTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                            className="w-full pr-8"
                        />
                        {draftSearchTitle && (
                            <button
                                type="button"
                                onClick={() => { setDraftSearchTitle(""); setAppliedSearchTitle(""); setPage(1); setCursors({ 0: null }); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Clear title filter"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    
                    <Select
                        value={draftStatus}
                        onValueChange={setDraftStatus}
                    >
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Apply Filter button */}
                    <Button
                        onClick={handleApplyFilter}
                        size="sm"
                        className="h-10 px-4 gap-2"
                        disabled={!hasActiveDraftFilters && !hasAppliedFilters}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Apply Filter
                    </Button>

                    {/* Clear All button — only shown when filters are applied */}
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
            </div>

            <MenuTable
                data={menus}
                loading={isLoading}
                onRefresh={delayedRefresh}
                onEdit={handleEdit}
                page={page}
                limit={limit}
                total={total}
                onPageChange={setPage}
                onLimitChange={setLimit}
                sort={sort}
                sortOrder={sortOrder}
                onSort={onSort}
            />
        </div>
    )
}

export default MenuComponent
