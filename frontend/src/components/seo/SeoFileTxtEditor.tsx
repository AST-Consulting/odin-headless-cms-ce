"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { usePropertyStore } from '@/lib/store';
import { getSeoFileHistory, updateSeoFile, SeoFileType } from '@/lib/api';

const FILE_META: Record<SeoFileType, { label: string; description: string; placeholder: string }> = {
    robots: {
        label: 'robots.txt',
        description: 'Control which bots can access your site and link to your sitemap.',
        placeholder: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml',
    },
    ads: {
        label: 'ads.txt',
        description: 'Declare authorized digital sellers for your ad inventory (IAB standard).',
        placeholder: '# google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0',
    },
    llms: {
        label: 'llms.txt',
        description: 'Provide guidance to Large Language Models about your site content and usage.',
        placeholder: '# llms.txt\n\n> Site Name\n\nShort description of your site.',
    },
};

interface Props {
    fileType: SeoFileType;
    onSaved?: () => void;
}

export function SeoFileTxtEditor({ fileType, onSaved }: Props) {
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const propertyId = usePropertyStore((state) => state.selectedProperty?._id);
    const meta = FILE_META[fileType];

    const loadContent = async () => {
        if (!propertyId) { setContent(''); setOriginalContent(''); return; }
        setIsLoading(true);
        try {
            const history = await getSeoFileHistory(propertyId, fileType);
            if (Array.isArray(history) && history.length > 0) {
                const latest = history[history.length - 1].content ?? '';
                setContent(latest);
                setOriginalContent(latest);
            }
        } catch {
            toast.error(`Failed to load ${meta.label}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadContent(); }, [propertyId, fileType]);

    // Listen for rollback events from the history panel
    useEffect(() => {
        const handler = () => loadContent();
        window.addEventListener(`seo-file-updated-${fileType}`, handler);
        return () => window.removeEventListener(`seo-file-updated-${fileType}`, handler);
    }, [propertyId, fileType]);

    const handleSave = async () => {
        if (!propertyId) { toast.error('Please select a property first'); return; }
        setIsLoading(true);
        try {
            await updateSeoFile(propertyId, fileType, content);
            setOriginalContent(content);
            setIsEditMode(false);
            toast.success('Changes saved successfully!');
            onSaved?.();
        } catch {
            toast.error(`Failed to save ${meta.label}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => { setContent(originalContent); setIsEditMode(false); };
    const handleReset = () => { setContent(originalContent); };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-semibold">Edit {meta.label}</CardTitle>
                        <CardDescription className="mt-1">{meta.description}</CardDescription>
                    </div>
                    {!isEditMode ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => setIsEditMode(true)}
                            disabled={!propertyId || isLoading}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={handleCancel}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm p-4 leading-relaxed bg-muted/30 focus-visible:ring-primary"
                    placeholder={
                        isLoading ? `Loading ${meta.label}...`
                        : !propertyId ? 'Please select a property first'
                        : meta.placeholder
                    }
                    spellCheck={false}
                    readOnly={!isEditMode}
                />
            </CardContent>

            <CardFooter className="flex justify-between items-center border-t py-4 bg-muted/5">
                <Button
                    variant="outline"
                    onClick={handleReset}
                    className="gap-2"
                    disabled={!isEditMode || isLoading || !propertyId}
                >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                </Button>
                <Button
                    onClick={handleSave}
                    className="gap-2 px-6"
                    disabled={!isEditMode || isLoading || !propertyId}
                >
                    <Save className="h-4 w-4" />
                    Save Changes
                </Button>
            </CardFooter>
        </Card>
    );
}
