"use client";

import { useState } from "react";
import { Menu } from "@/lib/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Edit, History, Trash2, ListOrdered, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MenuCardProps {
    menu: Menu;
    handleDelete: (menu: Menu) => void;
    handleStatusChange: (menu: Menu, checked: boolean) => void;
    handleEdit: (menu: Menu) => void;
    router: any;
}

export function MenuCard({ menu, handleDelete, handleStatusChange, handleEdit, router }: MenuCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    /**
     * Utility to format database dates into a human-readable format
     */
    const formatDate = (date: any) => {
        if (!date) return '-';
        const dateVal = (date as any).$date || date;
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
    };

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full">
            <Card className="bg-white dark:bg-slate-900/50 rounded-[22px] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center gap-2 mb-1">
                                    <button
                                        onClick={() => handleEdit(menu)}
                                        className="text-[16px] font-bold text-primary leading-tight hover:underline text-left truncate"
                                    >
                                        {menu.title}
                                    </button>
                                    <Badge className={`text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-md flex-shrink-0 ${menu.status?.toUpperCase() === "ACTIVE"
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                        }`}>
                                        {menu.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[12px] text-gray-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                        Slug: {menu.slug || '-'}
                                    </span>
                                    <span className="text-[12px] text-gray-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                        Items: {menu.items?.length || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Status Switch */}
                        <div className="flex items-center">
                            <Switch
                                checked={menu.status === 'active'}
                                onCheckedChange={(checked) => handleStatusChange(menu, checked)}
                            />
                        </div>
                    </div>
                </CardContent>

                {/* Collapsible Details Section (Metadata) */}
                <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4 px-6 py-5 bg-[#f8fafc] dark:bg-slate-800/50 border-t border-gray-50 dark:border-slate-800">
                        {[
                            { label: "Created By", value: menu.createdBy?.name || '-' },
                            { label: "Created At", value: formatDate(menu.createdAt) },
                            { label: "Updated By", value: menu.updatedBy?.name || '-' },
                            { label: "Updated At", value: formatDate(menu.updatedAt) },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-[10px] font-extrabold text-[#94a3b8] dark:text-slate-500 uppercase tracking-[0.1em] mb-1.5">{label}</p>
                                <p className="text-[10px] font-bold text-[#334155] dark:text-slate-300">{value}</p>
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>

                <CardFooter className="px-6 py-4 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                        <button
                            className="text-gray-600 dark:text-gray-400 text-sm font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                        >
                            {isExpanded ? 'Hide details' : 'View details'}
                            {isExpanded ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                        </button>
                    </CollapsibleTrigger>

                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => router.push(`/audit-trail/${menu._id}`)}
                            title="View History"
                        >
                            <History size={18} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => router.push(`/menu/priority?menuId=${menu._id}`)}
                            title="Set Item Priority"
                        >
                            <ListOrdered size={18} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleEdit(menu)}
                            title="Edit Menu"
                        >
                            <Edit size={18} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400 rounded-lg flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                            onClick={() => handleDelete(menu)}
                            title="Delete Menu"
                        >
                            <Trash2 size={18} strokeWidth={2} />
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </Collapsible>
    );
}
