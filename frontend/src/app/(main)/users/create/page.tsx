"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Plus, X, SlidersHorizontal, Shield, Share2, RefreshCw, Activity, Info, Trash2, Globe, Search, ArrowLeft, Mail, Twitter, Facebook, Linkedin, Instagram, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateRandomPassword, validatePassword } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PermissionTable } from "@/components/shared/PermissionTable";
import { SeoDiscoverySection } from "@/components/shared/SeoDiscoverySection";
import { getRoleNames, inviteUser, getRoleById } from "@/lib/api";
import { toast } from "sonner";
import { RoleName, Permission } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MODULE_NAMES,
  MODULE_VALUES,
  PERMISSION_ACTIONS,
  type PermissionAction
} from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────
type SocialType = "twitter" | "facebook" | "linkedin" | "instagram";

interface SocialEntry {
  id: number;           // local key only
  type: SocialType | "";
  url: string;
}

const SOCIAL_OPTIONS: { value: SocialType; label: string }[] = [
  { value: "twitter", label: "X / Twitter" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
];

const SOCIAL_ICON: Record<SocialType, React.ReactNode> = {
  twitter: <Twitter className="h-4 w-4 text-sky-500 shrink-0" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600 shrink-0" />,
  linkedin: <Linkedin className="h-4 w-4 text-indigo-700 shrink-0" />,
  instagram: <Instagram className="h-4 w-4 text-rose-500 shrink-0" />,
};

const SOCIAL_PLACEHOLDER: Record<SocialType, string> = {
  twitter: "https://twitter.com/profile",
  facebook: "https://facebook.com/profile",
  linkedin: "https://linkedin.com/in/profile",
  instagram: "https://instagram.com/profile",
};

// ── Zod schema ─────────────────────────────────────────────────────
const inviteUserSchema = z.object({
  name: z.string().min(1, { message: "Display name is required" }),
  email: z.string().email({ message: "Invalid email address" }),
  roleId: z.string().min(1, { message: "Please select a role" }),
  phone: z.string().optional(),
  alt_name: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  slug: z.string().optional(),
  permissions: z.array(
    z.object({
      module: z.string(),
      actions: z.array(z.string()),
    })
  ).optional(),
  password: z.string().superRefine((val, ctx) => {
    const result = validatePassword(val);
    if (!result.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message,
      });
    }
  }),
  sendEmail: z.boolean(),
  rank: z.coerce.number(),
});

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

