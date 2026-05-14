"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronRight } from "lucide-react";

interface ValidationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    errors: string[];
    warnings?: string[];
    onBackToEditor: () => void;
}

export function ValidationDialog({
    open,
    onOpenChange,
    errors,
    warnings = [],
    onBackToEditor,
}: ValidationDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-destructive mb-2">
                        <AlertCircle className="h-5 w-5" />
                        <DialogTitle>Content Validation Issues</DialogTitle>
                    </div>
                    <DialogDescription>
                        The following critical issues must be resolved before you can save this article.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {errors.length > 0 && (
                        <div className="space-y-3">
                            {errors.map((error, index) => (
                                <div
                                    key={index}
                                    className="flex gap-3 items-start text-sm bg-destructive/5 dark:bg-destructive/10 p-3 rounded-lg border border-destructive/20 text-destructive shadow-sm"
                                >
                                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span className="font-medium">{error}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {warnings.length > 0 && (
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider px-1">
                                Recommendations
                            </div>
                            {warnings.map((warning, index) => (
                                <div
                                    key={index}
                                    className="flex gap-3 items-start text-sm bg-yellow-500/5 dark:bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 shadow-sm"
                                >
                                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span className="font-medium">{warning}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button 
                        variant="secondary" 
                        onClick={onBackToEditor} 
                        className="w-full sm:w-auto font-medium transition-all hover:translate-x-0.5"
                    >
                        Back to Editor
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
