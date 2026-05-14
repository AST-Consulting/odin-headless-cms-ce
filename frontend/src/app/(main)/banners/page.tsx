"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBanners, getBannerTypes } from "@/lib/api";
import { Banner, BannerType } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { BannerTable } from "@/components/tables/BannerTable";
import { FilterBar } from "@/components/common/FilterBar";
import { useDebounce } from "@/hooks/use-debounce";

export default function BannersPage() {
    const router = useRouter();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [bannerTypes, setBannerTypes] = useState<BannerType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTitle, setSearchTitle] = useState("");
    const [selectedBannerType, setSelectedBannerType] = useState<string>("all");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const debouncedSearchTitle = useDebounce(searchTitle, 500);
    const [cursors, setCursors] = useState<Record<number, any>>({ 0: null });

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    // const [reloadKey, setReloadKey] = useState(0);

    const delayedRefresh = async (delayMs = 700) => {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        await fetchBanners();
    };

    const loadBannerTypes = useCallback(async () => {
        if (!selectedProperty?._id) {
            setLoading(false);
            return;
        }
        try {
            const res = await getBannerTypes({ propertyId: selectedProperty._id, limit: 100 });
            setBannerTypes(res.data);
        } catch (error) {
            console.error("Failed to fetch banner types", error);
        }
    }, [selectedProperty]);

    const fetchBanners = useCallback(async () => {
        if (!selectedProperty) return;
        setLoading(true);
        try {
            let cursorToSend: any = undefined;

            if (page > 1 && cursors[page - 1]) {
                cursorToSend = cursors[page - 1];
            } else {
                cursorToSend = undefined;
            }

            const res = await getBanners({
                propertyId: selectedProperty._id,
                search: debouncedSearchTitle || undefined,
                bannerType: selectedBannerType !== "all" ? selectedBannerType : undefined,
                status: selectedStatus !== "all" ? selectedStatus : undefined,
                page,
                lastSortValues: cursorToSend,
                limit,
            });
            setBanners(res.data);
            setTotal(res.total || 0);

            if (res.lastSortValues) {
                setCursors((prev) => ({
                    ...prev,
                    [page]: res.lastSortValues ?? null,
                }));
            }
        } catch (error) {
            console.error("Failed to fetch banners", error);
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, debouncedSearchTitle, selectedBannerType, selectedStatus, page, limit]);

    //reset cursor when filters change
    useEffect(() => {
        setCursors({ 0: null });
        setPage(1);
    }, [debouncedSearchTitle, selectedBannerType, selectedStatus, selectedProperty, searchTitle]);

    useEffect(() => {
        loadBannerTypes();
    }, [loadBannerTypes]);

    useEffect(() => {
        fetchBanners();
    }, [fetchBanners]);

    const handleEdit = (banner: Banner) => {
        router.push(`/banners/edit/${banner._id}`);
    };

    const handleClear = () => {
        setSearchTitle("");
        setSelectedBannerType("all");
        setSelectedStatus("all");
        setPage(1);
    };

    const hasActiveFilters = Boolean(
        searchTitle ||
        (selectedBannerType && selectedBannerType !== "all") ||
        (selectedStatus && selectedStatus !== "all")
    );

    return (
        <div className="w-full max-w-full space-y-4 sm:space-y-6">
            {/* Header with responsive title and add button */}
            <div className="flex justify-between items-center gap-2 sm:gap-3">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight truncate">
                    BANNERS ({total})
                </h1>
                <Button
                    onClick={() => router.push("/banners/create")}
                    size="icon"
                    className="rounded-full h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                >
                    <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
            </div>

            {/* Filter bar with responsive layout */}
            <FilterBar
                onClear={handleClear}
                showClear={hasActiveFilters}
            >
                <Input
                    placeholder="Search by title..."
                    value={searchTitle}
                    onChange={(e) => setSearchTitle(e.target.value)}
                    className="w-full sm:max-w-xs h-10"
                />
                <Select
                    value={selectedBannerType}
                    onValueChange={(value) => {
                        setSelectedBannerType(value);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[180px] h-10">
                        <SelectValue placeholder="Banner Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {bannerTypes.map((type) => (
                            <SelectItem key={type._id} value={type._id}>
                                {type.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={selectedStatus}
                    onValueChange={(value) => {
                        setSelectedStatus(value);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[180px] h-10">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </FilterBar>

            <BannerTable
                data={banners}
                loading={loading}
                onRefresh={delayedRefresh}
                onEdit={handleEdit}
                page={page}
                limit={limit}
                total={total}
                onPageChange={setPage}
                onLimitChange={setLimit}
            />
        </div>
    );
}