let _nextId = 2; // start at 2 since 1 is pre-created

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [fetchingRolePermissions, setFetchingRolePermissions] = useState(false);
  const { selectedProperty } = usePropertyStore();

  const modules = Object.entries(MODULE_NAMES);
  const actions = Object.values(PERMISSION_ACTIONS);

  // Social links — dynamic list, starts with one empty row
  const [socials, setSocials] = useState<SocialEntry[]>([
    { id: 1, type: "twitter", url: "" },
  ]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { name: "", email: "", roleId: "", phone: "", alt_name: "", seoTitle: "", seoDescription: "", slug: "", rank: 0, permissions: [], password: generateRandomPassword(12), sendEmail: true },
  });

  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Password copied to clipboard");
  };

  const watchEmail = watch("email");
  const watchSendEmail = watch("sendEmail");
  const selectedRoleId = watch("roleId");
  const watchedPermissions = watch("permissions") || [];

  useEffect(() => { loadRoles(); }, []);

  // Fetch role permissions when roleId changes
  useEffect(() => {
    if (selectedRoleId) {
      fetchRolePermissions(selectedRoleId);
    } else {
      setValue("permissions", []);
    }
  }, [selectedRoleId]);

  const fetchRolePermissions = async (id: string) => {
    setFetchingRolePermissions(true);
    try {
      const roleData = await getRoleById(id);
      if (roleData && roleData.permissions) {
        // Convert array to the format expected by the form
        const formattedPermissions = roleData.permissions.map((p: any) => ({
          module: p.module,
          actions: p.actions
        }));
        setValue("permissions", formattedPermissions);
      }
    } catch (error) {
      console.error("Failed to fetch role permissions:", error);
    } finally {
      setFetchingRolePermissions(false);
    }
  };


  const loadRoles = async () => {
    setLoadingRoles(true);
    try {
      const response = await getRoleNames(selectedProperty?._id);
      setRoles(response.data);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setLoadingRoles(false);
    }
  };

  // ── Social helpers ──────────────────────────────────────────────
  const addSocial = () => {
    const usedTypes = socials.map((s) => s.type).filter(Boolean) as SocialType[];
    const available = SOCIAL_OPTIONS.find((o) => !usedTypes.includes(o.value));
    setSocials((prev) => [
      ...prev,
      { id: _nextId++, type: available?.value ?? "", url: "" },
    ]);
  };

  const removeSocial = (id: number) =>
    setSocials((prev) => prev.filter((s) => s.id !== id));

  const updateSocialType = (id: number, type: SocialType) =>
    setSocials((prev) =>
      prev.map((s) => (s.id === id ? { ...s, type } : s))
    );

  const updateSocialUrl = (id: number, url: string) =>
    setSocials((prev) =>
      prev.map((s) => (s.id === id ? { ...s, url } : s))
    );

  // Types already chosen (to disable in other rows' dropdowns)
  const chosenTypes = socials.map((s) => s.type).filter(Boolean) as SocialType[];
  const allChosen = SOCIAL_OPTIONS.every((o) => chosenTypes.includes(o.value));

  // ── Submit ──────────────────────────────────────────────────────
  const onSubmit = async (data: InviteUserFormValues) => {
    setLoading(true);
    try {
      // Build socialLinks object from dynamic rows
      const socialLinks: Record<string, string> = {};
      socials.forEach(({ type, url }) => {
        if (type && url.trim()) socialLinks[type] = url.trim();
      });

      // Format permissions for the API
      const formattedPermissions = (data.permissions || [])
        .filter(p => p.actions.length > 0);

      await inviteUser(data.email, [data.roleId], {
        name: data.name,
        alt_name: data.alt_name,
        phone: data.phone?.trim() ? `+91${data.phone.trim()}` : undefined,
        permissions: formattedPermissions.length > 0 ? formattedPermissions : undefined,
        seo: {
          title: data.seoTitle?.trim() || undefined,
          metaDescription: data.seoDescription?.trim() || undefined,
          slug: data.slug?.trim() || undefined,
        },
        socialLinks: Object.keys(socialLinks).length ? (socialLinks as any) : undefined,
        password: data.password || undefined,
        sendEmail: data.sendEmail,
        rank: data.rank,
      });

      toast.success("Invitation Sent", {
        description: `An invitation has been sent to ${data.email}`,
      });
      router.push("/users");
    } catch (error: any) {
      toast.error(error.message || "Failed to Send Invitation", {
        description: "Please check the details and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingRoles) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm animate-pulse font-medium">Loading roles...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-10">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-4 md:px-0">
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
            Invite User
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Send an email invitation with optional profile head-start.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-4 md:px-0">

        {/* ── 1. Core Identity ── */}
        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 pb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Mail className="h-5 w-5 shrink-0" />
            </div>
            <div>
              <CardTitle className="text-xl">Core Identity</CardTitle>
              <CardDescription>Email and role are required to send the invitation.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Display Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Full Name"
                className="h-11"
                disabled={loading}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] text-rose-500 font-bold">{errors.name.message}</p>
              )}
            </div>

            {/* Alt Name */}
            <div className="space-y-2">
              <Label htmlFor="alt_name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Alternative Name
              </Label>
              <Input
                id="alt_name"
                placeholder="Alternative / English Name"
                className="h-11"
                disabled={loading}
                {...register("alt_name")}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">e.g. English name if primary is Hindi</p>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Email Address <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="invitee@example.com"
                className="h-11"
                disabled={loading}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-[11px] text-rose-500 font-bold">{errors.email.message}</p>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">An invitation email will be dispatched to this address.</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Phone Number
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 font-medium text-sm">+91</span>
                <Input
                  id="phone"
                  placeholder="Enter 10 digit number"
                  className="h-11 pl-12"
                  disabled={loading}
                  {...register("phone")}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Optional mobile number for contact.</p>
            </div>

            {/* Rank */}
            <div className="space-y-2">
              <Label htmlFor="rank" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Rank
              </Label>
              <Input
                id="rank"
                type="number"
                placeholder="0"
                className="h-11"
                disabled={loading}
                {...register("rank", { valueAsNumber: true })}
              />
              {errors.rank && (
                <p className="text-[11px] text-rose-500 font-bold">{errors.rank.message}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="roleId" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                Assigned Role <span className="text-rose-500">*</span>
              </Label>
              <Select
                onValueChange={(value) => setValue("roleId", value)}
                disabled={loading}
                value={selectedRoleId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p className="text-[11px] text-rose-500 font-bold">{errors.roleId.message}</p>
              )}
              <p className="text-xs text-slate-400">Determines the user's permissions upon accepting the invitation.</p>
            </div>

            {/* Permission Table Overrides */}
            {selectedRoleId && (
              <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-500" />
                      Custom User Permissions
                    </h3>
                    <p className="text-xs text-slate-500">Fine-tune permissions for this specific user invitation.</p>
                  </div>
                </div>

                {fetchingRolePermissions ? (
                  <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 animate-pulse">
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Loading default role permissions...</p>
                  </div>
                ) : (
                  <PermissionTable
                    permissions={watchedPermissions}
                    onChange={(newPerms) => setValue("permissions", newPerms)}
                    disabled={loading}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 1.5 Authentication ── */}
        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 pb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Shield className="h-5 w-5 shrink-0" />
            </div>
            <div>
              <CardTitle className="text-xl">Authentication</CardTitle>
              <CardDescription>Set a temporary password and notification preferences.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column: Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Input
                  id="password"
                  type="text"
                  placeholder="Enter temporary password"
                  className="h-11 pr-20"
                  disabled={loading}
                  {...register("password")}
                />
                <div className="absolute right-1 top-1 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => copyToClipboard(watch("password"))}
                    title="Copy password"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setValue("password", generateRandomPassword(14))}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {errors.password && (
                <p className="text-[11px] text-rose-500 font-bold">{errors.password.message}</p>
              )}
            </div>

            {/* Right Column: Email Preference & Notes */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 h-6"> {/* Height matching the Label above */}
                <Checkbox
                  id="sendEmail"
                  checked={watchSendEmail}
                  onCheckedChange={(checked) => setValue("sendEmail", checked as boolean)}
                />
                <Label htmlFor="sendEmail" className="text-sm font-medium leading-none cursor-pointer">
                  Send invitation email
                </Label>
              </div>

              <div className="h-11 flex items-center"> {/* Height matching the Input field */}
                {watchSendEmail ? (
                  <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg w-full">
                    <p className="text-[12px] text-blue-700 font-medium leading-tight">
                      <span className="font-bold">Note:</span> User can login by clicking the invitation link.
                    </p>
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg w-full">
                    <p className="text-[12px] text-amber-700 font-medium leading-tight">
                      <span className="font-bold">Note:</span> Please share the password manually for login.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 2. Social Links ── */}
        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-slate-50 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                <Share2 className="h-5 w-5 shrink-0" />
              </div>
              <div>
                <CardTitle className="text-xl">Social Links</CardTitle>
                <CardDescription>Pre-fill professional social handles. Optional.</CardDescription>
              </div>
            </div>
            {/* Add button — only if not all four are used */}
            {!allChosen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSocial}
                disabled={loading}
                className="gap-1.5 shrink-0 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-5 space-y-3">
            {socials.map((entry, idx) => (
              <div key={entry.id} className="flex items-center gap-3">
                {/* Network type selector */}
                <div className="w-44 shrink-0">
                  <Select
                    value={entry.type}
                    onValueChange={(v) => updateSocialType(entry.id, v as SocialType)}
                    disabled={loading}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Platform">
                        {entry.type && (
                          <span className="flex items-center gap-2">
                            {SOCIAL_ICON[entry.type]}
                            {SOCIAL_OPTIONS.find((o) => o.value === entry.type)?.label}
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          // disable if already chosen in another row (but allow current)
                          disabled={chosenTypes.includes(opt.value) && opt.value !== entry.type}
                        >
                          <span className="flex items-center gap-2">
                            {SOCIAL_ICON[opt.value]}
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* URL input */}
                <Input
                  value={entry.url}
                  onChange={(e) => updateSocialUrl(entry.id, e.target.value)}
                  placeholder={
                    entry.type
                      ? SOCIAL_PLACEHOLDER[entry.type]
                      : "Select a platform first..."
                  }
                  className="h-10 flex-1 min-w-0"
                  disabled={loading || !entry.type}
                />

                {/* Remove — always show but disable if only one row */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                  onClick={() => removeSocial(entry.id)}
                  disabled={loading || socials.length === 1}
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                </Button>
              </div>
            ))}

            {socials.length === 0 && (
              <p className="text-xs text-slate-400 italic py-2">No social links added yet.</p>
            )}
          </CardContent>
        </Card>

        {/* ── 3. SEO & Discovery ── */}
        <SeoDiscoverySection
          register={register}
          watch={watch}
          disabled={loading}
          isNewUser={true}
        />

        {/* ── Info notice ── */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500 dark:text-blue-400" />
          <div>
            <p className="text-sm font-bold">About User Invitations</p>
            <ul className="mt-1 text-xs font-medium text-blue-700 list-disc list-inside space-y-0.5">
              <li>The user receives an email with a secure invitation link.</li>
              <li>They set their own password when accepting.</li>
              <li>Social links and SEO data are pre-filled on their profile.</li>
              <li>The invitation link expires after a set period.</li>
            </ul>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/users")}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto h-11 text-md font-bold shadow-xl shadow-primary/10 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 animate-spin shrink-0" />
                Sending Invitation...
              </div>
            ) : (
              "Send Invitation"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
