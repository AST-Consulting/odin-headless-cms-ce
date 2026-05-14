"use client";

import { useState, useEffect } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetFooter 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserData, Permission } from "@/lib/types";
import { PermissionTable } from "./PermissionTable";
import { Shield, Mail, User, RotateCcw, Activity, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUserById } from "@/lib/api";

interface ReactivateUserDrawerProps {
  user: UserData | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, permissions: Permission[]) => Promise<void>;
}

/**
 * Side panel for reviewing and confirming user reactivation
 */
export function ReactivateUserDrawer({ user, isOpen, onClose, onConfirm }: ReactivateUserDrawerProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);

  const isPending = user?.status === 'pending' || user?.status === 'expired';
  const title = isPending ? "Resend Invitation" : "Reactivate Account";
  const Icon = isPending ? Send : RotateCcw;

  // Sync permissions when user changes
  useEffect(() => {
    const initPermissions = async () => {
      if (!user) {
        setPermissions([]);
        return;
      }

      // If permissions are already present in the user object (less likely in table view)
      if (user.permissions && user.permissions.length > 0) {
        setPermissions(JSON.parse(JSON.stringify(user.permissions)));
        return;
      }

      // If permissions are missing, fetch the full user profile
      try {
        setLoading(true);
        const response = await getUserById(user.id);
        const fullUser = response.data || response;
        if (fullUser && fullUser.permissions) {
          setPermissions(JSON.parse(JSON.stringify(fullUser.permissions)));
        } else {
          setPermissions([]);
        }
      } catch (error) {
        console.error("Failed to fetch user permissions:", error);
        toast.error("Failed to load user permissions");
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      initPermissions();
    }
  }, [user, isOpen]);

  const handleConfirm = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await onConfirm(user.id, permissions);
      const message = isPending 
        ? `Invitation resent to ${user.name} with updated permissions.`
        : `Reactivation started for ${user.name}. Welcome back email sent!`;
      toast.success(message);
      onClose();
    } catch (error: any) {
      console.error("Reactivation failed:", error);
      toast.error(error.message || "Failed to initiate reactivation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
      <SheetContent className="sm:max-w-5xl overflow-y-auto w-full flex flex-col p-0 gap-0">
        <SheetHeader className="p-6 space-y-3 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 transition-colors">
          <div className={cn(
            "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
            isPending ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <SheetTitle className="text-2xl font-bold tracking-tight">{title}</SheetTitle>
            <SheetDescription className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {isPending 
                ? "Review and confirm permissions before resending the invitation email."
                : "A temporary password and verification link will be sent to the user."}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="px-6 py-8 flex-1 space-y-8 overflow-y-auto">
          {/* User Profile Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 transition-colors">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1.5">
                <User size={14} className="opacity-70" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">User Profile</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name || '-'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 transition-colors">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1.5">
                <Mail size={14} className="opacity-70" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Email Destination</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{user?.email || '-'}</p>
            </div>
          </div>

          {/* Granular Permissions Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                  <Shield size={16} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">Access Permissions</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Define module-level capabilities</p>
                </div>
              </div>
              <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-slate-900 px-2 py-0.5">
                Review Required
              </Badge>
            </div>
            
            <div className="relative rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              <PermissionTable 
                permissions={permissions} 
                onChange={setPermissions}
                disabled={loading}
              />
            </div>
            
            <p className="text-[11px] text-amber-600 dark:text-amber-400/80 bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100/50 dark:border-amber-900/20 leading-relaxed font-medium">
              Note: Upon reactivation, the user will be prompted to change their temporary password as part of the secure onboarding flow.
            </p>
          </div>
        </div>

        <SheetFooter className="p-6 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 transition-colors sticky bottom-0 z-10 mt-auto">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button 
              variant="ghost" 
              onClick={onClose} 
              disabled={loading} 
              className="flex-1 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 h-12"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={loading} 
              className={cn(
                "flex-[2] text-white shadow-xl gap-2 h-12 font-bold text-[15px] transition-all hover:scale-[1.02] active:scale-[0.98]",
                isPending 
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20" 
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
              )}
            >
              {loading ? (
                <>
                  <Activity className="h-5 w-5 animate-spin" />
                  {isPending ? "Sending Invitation..." : "Generating Credentials..."}
                </>
              ) : (
                <>
                  <Icon className="h-5 w-5" />
                  {isPending ? "Send Invitation" : "Confirm Reactivation"}
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
