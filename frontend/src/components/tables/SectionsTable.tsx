"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, History, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { deleteSection, updateSection } from "@/lib/api";
import { useRouter } from "next/navigation";
import { TablePagination } from "@/components/ui/table-pagination";
import { SectionCard } from "@/components/cards/SectionCard";

interface Section {
    _id: string;
    title: string;
    status?: string;
    rank?: number;
    count?: number;
    createdBy: {
        id?: string;
        name: string;
        userType: string;
    };
    updatedBy: {
        id?: string;
        name: string;
        userType: string;
    };
    createdAt: string;
    updatedAt: string;
}

interface SectionsTableProps {
    data: Section[];
    loading: boolean;
    onRefresh: () => void;
    onEdit: (section: Section) => void;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    sort: string;
    sortOrder: "asc" | "desc";
    onSort: (sort: string, order: "asc" | "desc") => void;
}

export function SectionsTable({
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
}: SectionsTableProps) {
    const { toast } = useToast();
    const router = useRouter();

    const handleStatusChange = async (section: Section, checked: boolean) => {
        try {
            await updateSection(section._id, { status: checked ? 'active' : 'inactive' });
            toast({
                title: "Success",
                description: `Section ${checked ? 'activated' : 'deactivated'}`
            });
            await onRefresh();
        } catch (error: any) {
            console.error("Failed to update status:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to update status",
                variant: "destructive"
            });
        }
    };

    const handleDelete = async (section: Section) => {
        if (!confirm(`Are you sure you want to delete the section "${section.title}"?`)) {
            return;
        }

        try {
            await deleteSection(section._id);
            toast({
                title: "Success",
                description: "Section deleted successfully"
            });
            await onRefresh();
        } catch (error: any) {
            console.error("Failed to delete section:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to delete section",
                variant: "destructive"
            });
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
        <div>
            {/* Mobile / Tablet card view */}
            <div className="md:hidden space-y-3">
                {data.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">No sections found.</div>
                ) : (
                    data.map((section) => (
                        <SectionCard
                            key={section._id}
                            section={section}
                            onEdit={onEdit}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                            onAuditTrail={(id) => router.push(`audit-trail/${id}`)}
                        />
                    ))
                )}
                <TablePagination
                    page={page}
                    limit={limit}
                    total={total}
                    onPageChange={onPageChange}
                    onLimitChange={onLimitChange}
                />
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Rank</TableHead>
                            <TableHead>Count</TableHead>
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
                        </TableRow >
                    </TableHeader >
                    <TableBody>
                        {data.map((section) => (
                            <TableRow key={section._id}>
                                <TableCell className="font-medium">
                                    <button
                                        onClick={() => onEdit(section)}
                                        className="hover:underline text-primary text-left"
                                    >
                                        {section.title}
                                    </button>
                                </TableCell>
                                <TableCell>{section.rank || '-'}</TableCell>
                                <TableCell>{section.count || '0'}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span
                                            className="font-medium text-sm cursor-pointer hover:underline text-primary transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const id = section.createdBy?.id || (section.createdBy as any)?._id;
                                                if (id) router.push(`/users/edit/${id}`);
                                            }}
                                        >
                                            {section.createdBy?.name || '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!section.createdAt) return '-';
                                                const dateVal = (section.createdAt as any).$date || section.createdAt;
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
                                                const id = section.updatedBy?.id || (section.updatedBy as any)?._id;
                                                if (id) router.push(`/users/edit/${id}`);
                                            }}
                                        >
                                            {section.updatedBy?.name || '-'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                if (!section.updatedAt) return '-';
                                                const dateVal = (section.updatedAt as any).$date || section.updatedAt;
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
                                        checked={section.status === 'active'}
                                        onCheckedChange={(checked) => handleStatusChange(section, checked)}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => router.push(`audit-trail/${section._id}`)}>
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(section)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => handleDelete(section)}
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
                                    No sections found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table >
                <TablePagination
                    page={page}
                    limit={limit}
                    total={total}
                    onPageChange={onPageChange}
                    onLimitChange={onLimitChange}
                />
            </div >
        </div >
    );
}

