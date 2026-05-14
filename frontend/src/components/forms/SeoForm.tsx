"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MinimalHtmlEditor } from "@/components/editor/MinimalHtmlEditor";

interface SeoFormProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    metaTitle: string;
    setMetaTitle: (value: string) => void;
    metaDescription: string;
    setMetaDescription: (value: string) => void;
    keywords: string;
    setKeywords: (value: string) => void;
    ogTitle: string;
    setOgTitle: (value: string) => void;
    ogDescription: string;
    setOgDescription: (value: string) => void;
    ogUrl: string;
    setOgUrl: (value: string) => void;
    richDescriptions?: boolean;
}

export function SeoForm({
    isOpen,
    onOpenChange,
    metaTitle,
    setMetaTitle,
    metaDescription,
    setMetaDescription,
    keywords,
    setKeywords,
    ogTitle,
    setOgTitle,
    ogDescription,
    setOgDescription,
    ogUrl,
    setOgUrl,
    richDescriptions = false,
}: SeoFormProps) {
    return (
        <div className="border rounded-md p-4">
            <Collapsible open={isOpen} onOpenChange={onOpenChange}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">SEO</h3>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="metaTitle">Meta Title</Label>
                        <Input
                            id="metaTitle"
                            value={metaTitle}
                            onChange={(e) => setMetaTitle(e.target.value)}
                            placeholder="Meta Title"
                        />
                    </div>

                    {richDescriptions ? (
                        <div className="space-y-2">
                            <Label htmlFor="metaDescription">Meta Description</Label>
                            <MinimalHtmlEditor
                                defaultHtml={metaDescription}
                                onChange={setMetaDescription}
                                ariaLabel="Meta Description"
                            />
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="metaDescription">Meta Description</Label>
                                <Input
                                    id="metaDescription"
                                    value={metaDescription}
                                    onChange={(e) => setMetaDescription(e.target.value)}
                                    placeholder="Meta Description"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="keywords">Keywords</Label>
                            <Input
                                id="keywords"
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                placeholder="Keywords (comma separated)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ogTitle">OG Title</Label>
                            <Input
                                id="ogTitle"
                                value={ogTitle}
                                onChange={(e) => setOgTitle(e.target.value)}
                                placeholder="OG Title"
                            />
                        </div>
                    </div>

                    {richDescriptions ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="ogDescription">OG Description</Label>
                                <MinimalHtmlEditor
                                    defaultHtml={ogDescription}
                                    onChange={setOgDescription}
                                    ariaLabel="OG Description"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ogUrl">OG Url</Label>
                                <Input
                                    id="ogUrl"
                                    value={ogUrl}
                                    onChange={(e) => setOgUrl(e.target.value)}
                                    placeholder="OG Url"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="ogDescription">OG Description</Label>
                                <Input
                                    id="ogDescription"
                                    value={ogDescription}
                                    onChange={(e) => setOgDescription(e.target.value)}
                                    placeholder="OG Description"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ogUrl">OG Url</Label>
                                <Input
                                    id="ogUrl"
                                    value={ogUrl}
                                    onChange={(e) => setOgUrl(e.target.value)}
                                    placeholder="OG Url"
                                />
                            </div>
                        </div>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
