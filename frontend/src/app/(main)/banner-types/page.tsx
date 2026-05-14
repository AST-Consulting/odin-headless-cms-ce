"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBannerTypes } from "@/lib/api";
import { BannerType } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";

import { BannerTypeTable } from "@/components/tables/BannerTypeTable";
import { FilterBar } from "@/components/common/FilterBar";
import { useDebounce } from "@/hooks/use-debounce";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

export default function BannerTypesPage() {
    const [bannerTypes, setBannerTypes] = useState<BannerType[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const debouncedSearch = useDebounce(search, 500);
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [reloadKey, setReloadKey] = useState(0);
    const [cursor, setCursor] = useState<Record<number,string | null>>({0: null});

    const delayedRefresh = async (delayMs = 700) => {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        await fetchBannerTypes();
    };

    const fetchBannerTypes = useCallback(async () => {
        if (!selectedProperty?._id){
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await getBannerTypes({
                lastId: cursor[page - 1] || undefined,
                propertyId: selectedProperty._id,
                search: debouncedSearch || undefined,
                status: filterStatus !== "all" ? filterStatus : undefined,
                page,
                limit,
            });
            setBannerTypes(res.data);
            setTotal(res.total || 0);

            //update cursor
            setCursor((prev) => ({
                ...prev,
                [page]: res.lastId ?? null,
            }));
        } catch (error) {
            console.error("Failed to fetch banner types", error);
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, debouncedSearch, filterStatus, page, limit]);

    //reset cursor when filters change
    useEffect(() => {
        setCursor({0: null});
        setPage(1);
    }, [debouncedSearch, filterStatus, selectedProperty]);

    useEffect(() => {
        fetchBannerTypes();
    }, [fetchBannerTypes, reloadKey]);

    const handleEdit = (bannerType: BannerType) => {
        router.push(`/banner-types/edit/${bannerType._id}`);
    };



    const handleClear = () => {
        setSearch("");
        setFilterStatus("all");
        setPage(1);
    };

    const hasActiveFilters = Boolean(
        search || 
        (filterStatus && filterStatus !== "all")
    );

    return (
        <div className="w-full max-w-full space-y-4 sm:space-y-6">
            <div className="flex justify-between items-center gap-2 sm:gap-3">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight truncate">
                    BANNER TYPES ({total})
                </h1>
                <Button 
                    onClick={() => router.push("/banner-types/create")}
                    // onClick={() => setIsCreateOpen(true)} 
                    size="icon" 
                    className="rounded-full h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                >
                    <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
            </div>

            <FilterBar 
                onClear={handleClear}
                showClear={hasActiveFilters}
            >
                <Input
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:max-w-xs h-10"
                />
                <Select
                    value={filterStatus}
                    onValueChange={(value) => {
                        setFilterStatus(value);
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

            <BannerTypeTable
                data={bannerTypes}
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
