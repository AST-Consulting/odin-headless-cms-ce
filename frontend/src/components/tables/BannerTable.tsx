"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { History, Pencil, Trash2 } from "lucide-react";
import { Banner } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { updateBanner, deleteBanner } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { useRouter } from "next/navigation";

interface BannerTableProps {
    data: Banner[];
    loading: boolean;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}

export function BannerTable({ data, loading, onRefresh, onEdit, page, limit, total, onPageChange, onLimitChange }: BannerTableProps & { onRefresh: () => Promise<void>, onEdit: (banner: Banner) => void }) {
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusChange = async (banner: Banner, checked: boolean) => {
        try {
            await updateBanner(banner._id, { status: checked ? 'active' : 'inactive' });
            toast({ title: "Success", description: `Banner ${checked ? 'activated' : 'deactivated'}` });
            await onRefresh();
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleDelete = async (banner: Banner) => {
        if (!confirm(`Are you sure you want to delete the banner "${banner.title}"?`)) {
            return;
        }

        try {
            await deleteBanner(banner._id);
            toast({ title: "Success", description: "Banner deleted successfully" });
            await onRefresh();
        } catch (error) {
            console.error("Failed to delete banner:", error);
            toast({ title: "Error", description: "Failed to delete banner", variant: "destructive" });
        }
    };

    if (loading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Banner Type</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((banner) => (
                            <TableRow key={banner._id}>
                                <TableCell className="font-medium">{banner.title}</TableCell>
                                <TableCell>
                                    {typeof banner.bannerType === 'string'
                                        ? banner.bannerType
                                        : banner.bannerType?.name || '-'}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{banner.createdBy?.name || '-'}</span>
                                        <span className="text-xs text-muted-foreground">{banner.createdBy?.userType}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{banner.updatedBy?.name || '-'}</span>
                                        <span className="text-xs text-muted-foreground">{banner.updatedBy?.userType}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        checked={banner.status === 'active'}
                                        onCheckedChange={(checked) => handleStatusChange(banner, checked)}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost"
                                            size="icon"
                                            onClick={() => router.push(`audit-trail/${banner._id}`)}>
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(banner)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => handleDelete(banner)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No banners found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <TablePagination
                page={page}
                limit={limit}
                total={total}
                onPageChange={onPageChange}
                onLimitChange={onLimitChange}
            />
        </>
    );
}

