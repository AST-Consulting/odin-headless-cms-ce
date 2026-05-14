"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { createFAQ, updateFAQ } from "@/lib/api";
import { FAQ, CreateFAQDTO } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { CategorySelector } from "@/components/common/CategorySelector";
import { TagSelector } from "@/components/common/TagSelector";
import { Card, CardContent } from "../ui/card";

interface CreateFAQPageProps {
    onSuccess?: (faq: FAQ) => void;
    onCancel?: () => void;
    type?: "create" | "edit";
    faqToEdit?: FAQ | null;
    hideHeader?: boolean;
    hideFooter?: boolean;
    formId?: string;
    onLoadingChange?: (loading: boolean) => void;
    className?: string;
}

export function CreateFAQDialog({
    onSuccess,
    onCancel,
    type = "create",
    faqToEdit,
    hideHeader = false,
    hideFooter = false,
    formId,
    onLoadingChange,
    className
}: CreateFAQPageProps) {
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<CreateFAQDTO>>({
        question: "",
        answer: "",
        tags: [],
        categories: [],
        entityType: "",
        entityValue: "",
        entityId: "",
        status: "active",
        rank: 1,
    });

    useEffect(() => {
        if (faqToEdit) {
            setFormData({
                question: faqToEdit.question,
                answer: faqToEdit.answer,
                tags: faqToEdit.tags?.map(t => typeof t === 'string' ? t : t.id) || [],
                categories: faqToEdit.categories?.map(c => typeof c === 'string' ? c : c.id) || [],
                entityType: faqToEdit.entityType || "",
                entityValue: faqToEdit.entityValue || "",
                entityId: faqToEdit.entityId || "",
                status: faqToEdit.status,
                rank: faqToEdit.rank || 1,
            });
        } else {
            setFormData({
                question: "",
                answer: "",
                tags: [],
                categories: [],
                entityType: "",
                entityValue: "",
                entityId: "",
                status: "active",
                rank: 1,
            });
        }
    }, [faqToEdit]);

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.question || !formData.answer) {
                toast({
                    title: "Validation Error",
                    description: "Please fill in required fields",
                    variant: "destructive",
                });
                setLoading(false);
                return;
            }

            const payload: CreateFAQDTO = {
                question: formData.question,
                answer: formData.answer,
                tags: formData.tags,
                categories: formData.categories,
                entityType: formData.entityType,
                entityValue: formData.entityValue,
                entityId: "",
                status: formData.status,
                rank: formData.rank,
                propertyId: selectedProperty?._id,
            };

            let savedFaq: FAQ;
            if (faqToEdit) {
                savedFaq = await updateFAQ(faqToEdit._id, payload);
                toast({
                    title: "Success",
                    description: "FAQ updated successfully",
                });
            } else {
                savedFaq = await createFAQ(payload);
                toast({
                    title: "Success",
                    description: "FAQ created successfully",
                });
            }

            onSuccess?.(savedFaq);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            toast({
                title: "Error",
                description: `Failed to ${faqToEdit ? "update" : "create"} FAQ: ${errorMessage}`,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
            onLoadingChange?.(false);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        setLoading(true);
        onLoadingChange?.(true);
        await handleSubmit(e);
    };

    return (
        <div className={className || "md:p-4 lg:p-8 p-2"}>
            {!hideHeader && (
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">{type === "create" ? "Create FAQ" : "Update FAQ"}</h1>
                    <p className="text-muted-foreground">
                        {type === "create" ? "Add a new FAQ to your site" : "Update FAQ details"}
                    </p>
                </div>
            )}
            <form id={formId} onSubmit={handleFormSubmit} className="md:space-y-6 space-y-4">
                <Card>
                    <CardContent>
                        <div className="grid md:grid-cols-2 grid-cols-1 md:gap-4 gap-3">
                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="question">
                                    Question <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="question"
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    placeholder="Enter the question"
                                    required
                                />
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="answer">
                                    Answer <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="answer"
                                    value={formData.answer}
                                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    placeholder="Enter the answer"
                                    rows={4}
                                    required
                                />
                            </div>


                            <div className="space-y-2">
                                <Label htmlFor="entityType">Entity Type <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.entityType}
                                    onValueChange={(value) => setFormData({ ...formData, entityType: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select entity type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="article">Article</SelectItem>
                                        <SelectItem value="blog">Blog</SelectItem>
                                        <SelectItem value="page">Page</SelectItem>
                                        <SelectItem value="general">General</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="entityValue">Entity Value</Label>
                                <Input
                                    id="entityValue"
                                    value={formData.entityValue}
                                    onChange={(e) => setFormData({ ...formData, entityValue: e.target.value })}
                                    placeholder="Entity value"
                                />
                            </div>



                            <div className="space-y-2">
                                <Label htmlFor="rank">Order</Label>
                                <Input
                                    id="rank"
                                    type="number"
                                    value={formData.rank}
                                    onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) })}
                                    placeholder="Order"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>


                            <div className="space-y-2">
                                <Label>Categories</Label>
                                <CategorySelector
                                    selected={formData.categories || []}
                                    onChange={(selected) => setFormData({ ...formData, categories: selected })}
                                    placeholder="Select categories..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tags</Label>
                                <TagSelector
                                    selected={formData.tags || []}
                                    onChange={(selected) => setFormData({ ...formData, tags: selected })}
                                    placeholder="Select tags..."
                                />
                            </div>



                        </div>
                    </CardContent>
                </Card>
                {!hideFooter && (
                    <div className="flex md:justify-end justify-between gap-2 pt-4 pb-4">
                        <Button type="button" variant="outline" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (faqToEdit ? "Updating..." : "Creating...") : (faqToEdit ? "Update" : "Create")}
                        </Button>
                    </div>
                )}
            </form>
        </div>
    );
}
