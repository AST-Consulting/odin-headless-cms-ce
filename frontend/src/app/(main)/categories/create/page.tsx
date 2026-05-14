"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { createCategory, uploadFile } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateCategoryDTO } from "@/lib/types";
import { SeoForm } from "@/components/forms/SeoForm";
import { PrimaryCategorySelector } from "@/components/common/PrimaryCategorySelector";
import { MinimalHtmlEditor } from "@/components/editor/MinimalHtmlEditor";
import { MediaFieldInput } from "@/components/content-manager/MediaFieldInput";
import { MediaRef } from "@/lib/types";

export default function CreateCategoryPage() {
    const router = useRouter();
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [isSeoOpen, setIsSeoOpen] = useState(true);
    const handleEditorUpload = (file: File) => uploadFile(file, false, selectedProperty?._id);

    // Form State
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [order, setOrder] = useState("0");
    const [isFeatured, setIsFeatured] = useState("false");
    const [link, setLink] = useState("");
    const [parentId, setParentId] = useState<string | null>(null);
    const [icon, setIcon] = useState<MediaRef | null>(null);

    // SEO State
    const [metaTitle, setMetaTitle] = useState("");
    const [metaDescription, setMetaDescription] = useState("");
    const [keywords, setKeywords] = useState("");
    const [ogTitle, setOgTitle] = useState("");
    const [ogDescription, setOgDescription] = useState("");
    const [ogUrl, setOgUrl] = useState("");

    const handleSubmit = async () => {
        if (!title) {
            toast({ title: "Error", description: "Title is required", variant: "destructive" });
            return;
        }
        if (!selectedProperty) {
            toast({ title: "Error", description: "No property selected", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            // Check if any SEO fields have actual content (not empty strings)
            const hasSeoData = metaTitle.trim() || metaDescription.trim() || keywords.trim() ||
                ogTitle.trim() || ogDescription.trim() || ogUrl.trim();

            const payload: CreateCategoryDTO = {
                title,
                slug: slug || undefined,
                description,
                rank: parseInt(order) || 0,
                isFeatured: isFeatured === "true",
                link,
                parentId: parentId || undefined,
                status: "active",
                propertyId: selectedProperty._id,
                icon: icon || undefined,
            };

            // Only include SEO if at least some fields have content
            if (hasSeoData) {
                payload.seo = {
                    title: metaTitle,
                    metaDescription: metaDescription,
                    keywords: keywords.split(",").map(k => k.trim()).filter(k => k),
                    og: {
                        title: ogTitle,
                        description: ogDescription,
                        url: ogUrl,
                    }
                };
            }

            await createCategory(payload);
            toast({ title: "Success", description: "Category created successfully" });
            await new Promise((resolve) => setTimeout(resolve, 700));
            router.push("/categories");
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to create category", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-full space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 sm:gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/categories")}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Create Category</h1>
                </div>
            </div>

            <Card>
                <CardHeader className="space-y-1 sm:space-y-1.5">
                    <CardTitle className="text-lg sm:text-xl">Category Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Category Title <span className="text-red-500">*</span></Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Category Title"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slug">Slug</Label>
                            <Input
                                id="slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="Auto-generated if empty. Appends -1, -2 for duplicates."
                                className="h-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <MinimalHtmlEditor
                            defaultHtml={description}
                            onChange={setDescription}
                            ariaLabel="Description"
                            disabled={loading}
                            uploadFile={handleEditorUpload}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="order">Order <span className="text-red-500">*</span></Label>
                            <Input
                                id="order"
                                type="number"
                                value={order}
                                onChange={(e) => setOrder(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="isFeatured">Is Featured</Label>
                            <Select value={isFeatured} onValueChange={setIsFeatured}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="false">False</SelectItem>
                                    <SelectItem value="true">True</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="link">Link</Label>
                            <Input
                                id="link"
                                value={link}
                                onChange={(e) => setLink(e.target.value)}
                                placeholder="Link"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="parentId">Parent</Label>
                            <PrimaryCategorySelector
                                selected={parentId}
                                onChange={setParentId}
                                placeholder="Select parent category"
                                className="h-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Icon Image</Label>
                        <MediaFieldInput
                            field={{
                                name: "icon",
                                type: "media",
                                mediaMultiple: false,
                                mediaAllowedTypes: ["image"]
                            } as any}
                            value={icon}
                            onChange={(val) => setIcon(val as MediaRef | null)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <SeoForm
                        isOpen={isSeoOpen}
                        onOpenChange={setIsSeoOpen}
                        metaTitle={metaTitle}
                        setMetaTitle={setMetaTitle}
                        metaDescription={metaDescription}
                        setMetaDescription={setMetaDescription}
                        keywords={keywords}
                        setKeywords={setKeywords}
                        ogTitle={ogTitle}
                        setOgTitle={setOgTitle}
                        ogDescription={ogDescription}
                        setOgDescription={setOgDescription}
                        ogUrl={ogUrl}
                        setOgUrl={setOgUrl}
                        richDescriptions
                    />
                </CardContent>
            </Card>

            {/* Action Buttons - Responsive */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-4 sm:pb-0">
                <Button
                    variant="outline"
                    onClick={() => router.push("/categories")}
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
                    {loading ? "Creating..." : "Create Category"}
                </Button>
            </div>
        </div>
    );
}