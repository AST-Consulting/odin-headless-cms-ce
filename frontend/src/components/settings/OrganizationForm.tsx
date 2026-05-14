"use client";

import { useState, useEffect } from "react";
import { getOrganizationDetails, getOrganizations, getOrganizationById, updateOrganization } from "@/lib/api";
import { useOrganizationStore } from "@/lib/store";
import type { Organization } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Building2, Mail, Phone, Globe, MapPin, Twitter, Facebook, Instagram,
    Youtube, Linkedin, ExternalLink, Calendar, Search, Languages, Clock,
    Pencil, Check, X, Loader2, Store, PlusCircle, Share2, ChevronDown,
    Trash2, ImageIcon, Camera, Layout, Plus
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ImagePickerDialog } from "@/components/editor/ImagePickerDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { DatePicker } from "@/components/ui/date-picker";
import { OrganizationCreateForm } from "./OrganizationCreateForm";

export function OrganizationForm() {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<Partial<Organization>>({});

    // Image Picker State
    const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
    const [pickingFor, setPickingFor] = useState<"square" | "rectangle" | null>(null);

    // Sync with global store
    const { setSelectedOrganization, selectedOrganization } = useOrganizationStore();

    useEffect(() => {
        fetchAllOrganizations();
    }, []);

    const fetchAllOrganizations = async () => {
        try {
            setIsLoading(true);
            const res = await getOrganizations();
            const list = res.data || [];
            setOrganizations(list);

            // If we have a global selection, use it, else pick first
            const initialOrg = selectedOrganization || list[0];
            if (initialOrg) {
                await fetchOrgDetails(initialOrg._id || (initialOrg as any).id);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load organizations");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOrgDetails = async (id: string) => {
        try {
            setIsLoading(true);
            const res = await getOrganizationById(id);
            setOrganization(res.data);
            setFormData(res.data);
            setSelectedOrganization(res.data);
            setIsEditing(false);
        } catch (err: any) {
            toast.error("Failed to load organization details");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!organization?._id) return;

        // Validation parity with Create Form
        if (!formData.name || !formData.domain) {
            toast.error("Display Name and Primary Domain are required");
            return;
        }

        if (!formData.domain.startsWith('https://')) {
            toast.error("Primary Domain must start with https://");
            return;
        }

        try {
            new URL(formData.domain);
        } catch (err) {
            toast.error("Please enter a valid Primary Domain (e.g., https://example.com)");
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

        if (!formData.contact_details?.email || !formData.contact_details?.primary_phone) {
            toast.error("Support Email and Primary Phone are required");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.contact_details.email)) {
            toast.error("Please enter a valid Support Email address");
            return;
        }

        if (!formData.logos?.square?.url) {
            toast.error("Square Logo is required for the business profile");
            return;
        }

        try {
            setIsSaving(true);
            await updateOrganization(organization._id, formData);
            toast.success("Organization details updated successfully");
            setIsEditing(false);
            await fetchOrgDetails(organization._id);
            // Refresh list too
            const res = await getOrganizations();
            setOrganizations(res.data || []);
        } catch (err: any) {
            console.error("Failed to update organization:", err);
            toast.error(err.message || "Failed to update organization");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData(organization || {});
        setIsEditing(false);
    };

    const formatDate = (date: string | { $date: string } | undefined) => {
        if (!date) return 'Not established';
        const d = typeof date === 'string' ? date : date.$date;
        return new Date(d).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (isCreating) {
        return (
            <OrganizationCreateForm
                onSuccess={() => {
                    setIsCreating(false);
                    fetchAllOrganizations();
                }}
                onCancel={() => setIsCreating(false)}
            />
        );
    }

    if (isLoading && !organizations.length) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-3 space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
                </div>
                <div className="lg:col-span-9">
                    <Card className="animate-pulse h-96" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="py-12 text-center text-destructive">
                    <p className="font-semibold text-lg">Error loading organizations</p>
                    <p className="text-sm opacity-80 mt-2">{error}</p>
                    <Button onClick={fetchAllOrganizations} variant="outline" className="mt-4">Retry</Button>
                </CardContent>
            </Card>
        );
    }

    if (!organization && organizations.length > 0) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-3 space-y-4">
                    {organizations.map(org => (
                        <Card key={org._id} className="h-16 opacity-50"><CardContent /></Card>
                    ))}
                </div>
                <div className="lg:col-span-9 flex items-center justify-center h-96">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    if (!organization) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Directory */}
            <div className="lg:col-span-3 space-y-4">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                        Directory
                    </h2>
                    <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary border-none font-bold">
                        {organizations.length} Entities
                    </Badge>
                </div>

                <div className="space-y-2.5">
                    {organizations.map((org) => (
                        <Card
                            key={org._id}
                            onClick={() => fetchOrgDetails(org._id!)}
                            className={cn(
                                "cursor-pointer transition-all duration-300 border shadow-sm group relative overflow-hidden",
                                selectedOrganization?._id === org._id
                                    ? "ring-1 ring-primary border-primary bg-primary/[0.03]"
                                    : "border-slate-200 dark:border-white/10 hover:border-primary/40 bg-white dark:bg-[#1A1C1E]"
                            )}
                        >
                            <CardContent className="p-3.5 flex items-center gap-3">
                                <div className={cn(
                                    "w-11 h-11 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border transition-all",
                                    selectedOrganization?._id === org._id ? "border-primary/20 scale-105" : "border-transparent"
                                )}>
                                    {org.logos?.square?.url ? (
                                        <img src={org.logos.square.url} alt={org.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2 className="w-5 h-5 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className={cn(
                                        "text-[13px] font-black truncate transition-colors leading-tight",
                                        selectedOrganization?._id === org._id ? "text-primary" : "text-slate-800 dark:text-slate-200"
                                    )}>
                                        {org.name || org.legal_name}
                                    </h3>
                                    <p className="text-[9px] text-muted-foreground truncate uppercase tracking-widest font-black mt-1.5 opacity-60">
                                        {org.org_type?.replace(/([A-Z])/g, ' $1').trim() || 'Unit'}
                                    </p>
                                </div>
                                {selectedOrganization?._id === org._id && (
                                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
                                        <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}

                    <Button
                        variant="outline"
                        onClick={() => setIsCreating(true)}
                        className="w-full h-14 border-dashed border-2 bg-slate-50/50 dark:bg-white/[0.02] hover:border-primary hover:bg-primary/5 hover:text-primary transition-all rounded-xl gap-3 text-muted-foreground/60 font-black uppercase text-[9px] tracking-[0.2em] px-0"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Register Entity
                    </Button>
                </div>
            </div>

            {/* Right Detailed View */}
            <div className="lg:col-span-9 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1A1C1E] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
                                {organization.name || organization.legal_name}
                            </h1>
                            <Badge variant="outline" className="rounded-full px-2.5 py-0 text-[8px] font-black uppercase tracking-[0.2em] border-primary/20 text-primary bg-primary/5">
                                Active Profile
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 font-bold opacity-80 uppercase tracking-tight">
                            <Store className="w-3.5 h-3.5 text-primary" />
                            Corporate Settings & Brand Identity
                        </p>
                    </div>

                    <div className="flex items-center gap-3 relative z-10">
                        {!isEditing && (
                            <Button
                                onClick={() => setIsEditing(true)}
                                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 px-6 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 text-xs h-10"
                            >
                                <Pencil className="w-3.5 h-3.5 mr-2" />
                                Edit Profile
                            </Button>
                        )}
                    </div>
                </div>
                {isLoading && !organization ? (
                    <div className="grid gap-6 md:grid-cols-2">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i} className="animate-pulse h-48 border-slate-100 dark:border-white/10" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6">

                        {/* Logos & Branding */}
                        <div className="grid gap-6 md:grid-cols-3">
                            <Card className="md:col-span-2 overflow-hidden border-none shadow-lg dark:bg-[#1A1C1E]">
                                <CardHeader className="bg-primary/5 pb-6">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-primary" />
                                        Branding & Visibility
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="flex flex-col md:flex-row gap-8 items-start">
                                        {/* Square Logo */}
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center">
                                                Publication Icon {isEditing && <span className="text-red-500 ml-1">*</span>}
                                            </p>
                                            <div
                                                onClick={() => isEditing && (setPickingFor("square"), setIsImagePickerOpen(true))}
                                                className={cn(
                                                    "w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-white group relative",
                                                    isEditing && "cursor-pointer ring-2 ring-primary/20",
                                                    !isEditing && !organization.logos?.square?.url && "hidden"
                                                )}
                                            >
                                                {(isEditing ? formData.logos?.square?.url : organization.logos?.square?.url) ? (
                                                    <>
                                                        <img
                                                            src={isEditing ? formData.logos?.square?.url : organization.logos?.square?.url}
                                                            alt="Square Logo"
                                                            className="w-full h-full object-contain p-2"
                                                        />
                                                        {isEditing && (
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Camera className="w-6 h-6 text-white" />
                                                            </div>
                                                        )}
                                                    </>
                                                ) : isEditing && (
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700">
                                                        <Plus className="w-6 h-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            {!isEditing && !organization.logos?.square?.url && (
                                                <p className="text-xs text-muted-foreground italic">None</p>
                                            )}
                                        </div>

                                        {/* Rectangle Logo */}
                                        <div className="space-y-2 flex-1 w-full">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Digital Masthead</p>
                                            <div
                                                onClick={() => isEditing && (setPickingFor("rectangle"), setIsImagePickerOpen(true))}
                                                className={cn(
                                                    "h-24 w-full rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-white flex items-center justify-center group relative",
                                                    isEditing && "cursor-pointer ring-2 ring-primary/20",
                                                    !isEditing && !organization.logos?.rectangle?.url && "hidden"
                                                )}
                                            >
                                                {(isEditing ? formData.logos?.rectangle?.url : organization.logos?.rectangle?.url) ? (
                                                    <>
                                                        <img
                                                            src={isEditing ? formData.logos?.rectangle?.url : organization.logos?.rectangle?.url}
                                                            alt="Rectangle Logo"
                                                            className="max-h-full max-w-full object-contain p-4"
                                                        />
                                                        {isEditing && (
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Camera className="w-8 h-8 text-white" />
                                                            </div>
                                                        )}
                                                    </>
                                                ) : isEditing && (
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700">
                                                        <Plus className="w-8 h-8 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            {!isEditing && !organization.logos?.rectangle?.url && (
                                                <p className="text-xs text-muted-foreground italic">None</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-lg dark:bg-[#1A1C1E]">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg">Founding Info</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                                            <Calendar className="w-3 h-3" /> Founding Date {isEditing && <span className="text-red-500 ml-0.5">*</span>}
                                        </Label>
                                        {isEditing ? (
                                            <DatePicker
                                                value={(() => {
                                                    const dateVal = formData.founding_date;
                                                    if (!dateVal) return '';
                                                    const d = typeof dateVal === 'string' ? dateVal : (dateVal as any).$date;
                                                    return d ? new Date(d).toISOString().split('T')[0] : '';
                                                })()}
                                                onChange={(val) => setFormData({ ...formData, founding_date: val })}
                                                className="h-10"
                                            />
                                        ) : (
                                            <p className="text-lg font-bold text-primary">
                                                {formatDate(organization.founding_date)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Local Brands</Label>
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {(formData.alternate_name || []).map((name, i) => (
                                                        <Badge key={i} variant="outline" className="text-sm font-hindi py-1 px-3 flex items-center gap-1 group">
                                                            {name}
                                                            <X 
                                                                className="w-3 h-3 cursor-pointer hover:text-red-500" 
                                                                onClick={() => {
                                                                    const newList = (formData.alternate_name || []).filter((_, idx) => idx !== i);
                                                                    setFormData({ ...formData, alternate_name: newList });
                                                                }}
                                                            />
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        id="new-brand"
                                                        placeholder="Add brand name..."
                                                        className="h-9 bg-white dark:bg-slate-950 font-hindi"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const val = (e.target as HTMLInputElement).value.trim();
                                                                if (val) {
                                                                    setFormData({
                                                                        ...formData,
                                                                        alternate_name: [...(formData.alternate_name || []), val]
                                                                    });
                                                                    (e.target as HTMLInputElement).value = '';
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    <Button 
                                                        variant="secondary" 
                                                        size="sm"
                                                        onClick={() => {
                                                            const input = document.getElementById('new-brand') as HTMLInputElement;
                                                            const val = input.value.trim();
                                                            if (val) {
                                                                setFormData({
                                                                    ...formData,
                                                                    alternate_name: [...(formData.alternate_name || []), val]
                                                                });
                                                                input.value = '';
                                                            }
                                                        }}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (organization.alternate_name && organization.alternate_name.length > 0) ? (
                                            <div className="flex flex-wrap gap-2">
                                                {organization.alternate_name.map((name, i) => (
                                                    <Badge key={i} variant="outline" className="text-sm font-hindi py-1 px-3">
                                                        {name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">None defined</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Core Identity */}
                            <Card className="overflow-hidden border-none shadow-lg dark:bg-[#1A1C1E]">
                                <CardHeader className="bg-primary/5 pb-8">
                                    <div className="flex items-center justify-between">
                                        <Badge variant={organization.status === 'active' ? 'default' : 'secondary'} className="px-3 py-1 rounded-full uppercase tracking-wider text-[10px] font-bold">
                                            {organization.status || 'Active'}
                                        </Badge>
                                        {organization.isVerified && (
                                            <div className="flex items-center gap-2 text-xs text-green-600 font-medium bg-green-50 dark:bg-green-500/10 px-3 py-2 rounded-lg">
                                                Verified Entity
                                            </div>
                                        )}
                                    </div>
                                    {isEditing ? (
                                        <div className="mt-4 space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs uppercase text-muted-foreground font-bold flex items-center">
                                                    Display Name <span className="text-red-500 ml-1">*</span>
                                                </Label>
                                                <Input
                                                    value={formData.name || ''}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="bg-white dark:bg-slate-800"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs uppercase text-muted-foreground font-bold flex items-center">
                                                    Legal Name <span className="text-red-500 ml-1">*</span>
                                                </Label>
                                                <Input
                                                    value={formData.legal_name || ''}
                                                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                                                    className="bg-white dark:bg-slate-800"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <CardTitle className="text-2xl mt-4">{organization.legal_name || organization.organizationName || organization.name}</CardTitle>
                                            <CardDescription className="text-base">{organization.org_type || 'Commercial Organization'}</CardDescription>
                                        </>
                                    )}
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Globe className="w-4 h-4 text-muted-foreground" />
                                        {isEditing ? (
                                            <div className="flex-1 space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center">
                                                    Primary Domain <span className="text-red-500 ml-1">*</span>
                                                </Label>
                                                <Input
                                                    value={formData.domain || ''}
                                                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                                    placeholder="https://your-domain.com"
                                                    className="h-8"
                                                />
                                            </div>
                                        ) : (
                                            <span className="font-medium">{organization.domain || organization.url}</span>
                                        )}
                                        {!isEditing && organization.url && (
                                            <a href={organization.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-primary hover:underline flex items-center gap-1">
                                                Visit site <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                    {organization.website_info && (
                                        <div className="grid grid-cols-2 gap-4 mt-6">
                                            <div className="p-3 rounded-xl bg-muted/30 space-y-1">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                    <Languages className="w-3 h-3" /> Lang
                                                </p>
                                                <p className="text-xs font-bold uppercase">{organization.website_info.in_language || 'en'}</p>
                                            </div>
                                            <div className="p-3 rounded-xl bg-muted/30 space-y-1 overflow-hidden">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                    <Search className="w-3 h-3" /> Search
                                                </p>
                                                <p className="text-[10px] truncate opacity-80">{organization.website_info.search_url || 'N/A'}</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Contact Details Card */}
                            <Card className="overflow-hidden border-none shadow-lg dark:bg-[#1A1C1E]">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Mail className="w-5 h-5 text-primary" />
                                        Global Reach
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4">
                                        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                                            <Mail className="w-5 h-5 text-muted-foreground" />
                                            <div className="space-y-0.5 flex-1">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight flex items-center">
                                                    Email {isEditing && <span className="text-red-500 ml-1">*</span>}
                                                </p>
                                                {isEditing ? (
                                                    <Input
                                                        value={formData.contact_details?.email || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            contact_details: { ...formData.contact_details, email: e.target.value }
                                                        })}
                                                        className="h-8 mt-1"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-medium">{organization.contact_details?.email || 'Not provided'}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                                            <Phone className="w-5 h-5 text-muted-foreground" />
                                            <div className="space-y-0.5 flex-1">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight flex items-center">
                                                    Support {isEditing && <span className="text-red-500 ml-1">*</span>}
                                                </p>
                                                {isEditing ? (
                                                    <Input
                                                        value={formData.contact_details?.primary_phone || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            contact_details: { ...formData.contact_details, primary_phone: e.target.value }
                                                        })}
                                                        className="h-8 mt-1"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-medium">{organization.contact_details?.primary_phone || 'Not provided'}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Address & SEO */}
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card className={cn(
                                "overflow-hidden border-none shadow-xl dark:bg-[#1A1C1E] group relative min-h-[220px]",
                                !isEditing && organization.address && "bg-slate-50 dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-white/10"
                            )}>

                                <CardHeader className="pb-4 relative z-10 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                            Headquarters
                                        </CardTitle>
                                    </div>
                                    {!isEditing && organization.address && (
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-primary stroke-[2.5]" />
                                        </div>
                                    )}
                                </CardHeader>

                                <CardContent className="relative z-10">
                                    {isEditing ? (
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Street Address</Label>
                                                <Input
                                                    value={formData.address?.street_address || ''}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        address: { ...formData.address, street_address: e.target.value }
                                                    })}
                                                    className="h-10 bg-white/50 dark:bg-slate-950/50"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Locality / City</Label>
                                                    <Input
                                                        value={formData.address?.address_locality || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            address: { ...formData.address, address_locality: e.target.value }
                                                        })}
                                                        className="h-10 bg-white/50 dark:bg-slate-950/50"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Region / State</Label>
                                                    <Input
                                                        value={formData.address?.address_region || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            address: { ...formData.address, address_region: e.target.value }
                                                        })}
                                                        className="h-10 bg-white/50 dark:bg-slate-950/50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Postal Code</Label>
                                                    <Input
                                                        value={formData.address?.postal_code || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            address: { ...formData.address, postal_code: e.target.value }
                                                        })}
                                                        className="h-10 bg-white/50 dark:bg-slate-950/50"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Country</Label>
                                                    <Input
                                                        value={formData.address?.address_country || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            address: { ...formData.address, address_country: e.target.value }
                                                        })}
                                                        className="h-10 bg-white/50 dark:bg-slate-950/50"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : organization.address ? (
                                        <div className="flex flex-col justify-between h-full space-y-8">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                                    {organization.address.street_address}
                                                </h3>
                                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                                    {organization.address.address_locality}, {organization.address.address_region} {organization.address.postal_code}, {organization.address.address_country}
                                                </p>
                                            </div>

                                            <div className="h-4" />
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground italic text-sm py-4">Address information not detailed.</p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="overflow-hidden border-none shadow-lg dark:bg-[#1A1C1E]">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg">SEO Strategy</CardTitle>
                                    <CardDescription>Global metadata defaults</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Global Page Title</p>
                                        {isEditing ? (
                                            <Input
                                                value={formData.seo_data?.meta_title || ''}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    seo_data: { ...formData.seo_data, meta_title: e.target.value }
                                                })}
                                                className="h-8"
                                            />
                                        ) : (
                                            <p className="text-sm font-bold leading-tight">{organization.seo_data?.meta_title || 'N/A'}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Global Meta Description</p>
                                        {isEditing ? (
                                            <Textarea
                                                value={formData.seo_data?.meta_description || ''}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    seo_data: { ...formData.seo_data, meta_description: e.target.value }
                                                })}
                                                className="text-xs min-h-[80px]"
                                            />
                                        ) : (
                                            <p className="text-xs leading-relaxed opacity-80">{organization.seo_data?.meta_description || 'N/A'}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Business Operations */}
                        <div className="space-y-6">
                            <Card className="w-full overflow-hidden border-none shadow-lg dark:bg-[#1A1C1E]">
                                <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-primary" />
                                        Business Operations {isEditing && <span className="text-red-500 ml-0.5">*</span>}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {isEditing ? (
                                        <div className="space-y-6">
                                            {(formData.business_hours || []).map((hour, idx) => (
                                                <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 space-y-4 relative group/slot">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            const newHours = (formData.business_hours || []).filter((_, i) => i !== idx);
                                                            setFormData({ ...formData, business_hours: newHours });
                                                        }}
                                                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg opacity-0 group-hover/slot:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>

                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Days of Week</Label>
                                                        <div className="flex flex-wrap gap-1.5">
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
                                                                            const newHours = [...(formData.business_hours || [])];
                                                                            newHours[idx] = { ...newHours[idx], day_of_week: newDays };
                                                                            setFormData({ ...formData, business_hours: newHours });
                                                                        }}
                                                                        className={cn(
                                                                            "cursor-pointer px-3 py-1 text-[10px] rounded-lg transition-all",
                                                                            isSelected ? "bg-primary text-white shadow-md shadow-primary/20" : "hover:bg-slate-100 dark:hover:bg-white/5"
                                                                        )}
                                                                    >
                                                                        {day.substring(0, 3)}
                                                                    </Badge>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Opens</Label>
                                                            <Input
                                                                type="time"
                                                                value={hour.opens}
                                                                onChange={(e) => {
                                                                    const newHours = [...(formData.business_hours || [])];
                                                                    newHours[idx] = { ...newHours[idx], opens: e.target.value };
                                                                    setFormData({ ...formData, business_hours: newHours });
                                                                }}
                                                                className="h-10 bg-white dark:bg-slate-950 font-mono text-xs"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Closes</Label>
                                                            <Input
                                                                type="time"
                                                                value={hour.closes}
                                                                onChange={(e) => {
                                                                    const newHours = [...(formData.business_hours || [])];
                                                                    newHours[idx] = { ...newHours[idx], closes: e.target.value };
                                                                    setFormData({ ...formData, business_hours: newHours });
                                                                }}
                                                                className="h-10 bg-white dark:bg-slate-950 font-mono text-xs"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setFormData({
                                                        ...formData,
                                                        business_hours: [
                                                            ...(formData.business_hours || []),
                                                            { day_of_week: ["Monday"], opens: "09:00", closes: "18:00", is_closed: false }
                                                        ]
                                                    });
                                                }}
                                                className="w-full h-11 border-dashed border-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all rounded-xl gap-2 font-bold text-[10px] uppercase tracking-widest text-muted-foreground"
                                            >
                                                <PlusCircle className="w-4 h-4" />
                                                Add Operational Slot
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                                            {(organization.business_hours || []).map((hour, idx) => {
                                                const abbreviate = (d: string) => d.substring(0, 3);
                                                const dayDisplay = hour.day_of_week.length === 7
                                                    ? "Full Week"
                                                    : hour.day_of_week.map(abbreviate).join(', ');

                                                return (
                                                    <div key={idx} className="flex items-center justify-between group p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-all border border-transparent hover:border-primary/20">
                                                        <div className="space-y-0.5 min-w-0 flex-1 pr-4">
                                                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate" title={hour.day_of_week.join(', ')}>
                                                                {dayDisplay}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                                                {hour.is_closed ? 'Closed' : 'Operational'}
                                                            </p>
                                                        </div>
                                                        {!hour.is_closed && (
                                                            <div className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-lg whitespace-nowrap border border-primary/10">
                                                                {hour.opens} — {hour.closes}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {(!organization.business_hours || organization.business_hours.length === 0) && (
                                                <p className="text-xs text-muted-foreground italic col-span-2 py-8 text-center bg-muted/20 rounded-xl">Custom business hours not configured.</p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <ImagePickerDialog
                                open={isImagePickerOpen}
                                onOpenChange={setIsImagePickerOpen}
                                onImageSelected={(images) => {
                                    if (images.length > 0 && pickingFor) {
                                        const img = images[0];
                                        setFormData({
                                            ...formData,
                                            logos: {
                                                ...formData.logos,
                                                [pickingFor]: {
                                                    url: img.url,
                                                    id: img.id,
                                                    width: 1024,
                                                    height: 1024,
                                                    purpose: pickingFor === "square" ? "logo" : "banner"
                                                }
                                            }
                                        });
                                    }
                                    setIsImagePickerOpen(false);
                                }}
                            />

                            {/* Social Connections */}
                            <Collapsible defaultOpen={false}>
                                <Card className="overflow-hidden border-none shadow-lg dark:bg-[#1A1C1E]">
                                    <CollapsibleTrigger className="w-full text-left group">
                                        <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 dark:border-white/5 pb-4 transition-all hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                            <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-600 shrink-0 group-hover:bg-sky-100 dark:group-hover:bg-sky-500/20 transition-colors">
                                                <Share2 className="h-5 w-5 shrink-0" />
                                            </div>
                                            <div className="flex-1">
                                                <CardTitle className="text-xl">Social Connections</CardTitle>
                                                <CardDescription>Link your official digital presence across the social landscape.</CardDescription>
                                            </div>
                                            <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                                        </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {[
                                                { icon: Twitter, label: 'X / Twitter', key: 'twitter', color: 'text-sky-500', placeholder: 'https://twitter.com/handle' },
                                                { icon: Facebook, label: 'Facebook', key: 'facebook', color: 'text-blue-600', placeholder: 'https://facebook.com/page' },
                                                { icon: Instagram, label: 'Instagram', key: 'instagram', color: 'text-rose-500', placeholder: 'https://instagram.com/handle' },
                                                { icon: Youtube, label: 'YouTube', key: 'youtube', color: 'text-red-600', placeholder: 'https://youtube.com/@channel' },
                                                { icon: Linkedin, label: 'LinkedIn', key: 'linkedin', color: 'text-indigo-700', placeholder: 'https://linkedin.com/company/name' },
                                                { icon: Globe, label: 'Wikipedia', key: 'wikipedia', color: 'text-slate-600', placeholder: 'https://wikipedia.org/wiki/Page_Name' },
                                            ].map((social, i) => {
                                                const value = organization.social_links?.[social.key as keyof typeof organization.social_links];
                                                const formValue = formData.social_links?.[social.key as keyof typeof formData.social_links];

                                                const getHandle = (url: string, type: string) => {
                                                    try {
                                                        if (!url) return '';
                                                        const decodedUrl = decodeURIComponent(url);
                                                        const path = new URL(decodedUrl).pathname;
                                                        const parts = path.split('/').filter(Boolean);
                                                        if (parts.length === 0) return url;
                                                        const handle = parts[parts.length - 1];

                                                        // Special case for Wikipedia: replace underscores with spaces
                                                        if (type === 'wikipedia') {
                                                            return handle.replace(/_/g, ' ');
                                                        }

                                                        // Special case for YouTube: keep the @ if present
                                                        if (type === 'youtube' && handle.startsWith('@')) return handle;

                                                        // General social handles
                                                        return handle.startsWith('@') ? handle : `@${handle}`;
                                                    } catch {
                                                        return url;
                                                    }
                                                };

                                                if (!isEditing && !value) return null;

                                                return (
                                                    <div key={i} className="space-y-2">
                                                        <Label className={cn("text-xs font-bold uppercase flex items-center gap-2", isEditing ? "text-slate-500 dark:text-slate-400" : "text-slate-700 dark:text-slate-300")}>
                                                            <social.icon className={cn("h-3.5 w-3.5 shrink-0", social.color)} />
                                                            {social.label}
                                                        </Label>

                                                        {isEditing ? (
                                                            <Input
                                                                value={formValue || ''}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    social_links: { ...formData.social_links, [social.key]: e.target.value }
                                                                })}
                                                                placeholder={social.placeholder}
                                                                className="h-11 font-medium bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 rounded-xl focus-visible:ring-primary/20"
                                                            />
                                                        ) : (
                                                            <a
                                                                href={value}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/50 dark:bg-white/5 hover:bg-primary/5 transition-all group border border-slate-100 dark:border-white/5 hover:border-primary/20 shadow-sm"
                                                            >
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider mb-0.5">{social.label}</span>
                                                                    <span className="text-sm font-black text-primary truncate">
                                                                        {getHandle(value || '', social.key)}
                                                                    </span>
                                                                </div>
                                                                <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-primary translate-x-1 group-hover:translate-x-0" />
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {!isEditing && (!organization.social_links || Object.values(organization.social_links).every(v => !v)) && (
                                                <div className="col-span-2 py-10 text-center bg-muted/20 dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                                                    <Share2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                                                    <p className="text-xs text-muted-foreground italic font-medium">No social media profiles linked to this entity.</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        </div>

                        {/* Edit Mode Actions Block */}
                        {isEditing && (
                            <div className="bg-white dark:bg-[#1A1C1E] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl flex items-center justify-between relative overflow-hidden group mt-6 animate-in slide-in-from-bottom-5 duration-300">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                
                                <div className="relative z-10">
                                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Save Changes</h3>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">Update global settings for this business profile.</p>
                                </div>

                                <div className="flex items-center gap-4 relative z-10">
                                    <Button
                                        variant="ghost"
                                        onClick={handleCancel}
                                        className="rounded-xl font-bold px-8 text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        Discard
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 px-10 rounded-xl font-black uppercase text-xs tracking-widest transition-all hover:scale-[1.02] active:scale-95 h-14"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Check className="w-5 h-5 mr-3 stroke-[3]" />}
                                        Update Profile
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

