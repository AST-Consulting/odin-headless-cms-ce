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
import { Pencil, Trash2, ListOrdered, History, ChevronUp, ChevronDown } from "lucide-react";
import { Menu } from "@/lib/types";
import { MenuCard } from "@/components/cards/MenuCard";
import { Skeleton } from "@/components/ui/skeleton";
import { updateMenu, deleteMenu } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { useRouter } from "next/navigation";

interface MenuTableProps {
    data: Menu[];
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

export function MenuTable({ data, loading, onRefresh, onEdit, page, limit, total, onPageChange, onLimitChange, sort, sortOrder, onSort }: MenuTableProps & { onRefresh: () => Promise<void>, onEdit: (menu: Menu) => void }) {
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusChange = async (menu: Menu, checked: boolean) => {
        try {
            await updateMenu(menu._id, { status: checked ? 'active' : 'inactive' });
            toast({ title: "Success", description: `Menu ${checked ? 'activated' : 'deactivated'}` });
            await onRefresh();
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleDelete = async (menu: Menu) => {
        if (!confirm(`Are you sure you want to delete the menu "${menu.title}"?`)) {
            return;
        }

        try {
            await deleteMenu(menu._id);
            toast({ title: "Success", description: "Menu deleted successfully" });
            await onRefresh();
        } catch (error) {
            console.error("Failed to delete menu:", error);
            toast({ title: "Error", description: "Failed to delete menu", variant: "destructive" });
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
            {/* Mobile View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                {data.map((menu) => (
                    <MenuCard
                        key={menu._id}
                        menu={menu}
                        handleDelete={handleDelete}
                        handleStatusChange={handleStatusChange}
                        handleEdit={onEdit}
                        router={router}
                    />
                ))}
                
                {data.length === 0 && (
                    <div className="col-span-full h-24 flex items-center justify-center text-muted-foreground bg-white dark:bg-slate-900/50 rounded-[22px] border border-gray-100 dark:border-slate-800">
                        No menus found.
                    </div>
                )}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Status</TableHead>
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
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((menu) => (
                            <TableRow key={menu._id}>
                                <TableCell className="font-medium">
                                    <button
                                        onClick={() => onEdit(menu)}
                                        className="hover:underline text-primary text-left font-bold"
                                    >
                                        {menu.title}
                                    </button>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{menu.slug || '-'}</TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center justify-center bg-secondary/50 px-2 py-0.5 rounded-full text-xs font-medium">
                                        {menu.items?.length || 0}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        checked={menu.status === 'active'}
                                        onCheckedChange={(checked) => handleStatusChange(menu, checked)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{menu.createdBy?.name || '-'}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!menu.createdAt) return '-';
                                                const dateVal = (menu.createdAt as any).$date || menu.createdAt;
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
                                        <span className="text-sm font-medium">{menu.updatedBy?.name || '-'}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!menu.updatedAt) return '-';
                                                const dateVal = (menu.updatedAt as any).$date || menu.updatedAt;
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
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => router.push(`/audit-trail/${menu._id}`)} title="View History">
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => router.push(`/menu/priority?menuId=${menu._id}`)}
                                            title="Set Item Priority"
                                        >
                                            <ListOrdered className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(menu)}
                                            title="Edit Menu"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => handleDelete(menu)}
                                            title="Delete Menu"
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
                                    No menus found.
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

