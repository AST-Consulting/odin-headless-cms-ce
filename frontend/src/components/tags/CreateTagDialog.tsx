"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTag, updateTag } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateTagDTO, Tag } from "@/lib/types";
import { SeoForm } from "@/components/forms/SeoForm";

interface CreateTagDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    tagToEdit?: Tag | null;
}

export function CreateTagDialog({ open, onOpenChange, onSuccess, tagToEdit }: CreateTagDialogProps) {
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [isSeoOpen, setIsSeoOpen] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [order, setOrder] = useState("0");
    const [link, setLink] = useState("");
    const [isFeatured, setIsFeatured] = useState("false");

    // SEO State
    const [metaTitle, setMetaTitle] = useState("");
    const [metaDescription, setMetaDescription] = useState("");
    const [keywords, setKeywords] = useState("");
    const [ogTitle, setOgTitle] = useState("");
    const [ogDescription, setOgDescription] = useState("");
    const [ogUrl, setOgUrl] = useState("");

    useEffect(() => {
        if (open) {
            if (tagToEdit) {
                setName(tagToEdit.name || "");
                setDescription(tagToEdit.description || "");
                setOrder(tagToEdit.rank?.toString() || "0");
                setLink(tagToEdit.link || "");
                setIsFeatured("false"); // Tags don't have isFeatured in the DTO

                if (tagToEdit.seo) {
                    setMetaTitle(tagToEdit.seo.title || "");
                    setMetaDescription(tagToEdit.seo.metaDescription || "");
                    setKeywords(tagToEdit.seo.keywords?.join(", ") || "");
                    if (tagToEdit.seo.og) {
                        setOgTitle(tagToEdit.seo.og.title || "");
                        setOgDescription(tagToEdit.seo.og.description || "");
                        setOgUrl(tagToEdit.seo.og.url || "");
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
    }, [open, tagToEdit]);

    const handleSubmit = async () => {
        if (!name || !description) {
            toast({ title: "Error", description: "Name and Description are required", variant: "destructive" });
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
            
            const payload: CreateTagDTO = {
                name,
                description,
                rank: parseInt(order) || 0,
                link: link || undefined,
                status: tagToEdit ? tagToEdit.status : "active",
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

            if (tagToEdit) {
                await updateTag(tagToEdit._id, payload);
                toast({ title: "Success", description: "Tag updated successfully" });
            } else {
                await createTag(payload);
                toast({ title: "Success", description: "Tag created successfully" });
            }

            onSuccess();
            onOpenChange(false);
            resetForm();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || `Failed to ${tagToEdit ? 'update' : 'create'} tag`, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName("");
        setDescription("");
        setOrder("0");
        setLink("");
        setIsFeatured("false");
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
                    <DialogTitle>{tagToEdit ? "Edit Tag" : "Create Tag"}</DialogTitle>
                </DialogHeader>

                <div className="grid md:gap-6 gap-3 py-4">
                    <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Tag Name *</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag Name" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description *</Label>
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

                    <div className="space-y-2">
                        <Label htmlFor="link">Link</Label>
                        <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link" />
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "Saving..." : (tagToEdit ? "Update" : "Create Tag")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
