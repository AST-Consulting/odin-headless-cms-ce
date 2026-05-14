"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCategory, updateCategory } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateCategoryDTO, Category } from "@/lib/types";
import { SeoForm } from "@/components/forms/SeoForm";
import { PrimaryCategorySelector } from "@/components/common/PrimaryCategorySelector";

interface CreateCategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    categoryToEdit?: Category | null;
}

export function CreateCategoryDialog({ open, onOpenChange, onSuccess, categoryToEdit }: CreateCategoryDialogProps) {
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [isSeoOpen, setIsSeoOpen] = useState(true);

    // Form State
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [order, setOrder] = useState("0");
    const [isFeatured, setIsFeatured] = useState("false");
    const [link, setLink] = useState("");
    const [parentId, setParentId] = useState<string | null>(null);

    // SEO State
    const [metaTitle, setMetaTitle] = useState("");
    const [metaDescription, setMetaDescription] = useState("");
    const [keywords, setKeywords] = useState("");
    const [ogTitle, setOgTitle] = useState("");
    const [ogDescription, setOgDescription] = useState("");
    const [ogUrl, setOgUrl] = useState("");

    useEffect(() => {
        if (open) {
            if (categoryToEdit) {
                setTitle(categoryToEdit.title || "");
                setDescription(categoryToEdit.description || "");
                setOrder(categoryToEdit.rank?.toString() || "0");
                setIsFeatured(categoryToEdit.isFeatured ? "true" : "false");
                setLink(categoryToEdit.link || "");
                setParentId(categoryToEdit.parent?.id || categoryToEdit.parentId || null);

                if (categoryToEdit.seo) {
                    setMetaTitle(categoryToEdit.seo.title || "");
                    setMetaDescription(categoryToEdit.seo.metaDescription || "");
                    setKeywords(categoryToEdit.seo.keywords?.join(", ") || "");
                    if (categoryToEdit.seo.og) {
                        setOgTitle(categoryToEdit.seo.og.title || "");
                        setOgDescription(categoryToEdit.seo.og.description || "");
                        setOgUrl(categoryToEdit.seo.og.url || "");
                    } else {
                        setOgTitle("");
                        setOgDescription("");
                        setOgUrl("");
                    }
                } else {
                    setMetaTitle("");
                    setMetaDescription("");
                    setKeywords("");
                    setOgTitle("");
                    setOgDescription("");
                    setOgUrl("");
                }
            } else {
                resetForm();
            }
        }
    }, [open, categoryToEdit]);

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
                description,
                rank: parseInt(order) || 0,
                isFeatured: isFeatured === "true",
                link,
                parentId: parentId || undefined,
                status: categoryToEdit ? categoryToEdit.status : "active", // Default status
                propertyId: selectedProperty._id,
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

            if (categoryToEdit) {
                await updateCategory(categoryToEdit._id, payload);
                toast({ title: "Success", description: "Category updated successfully" });
            } else {
                await createCategory(payload);
                toast({ title: "Success", description: "Category created successfully" });
            }

            onSuccess();
            onOpenChange(false);
            resetForm();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || `Failed to ${categoryToEdit ? 'update' : 'create'} category`, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setOrder("0");
        setIsFeatured("false");
        setLink("");
        setParentId(null);
        setMetaTitle("");
        setMetaDescription("");
        setKeywords("");
        setOgTitle("");
        setOgDescription("");
        setOgUrl("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl md:max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{categoryToEdit ? "Edit Category" : "Create Category"}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Category Title *</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Category Title" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="order">Order *</Label>
                            <Input id="order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="isFeatured">Is Featured</Label>
                            <Select value={isFeatured} onValueChange={setIsFeatured}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="false">False</SelectItem>
                                    <SelectItem value="true">True</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="link">Link</Label>
                            <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="parentId">Parent</Label>
                            <PrimaryCategorySelector selected={parentId} onChange={setParentId} placeholder="Select parent category" />
                        </div>
                    </div>

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
                    />
                </div>

                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? (categoryToEdit ? "Updating..." : "Creating...") : (categoryToEdit ? "Update Category" : "Create Category")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
