"use client";

import { useState, useEffect, type FormEvent } from "react";
import { KeyRound, Activity, Eye, EyeOff, CheckCircle2, ShieldCheck, Lock, RefreshCw } from "lucide-react";
import { generateRandomPassword, validatePassword } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/api";
import { toast } from "sonner";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const handleNewPasswordChange = (val: string) => {
    setNewPassword(val);
  };

  useEffect(() => {
    if (newPassword.length > 0) {
      if (newPassword === currentPassword) {
        setPasswordError("New password cannot be the same as current password");
        return;
      }
      const validation = validatePassword(newPassword);
      if (!validation.isValid) {
        setPasswordError(validation.message || "Invalid password");
      } else {
        setPasswordError("");
      }
    } else {
      setPasswordError("");
    }
  }, [newPassword, currentPassword]);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle visibility per field
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [passwordError, setPasswordError] = useState("");

  const generateStrongPassword = () => {
    const pwd = generateRandomPassword(14);
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setShowNew(true);
    setShowConfirm(true);
    setPasswordError("");
    toast.success("Strong password generated");
  };

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleClose = () => {
    // Reset all fields on close
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password cannot be the same as current password");
      return;
    }
    
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      const msg = validation.message || "Invalid password";
      setPasswordError(msg);
      toast.error(msg);
      return;
    }
    setPasswordError("");
    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      handleClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <Card className="border-none shadow-none">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-50 pb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Change Password</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">Update your credentials to keep your account secure.</DialogDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Current password */}
              <div className="space-y-1.5">
                <Label htmlFor="cp-current" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Current Password
                </Label>
                <div className="relative text-black">
                  <Input
                    id="cp-current"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="h-11 pr-10 border-slate-200 focus-visible:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="cp-new" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  New Password
                </Label>
                <div className="relative text-black">
                  <Input
                    id="cp-new"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => handleNewPasswordChange(e.target.value)}
                    placeholder="Enter new password"
                    className="h-11 pr-10 border-slate-200 focus-visible:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between min-h-[20px]">
                  {passwordError && (
                    <p className="text-[11px] text-rose-500 font-bold animate-in fade-in slide-in-from-top-1">
                      {passwordError}
                    </p>
                  )}
                  <div className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={generateStrongPassword}
                    className="h-7 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 hover:bg-primary/5 gap-1.5"
                  >
                    <RefreshCw size={12} />
                    Auto-generate
                  </Button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="cp-confirm" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Confirm New Password
                </Label>
                <div className="relative text-black">
                  <Input
                    id="cp-confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={`h-11 pr-10 transition-colors ${
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? "border-emerald-400 focus:border-emerald-400 focus:ring-emerald-400/10"
                          : "border-rose-400 focus:border-rose-400 focus:ring-rose-400/10"
                        : "border-slate-200 focus-visible:ring-primary/20"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {/* Match indicator */}
                  {confirmPassword.length > 0 && (
                    <span
                      className={`absolute right-9 top-3.5 text-[10px] font-bold transition-colors ${
                        passwordsMatch ? "text-emerald-500" : "text-rose-400"
                      }`}
                    >
                      {passwordsMatch ? "✓ Match" : "✗ No match"}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 h-11 font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !passwordsMatch || !currentPassword || !!passwordError}
                  className="flex-1 h-11 font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Activity className="h-4 w-4 animate-spin shrink-0" />
                      Updating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 shrink-0" />
                      Update Password
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
