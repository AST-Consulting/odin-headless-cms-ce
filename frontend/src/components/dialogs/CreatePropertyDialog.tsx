"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Share2, Facebook, Twitter, Linkedin, Instagram, Youtube, Globe } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createProperty, updateProperty } from "@/lib/api";
import { PropertyDto, Property } from "@/lib/types";
import { INDUSTRY } from "@/lib/constants";

const propertySchema = z.object({
    domain: z.string().min(1, "Domain is required"),
    industry: z.string().min(1, "Industry is required"),
    status: z.string().optional(),
    articleType: z.string().min(1, "Article Type is required"),
    about: z.string().optional(),
    targetAudience: z.string().optional(), // We'll parse this to string[]
    specialInstruction: z.string().optional(),
    imageWidth: z.coerce.number().optional(),
    imageHeight: z.coerce.number().optional(),
    timeZone: z.string().optional(),
    urlPatternTag: z.string().optional(),
    urlPatternCategory: z.string().optional(),
    urlPatternAuthor: z.string().optional(),
    urlPatternPage: z.string().optional(),
    contact_details: z.object({
        primary_phone: z.string().optional(),
        email: z.string().optional(),
    }).optional(),
    social_links: z.object({
        facebook: z.string().optional(),
        twitter: z.string().optional(),
        instagram: z.string().optional(),
        youtube: z.string().optional(),
        wikipedia: z.string().optional(),
        linkedin: z.string().optional(),
    }).optional(),
    seo_data: z.object({
        meta_title: z.string().optional(),
        meta_description: z.string().optional(),
    }).optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

interface CreatePropertyDialogProps {
    onPropertyCreated: () => void;
    propertyToEdit?: Property; // Optional property to edit
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CreatePropertyDialog({ onPropertyCreated, propertyToEdit, open: controlledOpen, onOpenChange }: CreatePropertyDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? onOpenChange! : setInternalOpen;

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        reset,
    } = useForm<PropertyFormValues>({
        resolver: zodResolver(propertySchema),
        defaultValues: {
            status: "active",
            articleType: "blog",
        },
    });

    useEffect(() => {
        if (propertyToEdit) {
            setValue("domain", propertyToEdit.domain);
            setValue("industry", propertyToEdit.industry);
            setValue("status", propertyToEdit.status);
            setValue("articleType", propertyToEdit.articleType);
            setValue("about", propertyToEdit.about || "");
            setValue("targetAudience", propertyToEdit.targetAudience ? propertyToEdit.targetAudience.join(", ") : "");
            setValue("specialInstruction", propertyToEdit.specialInstruction || "");
            setValue("imageWidth", propertyToEdit.imageWidth);
            setValue("imageHeight", propertyToEdit.imageHeight);
            setValue("timeZone", propertyToEdit.timeZone || "");
            setValue("urlPatternTag", propertyToEdit.urlPatterns?.tag || "");
            setValue("urlPatternCategory", propertyToEdit.urlPatterns?.category || "");
            setValue("urlPatternAuthor", propertyToEdit.urlPatterns?.author || "");
            setValue("urlPatternPage", propertyToEdit.urlPatterns?.page || "");

            // Set additional fields for edit mode
            setValue("contact_details.primary_phone", propertyToEdit.contact_details?.primary_phone || "");
            setValue("contact_details.email", propertyToEdit.contact_details?.email || "");
            
            setValue("social_links.facebook", propertyToEdit.social_links?.facebook || "");
            setValue("social_links.twitter", propertyToEdit.social_links?.twitter || "");
            setValue("social_links.instagram", propertyToEdit.social_links?.instagram || "");
            setValue("social_links.youtube", propertyToEdit.social_links?.youtube || "");
            setValue("social_links.wikipedia", propertyToEdit.social_links?.wikipedia || "");
            setValue("social_links.linkedin", propertyToEdit.social_links?.linkedin || "");
            
            setValue("seo_data.meta_title", propertyToEdit.seo_data?.meta_title || "");
            setValue("seo_data.meta_description", propertyToEdit.seo_data?.meta_description || "");
        } else {
            reset({
                status: "active",
                articleType: "blog",
            });
        }
    }, [propertyToEdit, setValue, reset, open]);

    const onSubmit = async (data: PropertyFormValues) => {
        setIsLoading(true);
        try {
            const payload: PropertyDto = {
                ...data,
                targetAudience: data.targetAudience ? data.targetAudience.split(",").map(s => s.trim()) : [],
                urlPatterns: {
                    tag: data.urlPatternTag || undefined,
                    category: data.urlPatternCategory || undefined,
                    author: data.urlPatternAuthor || undefined,
                    page: data.urlPatternPage || undefined,
                },
            };

            if (propertyToEdit) {
                await updateProperty(propertyToEdit._id, payload);
                toast.success("Property Updated", {
                    description: `Property ${data.domain} has been updated successfully.`,
                });
            } else {
                await createProperty(payload);
                toast.success("Property Created", {
                    description: `Property ${data.domain} has been created successfully.`,
                });
            }

            reset();
            setOpen(false);
            onPropertyCreated();
        } catch (error: any) {
            toast.error(propertyToEdit ? "Failed to Update Property" : "Failed to Create Property", {
                description: error.message || "Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button size="sm" className="h-8 w-8 rounded-full p-0">
                        <Plus className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[600px] h-full md:max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{propertyToEdit ? "Edit Property" : "Create Property"}</DialogTitle>
                    <DialogDescription>
                        {propertyToEdit ? "Edit the details of this property." : "Add a new property to your organization."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid gap-4 py-4">
                        <div className="grid md:grid-cols-2 grid-cols-1 md:gap-4 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor="domain">Domain *</Label>
                                <Input id="domain" placeholder="example.com" {...register("domain")} />
                                {errors.domain && <p className="text-sm text-red-500">{errors.domain.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry *</Label>
                                <Select onValueChange={(value) => setValue("industry", value)} defaultValue={propertyToEdit?.industry}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Industry" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.values(INDUSTRY).map((ind) => (
                                            <SelectItem key={ind} value={ind}>
                                                {ind}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.industry && <p className="text-sm text-red-500">{errors.industry.message}</p>}
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 md:gap-4 grid-cols-1 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select onValueChange={(value) => setValue("status", value)} defaultValue={propertyToEdit?.status || "active"}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="articleType">Article Type *</Label>
                                <Select onValueChange={(value) => setValue("articleType", value)} defaultValue={propertyToEdit?.articleType || "blog"}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="blog">Blog</SelectItem>
                                        <SelectItem value="news">News</SelectItem>
                                        <SelectItem value="review">Review</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.articleType && <p className="text-sm text-red-500">{errors.articleType.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="about">About</Label>
                            <Textarea id="about" placeholder="Description of the property" {...register("about")} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="targetAudience">Target Audience (comma separated)</Label>
                            <Input id="targetAudience" placeholder="Teens, Adults, Techies" {...register("targetAudience")} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="specialInstruction">Special Instruction</Label>
                            <Textarea id="specialInstruction" placeholder="Any special instructions..." {...register("specialInstruction")} />
                        </div>

                        <div className="grid lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="imageWidth">Image Width</Label>
                                <Input type="number" id="imageWidth" placeholder="1200" {...register("imageWidth")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="imageHeight">Image Height</Label>
                                <Input type="number" id="imageHeight" placeholder="630" {...register("imageHeight")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="timeZone">Time Zone</Label>
                                <Select onValueChange={(value) => setValue("timeZone", value)} defaultValue={propertyToEdit?.timeZone || "UTC"}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Time Zone" />
                                    </SelectTrigger>
                                    <SelectContent className="h-60">
                                        {Intl.supportedValuesOf('timeZone').map((tz) => (
                                            <SelectItem key={tz} value={tz}>
                                                {tz}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                             </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium border-b pb-2">URL Structure</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="urlPatternTag">Tag Prefix</Label>
                                    <Input id="urlPatternTag" placeholder="topic" {...register("urlPatternTag")} />
                                    <p className="text-[10px] text-muted-foreground">Default: topic</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="urlPatternCategory">Category Prefix</Label>
                                    <Input id="urlPatternCategory" placeholder="none" {...register("urlPatternCategory")} />
                                    <p className="text-[10px] text-muted-foreground">Empty for clean URLs</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="urlPatternAuthor">Author Prefix</Label>
                                    <Input id="urlPatternAuthor" placeholder="author" {...register("urlPatternAuthor")} />
                                    <p className="text-[10px] text-muted-foreground">Default: author</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="urlPatternPage">Page Prefix</Label>
                                    <Input id="urlPatternPage" placeholder="none" {...register("urlPatternPage")} />
                                    <p className="text-[10px] text-muted-foreground">Empty for clean URLs</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium border-b pb-2">Contact Information</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="contact_phone">Primary Phone</Label>
                                    <Input id="contact_phone" placeholder="+91-000-000-0000" {...register("contact_details.primary_phone")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contact_email">Email Address</Label>
                                    <Input id="contact_email" placeholder="contact@example.com" {...register("contact_details.email")} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium border-b pb-2 flex items-center gap-2">
                                <Share2 className="h-5 w-5 text-sky-600" />
                                Social Presence
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="facebook" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Facebook className="h-3.5 w-3.5 text-blue-600" /> Facebook URL
                                    </Label>
                                    <Input id="facebook" placeholder="https://facebook.com/page" {...register("social_links.facebook")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="twitter" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Twitter className="h-3.5 w-3.5 text-sky-500" /> X / Twitter URL
                                    </Label>
                                    <Input id="twitter" placeholder="https://twitter.com/handle" {...register("social_links.twitter")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="linkedin" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Linkedin className="h-3.5 w-3.5 text-indigo-700" /> LinkedIn URL
                                    </Label>
                                    <Input id="linkedin" placeholder="https://linkedin.com/in/profile" {...register("social_links.linkedin")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="instagram" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Instagram className="h-3.5 w-3.5 text-rose-500" /> Instagram URL
                                    </Label>
                                    <Input id="instagram" placeholder="https://instagram.com/profile" {...register("social_links.instagram")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="youtube" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Youtube className="h-3.5 w-3.5 text-rose-600" /> YouTube URL
                                    </Label>
                                    <Input id="youtube" placeholder="https://youtube.com/@channel" {...register("social_links.youtube")} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="wikipedia" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5 text-slate-500" /> Wikipedia URL
                                    </Label>
                                    <Input id="wikipedia" placeholder="https://en.wikipedia.org/wiki/Page" {...register("social_links.wikipedia")} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium border-b pb-2">Search Engine Optimization</h3>
                            <div className="space-y-2">
                                <Label htmlFor="meta_title">Meta Title</Label>
                                <Input id="meta_title" placeholder="Title for search results" {...register("seo_data.meta_title")} />
                                <p className="text-[10px] text-muted-foreground">Optimal length: 50-60 characters</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="meta_description">Meta Description</Label>
                                <Textarea id="meta_description" placeholder="Brief summary for search result snippets" {...register("seo_data.meta_description")} />
                                <p className="text-[10px] text-muted-foreground">Optimal length: 120-160 characters</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                reset();
                                setOpen(false);
                            }}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Saving..." : (propertyToEdit ? "Update Property" : "Create Property")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
