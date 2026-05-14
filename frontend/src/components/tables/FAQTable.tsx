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
import { Pencil, Trash2, History, ChevronUp, ChevronDown } from "lucide-react";
import { FAQ } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { updateFAQ, deleteFAQ } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

import { FAQCard } from "@/components/cards/FAQCard";

interface FAQTableProps {
    data: FAQ[];
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

export function FAQTable({
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
}: FAQTableProps & { onRefresh: () => Promise<void>, onEdit: (faq: FAQ) => void }) {
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusChange = async (faq: FAQ, checked: boolean) => {
        try {
            await updateFAQ(faq._id, { status: checked ? 'active' : 'inactive' });
            toast({ title: "Success", description: `FAQ ${checked ? 'activated' : 'deactivated'}` });
            await onRefresh();
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleDelete = async (faq: FAQ) => {
        if (!confirm(`Are you sure you want to delete this FAQ?`)) {
            return;
        }

        try {
            await deleteFAQ(faq._id);
            toast({ title: "Success", description: "FAQ deleted successfully" });
            await onRefresh();
        } catch (error) {
            console.error("Failed to delete FAQ:", error);
            toast({ title: "Error", description: "Failed to delete FAQ", variant: "destructive" });
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
                            <TableHead>Question</TableHead>
                            <TableHead>Answer</TableHead>
                            <TableHead>Entity Type</TableHead>
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
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((faq) => (
                            <TableRow key={faq._id}>
                                <TableCell className="max-w-[250px]">
                                    <div
                                        className="font-bold cursor-pointer hover:underline text-primary transition-colors truncate"
                                        title={faq.question}
                                        onClick={() => onEdit(faq)}
                                    >
                                        {faq.question}
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-[300px]">
                                    <div className="truncate" title={faq.answer}>
                                        {faq.answer}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{faq.entityType || '-'}</Badge>
                                </TableCell>
                                <TableCell>{faq.rank || '-'}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span
                                            className="font-medium text-sm cursor-pointer hover:underline text-primary transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const id = (faq.createdBy as any)?.id || (faq.createdBy as any)?._id;
                                                if (id) router.push(`/users/edit/${id}`);
                                            }}
                                        >
                                            {faq.createdBy?.name || '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!faq.createdAt) return '-';
                                                const dateVal = (faq.createdAt as any).$date || faq.createdAt;
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
                                                const id = (faq.updatedBy as any)?.id || (faq.updatedBy as any)?._id;
                                                if (id) router.push(`/users/edit/${id}`);
                                            }}
                                        >
                                            {faq.updatedBy?.name || '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!faq.updatedAt) return '-';
                                                const dateVal = (faq.updatedAt as any).$date || faq.updatedAt;
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
                                        checked={faq.status === 'active'}
                                        onCheckedChange={(checked) => handleStatusChange(faq, checked)}
                                    />
                                </TableCell>
                                <TableCell>
                                    {faq.categories && faq.categories.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {faq.categories.map((cat) => (
                                                <Badge key={cat.id} variant="secondary" className="text-xs">
                                                    {cat.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">No categories</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost"
                                            size="icon" onClick={() => router.push(`audit-trail/${faq._id}`)}>
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(faq)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => handleDelete(faq)}
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
                                    No FAQs found.
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
                        No FAQs found.
                    </div>
                ) : (
                    data.map((faq) => (
                        <FAQCard
                            key={faq._id}
                            faq={faq}
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
