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
import { Category } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { updateCategory, deleteCategory } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { useRouter } from "next/navigation";
import { CategoryCard } from "@/components/cards/CategoryCard";

interface CategoryTableProps {
    data: Category[];
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

export function CategoryTable({
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
}: CategoryTableProps & { onRefresh: () => Promise<void>, onEdit: (category: Category) => void }) {
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusChange = async (category: Category, checked: boolean) => {
        try {
            await updateCategory(category._id, { status: checked ? 'active' : 'inactive' });
            toast({ title: "Success", description: `Category ${checked ? 'activated' : 'deactivated'}` });
            await onRefresh();
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleDelete = async (category: Category) => {
        if (!confirm(`Are you sure you want to delete the category "${category.title}"?`)) {
            return;
        }

        try {
            await deleteCategory(category._id);
            toast({ title: "Success", description: "Category deleted successfully" });
            await onRefresh();
        } catch (error) {
            console.error("Failed to delete category:", error);
            toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
        }
    };

    const onAuditTrail = (id: string) => {
        router.push(`audit-trail/${id}`);
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
                            <TableHead>Title</TableHead>
                            <TableHead>Slug</TableHead>
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
                        {data.map((category) => (
                            <TableRow key={category._id}>
                                <TableCell>
                                    <div
                                        className="font-bold cursor-pointer hover:underline text-primary transition-colors"
                                        onClick={() => onEdit(category)}
                                    >
                                        {category.title}
                                    </div>
                                </TableCell>
                                <TableCell>{category.slug}</TableCell>
                                <TableCell>{category.rank}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span
                                            className="font-medium text-sm cursor-pointer hover:underline text-primary transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const id = (category.createdBy as any)?.id || (category.createdBy as any)?._id;
                                                if (id) router.push(`/users/edit/${id}`);
                                            }}
                                        >
                                            {category.createdBy?.name || '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!category.createdAt) return '-';
                                                const dateVal = (category.createdAt as any).$date || category.createdAt;
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const id = (category.updatedBy as any)?.id || (category.updatedBy as any)?._id;
                                                if (id) router.push(`/users/edit/${id}`);
                                            }}
                                        >
                                            {category.updatedBy?.name || '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!category.updatedAt) return '-';
                                                const dateVal = (category.updatedAt as any).$date || category.updatedAt;
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
                                        checked={category.status === 'active'}
                                        onCheckedChange={(checked) => handleStatusChange(category, checked)}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost"
                                            size="icon" onClick={() => onAuditTrail(category._id)}>
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(category)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => handleDelete(category)}
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
                                    No categories found.
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
                        No categories found.
                    </div>
                ) : (
                    data.map((category) => (
                        <CategoryCard
                            key={category._id}
                            category={category}
                            onEdit={onEdit}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                            onAuditTrail={onAuditTrail}
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
