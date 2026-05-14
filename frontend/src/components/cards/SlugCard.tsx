"use client";

import { useState } from "react";
import { Pencil, Trash2, History, ChevronDown, ChevronUp, ExternalLink, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { type Slug } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";

interface SlugCardProps {
    slug: Slug;
    onEdit: (slug: Slug) => void;
    onDelete: (id: string) => void;
    onAuditTrail: (id: string) => void;
}

const formatDate = (date: any): string => {
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

export function SlugCard({ slug, onEdit, onDelete, onAuditTrail }: SlugCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);

    const isActive = slug.status?.toLowerCase() === "active";

    const getDisplayFullSlug = () => {
        if (!selectedProperty || !selectedProperty.urlPatterns) return slug.fullSlug || slug.slug;
        const patterns = selectedProperty.urlPatterns;

        switch (slug.type) {
            case 'tag':
                const tagPrefix = patterns.tag ?? 'topic';
                return tagPrefix ? `${tagPrefix}/${slug.slug}` : slug.slug;
            case 'author':
            case 'user':
                const authorPrefix = patterns.author ?? 'author';
                return authorPrefix ? `${authorPrefix}/${slug.slug}` : slug.slug;
            case 'static-page':
                const pagePrefix = patterns.page ?? '';
                return pagePrefix ? `${pagePrefix}/${slug.slug}` : slug.slug;
            case 'category':
                const catPrefix = patterns.category ?? '';
                return catPrefix ? `${catPrefix}/${slug.slug}` : slug.slug;
            default:
                return slug.fullSlug || slug.slug;
        }
    };

    const displayFullSlug = getDisplayFullSlug();

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full">
            <Card className="bg-card rounded-[18px] shadow-sm border border-border overflow-hidden">
                {/* Main Content */}
                <CardContent className="p-5">
                    {/* Header row: slug name + status badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <Link2 className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="font-mono font-semibold text-sm text-foreground truncate leading-tight">
                                {slug.slug}
                            </span>
                        </div>
                        <Badge
                            className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md shrink-0 ${isActive
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-muted text-muted-foreground"
                                }`}
                        >
                            {isActive ? "Active" : "Inactive"}
                        </Badge>
                    </div>

                    {/* Type badge */}
                    <div className="mb-3">
                        <Badge variant="outline" className="text-[10px] font-medium capitalize">
                            {slug.type}
                        </Badge>
                    </div>

                    {/* Full Slug */}
                    {displayFullSlug && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground font-mono break-all">
                            <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
                            <span>{displayFullSlug}</span>
                        </div>
                    )}
                </CardContent>

                {/* Collapsible Detail Section */}
                <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-4 px-5 py-4 bg-muted/40 border-t border-border">
                        {[
                            { label: "Created By", value: slug.createdBy?.name || "-" },
                            { label: "Created At", value: formatDate(slug.createdAt) },
                            { label: "Updated By", value: slug.updatedBy?.name || "-" },
                            { label: "Updated At", value: formatDate(slug.updatedAt) },
                            ...(slug.redirectTo
                                ? [{ label: "Redirect To", value: slug.redirectTo }]
                                : []),
                            ...(slug.canonicalUrl
                                ? [{ label: "Canonical URL", value: slug.canonicalUrl }]
                                : []),
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.1em] mb-1">
                                    {label}
                                </p>
                                <p className="text-[11px] font-semibold text-foreground break-all">{value}</p>
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>

                {/* Footer */}
                <CardFooter className="px-5 py-3.5 border-t border-border flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                        <button className="text-muted-foreground text-xs font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                            {isExpanded ? "Hide details" : "View details"}
                            {isExpanded ? (
                                <ChevronUp size={16} strokeWidth={2.5} />
                            ) : (
                                <ChevronDown size={16} strokeWidth={2.5} />
                            )}
                        </button>
                    </CollapsibleTrigger>

                    {/* Action Buttons */}
                    <div className="flex gap-1.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onAuditTrail(slug._id)}
                            className="w-8 h-8 bg-muted text-muted-foreground rounded-lg flex items-center justify-center hover:bg-muted/80 transition-colors"
                            title="Audit Trail"
                        >
                            <History size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(slug)}
                            className="w-8 h-8 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            title="Edit Slug"
                        >
                            <Pencil size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(slug._id)}
                            className="w-8 h-8 bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400 rounded-lg flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                            title="Delete Slug"
                        >
                            <Trash2 size={16} strokeWidth={2} />
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </Collapsible>
    );
}
