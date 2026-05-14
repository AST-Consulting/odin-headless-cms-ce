"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Globe, Search } from "lucide-react";
import { UseFormRegister, UseFormWatch } from "react-hook-form";
import { usePropertyStore } from "@/lib/store";

interface SeoDiscoverySectionProps {
    // Option 1: Using react-hook-form (preferred)
    register?: UseFormRegister<any>;
    watch?: UseFormWatch<any>;

    // Option 2: Using manual state (for pages not using react-hook-form)
    manualValues?: {
        name: string;
        description: string;
        username: string;
        slug: string;
        seoTitle: string;
        seoMetaDescription: string;
    };
    onManualChange?: (field: string, value: string) => void;

    // External data for fallbacks
    userData?: any;
    disabled?: boolean;
    defaultOpen?: boolean;
    isNewUser?: boolean;
}

export function SeoDiscoverySection({
    register,
    watch,
    manualValues,
    onManualChange,
    userData,
    disabled = false,
    defaultOpen = true,
    isNewUser = false,
}: SeoDiscoverySectionProps) {
    // Unified value helper
    const getValue = (field: string, manualKey: keyof NonNullable<typeof manualValues>): string => {
        if (watch) return watch(field) || "";
        return manualValues?.[manualKey] || "";
    };

    // Get current values for the preview
    const name = getValue("name", "name") || userData?.name || "Author Name";
    const description = getValue("description", "description") || userData?.description || "";
    const username = getValue("username", "username") || "";
    const slug = getValue("slug", "slug") || "";
    const seoTitleOverride = getValue("seo.title", "seoTitle") || getValue("seoTitle", "seoTitle");
    const seoDescOverride = getValue("seo.metaDescription", "seoMetaDescription") || getValue("seoMetaDescription", "seoMetaDescription");

    const { selectedProperty } = usePropertyStore();

    const orgName = userData?.organization?.name || userData?.companyName || "Organization Name";
    const domain = (userData?.organization?.domain || selectedProperty?.domain || "yourdomain.com").replace(/\/$/, "");

    // SEO Logic
    const previewName = name || "Author Name";
    const previewOrg = orgName;
    const previewSlug = slug || username || "your-identity";

    // Meta Title Fallback: {Author Name} at {Organization Name}
    const previewTitle = seoTitleOverride || `${previewName} at ${previewOrg}`;

    // Meta Description Fallback: {Author Name}, {Bio (first 30 chars)}. Read on {Organization Name}
    const bioExcerpt = description.substring(0, 30);
    const previewDescription = seoDescOverride || (description
        ? `${previewName}, ${bioExcerpt}. Read on ${previewOrg}`
        : `${previewName}, {Author Bio}. Read on ${previewOrg}`);

    const previewFullUrl = `${domain}/author/${previewSlug}`;
    const absoluteUrl = previewFullUrl.startsWith('http') ? previewFullUrl : `https://${previewFullUrl}`;

    // Input bindings
    const bindInput = (field: string, manualKey: keyof NonNullable<typeof manualValues>) => {
        if (register) return register(field);
        return {
            value: manualValues?.[manualKey] || "",
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                onManualChange?.(manualKey, e.target.value)
        };
    };

    return (
        <Collapsible defaultOpen={defaultOpen}>
            <Card className="border-none shadow-lg overflow-hidden">
                <CollapsibleTrigger className="w-full text-left group">
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 dark:border-slate-800 pb-4">
                        <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 shrink-0">
                            <Search className="h-5 w-5 shrink-0" />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-xl">SEO & Discovery</CardTitle>
                            <CardDescription>
                                Optimize how this profile is indexed by search engines.
                            </CardDescription>
                        </div>
                        <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    Public Username
                                </Label>
                                <Input
                                    {...bindInput("username", "username")}
                                    placeholder="username"
                                    className="h-11 font-mono text-sm"
                                    disabled={disabled}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    URL Slug
                                </Label>
                                <Input
                                    {...bindInput("slug", "slug")}
                                    placeholder="profile-path"
                                    className="h-11 font-mono text-sm bg-slate-50/50 dark:bg-slate-900/50"
                                    disabled={disabled}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    Meta Title Override
                                </Label>
                                <Input
                                    {...bindInput(register ? "seo.title" : "seoTitle", "seoTitle")}
                                    placeholder="Default: Display Name"
                                    className="h-11"
                                    disabled={disabled}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    Meta Description Override
                                </Label>
                                <Textarea
                                    {...bindInput(register ? "seo.metaDescription" : "seoMetaDescription", "seoMetaDescription")}
                                    placeholder="Brief snippet for search engine previews..."
                                    className="min-h-[100px] resize-none py-3"
                                    disabled={disabled}
                                />
                            </div>
                        </div>

                        {/* Search Engine Preview */}
                        {isNewUser ? (
                            <div className="p-5 rounded-2xl bg-slate-900 shadow-2xl space-y-3 block">
                                <div className="flex items-center gap-2 mb-1">
                                    <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                        Search Engine Preview
                                    </span>
                                </div>
                                <div className="space-y-1.5 rounded-lg transition-all">
                                    <div className="text-sky-400 text-lg font-medium underline-offset-4 block w-fit shrink-0">
                                        {previewTitle}
                                    </div>
                                    <div className="flex items-center gap-1.5 w-fit shrink-0">
                                        <Globe className="h-3 w-3 text-emerald-500 shrink-0" />
                                        <p className="text-emerald-500/80 text-[11px] font-mono tracking-tight font-medium truncate shrink-0">
                                            {domain}/author/{previewSlug}
                                        </p>
                                    </div>
                                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 italic shrink-0">
                                        {previewDescription}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <a 
                                href={absoluteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-5 rounded-2xl bg-slate-900 shadow-2xl space-y-3 block"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                        Search Engine Preview
                                    </span>
                                </div>
                                <div className="space-y-1.5 rounded-lg transition-all">
                                    <div className="text-sky-400 text-lg font-medium underline-offset-4 hover:underline decoration-sky-400/30 transition-all block w-fit shrink-0">
                                        {previewTitle}
                                    </div>
                                    <div className="flex items-center gap-1.5 hover:opacity-80 transition-opacity w-fit shrink-0">
                                        <Globe className="h-3 w-3 text-emerald-500 shrink-0" />
                                        <p className="text-emerald-500/80 text-[11px] font-mono tracking-tight font-medium truncate shrink-0">
                                            {domain}/author/{previewSlug}
                                        </p>
                                    </div>
                                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 italic shrink-0">
                                        {previewDescription}
                                    </p>
                                </div>
                            </a>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
