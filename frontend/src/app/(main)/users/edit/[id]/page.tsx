"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  Twitter,
  Facebook,
  Linkedin,
  Instagram,
  Share2,
  Search,
  Info,
  Calendar,
  Building2,
  Activity,
  CheckCircle2,
  Lock,
  Trash2,
  Globe,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { PermissionTable } from "@/components/shared/PermissionTable";
import { SeoDiscoverySection } from "@/components/shared/SeoDiscoverySection";
import { UserProfileSidebarCard } from "@/components/shared/UserProfileSidebarCard";
import { ImagePickerDialog } from "@/components/editor/ImagePickerDialog";
import { ResetPasswordDialog } from "@/components/shared/ResetPasswordDialog";

import {
  getUserById,
  updateUser,
  deleteUser,
  getProperties,
  getOrganizations,
  getRoleNames,
  fetchRoles
} from "@/lib/api";
import { AssignPropertyDialog } from "@/components/dialogs/AssignPropertyDialog";
import { useAuthStore, havePermission } from "@/lib/auth";
import { usePropertyStore } from "@/lib/store";
import { toast } from "sonner";
import { getStringId } from "@/lib/user-utils";
import { UserData, Property, Organization, Permission } from "@/lib/types";
import {
  MODULE_NAMES,
  MODULE_VALUES,
  PERMISSION_ACTIONS
} from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";

// Editable form state shape
interface FormState {
  name: string;
  alt_name: string;
  designation: string;
  phone: string;
  description: string;
  username: string;
  slug: string;
  seoTitle: string;
  seoMetaDescription: string;
  twitter: string;
  facebook: string;
  linkedin: string;
  instagram: string;
  propertyId: string;
  rank: string;
  properties: NonNullable<UserData['properties']>;
  permissions: Array<{ module: string, actions: string[] }>;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  // Permission checks — derived from JWT stored in auth store
  // Module name is "users" (plural), actions are "edit" / "delete"
  const { user: authUser } = useAuthStore();
  const canEdit = havePermission(authUser, "users", "edit");
  const canDelete = havePermission(authUser, "users", "delete");
  const isSelf = authUser?.id === userId;
  const canResetPassword = isSelf || havePermission(authUser, "auth", "edit");


  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  // Editable form state
  const [form, setForm] = useState<FormState>({
    name: "",
    alt_name: "",
    designation: "",
    phone: "",
    description: "",
    username: "",
    slug: "",
    seoTitle: "",
    seoMetaDescription: "",
    twitter: "",
    facebook: "",
    linkedin: "",
    instagram: "",
    propertyId: "",
    rank: "",
    properties: [],
    permissions: [],
  });
  
  const [selectedPermissionPropertyId, setSelectedPermissionPropertyId] = useState<string>("");

