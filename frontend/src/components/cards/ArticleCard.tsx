"use client";

import { useState } from "react";
import { Edit, Globe, History, Trash2, ChevronDown, ChevronUp, ListOrdered, Tag as TagIcon, FolderOpen, User, Plus, Minus, SquareArrowOutUpRight, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Article } from "@/lib/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/lib/utils";

interface ArticleCardProps {
    article: Article;
    selectedPropertyDomain?: string;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onView: (article: Article) => void;
    onMapStory: (article: Article) => void;
    onConvertToVideo: (article: Article) => void;
    onAuditTrail: (id: string) => void;
    onAuthorFilterSelect?: (authorId: string, authorName?: string) => void;
    appliedAuthorId?: string;
    onCategoryFilterSelect?: (categoryId: string, categoryTitle?: string) => void;
    appliedCategoryId?: string;
    onTagFilterSelect?: (tagId: string) => void;
    appliedTagId?: string;
}

const statusColors: Record<string, string> = {
    published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    scheduled: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

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

export function ArticleCard({
    article,
    selectedPropertyDomain,
    onEdit,
    onDelete,
    onView,
    onMapStory,
    onConvertToVideo,
    onAuditTrail,
    onAuthorFilterSelect,
    appliedAuthorId,
    onCategoryFilterSelect,
    appliedCategoryId,
    onTagFilterSelect,
    appliedTagId,
}: ArticleCardProps) {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);

    const getSafeId = (art: Article) => {
        if (typeof art._id === 'string') return art._id;
        if (art._id && (art._id as any).$oid) return (art._id as any).$oid;
        return art._id;
    };

    const statusKey = (article.status || "").toLowerCase();
    const statusClass = statusColors[statusKey] || "bg-slate-100 text-slate-600";

    const baseUrl = selectedPropertyDomain
        ? selectedPropertyDomain.startsWith("http")
            ? selectedPropertyDomain
            : `https://${selectedPropertyDomain}`
        : "";

    const primaryCategoryId =
        (article.primaryCategory && typeof article.primaryCategory === 'object')
            ? (article.primaryCategory as any)._id || (article.primaryCategory as any).id
            : article.primaryCategory;

    const primaryCategory = article.primaryCategory && typeof article.primaryCategory === 'object' ? article.primaryCategory as any : null;

    const otherCategoriesItems = (article.categories || [])
        .filter(cat => {
            const catId = (cat && typeof cat === 'object') ? (cat as any)._id || (cat as any).id : cat;
            return catId !== primaryCategoryId;
        });

    const tagItems = (article.tags || []);

    const typeLabel = article.type
        ? article.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        : null;

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full">
            <Card className="bg-white dark:bg-slate-900/50 rounded-[22px] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col h-full">
                {/* Main Content — fixed visible area */}
                <CardContent className="p-5 flex-1">
                    {/* Title & Status Row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                            {/* Featured Image Thumbnail */}
                            {(() => {
                                const imageUrl = article.featuredMedia?.url || (article.images && article.images.length > 0 ? article.images[0].url : null);
                                if (!imageUrl) return (
                                    <div className="h-10 w-16 bg-muted rounded grow-0 shrink-0 flex items-center justify-center text-[10px] text-muted-foreground border">
                                        No Image
                                    </div>
                                );
                                return (
                                    <div className="h-10 w-16 rounded overflow-hidden grow-0 shrink-0 border bg-muted">
                                        <img
                                            src={getImageUrl(imageUrl) || undefined}
                                            alt={article.title}
                                            className="h-full w-full object-cover"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                    </div>
                                );
                            })()}
                            <button
                                onClick={() => onEdit(getSafeId(article))}
                                className="text-[15px] font-bold text-primary leading-snug hover:underline text-left line-clamp-3"
                            >
                                {article.title}
                            </button>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <Badge className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md ${statusClass}`}>
                                {article.status?.toUpperCase()}
                            </Badge>
                            {statusKey === 'scheduled' && article.scheduledAt && (
                                <span className="text-[9px] text-muted-foreground font-bold whitespace-nowrap">
                                    {formatDate(article.scheduledAt)}
                                </span>
                            )}
                            {typeLabel && (
                                <Badge variant="outline" className="text-[9px] font-semibold px-1.5 py-0 rounded-md">
                                    {typeLabel}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Author — compact single line */}
                    {article.authors && article.authors.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                            <User size={13} className="text-muted-foreground shrink-0" />
                            <span
                                className="text-[13px] text-primary font-bold hover:underline cursor-pointer transition-colors truncate"
                                onClick={() => router.push(`/users/edit/${article.authors![0].id}`)}
                            >
                                {article.authors[0].name || "Unknown"}
                                {article.authors.length > 1 && <span className="text-muted-foreground font-normal"> +{article.authors.length - 1}</span>}
                            </span>
                        </div>
                    )}

                    {/* Primary category — compact inline badge */}
                    {primaryCategory && (
                        <div className="flex items-center gap-2 mb-3">
                            <FolderOpen size={13} className="text-muted-foreground shrink-0" />
                            <Badge className="text-[10px] bg-purple-600 text-white border-transparent px-2 py-0.5 rounded-md">
                                {(primaryCategory as Record<string, string>).title || (primaryCategory as Record<string, string>).name}
                            </Badge>
                            {otherCategoriesItems.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">+{otherCategoriesItems.length}</span>
                            )}
                        </div>
                    )}
                </CardContent>
 
                {/* Footer — Moved above CollapsibleContent so buttons don't jump to the bottom on expand */}
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
                            onClick={() => onView(article)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Globe size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Audit trail"
                            onClick={() => onAuditTrail(getSafeId(article))}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <History size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Manage priority"
                            onClick={() => onMapStory(article)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ListOrdered size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Convert to video"
                            onClick={() => onConvertToVideo(article)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Video size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Edit article"
                            onClick={() => onEdit(getSafeId(article))}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Edit size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Delete article"
                            onClick={() => onDelete(getSafeId(article))}
                            className="w-8 h-8 bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                        >
                            <Trash2 size={16} strokeWidth={2} />
                        </Button>
                    </div>
                </CardFooter>
 
                {/* Collapsible Details — authors, categories, tags with full filter controls */}
                <CollapsibleContent>
                    <div className="flex flex-col gap-4 px-5 py-4 bg-[#f8fafc] dark:bg-slate-800/50 border-t border-gray-50 dark:border-slate-800">
                        {/* Full Authors with filter buttons */}
                        {article.authors && article.authors.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] font-extrabold text-[#94a3b8] dark:text-slate-500 uppercase tracking-[0.1em]">Authors</p>
                                {article.authors.map((author, idx) => {
                                    const isFiltered = appliedAuthorId === author.id;
                                    return (
                                        <div key={idx} className="flex items-center justify-between gap-2">
                                            <span
                                                className="text-[13px] text-primary font-bold hover:underline cursor-pointer transition-colors"
                                                onClick={() => router.push(`/users/edit/${author.id}`)}
                                            >
                                                {author.name || "Unknown"}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {isFiltered ? (
                                                    <Button variant="default" size="icon" className="h-6 w-6 rounded-md bg-primary text-white" onClick={() => onAuthorFilterSelect?.("all")} title="Clear author filter"><Minus size={12} /></Button>
                                                ) : (
                                                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-md border-muted-foreground/30 text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={() => onAuthorFilterSelect?.(author.id, author.name)} title="Filter by this author"><Plus size={12} /></Button>
                                                )}
                                                {author.slug && baseUrl && (
                                                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-md border-muted-foreground/30 text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={() => window.open(`${baseUrl}/author/${author.slug}`, "_blank")} title="View author page"><SquareArrowOutUpRight size={12} /></Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
 
                        {/* Full Categories with filter buttons */}
                        {(primaryCategory || otherCategoriesItems.length > 0) && (
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] font-extrabold text-[#94a3b8] dark:text-slate-500 uppercase tracking-[0.1em]">Categories</p>
                                <div className="flex flex-wrap gap-2">
                                    {primaryCategory && (() => {
                                        const cat = primaryCategory;
                                        const catId = (cat && typeof cat === 'object') ? cat._id || cat.id : cat;
                                        const catTitle = (cat && typeof cat === 'object') ? cat.title || cat.name : cat;
                                        const isFiltered = appliedCategoryId === catId;
                                        return (
                                            <div key="primary" className="flex items-center gap-1">
                                                <Badge className="text-[10px] bg-purple-600 text-white border-transparent px-2 py-0.5 rounded-md">{catTitle}</Badge>
                                                {isFiltered ? (
                                                    <Button variant="default" size="icon" className="h-5 w-5 rounded-md bg-primary text-white" onClick={() => onCategoryFilterSelect?.("all")}><Minus size={10} /></Button>
                                                ) : (
                                                    <Button variant="outline" size="icon" className="h-5 w-5 rounded-md border-muted-foreground/30 text-muted-foreground hover:text-primary" onClick={() => onCategoryFilterSelect?.(catId, catTitle)}><Plus size={10} /></Button>
                                                )}
                                                {cat && typeof cat === 'object' && cat.fullSlug && (
                                                    <Button variant="outline" size="icon" className="h-5 w-5 rounded-md border-muted-foreground/30 text-muted-foreground hover:text-primary" onClick={() => { const slug = cat.fullSlug.startsWith('/') ? cat.fullSlug.substring(1) : cat.fullSlug; window.open(`${baseUrl}/${slug}`, "_blank"); }}><SquareArrowOutUpRight size={10} /></Button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {otherCategoriesItems.map((cat: any, idx) => {
                                        const catId = (cat && typeof cat === 'object') ? cat._id || cat.id : cat;
                                        const catTitle = (cat && typeof cat === 'object') ? cat.title || cat.name : cat;
                                        const isFiltered = appliedCategoryId === catId;
                                        return (
                                            <div key={idx} className="flex items-center gap-1">
                                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 px-2 py-0.5 rounded-md">{catTitle}</Badge>
                                                {isFiltered ? (
                                                    <Button variant="default" size="icon" className="h-5 w-5 rounded-md bg-primary text-white" onClick={() => onCategoryFilterSelect?.("all")}><Minus size={10} /></Button>
                                                ) : (
                                                    <Button variant="outline" size="icon" className="h-5 w-5 rounded-md border-muted-foreground/30 text-muted-foreground hover:text-primary" onClick={() => onCategoryFilterSelect?.(catId, catTitle)}><Plus size={10} /></Button>
                                                )}
                                                {cat && typeof cat === 'object' && cat.fullSlug && (
                                                    <Button variant="outline" size="icon" className="h-5 w-5 rounded-md border-muted-foreground/30 text-muted-foreground hover:text-primary" onClick={() => { const slug = cat.fullSlug.startsWith('/') ? cat.fullSlug.substring(1) : cat.fullSlug; window.open(`${baseUrl}/${slug}`, "_blank"); }}><SquareArrowOutUpRight size={10} /></Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
 
                        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                            {[
                                {
                                    label: "Created",
                                    value: article.createdBy?.name || "-",
                                    id: (article.createdBy as any)?.id || (article.createdBy as any)?._id
                                },
                                { label: "Created At", value: formatDate(article.createdAt) },
                                {
                                    label: "Updated",
                                    value: article.updatedBy?.name || "-",
                                    id: (article.updatedBy as any)?.id || (article.updatedBy as any)?._id
                                },
                                { label: "Updated At", value: formatDate(article.updatedAt) },
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
                        {tagItems.length > 0 && (
                            <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                    <TagIcon size={12} className="text-[#94a3b8]" />
                                    <p className="text-[10px] font-extrabold text-[#94a3b8] dark:text-slate-500 uppercase tracking-[0.1em]">
                                        Tags
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3 mt-1">
                                    {tagItems.map((tag: any, idx) => {
                                        const tagName = (tag && typeof tag === 'object') ? tag.name : tag;
                                        const tagSlug = (tag && typeof tag === 'object') ? tag.slug : null;
 
                                        return (
                                            <div key={idx} className="flex flex-col gap-1.5 min-w-[100px] mb-2">
                                                <Badge variant="secondary" className="text-[11px] px-2 py-0.5 rounded-md w-fit bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 font-medium">
                                                    {tagName}
                                                </Badge>
                                                <div className="flex items-center gap-1.5">
                                                    {appliedTagId === tagName ? (
                                                        <Button
                                                            variant="default"
                                                            size="icon"
                                                            className="h-6 w-6 rounded-md bg-primary text-white"
                                                            onClick={() => onTagFilterSelect?.("all")}
                                                            title="Clear tag filter"
                                                        >
                                                            <Minus size={12} />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-6 w-6 rounded-md border-muted-foreground/30 text-muted-foreground hover:text-primary hover:bg-primary/5"
                                                            onClick={() => onTagFilterSelect?.(tagName)}
                                                            title="Filter by this tag"
                                                        >
                                                            <Plus size={12} />
                                                        </Button>
                                                    )}
                                                    {tagSlug && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-6 w-6 rounded-md border-muted-foreground/30 text-muted-foreground hover:text-primary hover:bg-primary/5"
                                                            onClick={() => {
                                                                window.open(`${baseUrl}/topic/${tagSlug}`, "_blank");
                                                            }}
                                                            title="View tag page"
                                                        >
                                                            <SquareArrowOutUpRight size={12} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
