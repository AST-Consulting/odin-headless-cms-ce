"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { updateTag, getTagById } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateTagDTO, Tag } from "@/lib/types";
import { SeoForm } from "@/components/forms/SeoForm";

export default function EditTagPage() {
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);
    const [isSeoOpen, setIsSeoOpen] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [order, setOrder] = useState("0");
    const [link, setLink] = useState("");
    const [isFeatured, setIsFeatured] = useState(false);
    const [status, setStatus] = useState("active");

    // SEO State
    const [metaTitle, setMetaTitle] = useState("");
    const [metaDescription, setMetaDescription] = useState("");
    const [keywords, setKeywords] = useState("");
    const [ogTitle, setOgTitle] = useState("");
    const [ogDescription, setOgDescription] = useState("");
    const [ogUrl, setOgUrl] = useState("");

    const tagId = params.id as string;

    // Fetch tag data
    useEffect(() => {
        const fetchTag = async () => {
            if (!tagId || !selectedProperty) return;

            setFetchingData(true);
            try {
                // Fetch all tags and find the one we need
                // const response = await getTags({
                //     propertyId: selectedProperty._id,
                //     limit: 1000
                // });
                // const tag = response.data.find((t: Tag) => t._id === tagId);
                // fetching tag by id
                const tag = await getTagById(tagId);
                if (tag) {
                    setName(tag.name || "");
                    setDescription(tag.description || "");
                    setOrder(tag.rank?.toString() || "0");
                    setLink(tag.link || "");
                    setIsFeatured(tag.isFeatured || false);
                    setStatus(tag.status || "active");

                    // Populate SEO fields if they exist
                    if (tag.seo) {
                        setMetaTitle(tag.seo.title || "");
                        setMetaDescription(tag.seo.metaDescription || "");
                        setKeywords(tag.seo.keywords?.join(", ") || "");
                        if (tag.seo.og) {
                            setOgTitle(tag.seo.og.title || "");
                            setOgDescription(tag.seo.og.description || "");
                            setOgUrl(tag.seo.og.url || "");
                        }
                    }
                } else {
                    toast({
                        title: "Error",
                        description: "Tag not found",
                        variant: "destructive",
                    });
                    router.push("/tags");
                }
            } catch (error: any) {
                toast({
                    title: "Error",
                    description: error.message || "Failed to fetch tag",
                    variant: "destructive",
                });
                router.push("/tags");
            } finally {
                setFetchingData(false);
            }
        };

        fetchTag();
    }, [selectedProperty]);

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

            const payload: Partial<CreateTagDTO> = {
                name,
                description,
                rank: parseInt(order) || 0,
                link: link || undefined,
                status,
                propertyId: selectedProperty._id,
                isFeatured: isFeatured,//we are sending the boolean value to the backend but the tagsDTO doesnot contain isFeatured and the sent isFeature
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

            await updateTag(tagId, payload);
            toast({ title: "Success", description: "Tag updated successfully" });
            await new Promise(resolve => setTimeout(resolve, 700));
            router.push("/tags");
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to update tag", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (fetchingData) {
        return (
            <div className="w-full max-w-full space-y-4 sm:space-y-6">
                <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">Loading tag...</p>
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
                    onClick={() => router.push("/tags")}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Edit Tag</h1>
                </div>
            </div>

            <Card>
                <CardHeader className="space-y-1 sm:space-y-1.5">
                    <CardTitle className="text-lg sm:text-xl">Tag Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Tag Name <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Tag Name"
                                className="h-10"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Description"
                                className="h-10"
                                disabled={loading}
                            />
                        </div>
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
                            <Select value={isFeatured ? "true" : "false"} onValueChange={(value) => setIsFeatured(value === "true")} disabled={loading}>
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
                                disabled={loading}
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
                    />
                </CardContent>
            </Card>

            {/* Action Buttons - Responsive */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-4 sm:pb-0">
                <Button
                    variant="outline"
                    onClick={() => router.push("/tags")}
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
                    {loading ? "Updating..." : "Update Tag"}
                </Button>
            </div>
        </div>
    );
}
 