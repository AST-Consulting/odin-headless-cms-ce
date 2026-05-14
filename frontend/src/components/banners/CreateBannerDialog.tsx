"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { createBanner, updateBanner } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateBannerDTO, Banner, BannerType, NestedBanner } from "@/lib/types";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CreateBannerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    bannerToEdit?: Banner | null;
    bannerTypes: BannerType[];
}

export function CreateBannerDialog({ open, onOpenChange, onSuccess, bannerToEdit, bannerTypes }: CreateBannerDialogProps) {
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);

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
        if (open) {
            if (bannerToEdit) {
                setTitle(bannerToEdit.title || "");
                setBannerType(typeof bannerToEdit.bannerType === 'string' ? bannerToEdit.bannerType : bannerToEdit.bannerType?.id || "");
                setDescription(bannerToEdit.description || "");
                setRank(bannerToEdit.rank?.toString() || "1");
                setStartDate(new Date(bannerToEdit.startDate).toISOString().slice(0, 16));
                setEndDate(new Date(bannerToEdit.endDate).toISOString().slice(0, 16));
                setStatus(bannerToEdit.status || "active");
                setNestedBanners(bannerToEdit.banners || []);
            } else {
                resetForm();
            }
        }
    }, [open, bannerToEdit]);

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

            if (bannerToEdit) {
                await updateBanner(bannerToEdit._id, payload);
                toast({ title: "Success", description: "Banner updated successfully" });
            } else {
                await createBanner(payload);
                toast({ title: "Success", description: "Banner created successfully" });
            }

            onSuccess();
            onOpenChange(false);
            resetForm();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || `Failed to ${bannerToEdit ? 'update' : 'create'} banner`, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setBannerType("");
        setDescription("");
        setRank("1");
        setStartDate("");
        setEndDate("");
        setStatus("active");
        setNestedBanners([
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
        setOpenBannerIndices([0]);
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{bannerToEdit ? "Edit Banner" : "Create Banner"}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 sm:gap-6 py-4">
                    <div className="border rounded-lg p-3 sm:p-4">
                        <h3 className="text-sm font-semibold mb-3 sm:mb-4">Banner Details:</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Banner Title *</Label>
                                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Banner Title" className="h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bannerType">Banner Type *</Label>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="rank">Order *</Label>
                                <Input id="rank" type="number" value={rank} onChange={(e) => setRank(e.target.value)} className="h-10" />
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date *</Label>
                                <Input id="startDate" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date *</Label>
                                <Input id="endDate" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10" />
                            </div>
                        </div>

                        <div className="space-y-2 mt-4">
                            <Label>Description</Label>
                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                                title="banner description"
                            />
                        </div>
                    </div>

                    {/* Banner Images Section */}
                    <div className="border rounded-lg p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                            <h3 className="text-sm font-semibold">Banner Images:</h3>
                            <Button type="button" size="sm" variant="outline" onClick={addNestedBanner} className="w-full sm:w-auto h-9">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Banner Image
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {nestedBanners.map((banner, index) => (
                                <Collapsible key={index} open={openBannerIndices.includes(index)} onOpenChange={() => toggleBannerSection(index)}>
                                    <div className="border rounded-lg p-3 sm:p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" size="sm" className="flex-1 justify-start">
                                                    {openBannerIndices.includes(index) ? <ChevronUp className="h-4 w-4 mr-2 shrink-0" /> : <ChevronDown className="h-4 w-4 mr-2 shrink-0" />}
                                                    <span className="truncate">Banner Image {index + 1} {banner.title && `- ${banner.title}`}</span>
                                                </Button>
                                            </CollapsibleTrigger>
                                            <Button type="button" size="sm" variant="ghost" onClick={() => removeNestedBanner(index)} className="text-destructive shrink-0 h-8 w-8 p-0">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <CollapsibleContent className="mt-4 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Title *</Label>
                                                    <Input value={banner.title || ""} onChange={(e) => updateNestedBanner(index, "title", e.target.value)} placeholder="Title" className="h-10" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>CTA Text</Label>
                                                    <Input value={banner.ctaText || ""} onChange={(e) => updateNestedBanner(index, "ctaText", e.target.value)} placeholder="CTA Text" className="h-10" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>App Link</Label>
                                                    <Input value={banner.appLink || ""} onChange={(e) => updateNestedBanner(index, "appLink", e.target.value)} placeholder="App Link" className="h-10" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>API Link</Label>
                                                    <Input value={banner.apiLink || ""} onChange={(e) => updateNestedBanner(index, "apiLink", e.target.value)} placeholder="API Link" className="h-10" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Web Link</Label>
                                                    <Input value={banner.webLink || ""} onChange={(e) => updateNestedBanner(index, "webLink", e.target.value)} placeholder="Web Link" className="h-10" />
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
                                                    <Label>Rank *</Label>
                                                    <Input type="number" value={banner.rank || 1} onChange={(e) => updateNestedBanner(index, "rank", parseInt(e.target.value))} className="h-10" />
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
                                                    <Label>Start Date *</Label>
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
                                                <Label>Image URL *</Label>
                                                <Input value={banner.image?.url || ""} onChange={(e) => updateNestedBanner(index, "image", { url: e.target.value })} placeholder="Image URL" className="h-10" />
                                            </div>
                                        </CollapsibleContent>
                                    </div>
                                </Collapsible>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto h-10">
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto h-10">
                        {loading ? "Saving..." : (bannerToEdit ? "Update" : "Create")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
