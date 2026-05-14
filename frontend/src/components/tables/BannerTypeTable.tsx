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
import { BannerType } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { updateBannerType, deleteBannerType } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { useRouter } from "next/navigation";

interface BannerTypeTableProps {
    data: BannerType[];
    loading: boolean;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}

export function BannerTypeTable({ data, loading, onRefresh, onEdit, page, limit, total, onPageChange, onLimitChange }: BannerTypeTableProps & { onRefresh: () => Promise<void>, onEdit: (bannerType: BannerType) => void }) {
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusChange = async (bannerType: BannerType, checked: boolean) => {
        try {
            await updateBannerType(bannerType._id, { status: checked ? 'active' : 'inactive' });
            toast({ title: "Success", description: `Banner Type ${checked ? 'activated' : 'deactivated'}` });
            await onRefresh();
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleDelete = async (bannerType: BannerType) => {
        if (!confirm(`Are you sure you want to delete the banner type "${bannerType.name}"?`)) {
            return;
        }

        try {
            await deleteBannerType(bannerType._id);
            toast({ title: "Success", description: "Banner Type deleted successfully" });
            await onRefresh();
        } catch (error) {
            console.error("Failed to delete banner type:", error);
            toast({ title: "Error", description: "Failed to delete banner type", variant: "destructive" });
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
                        <TableHead>Name</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((bannerType) => (
                        <TableRow key={bannerType._id}>
                            <TableCell className="font-medium">{bannerType.name}</TableCell>
                            <TableCell>{bannerType.entity || '-'}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{bannerType.createdBy?.name || '-'}</span>
                                    <span className="text-xs text-muted-foreground">{bannerType.createdBy?.userType}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{bannerType.updatedBy?.name || '-'}</span>
                                    <span className="text-xs text-muted-foreground">{bannerType.updatedBy?.userType}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Switch
                                    checked={bannerType.status === 'active'}
                                    onCheckedChange={(checked) => handleStatusChange(bannerType, checked)}
                                />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost"
                                        size="icon" onClick={() => router.push(`audit-trail/${bannerType._id}`)}>
                                        <History className="h-4 w-4"/>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onEdit(bannerType)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive"
                                        onClick={() => handleDelete(bannerType)}
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
                                No banner types found.
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
