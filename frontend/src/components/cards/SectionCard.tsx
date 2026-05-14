"use client";

import { useState } from "react";
import { History, Pencil, Trash2, ChevronDown, ChevronUp, Hash, Layers } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

interface Section {
    _id: string;
    title: string;
    contentType?: string;
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

interface SectionCardProps {
    section: Section;
    onEdit: (section: Section) => void;
    onDelete: (section: Section) => void;
    onStatusChange: (section: Section, checked: boolean) => Promise<void>;
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

export function SectionCard({
    section,
    onEdit,
    onDelete,
    onStatusChange,
    onAuditTrail,
}: SectionCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const router = useRouter();

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full">
            <Card className="bg-white dark:bg-slate-900/50 rounded-[22px] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                            <button
                                onClick={() => onEdit(section)}
                                className="text-[17px] font-bold text-primary leading-tight truncate hover:underline text-left block w-full"
                            >
                                {section.title}
                            </button>
                            {section.contentType && (
                                <div className="flex items-center gap-2 mt-1.5 text-slate-500 dark:text-slate-400">
                                    <Layers size={12} className="shrink-0" />
                                    <span className="text-[13px] font-medium truncate capitalize">
                                        {section.contentType}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            {section.rank !== undefined && section.rank !== null && (
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <Hash size={12} className="text-slate-400" />
                                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300">{section.rank}</span>
                                </div>
                            )}
                            <Switch
                                checked={section.status === "active"}
                                onCheckedChange={(checked) => onStatusChange(section, checked)}
                                className="scale-90"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {section.status === "active" ? (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 border-green-100">Active</Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-500 border-gray-100">Inactive</Badge>
                        )}
                    </div>
                </CardContent>

                <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-4 px-5 py-4 bg-[#f8fafc] dark:bg-slate-800/50 border-t border-gray-50 dark:border-slate-800">
                        {[
                            { 
                                label: "Created", 
                                value: section.createdBy?.name || "-",
                                onClick: () => {
                                    const id = section.createdBy?.id || (section.createdBy as any)?._id;
                                    if (id) router.push(`/users/edit/${id}`);
                                }
                            },
                            { label: "Role", value: section.createdBy?.userType || "-" },
                            { label: "Created At", value: formatDate(section.createdAt) },
                            { 
                                label: "Updated", 
                                value: section.updatedBy?.name || "-",
                                onClick: () => {
                                    const id = section.updatedBy?.id || (section.updatedBy as any)?._id;
                                    if (id) router.push(`/users/edit/${id}`);
                                }
                            },
                            { label: "Count", value: section.count?.toString() || "0" },
                            { label: "Updater Role", value: section.updatedBy?.userType || "-" },
                            { label: "Updated At", value: formatDate(section.updatedAt) },
                        ].map(({ label, value, onClick }) => (
                            <div key={label}>
                                <p className="text-[10px] font-extrabold text-[#94a3b8] dark:text-slate-500 uppercase tracking-[0.1em] mb-1">
                                    {label}
                                </p>
                                <p 
                                    className={`text-[11px] font-bold text-[#334155] dark:text-slate-300 ${onClick ? "cursor-pointer hover:underline text-primary transition-colors" : ""}`}
                                    onClick={onClick}
                                >
                                    {value}
                                </p>
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
                            onClick={() => onAuditTrail(section._id)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <History size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(section)}
                            className="w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Pencil size={16} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(section)}
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
