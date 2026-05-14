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
import { Pencil, Trash2, BarChart2, ChevronUp, ChevronDown } from "lucide-react";
import { Poll } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { updatePoll, deletePoll } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { PollCard } from "@/components/cards/PollCard";
import { getImageUrl } from "@/lib/utils";
import Link from "next/link";

interface PollTableProps {
    data: Poll[];
    loading: boolean;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    sort: string;
    sortOrder: "asc" | "desc";
    onSort: (sort: string, order: "asc" | "desc") => void;
    onRefresh: () => Promise<void>;
    onEdit: (poll: Poll) => void;
}

export function PollTable({
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
}: PollTableProps) {
    const router = useRouter();
    const { toast } = useToast();

    const getAuthorId = (author?: { id?: string; _id?: string }) => {
        return author?.id || author?._id;
    };

    const handleStatusChange = async (poll: Poll, checked: boolean) => {
        try {
            await updatePoll(poll._id, { status: checked ? 'active' : 'inactive' } as any);
            toast({ title: "Success", description: `Poll ${checked ? 'activated' : 'deactivated'}` });
            await onRefresh();
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleDelete = async (poll: Poll) => {
        if (!confirm(`Are you sure you want to delete this poll?`)) {
            return;
        }

        try {
            await deletePoll(poll._id);
            toast({ title: "Success", description: "Poll deleted successfully" });
            await onRefresh();
        } catch (error) {
            console.error("Failed to delete poll:", error);
            toast({ title: "Error", description: "Failed to delete poll", variant: "destructive" });
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
                            <TableHead className="w-[100px]">Image</TableHead>
                            <TableHead>
                                <div className="flex items-center gap-2">
                                    <span>Question</span>
                                    <div className="flex flex-col">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'question' && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('question', 'asc')}
                                        >
                                            <ChevronUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'question' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('question', 'desc')}
                                        >
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </TableHead>
                            <TableHead>Options</TableHead>
                            <TableHead>
                                <div className="flex items-center gap-2">
                                    <span>Created</span>
                                    <div className="flex flex-col">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'createdAt' && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('createdAt', 'asc')}
                                        >
                                            <ChevronUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'createdAt' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('createdAt', 'desc')}
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
                                        >
                                            <ChevronUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'updatedAt' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                                            onClick={() => onSort('updatedAt', 'desc')}
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
                        {Array.isArray(data) && data.map((poll) => (
                            <TableRow key={poll._id}>
                                <TableCell>
                                    <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden shrink-0">
                                        {(() => {
                                            const imageUrl = getImageUrl(Array.isArray(poll.image) ? poll.image[0]?.url : (poll.image as any)?.url);
                                            return imageUrl ? (
                                                <img 
                                                    src={imageUrl} 
                                                    alt="" 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                    <BarChart2 className="w-6 h-6" />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-[300px]">
                                    <div
                                        className="font-bold cursor-pointer hover:underline text-primary transition-colors truncate"
                                        title={poll.question}
                                        onClick={() => onEdit(poll)}
                                    >
                                        {poll.question}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{poll.options.length} Options</Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">
                                            {(() => {
                                                const authorId = getAuthorId(poll.createdBy);
                                                const authorName = poll.createdBy?.userName || poll.createdBy?.name || '-';
                                                
                                                if (authorId) {
                                                    return (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.push(`/users/edit/${authorId}`);
                                                            }}
                                                            className="hover:underline text-primary text-left font-bold transition-all"
                                                        >
                                                            {authorName}
                                                        </button>
                                                    );
                                                }
                                                return authorName;
                                            })()}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {poll.createdAt ? new Date(poll.createdAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">
                                            {(() => {
                                                const authorId = getAuthorId(poll.updatedBy);
                                                const authorName = poll.updatedBy?.userName || poll.updatedBy?.name || '-';
                                                
                                                if (authorId) {
                                                    return (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.push(`/users/edit/${authorId}`);
                                                            }}
                                                            className="hover:underline text-primary text-left font-bold transition-all"
                                                        >
                                                            {authorName}
                                                        </button>
                                                    );
                                                }
                                                return authorName;
                                            })()}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {poll.updatedAt ? new Date(poll.updatedAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        checked={poll.status === 'active'}
                                        onCheckedChange={(checked) => handleStatusChange(poll, checked)}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(poll)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => handleDelete(poll)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">
                                    No Polls found.
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
                        No Polls found.
                    </div>
                ) : (
                    Array.isArray(data) && data.map((poll) => (
                        <PollCard
                            key={poll._id}
                            poll={poll}
                            onEdit={onEdit}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
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