  // Role state — lazy loaded only when dropdown opens
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Role selection state
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Organization Context state
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [orgProperties, setOrgProperties] = useState<Record<string, Property[]>>({});
  const [allProps, setAllProps] = useState<Property[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [targetOrg, setTargetOrg] = useState<Organization | null>(null);
  const [targetProp, setTargetProp] = useState<Property | null>(null);

  const { selectedProperty } = usePropertyStore();


  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    loadUserData();
    if (canEdit) {
      loadOrganizationsAndProperties();
    }
  }, [userId, canEdit]);

  const loadUserData = async () => {
    if (!userId) {
      toast.error("User ID not found");
      router.push("/users");
      return;
    }
    setFetchingData(true);
    try {
      const response = await getUserById(userId);
      const user: UserData = response.data || response;
      if (!user) {
        toast.error("User not found");
        router.push("/users");
        return;
      }
      setUserData(user);


      setForm({
        name: user.name || "",
        alt_name: user.alt_name || "",
        designation: user.designation || "",
        // phone from API is IPhone object { fullNumber, number, countryPrefix } — extract string
        phone: user.phone
          ? (typeof user.phone === "object"
            ? (user.phone as { fullNumber?: string; number?: string }).fullNumber || (user.phone as { fullNumber?: string; number?: string }).number || ""
            : (user.phone as string)).replace(/^\+91/, "")
          : "",
        description: user.description || "",
        username: user.username || "",
        slug: user.slug || "",
        seoTitle: user.seo?.title || "",
        seoMetaDescription: user.seo?.metaDescription || "",
        twitter: user.socialLinks?.twitter || "",
        facebook: user.socialLinks?.facebook || "",
        linkedin: user.socialLinks?.linkedin || "",
        instagram: user.socialLinks?.instagram || "",
        propertyId: user.properties?.[0]?.id || user.properties?.[0]?._id || "",
        rank: user.rank?.toString() || "0",
        properties: user.properties || [],
        permissions: user.permissions || [],
      });

      if (user.properties?.length) {
        setSelectedPermissionPropertyId(user.properties[0].id || user.properties[0]._id || "");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch user data");
      router.push("/users");
    } finally {
      setFetchingData(false);
    }
  };

  useEffect(() => {
    if (selectedPermissionPropertyId) {
      loadPropertyRoles();
    }
  }, [selectedPermissionPropertyId]);

  const loadPropertyRoles = async () => {
    setLoadingRoles(true);
    try {
      // Use fetchRoles instead of getRoleNames to get permissions too
      const response = await fetchRoles({ propertyId: selectedPermissionPropertyId, limit: 100 });
      const roles = response.data || [];
      setAvailableRoles(roles);
    } catch (error) {
      console.error("Failed to load roles for property:", error);
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleRoleChange = (roleId: string) => {
    const selectedRole = availableRoles.find(r => r.id === roleId || r._id === roleId);
    if (!selectedRole) return;

    setForm(prev => {
      const updatedProps = [...prev.properties];
      const idx = updatedProps.findIndex(p => p.id === selectedPermissionPropertyId || p._id === selectedPermissionPropertyId);
      if (idx !== -1) {
        // Pre-populate with role permissions
        updatedProps[idx] = { 
          ...updatedProps[idx], 
          roles: [{ id: selectedRole.id || selectedRole._id, name: selectedRole.name }],
          permissions: selectedRole.permissions || [] 
        };
      }
      return { 
        ...prev, 
        properties: updatedProps,
        permissions: prev.propertyId === selectedPermissionPropertyId ? (selectedRole.permissions || []) : prev.permissions
      };
    });
  };

  const loadOrganizationsAndProperties = async () => {
    setLoadingOrgs(true);
    setLoadingProperties(true);
    try {
      const orgRes = await getOrganizations();
      const orgs = orgRes.data || orgRes || [];
      setAllOrganizations(orgs);

      // Batch fetch ALL properties to avoid parallel congestion
      const allPropsRes = await getProperties({});
      const allPropsData: Property[] = Array.isArray(allPropsRes) ? allPropsRes : ((allPropsRes as { data?: Property[] }).data || []);
      setAllProps(allPropsData);

      // Group properties by organization
      const propMap: Record<string, Property[]> = {};
      orgs.forEach((org: Organization) => {
        const oId = org.id || org._id;
        propMap[oId] = [];
      });

      allPropsData.forEach((prop: Property) => {
        const oId = prop.organization?.id || prop.organization?._id || prop.organizationId;
        if (oId && propMap[oId]) {
          propMap[oId].push(prop);
        } else if (oId) {
          if (!propMap[oId]) propMap[oId] = [];
          propMap[oId].push(prop);
        }
      });

      setOrgProperties(propMap);
    } catch (error) {
      console.error("Failed to load organizations and properties:", error);
    } finally {
      setLoadingOrgs(false);
      setLoadingProperties(false);
    }
  };


  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));



  const handleUpdateAvatar = async (images: { url: string; id: string; path: string }[]) => {
    if (images.length === 0 || !userId) return;

    const image = images[0];
    const newProfilePicture = {
      url: image.url,
      id: image.id,
      path: image.path,
      fileName: image.path.split('/').pop() || 'avatar.jpg'
    };

    try {
      setLoading(true);
      const response = await updateUser(userId, {
        profilePicture: newProfilePicture
      });

      if (response.success) {
        toast.success("Profile picture updated");
        setUserData(prev => prev ? { ...prev, profilePicture: newProfilePicture } : null);
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

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Display name is required");
      return;
    }
    setLoading(true);
    
    // Capitalize first letters of each word in the name
    const formattedName = form.name.trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
      
    try {
      // Run both updates in parallel
      const updatePromises: Promise<any>[] = [
        updateUser(userId, {
          name: formattedName,
          alt_name: form.alt_name,
          designation: form.designation,
          rank: parseInt(form.rank, 10) || 0,
          phone: form.phone?.trim() ? `+91${form.phone.trim().replace(/^\+91/, "")}` : "",
          description: form.description,
          username: form.username,
          slug: form.slug,
          seo: {
            title: form.seoTitle,
            metaDescription: form.seoMetaDescription,
          },
          socialLinks: {
            twitter: form.twitter,
            facebook: form.facebook,
            linkedin: form.linkedin,
            instagram: form.instagram,
          },
          properties: form.properties?.map(p => ({
            ...p,
            permissions: p.permissions?.filter(perm => perm && perm.module && perm.actions?.length > 0) || []
          })),
          permissions: form.permissions?.filter(perm => perm && perm.module && perm.actions?.length > 0) || [],
        }),
      ];

      await Promise.all(updatePromises);

      toast.success("User Updated", {
        description: "All changes have been saved successfully.",
      });
      router.push("/users");
    } catch (error: any) {
      toast.error("Failed to Update User", {
        description: error.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const propId = selectedProperty?._id;
    const confirmMsg = propId 
      ? `Are you sure you want to deactivate "${userData?.name}" for the current property? They will lose access to this property but may remain active in others.`
      : `Are you sure you want to deactivate "${userData?.name}" GLOBALLY? They will no longer be able to log in to ANY property.`;

    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      await deleteUser(userId, propId);
      toast.success(propId ? "User deactivated for this property" : "User deactivated globally");
      router.push("/users");
    } catch (error: any) {
      toast.error("Failed to Deactivate User", {
        description: error.message || "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: string | { $date: string } | null | undefined) => {
    if (!date) return "N/A";
    const d = typeof date === "object" && date && "$date" in date ? (date as { $date: string }).$date : (date as string);
    try {
      return new Date(d).toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid Date";
    }
  };

  if (fetchingData) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm animate-pulse font-medium">
          Loading user data...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/users")}
            className="rounded-full h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <ArrowLeft className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </Button>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 border-none">
              Edit User
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
              Manage user identity, social links, SEO and granular permissions.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 px-4 md:px-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Sidebar ──────────────────────────────────────────── */}
          <aside className="lg:col-span-4 space-y-6">
            <UserProfileSidebarCard
              userData={userData}
              phoneString={userData?.phone ? (typeof userData.phone === "object" ? (userData.phone as { fullNumber?: string; number?: string }).fullNumber || (userData.phone as { fullNumber?: string; number?: string }).number : userData.phone) : "No phone"}
              onEditAvatar={canEdit ? () => setIsImagePickerOpen(true) : undefined}
              onChangePassword={canResetPassword ? () => setIsResetPasswordOpen(true) : undefined}
              canEdit={canEdit}
            />


            <ImagePickerDialog
              open={isImagePickerOpen}
              onOpenChange={setIsImagePickerOpen}
              onImageSelected={handleUpdateAvatar}
            />

            <ResetPasswordDialog
              userId={userId}
              userName={userData?.name || "User"}
              open={isResetPasswordOpen}
              onOpenChange={setIsResetPasswordOpen}
            />


            {/* Organization Context */}
            <Collapsible defaultOpen={true}>
              <Card className="border-none shadow-lg bg-indigo-50/20 dark:bg-indigo-900/10 px-1 pb-1">
                <div className="h-1 bg-indigo-500/50 rounded-t-full mx-4" />
                <CollapsibleTrigger className="w-full text-left group">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
                      <Building2 className="h-5 w-5 shrink-0" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">Organization Context</CardTitle>
                      <CardDescription>
                        Assign or change the property context for this user.
                      </CardDescription>
                    </div>
                    <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-2">
                    {loadingOrgs ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading organizations...</span>
                      </div>
                    ) : (canEdit && allOrganizations.length > 0) ? (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {allOrganizations.map((org: Organization) => {
                          const orgId = getStringId(org.id || org._id);
                          const org_id = getStringId(org._id);
                          const orgSlug = org.slug;

                          // Find all properties that match this organization using exhaustive ID/slug matching
                          const props = allProps.filter((prop: Property) => {
                            const pOrgId = getStringId(prop.organizationId || prop.organization?.id || prop.organization?._id);
                            const pOrgSlug = (prop.organization as any)?.slug;
                            return (pOrgId !== "" && (pOrgId === orgId || pOrgId === org_id)) || (orgSlug && pOrgSlug === orgSlug);
                          });
                          
                          const orgName = org.name || org.organization_name || "Unknown Organization";

                          return (
                            <div key={orgId} className="space-y-2 pb-4 border-b border-indigo-100/50 dark:border-indigo-900/20 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2 px-1">
                                <Building2 className="w-3 h-3 text-indigo-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 truncate flex-1">
                                  {orgName}
                                </span>
                              </div>

                              <div className="space-y-1.5 ml-3 pl-3 border-l-2 border-indigo-50 dark:border-indigo-900/10">
                                {props.length === 0 ? (
                                  <span className="text-[10px] italic text-slate-400">No properties found</span>
                                ) : (
                                  props.map((prop: Property) => {
                                    const assignedProperty = userData?.properties?.find((p: any) => p.id === prop._id || p._id === prop._id);
                                    const isAssigned = !!assignedProperty;
                                    const status = assignedProperty?.status || 'Active';
                                    const statusColors = {
                                      active: "bg-emerald-50 text-emerald-700 border-emerald-100",
                                      pending: "bg-blue-50 text-blue-700 border-blue-100",
                                      expired: "bg-amber-50 text-amber-700 border-amber-100",
                                      inactive: "bg-slate-50 text-slate-700 border-slate-100",
                                    }[status.toLowerCase()] || "bg-emerald-50 text-emerald-700 border-emerald-100";

                                      return (
                                        <div key={prop._id} className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
                                        <div className="flex items-center gap-2 flex-1 truncate">
                                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span className="text-xs font-bold truncate">{prop.domain}</span>
                                        </div>

                                        {isAssigned ? (
                                          (status.toLowerCase() === 'pending' || status.toLowerCase() === 'expired') ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 px-3 text-[10px] font-bold uppercase tracking-widest text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 rounded-lg shrink-0"
                                              onClick={() => router.push(`/users/activate/${userId}`)}
                                            >
                                              Resend
                                            </Button>
                                          ) : status.toLowerCase() === 'inactive' ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 px-3 text-[10px] font-bold uppercase tracking-widest text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 rounded-lg shrink-0"
                                              onClick={() => router.push(`/users/activate/${userId}`)}
                                            >
                                              Reactivate
                                            </Button>
                                          ) : (
                                            <Badge variant="secondary" className={cn("text-[9px] font-black uppercase tracking-tighter shrink-0 border", statusColors)}>
                                              {status}
                                            </Badge>
                                          )
                                        ) : (
                                          <Button
                                            size="sm"
                                            className="h-7 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg"
                                            onClick={() => {
                                              setTargetOrg(org);
                                              setTargetProp(prop);
                                              setIsAssignDialogOpen(true);
                                            }}
                                          >
                                            Assign
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (userData?.organizations && userData.organizations.length > 0) ? (
                      <div className="space-y-4">
                        {userData.organizations.map((org) => {
                          const orgId = org.id || org._id;
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
                            <div key={orgId} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3 h-3 text-indigo-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
                                  {org.name}
                                </span>
                              </div>
                              <div className="space-y-1.5 ml-3 pl-3 border-l-2 border-indigo-50 dark:border-indigo-900/10">
                                {props.map((prop) => {
                                  const status = prop.status || 'Active';
                                  const statusColors = {
                                    active: "bg-emerald-50 text-emerald-700 border-emerald-100",
                                    pending: "bg-blue-50 text-blue-700 border-blue-100",
                                    expired: "bg-amber-50 text-amber-700 border-amber-100",
                                    inactive: "bg-slate-50 text-slate-700 border-slate-100",
                                  }[status.toLowerCase()] || "bg-emerald-50 text-emerald-700 border-emerald-100";

                                  return (
                                    <div key={prop.id || prop._id} className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                                      <span className="text-xs font-bold truncate">{prop.domain}</span>
                                      <Badge variant="secondary" className={cn("ml-auto text-[9px] font-black uppercase tracking-tighter border", statusColors)}>
                                        {status}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-sm text-slate-400 italic">
                        No organizations assigned to this user.
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </aside>

          {/* ── Main Content ──────────────────────────────────────── */}
          <div className="lg:col-span-8 space-y-8">

            {/* Permission notice banner */}
            {!canEdit && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-bold">View-only mode</p>
                  <p className="text-xs font-medium mt-0.5 text-amber-700">
                    Your account does not have <span className="font-bold">users → update</span> permission.
                    All fields are read-only. Contact your administrator to request edit access.
                  </p>
                </div>
              </div>
            )}

            {/* 1. Basic Profile — Editable */}
            <Collapsible defaultOpen={!isMobile}>
              <Card className="border-none shadow-lg font-primary bg-card">
                <CollapsibleTrigger className="w-full text-left group">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 dark:border-slate-800 pb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Info className="h-5 w-5 shrink-0" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">Basic Profile</CardTitle>
                      <CardDescription>
                        Update user's name, designation, contact and biography.
                      </CardDescription>
                    </div>
                    <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-6 space-y-6">
                    {/* Name + Alt Name side-by-side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Name */}
                      <div className="space-y-2 text-foreground">
                        <Label
                          htmlFor="name"
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                          Display Name
                        </Label>
                        <Input
                          id="name"
                          value={form.name}
                          onChange={set("name")}
                          placeholder="Full Name"
                          className="font-semibold h-11"
                          disabled={loading || !canEdit}
                        />
                      </div>

                      {/* Alt Name */}
                      <div className="space-y-2 text-foreground">
                        <Label
                          htmlFor="alt_name"
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                          Alternative Name{" "}
                          <span className="normal-case font-normal text-slate-400 dark:text-slate-500">
                            (e.g. English if primary is Hindi)
                          </span>
                        </Label>
                        <Input
                          id="alt_name"
                          value={form.alt_name}
                          onChange={set("alt_name")}
                          placeholder="Romanised / English name"
                          className="h-11 border-indigo-100"
                          disabled={loading || !canEdit}
                        />
                      </div>

                      {/* Email + Phone — same row */}
                      <div className="space-y-2 text-foreground">
                        <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Email (Secure/Verified)
                        </Label>
                        <div className="relative">
                          <Input
                            disabled
                            value={userData?.email || ""}
                            className="font-bold h-11 cursor-not-allowed pl-10 bg-slate-50/50 dark:bg-slate-900/50"
                          />
                          <CheckCircle2 className="absolute left-3 top-3.5 h-4 w-4 text-emerald-500/50 shrink-0" />
                        </div>
                      </div>

                      <div className="space-y-2 text-foreground">
                        <Label
                          htmlFor="phone"
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                          Contact Number
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 font-medium text-sm">+91</span>
                          <Input
                            id="phone"
                            value={form.phone}
                            onChange={set("phone")}
                            placeholder="Enter 10 digit number"
                            className="h-11 pl-12"
                            disabled={loading || !canEdit}
                          />
                        </div>
                      </div>

                      {/* Designation — full width */}
                      <div className="space-y-2 text-foreground">
                        <Label
                          htmlFor="designation"
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                          Professional Designation
                        </Label>
                        <Input
                          id="designation"
                          value={form.designation}
                          onChange={set("designation")}
                          placeholder="e.g. Lead Managing Editor, Product Head"
                          className="h-11"
                          disabled={loading || !canEdit}
                        />
                      </div>

                      <div className="space-y-2 text-foreground">
                        <Label
                          htmlFor="rank"
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                          Rank
                        </Label>
                        <Input
                          id="rank"
                          type="number"
                          value={form.rank}
                          onChange={set("rank")}
                          placeholder="0"
                          className="h-11"
                          disabled={loading || !canEdit}
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-2 md:col-span-2 text-foreground">
                        <Label
                          htmlFor="description"
                          className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                          Short Biography
                        </Label>
                        <Textarea
                          id="description"
                          value={form.description}
                          onChange={set("description")}
                          placeholder="Brief overview of role and background..."
                          className="min-h-[100px] resize-none px-4 py-3"
                          disabled={loading || !canEdit}
                        />
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>


            {/* 3. SEO & Discovery — Editable */}
            <SeoDiscoverySection
              manualValues={{
                name: form.name,
                description: form.description,
                username: form.username,
                slug: form.slug,
                seoTitle: form.seoTitle,
                seoMetaDescription: form.seoMetaDescription,
              }}
              onManualChange={(field, value) => {
                setForm((prev) => ({ ...prev, [field]: value }));
              }}
              userData={userData}
              disabled={loading || !canEdit}
              defaultOpen={!isMobile}
            />

            {/* 2. Social Connections — Editable (Moved to Main Content) */}
            <Collapsible defaultOpen={false}>
              <Card className="border-none shadow-lg transform text-foreground bg-card">
                <CollapsibleTrigger className="w-full text-left group">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 dark:border-slate-800 pb-4">
                    <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-600 shrink-0">
                      <Share2 className="h-5 w-5 shrink-0" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">Social Connections</CardTitle>
                      <CardDescription>
                        Update verified professional social media handles.
                      </CardDescription>
                    </div>
                    <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="twitter"
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2"
                      >
                        <Twitter className="h-3.5 w-3.5 text-sky-500 shrink-0" /> X / Twitter
                      </Label>
                      <Input
                        id="twitter"
                        value={form.twitter}
                        onChange={set("twitter")}
                        placeholder="https://twitter.com/profile"
                        className="h-11"
                        disabled={loading || !canEdit}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="facebook"
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2"
                      >
                        <Facebook className="h-3.5 w-3.5 text-blue-600 shrink-0" /> Facebook
                      </Label>
                      <Input
                        id="facebook"
                        value={form.facebook}
                        onChange={set("facebook")}
                        placeholder="https://facebook.com/profile"
                        className="h-11"
                        disabled={loading || !canEdit}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="linkedin"
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2"
                      >
                        <Linkedin className="h-3.5 w-3.5 text-indigo-700 shrink-0" /> LinkedIn
                      </Label>
                      <Input
                        id="linkedin"
                        value={form.linkedin}
                        onChange={set("linkedin")}
                        placeholder="https://linkedin.com/in/profile"
                        className="h-11"
                        disabled={loading || !canEdit}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="instagram"
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2"
                      >
                        <Instagram className="h-3.5 w-3.5 text-rose-500 shrink-0" /> Instagram
                      </Label>
                      <Input
                        id="instagram"
                        value={form.instagram}
                        onChange={set("instagram")}
                        placeholder="https://instagram.com/profile"
                        className="h-11"
                        disabled={loading || !canEdit}
                      />
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* 5. Permission Management — UI to update permissions directly */}
            {canEdit && (
              <Collapsible defaultOpen={false}>
                <Card className="border-none shadow-lg bg-card text-foreground">
                  <CollapsibleTrigger className="w-full text-left group">
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 dark:border-slate-800 pb-4">
                      <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 shrink-0">
                        <Shield className="h-5 w-5 shrink-0" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl">Permission Management</CardTitle>
                        <CardDescription>
                          Directly manage user module-level permissions.
                        </CardDescription>
                      </div>
                      <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-6 space-y-6">
                      {/* Property & Role Selector for Scoped Permissions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold flex items-center gap-2">
                              <Globe className="h-4 w-4 text-primary" />
                              Select Property Scope
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">
                              Choose which property's permissions to manage.
                            </p>
                          </div>
                          <Select
                            value={selectedPermissionPropertyId}
                            onValueChange={setSelectedPermissionPropertyId}
                          >
                            <SelectTrigger className="w-full bg-white dark:bg-slate-950 font-bold border-indigo-100 dark:border-indigo-900/30">
                              <SelectValue placeholder="Select a property..." />
                            </SelectTrigger>
                            <SelectContent>
                              {form.properties.length === 0 ? (
                                <SelectItem value="none" disabled>No properties assigned</SelectItem>
                              ) : (
                                form.properties.map((prop) => (
                                  <SelectItem key={prop.id || prop._id || ""} value={prop.id || prop._id || ""}>
                                    {prop.domain}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold flex items-center gap-2">
                              <Shield className="h-4 w-4 text-purple-600" />
                              Assign Role
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">
                              Pick a predefined role to pre-populate permissions.
                            </p>
                          </div>
                          <Select
                            value={form.properties.find(p => p.id === selectedPermissionPropertyId)?.roles?.[0]?.id || ""}
                            onValueChange={handleRoleChange}
                            disabled={!selectedPermissionPropertyId || loadingRoles}
                          >
                            <SelectTrigger className="w-full bg-white dark:bg-slate-950 font-bold border-purple-100 dark:border-purple-900/30">
                              <SelectValue placeholder={loadingRoles ? "Loading roles..." : "Select a role..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableRoles.length === 0 ? (
                                <SelectItem value="none" disabled>No roles found</SelectItem>
                              ) : (
                                availableRoles.map((role) => (
                                  <SelectItem key={role.id || role._id} value={role.id || role._id}>
                                    {role.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {selectedPermissionPropertyId ? (
                        <PermissionTable
                          permissions={form.properties.find(p => p.id === selectedPermissionPropertyId)?.permissions || []}
                          onChange={(newPerms: Permission[]) => {
                            setForm(prev => {
                              const updatedProps = [...prev.properties];
                              const idx = updatedProps.findIndex(p => p.id === selectedPermissionPropertyId);
                              if (idx !== -1) {
                                updatedProps[idx] = { ...updatedProps[idx], permissions: newPerms as Permission[] };
                              }
                              return { 
                                ...prev, 
                                properties: updatedProps,
                                // Also sync to root permissions if this is the currently "active" property being edited
                                permissions: prev.propertyId === selectedPermissionPropertyId ? newPerms : prev.permissions
                              };
                            });
                          }}
                          disabled={loading || !canEdit}
                        />
                      ) : (
                        <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl gap-3">
                          <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                            <Shield className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-bold text-slate-400">Please select a property to manage permissions</p>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}


            {/* ── Save / Cancel / Delete ─────────────────────────── */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Delete button — left side, only if permitted */}
              <div>
                {canDelete && (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting || loading}
                    className="w-full sm:w-auto gap-2 bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20"
                  >
                    {deleting ? (
                      <>
                        <Activity className="h-4 w-4 animate-spin shrink-0" />
                        Deactivating...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 shrink-0" />
                        Deactivate User
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Right side: Cancel + Save */}
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push("/users")}
                  disabled={loading || deleting}
                  className="w-full sm:w-auto"
                >
                  {canEdit ? "Cancel" : "Back to Users"}
                </Button>
                {canEdit && (
                  <Button
                    onClick={handleSave}
                    disabled={loading || deleting}
                    className="w-full sm:w-auto h-11 text-md font-bold shadow-xl shadow-primary/10 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 animate-spin shrink-0" />
                        Saving Changes...
                      </div>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <AssignPropertyDialog
        isOpen={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        user={userData}
        organization={targetOrg}
        property={targetProp}
        onSuccess={loadUserData}
      />
    </div>
  );
}