"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { updateCategory, getCategories, getCategoryById, uploadFile } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateCategoryDTO, Category } from "@/lib/types";
import { SeoForm } from "@/components/forms/SeoForm";
import { PrimaryCategorySelector } from "@/components/common/PrimaryCategorySelector";
import { MinimalHtmlEditor } from "@/components/editor/MinimalHtmlEditor";
import { MediaFieldInput } from "@/components/content-manager/MediaFieldInput";
import { MediaRef } from "@/lib/types";

export default function EditCategoryPage() {
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);
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
    const [status, setStatus] = useState("active");
    const [icon, setIcon] = useState<MediaRef | null>(null);
    const [fullSlug, setFullSlug] = useState("");
    const [parentPath, setParentPath] = useState("");

    // SEO State
    const [metaTitle, setMetaTitle] = useState("");
    const [metaDescription, setMetaDescription] = useState("");
    const [keywords, setKeywords] = useState("");
    const [ogTitle, setOgTitle] = useState("");
    const [ogDescription, setOgDescription] = useState("");
    const [ogUrl, setOgUrl] = useState("");

    const categoryId = params.id as string;

    // Fetch category data
    useEffect(() => {
        const fetchCategory = async () => {
            if (!categoryId || !selectedProperty) return;

            setFetchingData(true);
            try {
                // Fetch category by id
                const category = await getCategoryById(categoryId);
                if (category) {
                    setTitle(category.title || "");
                    setSlug(category.slug || "");
                    setDescription(category.description || "");
                    setOrder(category.rank?.toString() || "0");
                    setIsFeatured(category.isFeatured ? "true" : "false");
                    setLink(category.link || "");
                    setParentId(category.parent?.id || category.parentId || null);
                    setStatus(category.status || "active");
                    setIcon(category.icon || null);
                    setFullSlug(category.fullSlug || "");
                    
                    // Extract parent path from fullSlug
                    if (category.fullSlug && category.slug) {
                        const pathParts = category.fullSlug.split('/');
                        pathParts.pop(); // Remove current slug
                        setParentPath(pathParts.join('/'));
                    }

                    // Populate SEO fields if they exist
                    if (category.seo) {
                        setMetaTitle(category.seo.title || "");
                        setMetaDescription(category.seo.metaDescription || "");
                        setKeywords(category.seo.keywords?.join(", ") || "");
                        if (category.seo.og) {
                            setOgTitle(category.seo.og.title || "");
                            setOgDescription(category.seo.og.description || "");
                            setOgUrl(category.seo.og.url || "");
                        }
                    }
                } else {
                    toast({
                        title: "Error",
                        description: "Category not found",
                        variant: "destructive",
                    });
                    router.push("/categories");
                }
            } catch (error: any) {
                toast({
                    title: "Error",
                    description: error.message || "Failed to fetch category",
                    variant: "destructive",
                });
                router.push("/categories");
            } finally {
                setFetchingData(false);
            }
        };

        fetchCategory();
    }, [categoryId, selectedProperty?._id]);

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

            const payload: Partial<CreateCategoryDTO> = {
                title,
                slug: slug || undefined,
                description,
                rank: parseInt(order) || 0,
                isFeatured: isFeatured === "true",
                link,
                parentId: parentId || undefined,
                status,
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

            await updateCategory(categoryId, payload);
            toast({ title: "Success", description: "Category updated successfully" });
            await new Promise((resolve) => setTimeout(resolve, 700));
            router.push("/categories");
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to update category", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (fetchingData) {
        return (
            <div className="w-full max-w-full space-y-4 sm:space-y-6">
                <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">Loading category...</p>
                </div>
            </div>
        );
    }

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
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Edit Category</h1>
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
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slug">Slug</Label>
                            <Input
                                id="slug"
                                value={slug}
                                onChange={(e) => {
                                    const newSlug = e.target.value;
                                    setSlug(newSlug);
                                    if (parentPath) {
                                        setFullSlug(`${parentPath}/${newSlug}`);
                                    } else {
                                        setFullSlug(newSlug);
                                    }
                                }}
                                placeholder="Auto-generated if empty. Appends -1, -2 for duplicates."
                                className="h-10"
                                disabled={loading}
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
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="isFeatured">Is Featured</Label>
                            <Select value={isFeatured} onValueChange={setIsFeatured} disabled={loading}>
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
                                value={link || (fullSlug ? `/${fullSlug}` : "")}
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    setLink(newValue);
                                    
                                    // Two-way sync: If editing internal-style path, update the slug
                                    if (parentPath && newValue.startsWith(`/${parentPath}/`)) {
                                        const extractedSlug = newValue.replace(`/${parentPath}/`, "");
                                        if (extractedSlug && !extractedSlug.includes("/")) {
                                            setSlug(extractedSlug);
                                            setFullSlug(`${parentPath}/${extractedSlug}`);
                                        }
                                    } else if (!parentPath && newValue.startsWith("/")) {
                                        const extractedSlug = newValue.slice(1);
                                        if (extractedSlug && !extractedSlug.includes("/")) {
                                            setSlug(extractedSlug);
                                            setFullSlug(extractedSlug);
                                        }
                                    }
                                }}
                                placeholder="Link (defaults to full slug)"
                                className="h-10"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="parentId">Parent</Label>
                            <PrimaryCategorySelector 
                                selected={parentId} 
                                onChange={setParentId} 
                                onCategoryChange={(cat) => {
                                    if (cat) {
                                        const pPath = cat.fullSlug || cat.slug;
                                        setParentPath(pPath);
                                        setFullSlug(`${pPath}/${slug}`);
                                    } else {
                                        setParentPath("");
                                        setFullSlug(slug);
                                    }
                                }}
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

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={status} onValueChange={setStatus} disabled={loading}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
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
                    {loading ? "Updating..." : "Update Category"}
                </Button>
            </div>
        </div>
    );
}
