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
import { ChevronDown, ChevronUp, History, Pencil, Trash2 } from "lucide-react";
import { Tag } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { updateTag, deleteTag } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { useRouter } from "next/navigation";

import { TagCard } from "@/components/cards/TagCard";

interface TagTableProps {
    data: Tag[];
    loading: boolean;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    sort: string;
    sortOrder: "asc" | "desc";
    onSort: (sort: string, order: "asc" | "desc") => void;
}

export function TagTable({
    data,
    loading,
    onRefresh,
    onEdit,
    page,
    limit,
    total,
    onPageChange,
    onLimitChange,
    sort,
    sortOrder,
    onSort
}: TagTableProps & { onRefresh: () => Promise<void>, onEdit: (tag: Tag) => void }) {
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusChange = async (tag: Tag, checked: boolean) => {
        try {
            await updateTag(tag._id, { status: checked ? 'active' : 'inactive' });
            toast({ title: "Success", description: `Tag ${checked ? 'activated' : 'deactivated'}` });
            await onRefresh();
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleDelete = async (tag: Tag) => {
        if (!confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
            return;
        }

        try {
            await deleteTag(tag._id);
            toast({ title: "Success", description: "Tag deleted successfully" });
            await onRefresh();
        } catch (error) {
            console.error("Failed to delete tag:", error);
            toast({ title: "Error", description: "Failed to delete tag", variant: "destructive" });
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="hidden xl:block space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
                <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table View */}
            <div className="hidden xl:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tag Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Rank</TableHead>
                            <TableHead>
                                <div className="flex items-center gap-2">
                                    <span>Created</span>
                                    <div className="flex flex-col">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'createdAt' && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('createdAt', 'asc')}
                                            title="Sort by oldest"
                                        >
                                            <ChevronUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'createdAt' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('createdAt', 'desc')}
                                            title="Sort by latest"
                                        >
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </TableHead>
                            <TableHead>
                                <div className="flex items-center gap-2">
                                    <span>Updated</span>
                                    <div className="flex flex-col">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'updatedAt' && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('updatedAt', 'asc')}
                                            title="Sort by oldest"
                                        >
                                            <ChevronUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'updatedAt' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('updatedAt', 'desc')}
                                            title="Sort by latest"
                                        >
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((tag) => (
                            <TableRow key={tag._id}>
                                <TableCell>
                                    <div
                                        className="font-bold cursor-pointer hover:underline text-primary transition-colors"
                                        onClick={() => onEdit(tag)}
                                    >
                                        {tag.name}
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">{tag.description || '-'}</TableCell>
                                <TableCell>{tag.rank}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span
                                            className="font-medium text-sm cursor-pointer hover:underline text-primary transition-colors"
                                            onClick={() => {
                                                const id = (tag.createdBy as any)?.id || (tag.createdBy as any)?._id;
                                                if (id) router.push(`/users/edit/${id}`);
                                            }}
                                        >
                                            {tag.createdBy?.name || '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!tag.createdAt) return '-';
                                                const dateVal = (tag.createdAt as any).$date || tag.createdAt;
                                                try {
                                                    return new Date(dateVal).toLocaleString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    });
                                                } catch (e) {
                                                    return '-';
                                                }
                                            })()}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span
                                            className="font-medium text-sm cursor-pointer hover:underline text-primary transition-colors"
                                            onClick={() => {
                                                const id = (tag.updatedBy as any)?.id || (tag.updatedBy as any)?._id;
                                                if (id) router.push(`/users/edit/${id}`);
                                            }}
                                        >
                                            {tag.updatedBy?.name || '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!tag.updatedAt) return '-';
                                                const dateVal = (tag.updatedAt as any).$date || tag.updatedAt;
                                                try {
                                                    return new Date(dateVal).toLocaleString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    });
                                                } catch (e) {
                                                    return '-';
                                                }
                                            })()}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        checked={tag.status === 'active'}
                                        onCheckedChange={(checked) => handleStatusChange(tag, checked)}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost"
                                            size="icon" onClick={() => router.push(`audit-trail/${tag._id}`)}>
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(tag)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => handleDelete(tag)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No tags found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground bg-white rounded-xl border border-dashed">
                        No tags found.
                    </div>
                ) : (
                    data.map((tag) => (
                        <TagCard
                            key={tag._id}
                            tag={tag}
                            onEdit={onEdit}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                            onAuditTrail={(id) => router.push(`audit-trail/${id}`)}
                        />
                    ))
                )}
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
