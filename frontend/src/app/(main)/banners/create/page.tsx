"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { createBanner, getBannerTypes } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateBannerDTO, BannerType, NestedBanner } from "@/lib/types";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect } from "react";

export default function CreateBannerPage() {
    const router = useRouter();
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [bannerTypes, setBannerTypes] = useState<BannerType[]>([]);

    // Banner Details
    const [title, setTitle] = useState("");
    const [bannerType, setBannerType] = useState("");
    const [description, setDescription] = useState("");
    const [rank, setRank] = useState("1");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("active");

    // Nested Banners
    const [nestedBanners, setNestedBanners] = useState<NestedBanner[]>([
        {
            title: "",
            ctaText: "",
            appLink: "",
            apiLink: "",
            webLink: "",
            description: "",
            rank: 1,
            openIn: "same",
            runsOn: "mobile",
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            status: "active",
            image: { url: "" },
        },
    ]);

    const [openBannerIndices, setOpenBannerIndices] = useState<number[]>([0]);

    useEffect(() => {
        const fetchBannerTypes = async () => {
            if (!selectedProperty) return;
            try {
                const res = await getBannerTypes({ propertyId: selectedProperty._id, limit: 100 });
                setBannerTypes(res.data);
            } catch (error) {
                console.error("Failed to fetch banner types", error);
            }
        };
        fetchBannerTypes();
    }, [selectedProperty]);

    const handleSubmit = async () => {
        if (!title || !bannerType || !startDate || !endDate) {
            toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
            return;
        }
        if (!selectedProperty) {
            toast({ title: "Error", description: "No property selected", variant: "destructive" });
            return;
        }
        if (nestedBanners.length === 0) {
            toast({ title: "Error", description: "Please add at least one banner image", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const payload: CreateBannerDTO = {
                title,
                bannerType,
                description,
                rank: parseInt(rank) || 1,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                status,
                banners: nestedBanners.map(banner => ({
                    ...banner,
                    startDate: banner.startDate ? new Date(banner.startDate).toISOString() : new Date().toISOString(),
                    endDate: banner.endDate ? new Date(banner.endDate).toISOString() : undefined,
                })),
                propertyId: selectedProperty._id,
            };

            await createBanner(payload);
            toast({ title: "Success", description: "Banner created successfully" });
            await new Promise((resolve) => setTimeout(resolve, 700));
            router.push("/banners");
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to create banner", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const addNestedBanner = () => {
        const newBanner: NestedBanner = {
            title: "",
            ctaText: "",
            appLink: "",
            apiLink: "",
            webLink: "",
            description: "",
            rank: nestedBanners.length + 1,
            openIn: "same",
            runsOn: "mobile",
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            status: "active",
            image: { url: "" },
        };
        setNestedBanners([...nestedBanners, newBanner]);
        setOpenBannerIndices([...openBannerIndices, nestedBanners.length]);
    };

    const removeNestedBanner = (index: number) => {
        if (nestedBanners.length === 1) {
            toast({ title: "Error", description: "At least one banner image is required", variant: "destructive" });
            return;
        }
        setNestedBanners(nestedBanners.filter((_, i) => i !== index));
        setOpenBannerIndices(openBannerIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    };

    const updateNestedBanner = (index: number, field: keyof NestedBanner, value: any) => {
        const updated = [...nestedBanners];
        updated[index] = { ...updated[index], [field]: value };
        setNestedBanners(updated);
    };

    const toggleBannerSection = (index: number) => {
        if (openBannerIndices.includes(index)) {
            setOpenBannerIndices(openBannerIndices.filter(i => i !== index));
        } else {
            setOpenBannerIndices([...openBannerIndices, index]);
        }
    };

    return (
        <div className="w-full max-w-full space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 sm:gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/banners")}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Create Banner</h1>
                </div>
            </div>

            <Card>
                <CardHeader className="space-y-1 sm:space-y-1.5">
                    <CardTitle className="text-lg sm:text-xl">Banner Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Banner Title <span className="text-red-500">*</span></Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Banner Title"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bannerType">Banner Type <span className="text-red-500">*</span></Label>
                            <Select value={bannerType} onValueChange={setBannerType}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Select Banner Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {bannerTypes.map((type) => (
                                        <SelectItem key={type._id} value={type._id}>
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="rank">Order <span className="text-red-500">*</span></Label>
                            <Input
                                id="rank"
                                type="number"
                                value={rank}
                                onChange={(e) => setRank(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Start Date <span className="text-red-500">*</span></Label>
                            <Input
                                id="startDate"
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">End Date <span className="text-red-500">*</span></Label>
                            <Input
                                id="endDate"
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            title="banner description"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 gap-2">
                    <CardTitle className="text-lg sm:text-xl">Banner Images</CardTitle>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addNestedBanner}
                        className="w-full sm:w-auto h-9"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Banner Image
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {nestedBanners.map((banner, index) => (
                        <Collapsible key={index} open={openBannerIndices.includes(index)} onOpenChange={() => toggleBannerSection(index)}>
                            <Card>
                                <CardContent className="pt-4 sm:pt-6">
                                    <div className="flex items-center justify-between mb-4 gap-2">
                                        <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="sm" className="flex-1 justify-start">
                                                {openBannerIndices.includes(index) ? <ChevronUp className="h-4 w-4 mr-2 shrink-0" /> : <ChevronDown className="h-4 w-4 mr-2 shrink-0" />}
                                                <span className="truncate">Banner Image {index + 1} {banner.title && `- ${banner.title}`}</span>
                                            </Button>
                                        </CollapsibleTrigger>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => removeNestedBanner(index)}
                                            className="text-destructive shrink-0 h-8 w-8 p-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <CollapsibleContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Title <span className="text-red-500">*</span></Label>
                                                <Input
                                                    value={banner.title || ""}
                                                    onChange={(e) => updateNestedBanner(index, "title", e.target.value)}
                                                    placeholder="Title"
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>CTA Text</Label>
                                                <Input
                                                    value={banner.ctaText || ""}
                                                    onChange={(e) => updateNestedBanner(index, "ctaText", e.target.value)}
                                                    placeholder="CTA Text"
                                                    className="h-10"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>App Link</Label>
                                                <Input
                                                    value={banner.appLink || ""}
                                                    onChange={(e) => updateNestedBanner(index, "appLink", e.target.value)}
                                                    placeholder="App Link"
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>API Link</Label>
                                                <Input
                                                    value={banner.apiLink || ""}
                                                    onChange={(e) => updateNestedBanner(index, "apiLink", e.target.value)}
                                                    placeholder="API Link"
                                                    className="h-10"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Web Link</Label>
                                                <Input
                                                    value={banner.webLink || ""}
                                                    onChange={(e) => updateNestedBanner(index, "webLink", e.target.value)}
                                                    placeholder="Web Link"
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Status</Label>
                                                <Select value={banner.status || "active"} onValueChange={(value) => updateNestedBanner(index, "status", value)}>
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

                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <RichTextEditor
                                                value={banner.description || ""}
                                                onChange={(value) => updateNestedBanner(index, "description", value)}
                                                title="banner image description"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label>Rank <span className="text-red-500">*</span></Label>
                                                <Input
                                                    type="number"
                                                    value={banner.rank || 1}
                                                    onChange={(e) => updateNestedBanner(index, "rank", parseInt(e.target.value))}
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Open In</Label>
                                                <Select value={banner.openIn || "same"} onValueChange={(value) => updateNestedBanner(index, "openIn", value)}>
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="same">Same</SelectItem>
                                                        <SelectItem value="new">New</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Runs On</Label>
                                                <Select value={banner.runsOn || "mobile"} onValueChange={(value) => updateNestedBanner(index, "runsOn", value)}>
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="mobile">Mobile</SelectItem>
                                                        <SelectItem value="web">Web</SelectItem>
                                                        <SelectItem value="both">Both</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Start Date <span className="text-red-500">*</span></Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={banner.startDate ? new Date(banner.startDate).toISOString().slice(0, 16) : ""}
                                                    onChange={(e) => updateNestedBanner(index, "startDate", e.target.value)}
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End Date</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={banner.endDate ? new Date(banner.endDate).toISOString().slice(0, 16) : ""}
                                                    onChange={(e) => updateNestedBanner(index, "endDate", e.target.value)}
                                                    className="h-10"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Image URL <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={banner.image?.url || ""}
                                                onChange={(e) => updateNestedBanner(index, "image", { url: e.target.value })}
                                                placeholder="Image URL"
                                                className="h-10"
                                            />
                                        </div>
                                    </CollapsibleContent>
                                </CardContent>
                            </Card>
                        </Collapsible>
                    ))}
                </CardContent>
            </Card>

            {/* Action Buttons - Responsive */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-4 sm:pb-0">
                <Button
                    variant="outline"
                    onClick={() => router.push("/banners")}
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
                    {loading ? "Creating..." : "Create Banner"}
                </Button>
            </div>
        </div>
    );
}
