"use client";

import { useState, useRef } from "react";
import { createOrganization, uploadFile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Building2, Globe, Check, Loader2, Store, ArrowLeft, MapPin,
    Twitter, Facebook, Instagram, Youtube, Linkedin, Mail,
    Phone, Calendar, Search, Share2, Plus, Trash2, Camera, ImageIcon, Layout,
    Clock, X
} from "lucide-react";
import { toast } from "sonner";
import { useOrganizationStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { ImagePickerDialog } from "@/components/editor/ImagePickerDialog";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { DatePicker } from "@/components/ui/date-picker";

interface OrganizationCreateFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

// Social platform configuration
type SocialType = "twitter" | "facebook" | "linkedin" | "instagram" | "youtube" | "wikipedia";

interface SocialEntry {
    id: number;
    type: SocialType | "";
    url: string;
}

const SOCIAL_OPTIONS: { value: SocialType; label: string }[] = [
    { value: "twitter", label: "X / Twitter" },
    { value: "facebook", label: "Facebook" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "instagram", label: "Instagram" },
    { value: "youtube", label: "YouTube" },
    { value: "wikipedia", label: "Wikipedia" },
];

const SOCIAL_ICON: Record<SocialType, React.ReactNode> = {
    twitter: <Twitter className="h-3.5 w-3.5 text-sky-500 shrink-0" />,
    facebook: <Facebook className="h-3.5 w-3.5 text-blue-600 shrink-0" />,
    linkedin: <Linkedin className="h-3.5 w-3.5 text-indigo-700 shrink-0" />,
    instagram: <Instagram className="h-3.5 w-3.5 text-rose-500 shrink-0" />,
    youtube: <Youtube className="h-3.5 w-3.5 text-red-600 shrink-0" />,
    wikipedia: <Globe className="h-3.5 w-3.5 text-slate-600 shrink-0" />,
};

const SOCIAL_PLACEHOLDER: Record<SocialType, string> = {
    twitter: "https://twitter.com/profile",
    facebook: "https://facebook.com/profile",
    linkedin: "https://linkedin.com/company/profile",
    instagram: "https://instagram.com/profile",
    youtube: "https://youtube.com/@channel",
    wikipedia: "https://wikipedia.org/wiki/Page",
};

export function OrganizationCreateForm({ onSuccess, onCancel }: OrganizationCreateFormProps) {
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        legal_name: "",
        url: "",
        org_type: "NewsMediaOrganization",
        founding_date: "",
        alternate_name: [] as string[],
        business_hours: [
            { day_of_week: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "18:00", is_closed: false }
        ],
        contact_details: {
            email: "",
            primary_phone: ""
        },
        address: {
            street_address: "",
            city: "",
            state: "",
            zip_code: "",
            country: "India"
        },
        seo_data: {
            meta_title: "",
            meta_description: ""
        }
    });

    // Dynamic Social Links state (User Creation Style)
    const [socials, setSocials] = useState<SocialEntry[]>([
        { id: 1, type: "twitter", url: "" },
    ]);
    const [socialIdCounter, setSocialIdCounter] = useState(2);

    const addSocial = () => {
        const usedTypes = socials.map(s => s.type).filter(Boolean) as SocialType[];
        const available = SOCIAL_OPTIONS.find(o => !usedTypes.includes(o.value));
        setSocials([...socials, { id: socialIdCounter, type: available?.value ?? "", url: "" }]);
        setSocialIdCounter(socialIdCounter + 1);
    };

    const removeSocial = (id: number) => {
        if (socials.length <= 1) {
            setSocials([{ id: 1, type: "", url: "" }]);
            return;
        }
        setSocials(socials.filter(s => s.id !== id));
    };

    const updateSocial = (id: number, field: keyof SocialEntry, value: string) => {
        setSocials(socials.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const chosenTypes = socials.map(s => s.type).filter(Boolean) as SocialType[];
    const allChosen = SOCIAL_OPTIONS.every(o => chosenTypes.includes(o.value));

    // Logo state & refs
    const [logos, setLogos] = useState<{
        square?: { url: string; id: string; width?: number; height?: number; purpose?: string };
        rectangle?: { url: string; id: string; width?: number; height?: number; purpose?: string };
    }>({});
    
    // Direct file upload refs for new organization
    const squareFileRef = useRef<HTMLInputElement>(null);
    const rectangleFileRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "square" | "rectangle") => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show a local preview immediately
        const previewUrl = URL.createObjectURL(file);
        
        // We temporarily store the File as metadata or on a separate state
        // For simplicity, we could put the File object itself in logos and replace it on submit
        // or just have a separate "pendingUploads" state
        setLogos(prev => ({
            ...prev,
            [type]: {
                url: previewUrl,
                id: "pending", // mark as pending upload
                purpose: type === "square" ? "logo" : "banner",
                file: file // Store file for later upload
            }
        } as any));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.url) {
            toast.error("Display Name and Primary URL are required");
            return;
        }

        // URL/Domain Validation (Strictly HTTPS)
        if (!formData.url.startsWith('https://')) {
            toast.error("Primary URL must start with https://");
            return;
        }

        try {
            new URL(formData.url);
        } catch (err) {
            toast.error("Please enter a valid Primary URL (e.g., https://example.com)");
            return;
        }

        if (!formData.legal_name) {
            toast.error("Legal Entity Name is required");
            return;
        }

        if (!formData.founding_date) {
            toast.error("Founding Year/Info is required");
            return;
        }

        if (!formData.org_type) {
            toast.error("Organization Category is required");
            return;
        }

        if (!formData.contact_details.email || !formData.contact_details.primary_phone) {
            toast.error("Support Email and Primary Phone are required");
            return;
        }

        // Email Format Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.contact_details.email)) {
            toast.error("Please enter a valid Support Email address");
            return;
        }

        if (!logos.square?.url) {
            toast.error("At least one logo (Square Logo) is required");
            return;
        }

        try {
            setIsSaving(true);
            const domain = new URL(formData.url.startsWith('http') ? formData.url : `https://${formData.url}`).hostname;

            // Handle pending logo uploads
            const finalizedLogos = { ...logos };
            
            // Upload Square Logo if pending
            if ((logos.square as any)?.file && logos.square?.id === "pending") {
                const uploadedUrl = await uploadFile((logos.square as any).file);
                finalizedLogos.square = {
                    ...logos.square,
                    url: uploadedUrl,
                    id: "uploaded-" + Date.now()
                };
            }

            // Upload Rectangle Logo if pending
            if ((logos.rectangle as any)?.file && logos.rectangle?.id === "pending") {
                const uploadedUrl = await uploadFile((logos.rectangle as any).file);
                finalizedLogos.rectangle = {
                    ...logos.rectangle,
                    url: uploadedUrl,
                    id: "uploaded-" + Date.now()
                };
            }

            // Process dynamic socials into the expected schema object
            const socialLinksObj: Record<string, string> = {};
            socials.forEach(s => {
                if (s.type && s.url.trim()) {
                    socialLinksObj[s.type] = s.url.trim();
                }
            });

            const payload = {
                organization_name: formData.name,
                legal_name: formData.legal_name,
                domain: domain,
                url: formData.url,
                org_type: formData.org_type,
                founding_date: formData.founding_date,
                alternate_name: formData.alternate_name,
                business_hours: formData.business_hours,
                contact_details: formData.contact_details,
                address: {
                    street_address: formData.address.street_address,
                    address_locality: formData.address.city,
                    address_region: formData.address.state,
                    postal_code: formData.address.zip_code,
                    address_country: formData.address.country
                },
                social_links: socialLinksObj,
                seo_data: formData.seo_data,
                logos: finalizedLogos
            };

            await createOrganization(payload);
            toast.success("Organization established successfully!");
            // Refresh global store list
            useOrganizationStore.getState().fetchOrganizations();
            onSuccess();
        } catch (err: any) {
            console.error("Failed to create organization:", err);
            toast.error(err.message || "Registration failed");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="flex items-center justify-between bg-white dark:bg-[#1A1C1E] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="flex items-center gap-4 relative z-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onCancel}
                        className="rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
                            Entity Registration
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1 font-bold uppercase tracking-tight flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-primary" />
                            Provisioning Global Business Profile
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-4 items-start">
                <div className="md:col-span-3 space-y-8">
                    {/* Core Identity */}
                    <Card className="border-none shadow-xl dark:bg-[#1A1C1E] ring-1 ring-slate-200 dark:ring-white/10">
                        <CardHeader className="bg-slate-50/50 dark:bg-white/[0.02] p-8 border-b border-slate-100 dark:border-white/5">
                            <CardTitle className="text-xl font-black flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-blue-500" />
                                </div>
                                Corporate Identity & Branding
                            </CardTitle>
                            <CardDescription className="text-sm font-medium pt-1">
                                Provide the fundamental business details that define this entity.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1 flex items-center">
                                        Display Name <span className="text-red-500 ml-0.5 text-xs font-bold">*</span>
                                    </Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Global Tech News"
                                        className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold text-base focus-visible:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1 flex items-center">
                                        Primary URL / Domain <span className="text-red-500 ml-0.5 text-xs font-bold">*</span>
                                    </Label>
                                    <Input
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        placeholder="https://tech.example.com"
                                        className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold text-base focus-visible:ring-primary/20"
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1 flex items-center">
                                        Legal Entity Name <span className="text-red-500 ml-0.5 text-xs font-bold">*</span>
                                    </Label>
                                    <Input
                                        value={formData.legal_name}
                                        onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                                        placeholder="e.g. Neutral Publishing House Ltd."
                                        className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold focus-visible:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1 flex items-center">
                                        Founding Year/Info <span className="text-red-500 ml-0.5 text-xs font-bold">*</span>
                                    </Label>
                                    <DatePicker
                                        value={formData.founding_date}
                                        onChange={(val) => setFormData({ ...formData, founding_date: val })}
                                        className="h-12"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">Local Brands / Alternate Names</Label>
                                <div className="p-6 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {formData.alternate_name.map((name, i) => (
                                            <Badge key={i} variant="secondary" className="pl-3 pr-2 py-1.5 rounded-lg font-hindi text-sm flex items-center gap-2 group">
                                                {name}
                                                <X 
                                                    className="w-3.5 h-3.5 cursor-pointer opacity-40 group-hover:opacity-100 hover:text-red-500 transition-opacity" 
                                                    onClick={() => setFormData({ ...formData, alternate_name: formData.alternate_name.filter((_, idx) => idx !== i) })}
                                                />
                                            </Badge>
                                        ))}
                                        {formData.alternate_name.length === 0 && (
                                            <p className="text-xs text-muted-foreground italic pl-1">No alternate names defined yet.</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            id="new-create-brand"
                                            placeholder="Type a name and press Enter or Add..."
                                            className="h-11 bg-white dark:bg-black/20 font-hindi"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = (e.target as HTMLInputElement).value.trim();
                                                    if (val) {
                                                        setFormData({ ...formData, alternate_name: [...formData.alternate_name, val] });
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <Button 
                                            type="button"
                                            variant="secondary" 
                                            className="h-11 px-6 rounded-xl font-bold"
                                            onClick={() => {
                                                const el = document.getElementById('new-create-brand') as HTMLInputElement;
                                                const val = el.value.trim();
                                                if (val) {
                                                    setFormData({ ...formData, alternate_name: [...formData.alternate_name, val] });
                                                    el.value = '';
                                                }
                                            }}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1 flex items-center">
                                    Organization Category <span className="text-red-500 ml-0.5 text-xs font-bold">*</span>
                                </Label>
                                <Select
                                    value={formData.org_type}
                                    onValueChange={(v) => setFormData({ ...formData, org_type: v })}
                                >
                                    <SelectTrigger className="h-14 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-black text-[12px] uppercase tracking-wider focus-visible:ring-primary/20 px-6">
                                        <SelectValue placeholder="Select classification" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-200 dark:border-white/10 shadow-2xl">
                                        <SelectItem value="NewsMediaOrganization" className="py-3 font-bold">News Media</SelectItem>
                                        <SelectItem value="Corporation" className="py-3 font-bold">Corporation</SelectItem>
                                        <SelectItem value="GovernmentOrganization" className="py-3 font-bold">Government</SelectItem>
                                        <SelectItem value="NGO" className="py-3 font-bold">NGO / Non-Profit</SelectItem>
                                        <SelectItem value="EducationalOrganization" className="py-3 font-bold">Educational</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Location */}
                    <Card className="overflow-hidden border-none shadow-xl dark:bg-[#1A1C1E] ring-1 ring-slate-200 dark:ring-white/10 relative group">
                        <div 
                            className="absolute inset-0 bg-cover bg-center grayscale opacity-[0.05] dark:opacity-[0.08] pointer-events-none transition-transform duration-1000 group-hover:scale-105" 
                            style={{ backgroundImage: 'url("/assets/brand/headquarters-bg.png")' }}
                        />
                        <CardHeader className="bg-red-500/5 dark:bg-red-500/10 p-8 border-b border-red-500/10 relative z-10">
                            <CardTitle className="text-xl font-black flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-red-500" />
                                </div>
                                Headquarters Location
                            </CardTitle>
                            <CardDescription className="text-sm font-medium pt-1">
                                Set your physical coordinate for regional presence and contact mapping.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="space-y-2.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">Street Address</Label>
                                <Input
                                    value={formData.address.street_address}
                                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street_address: e.target.value } })}
                                    placeholder="Unit 102, Innovation Park"
                                    className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold focus-visible:ring-red-500/20"
                                />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">City</Label>
                                    <Input
                                        value={formData.address.city}
                                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                                        placeholder="Bangalore"
                                        className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">State</Label>
                                    <Input
                                        value={formData.address.state}
                                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                                        placeholder="KA"
                                        className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">ZIP</Label>
                                    <Input
                                        value={formData.address.zip_code}
                                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, zip_code: e.target.value } })}
                                        placeholder="560001"
                                        className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">Country</Label>
                                    <Input
                                        value={formData.address.country}
                                        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, country: e.target.value } })}
                                        placeholder="India"
                                        className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Reach */}
                    <Card className="overflow-hidden border-none shadow-xl dark:bg-[#1A1C1E] ring-1 ring-slate-200 dark:ring-white/10">
                        <CardHeader className="bg-emerald-500/5 dark:bg-emerald-500/10 p-8 border-b border-emerald-500/10">
                            <CardTitle className="text-xl font-black flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-emerald-500" />
                                </div>
                                Global Reach & Connectivity
                            </CardTitle>
                            <CardDescription className="text-sm font-medium pt-1">
                                Define how the audience and clients can reach this organization.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1 flex items-center">
                                        Support Email <span className="text-red-500 ml-0.5 text-xs font-bold">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            value={formData.contact_details.email}
                                            onChange={(e) => setFormData({ ...formData, contact_details: { ...formData.contact_details, email: e.target.value } })}
                                            placeholder="contact@example.com"
                                            className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold pl-10 focus-visible:ring-emerald-500/20"
                                        />
                                        <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1 flex items-center">
                                        Primary Phone <span className="text-red-500 ml-0.5 text-xs font-bold">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            value={formData.contact_details.primary_phone}
                                            onChange={(e) => setFormData({ ...formData, contact_details: { ...formData.contact_details, primary_phone: e.target.value } })}
                                            placeholder="+91 XXXXX XXXXX"
                                            className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold pl-10 focus-visible:ring-emerald-500/20"
                                        />
                                        <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Social */}
                    <Card className="overflow-hidden border-none shadow-xl dark:bg-[#1A1C1E] ring-1 ring-slate-200 dark:ring-white/10">
                        <CardHeader className="bg-purple-500/5 dark:bg-purple-500/10 p-8 border-b border-purple-500/10">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl font-black flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <Share2 className="w-5 h-5 text-purple-500" />
                                    </div>
                                    Social Ecosystem
                                </CardTitle>
                                {!allChosen && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addSocial}
                                        className="h-9 px-4 rounded-xl border-purple-500/20 text-purple-500 hover:bg-purple-500/10 transition-all font-black uppercase text-[10px] tracking-widest gap-2"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Platform
                                    </Button>
                                )}
                            </div>
                            <CardDescription className="text-sm font-medium pt-1">
                                Link your official digital presence across the social landscape.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                            {socials.map((entry) => (
                                <div key={entry.id} className="flex flex-col md:flex-row items-end gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="w-full md:w-48 space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">Platform</Label>
                                        <Select
                                            value={entry.type}
                                            onValueChange={(v) => updateSocial(entry.id, "type", v)}
                                        >
                                            <SelectTrigger className="h-11 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs focus-visible:ring-purple-500/20">
                                                <SelectValue placeholder="Select Platform">
                                                    {entry.type && (
                                                        <div className="flex items-center gap-2">
                                                            {SOCIAL_ICON[entry.type as SocialType]}
                                                            {SOCIAL_OPTIONS.find(o => o.value === entry.type)?.label}
                                                        </div>
                                                    )}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-200 dark:border-white/10">
                                                {SOCIAL_OPTIONS.map((opt) => (
                                                    <SelectItem 
                                                        key={opt.value} 
                                                        value={opt.value}
                                                        disabled={chosenTypes.includes(opt.value) && opt.value !== entry.type}
                                                        className="py-3 font-bold text-xs"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {SOCIAL_ICON[opt.value]}
                                                            {opt.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex-1 w-full space-y-2">
                                        <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">Profile / Page URL</Label>
                                        <div className="relative">
                                            <Input
                                                value={entry.url}
                                                onChange={(e) => updateSocial(entry.id, "url", e.target.value)}
                                                placeholder={entry.type ? SOCIAL_PLACEHOLDER[entry.type as SocialType] : "Select platform first..."}
                                                className="h-11 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl pl-10 text-xs font-bold focus-visible:ring-purple-500/20"
                                            />
                                            {entry.type && (
                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-70">
                                                    {SOCIAL_ICON[entry.type as SocialType]}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeSocial(entry.id)}
                                        disabled={socials.length === 1 && !entry.type && !entry.url}
                                        className="mb-0.5 h-11 w-11 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {socials.length === 0 && (
                                <div className="text-center py-12 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5">
                                    <Share2 className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No social profiles configured</p>
                                    <Button 
                                        type="button" 
                                        variant="link" 
                                        onClick={addSocial}
                                        className="text-primary text-[10px] font-black uppercase mt-2"
                                    >
                                        Click to start adding
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Business Operations */}
                    <Card className="overflow-hidden border-none shadow-xl dark:bg-[#1A1C1E] ring-1 ring-slate-200 dark:ring-white/10">
                        <CardHeader className="bg-primary/5 p-8 border-b border-primary/10">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl font-black flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-primary" />
                                    </div>
                                    Business Operations <span className="text-red-500 ml-0.5 text-xs font-bold">*</span>
                                </CardTitle>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setFormData({
                                            ...formData,
                                            business_hours: [
                                                ...formData.business_hours,
                                                { day_of_week: [], opens: "09:00", closes: "18:00", is_closed: false }
                                            ]
                                        });
                                    }}
                                    className="h-9 px-4 rounded-xl border-primary/20 text-primary hover:bg-primary/10 transition-all font-black uppercase text-[10px] tracking-widest gap-2"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Shift Slot
                                </Button>
                            </div>
                            <CardDescription className="text-sm font-medium pt-1">
                                Configure the standard operating schedule for the public and staff.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            {formData.business_hours.map((hour, idx) => (
                                <div key={idx} className="p-6 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-6 relative group/slot">
                                    {formData.business_hours.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const newHours = formData.business_hours.filter((_, i) => i !== idx);
                                                setFormData({ ...formData, business_hours: newHours });
                                            }}
                                            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all opacity-0 group-hover/slot:opacity-100"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}

                                    <div className="space-y-4">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Active Days</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => {
                                                const isSelected = hour.day_of_week.includes(day);
                                                return (
                                                    <Badge
                                                        key={day}
                                                        variant={isSelected ? "default" : "outline"}
                                                        onClick={() => {
                                                            const newDays = isSelected
                                                                ? hour.day_of_week.filter(d => d !== day)
                                                                : [...hour.day_of_week, day];
                                                            const newHours = [...formData.business_hours];
                                                            newHours[idx] = { ...newHours[idx], day_of_week: newDays };
                                                            setFormData({ ...formData, business_hours: newHours });
                                                        }}
                                                        className={cn(
                                                            "cursor-pointer px-4 py-2 text-[11px] rounded-xl transition-all font-bold",
                                                            isSelected ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" : "hover:bg-slate-100 dark:hover:bg-white/5"
                                                        )}
                                                    >
                                                        {day.slice(0, 3)}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 items-end">
                                        <div className="space-y-2.5">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Opening Time</Label>
                                            <Input
                                                type="time"
                                                value={hour.opens}
                                                onChange={(e) => {
                                                    const newHours = [...formData.business_hours];
                                                    newHours[idx] = { ...newHours[idx], opens: e.target.value };
                                                    setFormData({ ...formData, business_hours: newHours });
                                                }}
                                                className="h-12 bg-white dark:bg-black/20 font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Closing Time</Label>
                                            <Input
                                                type="time"
                                                value={hour.closes}
                                                onChange={(e) => {
                                                    const newHours = [...formData.business_hours];
                                                    newHours[idx] = { ...newHours[idx], closes: e.target.value };
                                                    setFormData({ ...formData, business_hours: newHours });
                                                }}
                                                className="h-12 bg-white dark:bg-black/20 font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Brand Visual Assets */}
                    <Card className="overflow-hidden border-none shadow-xl dark:bg-[#1A1C1E] ring-1 ring-slate-200 dark:ring-white/10">
                        <CardHeader className="bg-indigo-500/5 dark:bg-indigo-500/10 p-8 border-b border-indigo-500/10">
                            <CardTitle className="text-xl font-black flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                    <Layout className="w-5 h-5 text-indigo-500" />
                                </div>
                                Brand Identity & Visuals
                            </CardTitle>
                            <CardDescription className="text-sm font-medium pt-1">
                                Upload the primary brand assets for this organization.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8">
                        <div className="flex flex-col md:flex-row gap-10">
                            {/* Square Logo */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        Square Logo <span className="text-red-500 font-bold">*</span>
                                        <Badge variant="outline" className="text-[8px] h-4 font-bold border-indigo-500/20 text-indigo-500">1:1</Badge>
                                    </Label>
                                    {logos.square?.url && (
                                        <Button
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => setLogos({ ...logos, square: undefined })}
                                            className="h-6 text-[9px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                        >
                                            <Trash2 className="w-3 h-3 mr-1" /> Remove
                                        </Button>
                                    )}
                                </div>
                                <div 
                                    onClick={() => squareFileRef.current?.click()}
                                    className={cn(
                                        "group relative h-40 aspect-square rounded-3xl overflow-hidden border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3",
                                        logos.square?.url 
                                            ? "border-emerald-500/20 bg-emerald-500/[0.02]" 
                                            : "border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] hover:border-indigo-500/50 hover:bg-indigo-500/[0.02]"
                                    )}
                                >
                                    <input 
                                        type="file" 
                                        ref={squareFileRef} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, "square")}
                                    />
                                    {logos.square?.url ? (
                                        <>
                                            <div className="relative w-full h-full p-4">
                                                <img 
                                                    src={logos.square.url} 
                                                    alt="Square Logo" 
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                                <Camera className="w-8 h-8 text-white animate-in zoom-in-50 duration-300" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                                                <ImageIcon className="w-5 h-5 text-indigo-500 opacity-60" />
                                            </div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Upload Square</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Rectangle Logo */}
                            <div className="space-y-4 flex-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        Landscape Logo / Banner
                                        <Badge variant="outline" className="text-[8px] h-4 font-bold border-emerald-500/20 text-emerald-500">Wide</Badge>
                                    </Label>
                                    {logos.rectangle?.url && (
                                        <Button
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => setLogos({ ...logos, rectangle: undefined })}
                                            className="h-6 text-[9px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                        >
                                            <Trash2 className="w-3 h-3 mr-1" /> Remove
                                        </Button>
                                    )}
                                </div>
                                <div 
                                    onClick={() => rectangleFileRef.current?.click()}
                                    className={cn(
                                        "group relative h-40 w-full rounded-3xl overflow-hidden border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3",
                                        logos.rectangle?.url 
                                            ? "border-emerald-500/20 bg-emerald-500/[0.02]" 
                                            : "border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] hover:border-emerald-500/50 hover:bg-emerald-500/[0.02]"
                                    )}
                                >
                                    <input 
                                        type="file" 
                                        ref={rectangleFileRef} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, "rectangle")}
                                    />
                                    {logos.rectangle?.url ? (
                                        <>
                                            <div className="relative w-full h-full p-6">
                                                <img 
                                                    src={logos.rectangle.url} 
                                                    alt="Rectangle Logo" 
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                                <Camera className="w-8 h-8 text-white animate-in zoom-in-50 duration-300" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                                                <Layout className="w-5 h-5 text-emerald-500 opacity-60" />
                                            </div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Upload Landscape</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        </CardContent>
                    </Card>

                    {/* SEO */}
                    <Card className="overflow-hidden border-none shadow-xl dark:bg-[#1A1C1E] ring-1 ring-slate-200 dark:ring-white/10">
                        <CardHeader className="bg-orange-500/5 dark:bg-orange-500/10 p-8 border-b border-orange-500/10">
                            <CardTitle className="text-xl font-black flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                    <Search className="w-5 h-5 text-orange-500" />
                                </div>
                                SEO & Search Strategy
                            </CardTitle>
                            <CardDescription className="text-sm font-medium pt-1">
                                Optimize how search engines index and display this organization.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="space-y-2.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">Primary Meta Title</Label>
                                <Input
                                    value={formData.seo_data.meta_title}
                                    onChange={(e) => setFormData({ ...formData, seo_data: { ...formData.seo_data, meta_title: e.target.value } })}
                                    placeholder="The definitive title for search results..."
                                    className="h-12 bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold focus-visible:ring-orange-500/20"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest pl-1">Global Meta Description</Label>
                                <Textarea
                                    value={formData.seo_data.meta_description}
                                    onChange={(e) => setFormData({ ...formData, seo_data: { ...formData.seo_data, meta_description: e.target.value } })}
                                    placeholder="Summarize the organization's purpose and reach..."
                                    className="min-h-[120px] bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl font-bold focus-visible:ring-orange-500/20 resize-none pt-4"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Form Actions */}
                    <div className="bg-white dark:bg-[#1A1C1E] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl flex items-center justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        
                        <div className="relative z-10">
                            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Finalize Registration</h3>
                            <p className="text-xs text-muted-foreground font-medium mt-1">Review all mandatory fields highlighted with <span className="text-red-500">*</span></p>
                        </div>

                        <div className="flex items-center gap-4 relative z-10">
                            <Button
                                variant="ghost"
                                onClick={onCancel}
                                className="rounded-xl font-bold px-8 text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Discard Changes
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSaving}
                                className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 px-10 rounded-xl font-black uppercase text-xs tracking-widest transition-all hover:scale-[1.02] active:scale-95 h-14"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Check className="w-5 h-5 mr-3 stroke-[3]" />}
                                Establish Entity
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-8 sticky top-24">
                    <Card className="overflow-hidden border-none shadow-lg dark:bg-[#1A1C1E] ring-1 ring-slate-200 dark:ring-white/5">
                        <CardHeader className="bg-primary/5 pb-6">
                            <CardTitle className="text-lg font-black flex items-center gap-2 text-primary">
                                <Globe className="w-5 h-5" />
                                Creation Insight
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <ul className="space-y-6">
                                <li className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-[10px] font-black text-blue-600">01</span>
                                    </div>
                                    <p className="text-[11px] font-bold leading-relaxed text-slate-600 dark:text-slate-400">
                                        The <span className="text-primary tracking-tight font-black">Core Identity</span> data is immutable for SEO consistency once indexed.
                                    </p>
                                </li>
                                <li className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-[10px] font-black text-emerald-600">02</span>
                                    </div>
                                    <p className="text-[11px] font-bold leading-relaxed text-slate-600 dark:text-slate-400">
                                        Ensure <span className="text-primary tracking-tight font-black">Social Connections</span> use direct canonical URLs.
                                    </p>
                                </li>
                                <li className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-[10px] font-black text-red-600">03</span>
                                    </div>
                                    <p className="text-[11px] font-bold leading-relaxed text-slate-600 dark:text-slate-400">
                                        Ensure <span className="text-primary tracking-tight font-black">Meta Data</span> is relevant to your primary audience.
                                    </p>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
