"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  Check,
  Key,
  ArrowLeft,
  Shield,
  User as UserIcon,
  CheckCircle2,
  Info,
  Copy,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { getUserById, reactivateUser, getRoleNames, getRoleById } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { UserData, Permission, RoleName } from "@/lib/types";
import { cn, generateRandomPassword, validatePassword } from "@/lib/utils";
import { PermissionTable } from "@/components/shared/PermissionTable";

export default function ActivateUserPage() {
  const { id } = useParams();
  const router = useRouter();
  const { selectedProperty } = usePropertyStore();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [isPermissionsExpanded, setIsPermissionsExpanded] = useState(true);

  const [password, setPassword] = useState(() => generateRandomPassword());
  const [sendEmail, setSendEmail] = useState(true);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [userRes, rolesRes] = await Promise.all([
          getUserById(id as string),
          getRoleNames(selectedProperty?._id)
        ]);

        const userData = userRes.data || userRes;
        const allRoles = rolesRes.data || rolesRes;

        setUser(userData);
        setRoles(allRoles);

        // Pre-select current role and permissions if they exist
        let bestRoleId = "";

        // Priority 1: Property-specific role if we're in a property context
        if (userData.properties && selectedProperty) {
          const prop = userData.properties.find((p: any) => p.id === selectedProperty._id || p._id === selectedProperty._id);
          if (prop && prop.roles && prop.roles.length > 0) {
            bestRoleId = prop.roles[0].id;
          }
        }

        // Priority 2: Global roles
        if (!bestRoleId && userData.roles && userData.roles.length > 0) {
          bestRoleId = userData.roles[0].id;
        }

        setSelectedRoleId(bestRoleId);

        // Load permissions: preferring existing user permissions over role defaults
        if (userData.permissions && userData.permissions.length > 0) {
          setPermissions(JSON.parse(JSON.stringify(userData.permissions)));
        } else if (bestRoleId) {
          // Fallback to role permissions if user has no direct overrides
          const roleData = await getRoleById(bestRoleId);
          if (roleData && roleData.permissions) {
            setPermissions(JSON.parse(JSON.stringify(roleData.permissions)));
          }
        }
      } catch (error) {
        toast.error("Failed to load data");
        router.push("/users");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, router, selectedProperty]);

  const handleRoleChange = async (roleId: string) => {
    setSelectedRoleId(roleId);
    try {
      const roleData = await getRoleById(roleId);
      if (roleData && roleData.permissions) {
        setPermissions(JSON.parse(JSON.stringify(roleData.permissions)));
      }
    } catch (error) {
      toast.error("Failed to fetch role permissions");
    }
  };

  const handleGeneratePassword = () => {
    setPassword(generateRandomPassword());
    toast.info("Strong password generated");
  };

  const handleActivate = async () => {
    if (!sendEmail) {
      const result = validatePassword(password);
      if (!result.isValid) {
        toast.error(result.message || "Invalid password");
        return;
      }
    }

    setSubmitting(true);
    try {
      await reactivateUser(id as string, permissions, password || undefined, sendEmail, selectedProperty?._id);
      toast.success(sendEmail ? "Invitation sent successfully" : "User activated successfully");
      router.push("/users");
    } catch (error: any) {
      toast.error(error.message || "Failed to activate user");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const propertyStatus = user?.properties?.find(p => p.id === selectedProperty?._id || p._id === selectedProperty?._id)?.status;
  const isResend = propertyStatus === 'pending' || propertyStatus === 'expired' || user?.status === 'pending' || user?.status === 'expired';
  const isReactivation = propertyStatus === 'inactive' || user?.status === 'inactive';

  return (
    <div className="w-full space-y-8 pb-10 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-4 md:px-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/users")}
          className="rounded-full h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 border border-slate-200"
        >
          <ArrowLeft className="h-6 w-6 text-slate-600 dark:text-slate-400" />
        </Button>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 border-none">
            {isResend ? "Resend Invitation" : isReactivation ? "Reactivate User" : "Update Access"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 leading-tight">
            {isResend ? "Review and resend the access invitation for " : isReactivation ? "Restore platform access for " : "Manage credentials for "}
            <span className="text-blue-600 font-bold">{user?.name}</span>
          </p>
        </div>
      </div>

      <div className="space-y-6 px-4 md:px-0 max-w-4xl mx-auto">
        {/* ── 1. User Context ── */}
        <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 pb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <UserIcon className="h-5 w-5 shrink-0" />
            </div>
            <div>
              <CardTitle className="text-xl">User Profile</CardTitle>
              <CardDescription>Confirming identity for account {isResend ? 'invitation' : 'reactivation'}.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Full Name</Label>
              <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {user?.name}
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Email Address</Label>
              <p className="text-lg font-bold text-slate-900">{user?.email}</p>
            </div>

            {/* Role Selection */}
            <div className="md:col-span-2 space-y-2 pt-2 border-t border-slate-50 mt-2">
              <Label htmlFor="role" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                Assigned Role <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={selectedRoleId}
                onValueChange={handleRoleChange}
                disabled={submitting}
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
              <p className="text-xs text-slate-400">Updating the role will suggest new default permissions below.</p>
            </div>
          </CardContent>
        </Card>

        {/* ── 2. Authentication Settings ── */}
        <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 pb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
                <div className="absolute right-1 top-1 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => {
                      if (!password) {
                        toast.error("Nothing to copy");
                        return;
                      }
                      navigator.clipboard.writeText(password);
                      toast.success("Password copied to clipboard");
                    }}
                    title="Copy password"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={handleGeneratePassword}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Email Preference & Notes */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 h-6">
                <Checkbox
                  id="sendEmail"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                />
                <Label htmlFor="sendEmail" className="text-sm font-medium leading-none cursor-pointer">
                  Send invitation email
                </Label>
              </div>

              <div className="h-11 flex items-center">
                {sendEmail ? (
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

        {/* ── 3. Access Control (Collapsible) ── */}
        <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
          <CardHeader
            className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-slate-50 pb-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
            onClick={() => setIsPermissionsExpanded(!isPermissionsExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                <Shield className="h-5 w-5 shrink-0" />
              </div>
              <div>
                <CardTitle className="text-xl">Access Control</CardTitle>
                <CardDescription>Verify module permissions before finalizing activation.</CardDescription>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-slate-400">
              {isPermissionsExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </CardHeader>
          <div className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden",
            isPermissionsExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          )}>
            <CardContent className="p-0 border-t border-slate-50">
              <PermissionTable
                permissions={permissions}
                onChange={setPermissions}
                disabled={submitting}
              />
            </CardContent>
          </div>
        </Card>

        {/* ── Info notice ── */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500 dark:text-blue-400" />
          <div>
            <p className="text-sm font-bold">Important Note</p>
            <ul className="mt-1 text-xs font-medium text-blue-700 list-disc list-inside space-y-0.5">
              <li>{isResend ? 'Resending the invitation will replace any existing access links.' : isReactivation ? 'Reactivation will restore the user\'s previous access levels unless modified above.' : 'Updating these settings will change the user\'s access credentials.'}</li>
              <li>{sendEmail ? 'An email will be sent containing a secure link to complete the setup.' : 'The password entered above will be immediately active.'}</li>
              <li>Status of this property will be set to PENDING until the user logs in.</li>
            </ul>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 pb-10">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/users")}
            disabled={submitting}
            className="w-full sm:w-auto h-11 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleActivate}
            disabled={submitting}
            className="w-full sm:w-auto h-11 px-8 bg-primary hover:bg-primary/90 text-white gap-3 text-md font-bold shadow-xl shadow-primary/20 transition-all rounded-xl"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Key className="w-4 h-4" />
                {isResend ? "Resend Invitation" : isReactivation ? "Confirm Reactivation" : "Update Access"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
