"use client";

import { useState } from "react";
import { History, Pencil, Trash2, ChevronDown, ChevronUp, Link as LinkIcon, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { Category } from "@/lib/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface CategoryCardProps {
    category: Category;
    onEdit: (category: Category) => void;
    onDelete: (category: Category) => void;
    onStatusChange: (category: Category, checked: boolean) => Promise<void>;
    onAuditTrail: (id: string) => void;
}

const formatDate = (date: any) => {
    if (!date) return "-";
    const dateVal = (date as any).$date || date;
    try {
        return new Date(dateVal).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "-";
    }
};

export function CategoryCard({
    category,
    onEdit,
    onDelete,
    onStatusChange,
    onAuditTrail,
}: CategoryCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const router = useRouter();

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full">
            <Card className="bg-white dark:bg-slate-900/50 rounded-[22px] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                            <button
                                onClick={() => onEdit(category)}
                                className="text-[17px] font-bold text-primary leading-tight truncate hover:underline text-left block w-full"
                            >
                                {category.title}
                            </button>
                            <div className="flex items-center gap-2 mt-1.5 text-slate-500 dark:text-slate-400">
                                <LinkIcon size={12} className="shrink-0" />
                                <span className="text-[13px] font-medium truncate">{category.slug}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                <Hash size={12} className="text-slate-400" />
                                <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300">{category.rank}</span>
                            </div>
                            <Switch
                                checked={category.status === 'active'}
                                onCheckedChange={(checked) => onStatusChange(category, checked)}
                                className="scale-90"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {category.isPublic && (
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100">Public</Badge>
                        )}
                        {category.isFeatured && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-100">Featured</Badge>
                        )}
                        {category.parentId && (
                            <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-100">Sub-category</Badge>
                        )}
                    </div>
                </CardContent>

                <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-4 px-5 py-4 bg-[#f8fafc] dark:bg-slate-800/50 border-t border-gray-50 dark:border-slate-800">
                        {[
                            {
                                label: "Created By",
                                value: category.createdBy?.name || "-",
                                id: (category.createdBy as any)?.id || (category.createdBy as any)?._id
                            },
                            { label: "Role", value: category.createdBy?.userType || "-" },
                            { label: "Created At", value: formatDate(category.createdAt) },
                            {
                                label: "Updated By",
                                value: category.updatedBy?.name || "-",
                                id: (category.updatedBy as any)?.id || (category.updatedBy as any)?._id
                            },
                        ].map(({ label, value, id }) => (
                            <div key={label}>
                                <p className="text-[10px] font-extrabold text-[#94a3b8] dark:text-slate-500 uppercase tracking-[0.1em] mb-1">
                                    {label}
                                </p>
                                {id ? (
                                    <p
                                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/users/edit/${id}`);
                                        }}
                                    >
                                        {value}
                                    </p>
                                ) : (
                                    <p className="text-[11px] font-bold text-[#334155] dark:text-slate-300">{value}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>

                <CardFooter className="px-5 py-3 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                        <button className="text-gray-500 dark:text-gray-400 text-sm font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                            {isExpanded ? "Hide details" : "View details"}
                            {isExpanded ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
                        </button>
                    </CollapsibleTrigger>

                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onAuditTrail(category._id)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <History size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(category)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Pencil size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(category)}
                            className="w-8 h-8 bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                        >
                            <Trash2 size={16} strokeWidth={2} />
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </Collapsible>
    );
}
