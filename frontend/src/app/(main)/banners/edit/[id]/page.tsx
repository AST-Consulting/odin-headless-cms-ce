"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { updateBanner, getBannerTypes, getBannerById } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateBannerDTO, BannerType, NestedBanner } from "@/lib/types";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect } from "react";

export default function EditBannerPage() {
    const router = useRouter();
    const params = useParams();
    const bannerId = params.id as string;
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);
    const [fetchingBanner, setFetchingBanner] = useState(true);
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

    useEffect(() => {
        const fetchBanner = async () => {
            if (!bannerId) return;
            setFetchingBanner(true);
            try {
                const banner = await getBannerById(bannerId);
                setTitle(banner.title || "");
                setBannerType(typeof banner.bannerType === 'string' ? banner.bannerType : banner.bannerType?.id || "");
                setDescription(banner.description || "");
                setRank(banner.rank?.toString() || "1");
                setStartDate(new Date(banner.startDate).toISOString().slice(0, 16));
                setEndDate(new Date(banner.endDate).toISOString().slice(0, 16));
                setStatus(banner.status || "active");
                setNestedBanners(banner.banners || []);
            } catch (error: any) {
                toast({ title: "Error", description: error.message || "Failed to fetch banner", variant: "destructive" });
                router.push("/banners");
            } finally {
                setFetchingBanner(false);
            }
        };
        fetchBanner();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bannerId]);

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

            await updateBanner(bannerId, payload);
            toast({ title: "Success", description: "Banner updated successfully" });
            await new Promise((resolve) => setTimeout(resolve, 700));
            router.push("/banners");
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to update banner", variant: "destructive" });
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
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push("/banners")}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold">Edit Banner</h1>
            </div>

            {fetchingBanner ? (
                <div className="text-center py-10">Loading banner...</div>
            ) : (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Banner Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Banner Title <span className="text-red-500">*</span></Label>
                                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Banner Title" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bannerType">Banner Type <span className="text-red-500">*</span></Label>
                                    <Select value={bannerType} onValueChange={setBannerType}>
                                        <SelectTrigger>
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="rank">Order <span className="text-red-500">*</span></Label>
                                    <Input id="rank" type="number" value={rank} onChange={(e) => setRank(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status</Label>
                                    <Select value={status} onValueChange={setStatus}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startDate">Start Date <span className="text-red-500">*</span></Label>
                                    <Input id="startDate" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endDate">End Date <span className="text-red-500">*</span></Label>
                                    <Input id="endDate" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    title="banner description"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Banner Images</CardTitle>
                            <Button type="button" size="sm" variant="outline" onClick={addNestedBanner}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Banner Image
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {nestedBanners.map((banner, index) => (
                                <Collapsible key={index} open={openBannerIndices.includes(index)} onOpenChange={() => toggleBannerSection(index)}>
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <CollapsibleTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        {openBannerIndices.includes(index) ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                                                        Banner Image {index + 1} {banner.title && `- ${banner.title}`}
                                                    </Button>
                                                </CollapsibleTrigger>
                                                <Button type="button" size="sm" variant="ghost" onClick={() => removeNestedBanner(index)} className="text-destructive">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <CollapsibleContent className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                                                        <Input value={banner.title || ""} onChange={(e) => updateNestedBanner(index, "title", e.target.value)} placeholder="Title" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="ctaText">CTA Text</Label>
                                                        <Input value={banner.ctaText || ""} onChange={(e) => updateNestedBanner(index, "ctaText", e.target.value)} placeholder="CTA Text" />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="appLink">App Link</Label>
                                                        <Input value={banner.appLink || ""} onChange={(e) => updateNestedBanner(index, "appLink", e.target.value)} placeholder="App Link" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="apiLink">API Link</Label>
                                                        <Input value={banner.apiLink || ""} onChange={(e) => updateNestedBanner(index, "apiLink", e.target.value)} placeholder="API Link" />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="webLink">Web Link</Label>
                                                        <Input value={banner.webLink || ""} onChange={(e) => updateNestedBanner(index, "webLink", e.target.value)} placeholder="Web Link" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="status">Status</Label>
                                                        <Select value={banner.status || "active"} onValueChange={(value) => updateNestedBanner(index, "status", value)}>
                                                            <SelectTrigger>
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
                                                    <Label htmlFor="description">Description</Label>
                                                    <RichTextEditor
                                                        value={banner.description || ""}
                                                        onChange={(value) => updateNestedBanner(index, "description", value)}
                                                        title="banner image description"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-4 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="rank">Rank <span className="text-red-500">*</span></Label>
                                                        <Input type="number" value={banner.rank || 1} onChange={(e) => updateNestedBanner(index, "rank", parseInt(e.target.value))} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="openIn">Open In</Label>
                                                        <Select value={banner.openIn || "same"} onValueChange={(value) => updateNestedBanner(index, "openIn", value)}>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="same">Same</SelectItem>
                                                                <SelectItem value="new">New</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="runsOn">Runs On</Label>
                                                        <Select value={banner.runsOn || "mobile"} onValueChange={(value) => updateNestedBanner(index, "runsOn", value)}>
                                                            <SelectTrigger>
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

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="startDate">Start Date <span className="text-red-500">*</span></Label>
                                                        <Input
                                                            type="datetime-local"
                                                            value={banner.startDate ? new Date(banner.startDate).toISOString().slice(0, 16) : ""}
                                                            onChange={(e) => updateNestedBanner(index, "startDate", e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>End Date</Label>
                                                        <Input
                                                            type="datetime-local"
                                                            value={banner.endDate ? new Date(banner.endDate).toISOString().slice(0, 16) : ""}
                                                            onChange={(e) => updateNestedBanner(index, "endDate", e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Image URL <span className="text-red-500">*</span></Label>
                                                    <Input value={banner.image?.url || ""} onChange={(e) => updateNestedBanner(index, "image", { url: e.target.value })} placeholder="Image URL" />
                                                </div>
                                            </CollapsibleContent>
                                        </CardContent>
                                    </Card>
                                </Collapsible>
                            ))}
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Button variant="outline" onClick={() => router.push("/banners")} disabled={loading}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? "Updating..." : "Update Banner"}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
