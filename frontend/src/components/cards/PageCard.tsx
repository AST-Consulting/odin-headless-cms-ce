"use client";

import { useState } from "react";
import { Edit, Link as LinkIcon, History, ChevronDown, ChevronUp, Tag as TagIcon, FolderOpen, SquareArrowOutUpRight, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Page } from "@/lib/api";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { decodeHtmlEntities } from "@/lib/utils";

interface PageCardProps {
    page: Page;
    selectedPropertyDomain?: string;
    onEdit: (page: Page) => void;
    onView: (page: Page) => void;
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

export function PageCard({
    page,
    selectedPropertyDomain,
    onEdit,
    onView,
    onAuditTrail,
}: PageCardProps) {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);

    const typeLabel = page.type
        ? page.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        : null;

    const baseUrl = selectedPropertyDomain
        ? selectedPropertyDomain.startsWith("http")
            ? selectedPropertyDomain
            : `https://${selectedPropertyDomain}`
        : "";

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full">
            <Card className="bg-white dark:bg-slate-900/50 rounded-[22px] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                {/* Main Content */}
                <CardContent className="p-5">
                    {/* Title & Status Row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <button
                            onClick={() => onEdit(page)}
                            className="text-[15px] font-bold text-primary leading-snug hover:underline text-left line-clamp-2 flex-1"
                        >
                            {decodeHtmlEntities(page.title)}
                        </button>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <Badge className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md ${page.isPublished ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                {page.isPublished ? "PUBLISHED" : "DRAFT"}
                            </Badge>
                            {typeLabel && (
                                <Badge variant="outline" className="text-[9px] font-semibold px-1.5 py-0 rounded-md">
                                    {typeLabel}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Slug / Preview info */}
                    {page.slug && (
                        <div className="flex items-center gap-2 mb-3">
                            <LinkIcon size={12} className="text-muted-foreground shrink-0" />
                            <span className="text-[13px] font-medium text-muted-foreground truncate">
                                {page.slug}
                            </span>
                        </div>
                    )}

                    {/* Categories snippets if any */}
                    {page.categories && page.categories.length > 0 && (
                        <div className="flex items-start gap-2 mb-3 pt-2 border-t border-gray-50 dark:border-slate-800">
                            <FolderOpen size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex flex-wrap gap-1.5">
                                {page.categories.map((cat: any, idx) => (
                                    <Badge key={idx} variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 px-1.5 py-0 rounded-md">
                                        {cat.name || cat}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                </CardContent>

                {/* Collapsible Details */}
                <CollapsibleContent>
                    <div className="flex flex-col gap-4 px-5 py-4 bg-[#f8fafc] dark:bg-slate-800/50 border-t border-gray-50 dark:border-slate-800">
                        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                            {[
                                {
                                    label: "Created By",
                                    value: (page as any).createdBy?.name || "-",
                                    id: (page as any).createdBy?.id || (page as any).createdBy?._id
                                },
                                { label: "Created At", value: formatDate(page.createdAt) },
                                {
                                    label: "Updated By",
                                    value: (page as any).updatedBy?.name || "-",
                                    id: (page as any).updatedBy?.id || (page as any).updatedBy?._id
                                },
                                { label: "Updated At", value: formatDate(page.updatedAt) },
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

                        {/* Tags section */}
                        {page.tags && page.tags.length > 0 && (
                            <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                    <TagIcon size={12} className="text-[#94a3b8]" />
                                    <p className="text-[10px] font-extrabold text-[#94a3b8] dark:text-slate-500 uppercase tracking-[0.1em]">
                                        Tags
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {page.tags.map((tag: any, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-[10px] px-2 py-0 rounded-md bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 font-medium">
                                            {tag.name || tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CollapsibleContent>

                {/* Footer */}
                <CardFooter className="px-5 py-3 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                        <button className="text-gray-500 dark:text-gray-400 text-sm font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                            {isExpanded ? "Hide details" : "View details"}
                            {isExpanded ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
                        </button>
                    </CollapsibleTrigger>

                    <div className="flex gap-1.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            title="View on site"
                            onClick={() => onView(page)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Globe size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Audit trail"
                            onClick={() => onAuditTrail(page._id)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <History size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Edit page"
                            onClick={() => onEdit(page)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Edit size={16} strokeWidth={2} />
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </Collapsible>
    );
}
