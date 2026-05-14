"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CheckCircle2,
  Twitter,
  Facebook,
  Linkedin,
  Instagram,
  Share2,
  Info,
  Building2,
  Globe,
  Activity,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getUserById, updateUser } from "@/lib/api";
import { toast } from "sonner";
import { UserData, UserOrganizationSub, UserProperty } from "@/lib/types";
import { useAuthStore } from "@/lib/auth";
import { usePropertyStore } from "@/lib/store";
import { SeoDiscoverySection } from "@/components/shared/SeoDiscoverySection";
import { UserProfileSidebarCard } from "@/components/shared/UserProfileSidebarCard";
import { ImagePickerDialog } from "@/components/editor/ImagePickerDialog";
import { ChangePasswordDialog } from "@/components/shared/ChangePasswordDialog";
import { cn } from "@/lib/utils";
import { getStringId } from "@/lib/user-utils";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  designation: z.string().optional().nullable(),
  phone: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const digits = val.replace(/\D/g, "");
        return digits.length >= 10;
      },
      { message: "Enter a valid phone number (min 10 digits)" }
    ),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  socialLinks: z
    .object({
      twitter: z.string().optional().nullable(),
      facebook: z.string().optional().nullable(),
      linkedin: z.string().optional().nullable(),
      instagram: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  username: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  seo: z
    .object({
      title: z.string().optional().nullable(),
      metaDescription: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  organizationName: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  organizationSlug: z.string().optional().nullable(),
  organizationDomain: z.string().optional().nullable(),
  rank: z.coerce.number(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const { user: authUser } = useAuthStore();
  const { selectedProperty } = usePropertyStore();
  const userId = authUser?.id;

  const getPhoneString = (phone: any): string =>
    !phone ? "" : typeof phone === "object" ? phone.fullNumber || phone.number || "" : phone;

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      designation: "",
      phone: "",
      location: "",
      description: "",
      socialLinks: { twitter: "", facebook: "", linkedin: "", instagram: "" },
      username: "",
      slug: "",
      seo: { title: "", metaDescription: "" },
      organizationName: "",
      organizationId: "",
      organizationSlug: "",
      organizationDomain: "",
      rank: 0,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      try {
        setFetchingData(true);
        const userRes = await getUserById(userId);
        let uData: UserData | null = null;
        if (userRes) {
          uData = userRes.data || userRes;
          setUserData(uData);
        }
        if (uData) {
          reset({
            name: uData.name || "",
            email: uData.email || "",
            designation: uData.designation || "",
            phone: getPhoneString(uData.phone),
            location: uData.timezone?.country_or_territory || "",
            description: uData.description || "",
            socialLinks: {
              twitter: uData.socialLinks?.twitter || "",
              facebook: uData.socialLinks?.facebook || "",
              linkedin: uData.socialLinks?.linkedin || "",
              instagram: uData.socialLinks?.instagram || "",
            },
            username: uData.username || "",
            slug: uData.slug || "",
            seo: {
              title: uData.seo?.title || "",
              metaDescription: uData.seo?.metaDescription || "",
            },
            organizationName: uData.organization?.name || uData.companyName || "",
            organizationId: uData.organization?.id || "",
            organizationSlug: uData.organization?.slug || "",
            organizationDomain: uData.organization?.domain || "",
            rank: uData.rank || 0,
          });
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
        toast.error("Failed to load profile data");
      } finally {
        setFetchingData(false);
      }
    };
    fetchData();
  }, [userId, reset]);

  const onSubmit = async (data: ProfileFormValues) => {
    setLoading(true);
    try {
      if (!userId) return;
      const response = await updateUser(userId, {
        name: data.name,
        designation: data.designation,
        phone: data.phone,
        description: data.description,
        socialLinks: data.socialLinks,
        username: data.username,
        slug: data.slug,
        seo: data.seo,
        rank: data.rank,
      });
      if (response.success) {
        toast.success("Profile updated successfully");
        setUserData(response.data);
      } else {
        toast.error(response.message || "Failed to update profile");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvatar = async (images: { url: string; id: string; path: string }[]) => {
    if (images.length === 0 || !userId) return;
    const image = images[0];
    const newProfilePicture = {
      url: image.url,
      id: image.id,
      path: image.path,
      fileName: image.path.split("/").pop() || "avatar.jpg",
    };
    try {
      setLoading(true);
      const response = await updateUser(userId, { profilePicture: newProfilePicture });
      if (response.success) {
        toast.success("Profile picture updated");
        setUserData((prev) => (prev ? { ...prev, profilePicture: newProfilePicture } : null));
      } else {
        toast.error("Failed to update profile picture");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile picture");
    } finally {
      setLoading(false);
      setIsImagePickerOpen(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm animate-pulse font-medium">
          Synchronizing account components...
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Change Password Modal — triggered from sidebar card */}
      <ChangePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="lg:col-span-4 space-y-6">

          <UserProfileSidebarCard
            userData={userData}
            phoneString={getPhoneString(userData?.phone)}
            onEditAvatar={() => setIsImagePickerOpen(true)}
            onChangePassword={() => setIsPasswordDialogOpen(true)}
          />

          <ImagePickerDialog
            open={isImagePickerOpen}
            onOpenChange={setIsImagePickerOpen}
            onImageSelected={handleUpdateAvatar}
          />

          {/* Organization Context (View-Only) */}
          <Collapsible defaultOpen={true}>
            <Card className="border-none shadow-lg bg-indigo-50/20 dark:bg-indigo-900/10 px-1 pb-1">
              <div className="h-1 bg-indigo-500/50 rounded-t-full mx-4" />
              <CollapsibleTrigger className="w-full text-left group">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                    <Building2 className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">Organization Context</CardTitle>
                    <CardDescription>View-only details about your corporate environment.</CardDescription>
                  </div>
                  <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-2 space-y-4">
                  {userData?.organizations && userData.organizations.length > 0 ? (
                    <div className="space-y-4">
                      {userData.organizations.map((org: UserOrganizationSub) => {
                        const props = (() => {
                          let filtered = userData?.properties?.filter(p => {
                            const pOrgId = getStringId(p.organizationId || (p as any).organization?._id || (p as any).organization?.id || (p as any).organization);
                            const pOrgSlug = (p as any).organization?.slug || "";
                            
                            const targetOrgId = getStringId(org.id);
                            const targetOrg_id = getStringId(org._id);
                            const targetOrgSlug = org.slug || "";
                            
                            return (pOrgId !== "" && (pOrgId === targetOrgId || pOrgId === targetOrg_id)) || 
                                   (pOrgSlug !== "" && pOrgSlug === targetOrgSlug);
                          }) || [];

                          // Fallback: If current workspace property belongs to this org and isn't in the list, add it
                          if (selectedProperty) {
                            const sPropOrgId = getStringId(selectedProperty.organizationId || (selectedProperty.organization as any)?._id || (selectedProperty.organization as any)?.id);
                            const sPropOrgSlug = (selectedProperty.organization as any)?.slug;
                            
                            const targetOrgId = getStringId(org.id);
                            const targetOrg_id = getStringId(org._id);
                            const targetOrgSlug = org.slug || "";
                            
                            if ((sPropOrgId !== "" && (sPropOrgId === targetOrgId || sPropOrgId === targetOrg_id)) || 
                                (sPropOrgSlug && targetOrgSlug && sPropOrgSlug === targetOrgSlug)) {
                              const isAlreadyInList = filtered.some(p => getStringId(p.id || p._id) === getStringId(selectedProperty._id));
                              if (!isAlreadyInList) {
                                filtered = [...filtered, {
                                  id: selectedProperty._id,
                                  _id: selectedProperty._id,
                                  domain: selectedProperty.domain,
                                  status: 'Active'
                                } as any];
                              }
                            }
                          }
                          return filtered;
                        })();
                        
                        return (
                          <div key={org.id || org._id} className="space-y-2 pb-4 border-b border-indigo-100/50 dark:border-indigo-900/20 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2 px-1">
                              <Building2 className="w-3 h-3 text-indigo-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 truncate flex-1">
                                {org.name}
                              </span>
                            </div>
                            
                            <div className="space-y-1.5 ml-3 pl-3 border-l-2 border-indigo-50 dark:border-indigo-900/10">
                              {props.length === 0 ? (
                                <span className="text-[10px] italic text-slate-400">No properties assigned in this organization</span>
                              ) : (
                                  props.map((prop: UserProperty) => {
                                    const status = prop.status || 'inactive';
                                    const statusColors = {
                                      active: "bg-emerald-50 text-emerald-700 border-emerald-100",
                                      pending: "bg-blue-50 text-blue-700 border-blue-100",
                                      expired: "bg-amber-50 text-amber-700 border-amber-100",
                                      inactive: "bg-slate-50 text-slate-700 border-slate-100",
                                    }[status as string] || "bg-slate-50 text-slate-700 border-slate-100";

                                    return (
                                      <div key={prop.id || prop._id} className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
                                        <div className="flex items-center gap-2 flex-1 truncate">
                                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span className="text-xs font-bold truncate">{prop.domain}</span>
                                        </div>
                                        <Badge variant="secondary" className={cn("text-[9px] font-black uppercase tracking-tighter shrink-0 border", statusColors)}>
                                          {status}
                                        </Badge>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-sm text-slate-400 italic">
                      No organizations assigned to your profile.
                    </div>
                  )}

                  {/* Active Property Highlight */}
                  {/* {selectedProperty && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Current Workspace</Label>
                      <div className="flex items-center gap-3 px-4 h-11 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-sm font-medium text-indigo-600 border-dashed">
                         <Activity className="h-4 w-4 shrink-0 animate-pulse text-indigo-500" />
                         <span className="flex-1 truncate font-bold">{selectedProperty.domain}</span>
                         <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter shrink-0 border border-indigo-200 bg-white/50">
                            {selectedProperty.status || 'Active'}
                         </Badge>
                      </div>
                    </div>
                  )} */}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

            {/* Basic Profile */}
            <Collapsible defaultOpen={!isMobile}>
              <Card className="border-none shadow-lg">
                <CollapsibleTrigger className="w-full text-left group">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 pb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Info className="h-5 w-5 shrink-0" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">Basic Profile</CardTitle>
                      <CardDescription>Update your public-facing professional identity.</CardDescription>
                    </div>
                    <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Display Name</Label>
                        <Input id="name" {...register("name")} placeholder="Your Full Name" className="font-semibold h-11" />
                        {errors.name && <p className="text-[10px] text-rose-500 font-bold">{errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email (Secure/Verified)</Label>
                        <div className="relative text-foreground">
                          <Input id="email" {...register("email")} disabled className="font-semibold h-11 pl-10 bg-slate-50/50 dark:bg-slate-900/50" />
                          <CheckCircle2 className="absolute left-3 top-3.5 h-4 w-4 text-emerald-500/50 shrink-0" />
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="designation" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Professional Designation</Label>
                        <Input id="designation" {...register("designation")} placeholder="e.g. Lead Managing Editor, Product Head" className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rank" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rank</Label>
                        <Input id="rank" type="number" {...register("rank", { valueAsNumber: true })} placeholder="0" className="h-11" />
                        {errors.rank && <p className="text-[10px] text-rose-500 font-bold">{errors.rank.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Number</Label>
                        <Input
                          id="phone"
                          {...register("phone")}
                          placeholder="Enter phone number"
                          inputMode="tel"
                          onKeyDown={(e) => {
                            const allowed =
                              /[0-9+\-\s]/.test(e.key) ||
                              ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"].includes(e.key);
                            if (!allowed) e.preventDefault();
                          }}
                          className={`h-11 ${errors.phone ? "border-rose-400 focus-visible:ring-rose-400" : ""}`}
                        />
                        {errors.phone && <p className="text-[10px] text-rose-500 font-bold">{errors.phone.message}</p>}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="description" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Short Biography</Label>
                        <Textarea id="description" {...register("description")} placeholder="Brief overview of your role and background..." className="min-h-[120px] resize-none px-4 py-3" />
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* SEO & Discovery */}
            <SeoDiscoverySection register={register} watch={watch} userData={userData} defaultOpen={!isMobile} />

            {/* Social Connections */}
            <Collapsible defaultOpen={false}>
              <Card className="border-none shadow-lg">
                <CollapsibleTrigger className="w-full text-left group">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 pb-4">
                    <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                      <Share2 className="h-5 w-5 shrink-0" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">Social Connections</CardTitle>
                      <CardDescription>Link your verified professional social media handles.</CardDescription>
                    </div>
                    <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="twitter" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                        <Twitter className="h-3.5 w-3.5 text-sky-500 shrink-0" /> X / Twitter
                      </Label>
                      <Input id="twitter" {...register("socialLinks.twitter")} placeholder="https://twitter.com/profile" className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facebook" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                        <Facebook className="h-3.5 w-3.5 text-blue-600 shrink-0" /> Facebook
                      </Label>
                      <Input id="facebook" {...register("socialLinks.facebook")} placeholder="https://facebook.com/profile" className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedin" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                        <Linkedin className="h-3.5 w-3.5 text-indigo-700 shrink-0" /> LinkedIn
                      </Label>
                      <Input id="linkedin" {...register("socialLinks.linkedin")} placeholder="https://linkedin.com/in/profile" className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagram" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                        <Instagram className="h-3.5 w-3.5 text-rose-500 shrink-0" /> Instagram
                      </Label>
                      <Input id="instagram" {...register("socialLinks.instagram")} placeholder="https://instagram.com/profile" className="h-11" />
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* PRIMARY Save Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-sm font-bold tracking-wide shadow-xl shadow-primary/20 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] bg-primary hover:bg-primary/95"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 animate-spin shrink-0" />
                  Saving Changes...
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}