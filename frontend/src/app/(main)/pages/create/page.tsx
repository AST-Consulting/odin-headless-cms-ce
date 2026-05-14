"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { usePropertyStore } from "@/lib/store";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { CategorySelector } from "@/components/common/CategorySelector";
import { TagSelector } from "@/components/common/TagSelector";
import { createPage, type CreatePageData } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateStaticPage() {
    const router = useRouter();
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [isSeoOpen, setIsSeoOpen] = useState(false);

    // Basic Information
    const [title, setTitle] = useState("");
    const [status, setStatus] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [metaKeywords, setMetaKeywords] = useState("");
    const [content, setContent] = useState("");

    // SEO Fields
    const [seoTitle, setSeoTitle] = useState("");
    const [seoDescription, setSeoDescription] = useState("");
    const [seoKeywords, setSeoKeywords] = useState("");
    const [ogTitle, setOgTitle] = useState("");
    const [ogDescription, setOgDescription] = useState("");
    const [ogUrl, setOgUrl] = useState("");
    const [ogImage, setOgImage] = useState("");

    const handleSubmit = async () => {
        if (!title) {
            toast({ title: "Error", description: "Please fill in the title", variant: "destructive" });
            return;
        }
        if (!selectedProperty) {
            toast({ title: "Error", description: "No property selected", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const hasSeoData =
                seoTitle ||
                seoDescription ||
                seoKeywords ||
                ogTitle ||
                ogDescription ||
                ogUrl ||
                ogImage;

            const payload: any = {
                title,
                status,
                content,
                propertyId: selectedProperty._id,
                tags: selectedTags,
                categories: selectedCategories,
                isPublished: false,
            };

            if (seoDescription) {
                payload.metaDescription = seoDescription;
            }

            if (metaKeywords) {
                payload.metaKeywords = metaKeywords.split(",").map((k) => k.trim());
            } else {
                payload.metaKeywords = [];
            }

            if (hasSeoData) {
                payload.seo = {
                    title: seoTitle || title,
                    description: seoDescription,
                    keywords: seoKeywords ? seoKeywords.split(",").map((k) => k.trim()) : [],
                    og: {
                        title: ogTitle || seoTitle || title,
                        description: ogDescription || seoDescription,
                        url: ogUrl,
                        image: ogImage,
                    },
                };
            }

            await createPage(payload);
            toast({ title: "Success", description: "Page created successfully" });
            // Wait for Elasticsearch to index the new page before navigating
            await new Promise(resolve => setTimeout(resolve, 700));
            router.push("/pages");
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to create page",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-full space-y-4 sm:space-y-6">
            {/* Header - Responsive */}
            <div className="flex items-center gap-2 sm:gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/pages")}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Create Static Page</h1>
                    <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1 truncate">
                        Create a new static page for your website
                    </p>
                </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
                {/* Basic Information Section - Responsive */}
                <Card>
                    <CardHeader className="space-y-1 sm:space-y-1.5">
                        <CardTitle className="text-lg sm:text-xl">Basic Information</CardTitle>
                        <CardDescription className="text-sm">
                            Enter the basic details for your static page
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 sm:space-y-6">
                        {/* Responsive grid - 1 column on mobile, 2 on desktop */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter page title"
                                    className="h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status">Status <span className="text-red-500">*</span></Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Responsive grid for tags and categories */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tags</Label>
                                <TagSelector
                                    selected={selectedTags}
                                    onChange={setSelectedTags}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Categories</Label>
                                <CategorySelector
                                    selected={selectedCategories}
                                    onChange={setSelectedCategories}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Keywords</Label>
                            <Input
                                value={metaKeywords}
                                onChange={(e) => setMetaKeywords(e.target.value)}
                                placeholder="Enter keywords separated by commas"
                                className="h-10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <RichTextEditor
                                value={content}
                                onChange={setContent}
                                title="page description"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* SEO Section - Responsive */}
                <Card>
                    <CardHeader className="space-y-1 sm:space-y-1.5">
                        <Collapsible open={isSeoOpen} onOpenChange={setIsSeoOpen}>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                                    <div className="text-left">
                                        <CardTitle className="text-lg sm:text-xl">SEO Settings</CardTitle>
                                        <CardDescription className="text-sm mt-0.5 sm:mt-1 hidden sm:block">
                                            Configure search engine optimization settings
                                        </CardDescription>
                                    </div>
                                    <ChevronDown
                                        className={`h-4 w-4 shrink-0 transition-transform ${isSeoOpen ? "transform rotate-180" : ""}`}
                                    />
                                </Button>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                                <CardContent className="pt-4 sm:pt-6 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="seoTitle">SEO Title</Label>
                                        <Input
                                            id="seoTitle"
                                            value={seoTitle}
                                            onChange={(e) => setSeoTitle(e.target.value)}
                                            placeholder="Enter SEO title"
                                            className="h-10"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="seoDescription">SEO Description</Label>
                                        <Textarea
                                            id="seoDescription"
                                            value={seoDescription}
                                            onChange={(e) => setSeoDescription(e.target.value)}
                                            placeholder="Enter SEO description"
                                            rows={3}
                                            className="resize-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="seoKeywords">SEO Keywords</Label>
                                        <Input
                                            id="seoKeywords"
                                            value={seoKeywords}
                                            onChange={(e) => setSeoKeywords(e.target.value)}
                                            placeholder="Enter SEO keywords separated by commas"
                                            className="h-10"
                                        />
                                    </div>

                                    <div className="border-t pt-4 mt-4">
                                        <h4 className="text-sm font-medium mb-3">Open Graph (OG) Tags</h4>

                                        {/* Responsive grid for OG fields */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="ogTitle">OG Title</Label>
                                                <Input
                                                    id="ogTitle"
                                                    value={ogTitle}
                                                    onChange={(e) => setOgTitle(e.target.value)}
                                                    placeholder="Enter OG title"
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="ogUrl">OG URL</Label>
                                                <Input
                                                    id="ogUrl"
                                                    value={ogUrl}
                                                    onChange={(e) => setOgUrl(e.target.value)}
                                                    placeholder="Enter OG URL"
                                                    className="h-10"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2 mt-4">
                                            <Label htmlFor="ogDescription">OG Description</Label>
                                            <Textarea
                                                id="ogDescription"
                                                value={ogDescription}
                                                onChange={(e) => setOgDescription(e.target.value)}
                                                placeholder="Enter OG description"
                                                rows={3}
                                                className="resize-none"
                                            />
                                        </div>

                                        <div className="space-y-2 mt-4">
                                            <Label htmlFor="ogImage">OG Image URL</Label>
                                            <Input
                                                id="ogImage"
                                                value={ogImage}
                                                onChange={(e) => setOgImage(e.target.value)}
                                                placeholder="Enter OG image URL"
                                                className="h-10"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </CardHeader>
                </Card>
            </div>

            {/* Action Buttons - Responsive: Full width on mobile, right-aligned on desktop */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2 pb-4 sm:pb-0">
                <Button 
                    variant="outline" 
                    onClick={() => router.push("/pages")} 
                    disabled={loading}
                    className="w-full sm:w-auto h-10"
                >
                    Cancel
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="w-full sm:w-auto h-10"
                >
                    {loading ? "Creating..." : "Create Page"}
                </Button>
            </div>
        </div>
    );
}
