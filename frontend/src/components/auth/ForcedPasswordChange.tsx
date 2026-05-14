"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Lock, KeyRound, Activity, Eye, EyeOff, CheckCircle2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { toast } from "sonner";
import { validatePassword } from "@/lib/utils";

export function ForcedPasswordChange() {
  const { user, token, setAuth } = useAuthStore();
  const [show, setShow] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle visibility per field
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (user?.generateNewPw) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [user?.generateNewPw]);

  // Strict strength checks matching helper
  const strengthChecks = [
    { label: "10+ characters", pass: newPassword.length >= 10 },
    { label: "Uppercase & Lowercase", pass: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) },
    { label: "Number", pass: /[0-9]/.test(newPassword) },
    { label: "2+ Special chars", pass: (newPassword.match(/[^A-Za-z0-9]/g) || []).length >= 2 },
  ];
  const strengthScore = strengthChecks.filter((c) => c.pass).length;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strengthScore];
  const strengthColor = ["", "bg-rose-400", "bg-amber-400", "bg-blue-400", "bg-emerald-500"][strengthScore];

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const generateStrongPassword = () => {
    const length = 14;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    
    // Ensure at least one of each required group
    retVal += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    retVal += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    retVal += "0123456789"[Math.floor(Math.random() * 10)];
    retVal += "!@#$%^&*()"[Math.floor(Math.random() * 10)];
    retVal += "!@#$%^&*()"[Math.floor(Math.random() * 10)]; // 2 special chars
    
    for (var i = 0, n = charset.length; i < length - 5; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    
    // Shuffle the result
    const shuffled = retVal.split('').sort(() => 0.5 - Math.random()).join('');
    
    setNewPassword(shuffled);
    setConfirmPassword(shuffled);
    setShowNew(true);
    setShowConfirm(true);
    toast.success("Strong password generated");
  };

  if (!show) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }
    setIsSubmitting(true);
    try {
      // Backend now allows null/empty currentPassword for onboarding users
      await changePassword("", newPassword);
      toast.success("Password changed successfully");
      
      // Update local store to clear the flag
      if (user && token) {
        setAuth(token, { ...user, generateNewPw: false });
      }
      setShow(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <Card className="border-none shadow-none">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-50 pb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Set Your New Password</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">Pick a secure password for your account to continue.</DialogDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* New password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="forced-new" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    New Password
                  </Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={generateStrongPassword}
                    className="h-7 text-[10px] font-bold uppercase tracking-tight text-primary hover:text-primary/80 hover:bg-primary/5 gap-1.5 px-2"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Suggest Strong Password
                  </Button>
                </div>
                <div className="relative text-black">
                  <Input
                    id="forced-new"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="h-11 pr-10 border-slate-200 focus-visible:ring-primary/20 text-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {newPassword.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i <= strengthScore ? strengthColor : "bg-slate-100"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {strengthChecks.map((check) => (
                          <span
                            key={check.label}
                            className={`text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                              check.pass ? "text-emerald-600" : "text-slate-300"
                            }`}
                          >
                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                            {check.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="forced-confirm" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Confirm New Password
                </Label>
                <div className="relative text-black">
                  <Input
                    id="forced-confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={`h-11 pr-10 transition-colors text-black ${
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
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || !passwordsMatch || strengthScore < 3} // Required "Good" strength
                  className="w-full h-11 font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Activity className="h-4 w-4 animate-spin shrink-0" />
                      Updating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 shrink-0" />
                      Complete Setup
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
