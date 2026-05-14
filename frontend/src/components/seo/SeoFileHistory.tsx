"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { SeoFileType } from '@/lib/api';

interface HistoryEntry {
    _id: string;
    version: string;
    createdBy: { id: string; name: string; email: string; userType: string };
    content: string;
    createdAt: string;
}

interface Props {
    fileType: SeoFileType;
    history: HistoryEntry[];
    onRevert?: (version: string) => void;
    onDelete?: (version: string) => void;
}

export function SeoFileHistory({ fileType, history, onRevert, onDelete }: Props) {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const toggleRow = (id: string) => setExpandedRow(expandedRow === id ? null : id);

    const handleRevert = (e: React.MouseEvent, version: string) => {
        e.stopPropagation();
        onRevert?.(version);
    };

    const handleDelete = (e: React.MouseEvent, version: string) => {
        e.stopPropagation();
        onDelete?.(version);
    };

    const label = `${fileType}.txt`;

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-2xl font-semibold capitalize">{label} History</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                    View previous versions. Click &quot;Revert&quot; to restore a version as active.
                </p>
            </CardHeader>

            <CardContent className="p-0">
                <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="min-w-[700px]">
                            {/* Header */}
                            <div className="grid grid-cols-[40px_1fr_1fr_1fr_120px_100px] gap-4 px-4 py-3 bg-muted/50 border-b font-medium text-sm">
                                <div />
                                <div>Version</div>
                                <div>Date</div>
                                <div>By</div>
                                <div className="text-center">Revert</div>
                                <div className="text-center">Delete</div>
                            </div>

                            {/* Body */}
                            <div className="max-h-[350px] overflow-y-auto">
                                <div className="divide-y">
                                    {history.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-muted-foreground">
                                            No history available
                                        </div>
                                    ) : (
                                        [...history].reverse().map((item) => (
                                            <div key={item._id} className="relative">
                                                <div
                                                    className={cn(
                                                        "grid grid-cols-[40px_1fr_1fr_1fr_120px_100px] gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer",
                                                        expandedRow === item._id && "bg-muted/20"
                                                    )}
                                                    onClick={() => toggleRow(item._id)}
                                                >
                                                    <span className="flex items-center justify-center">
                                                        {expandedRow === item._id
                                                            ? <ChevronDown className="h-4 w-4" />
                                                            : <ChevronRight className="h-4 w-4" />}
                                                    </span>
                                                    <div className="flex items-center text-sm">
                                                        {item.version}
                                                    </div>
                                                    <div className="flex items-center text-sm">
                                                        {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                                                    </div>
                                                    <div className="flex items-center text-sm">
                                                        {item.createdBy?.name ?? '—'}
                                                    </div>
                                                    <div className="flex items-center justify-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={(e) => handleRevert(e, item.version)}
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                            Revert
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center justify-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-2 text-destructive hover:text-destructive"
                                                            onClick={(e) => handleDelete(e, item.version)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>

                                                {expandedRow === item._id && (
                                                    <div className="px-4 pb-4 bg-muted/10">
                                                        <div className="bg-background border rounded-lg p-4 mt-2">
                                                            <pre className="font-mono text-sm whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
                                                                {item.content}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
