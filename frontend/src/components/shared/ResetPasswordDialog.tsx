"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { resetUserPassword } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { usePropertyStore } from "@/lib/store";
import { Loader2, Lock, Eye, EyeOff, RefreshCw } from "lucide-react";
import { generateRandomPassword, validatePassword } from "@/lib/utils";

interface ResetPasswordDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const { selectedProperty } = usePropertyStore();

  useEffect(() => {
    if (!sendEmail && password.length > 0) {
      const validation = validatePassword(password);
      if (!validation.isValid) {
        setPasswordError(validation.message || "Invalid password");
      } else {
        setPasswordError("");
      }
    } else {
      setPasswordError("");
    }
  }, [password, sendEmail]);

  const generateStrongPassword = () => {
    const newPassword = generateRandomPassword(14);
    setPassword(newPassword);
    setShowPassword(true);
    toast.success("Strong password generated");
  };

  const handleReset = async () => {
    if (!sendEmail) {
      const validation = validatePassword(password);
      if (!validation.isValid) {
        const errorMsg = validation.message || "Invalid password";
        setPasswordError(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }
    setPasswordError("");

    setLoading(true);
    try {
      await resetUserPassword(userId, password || undefined, sendEmail, selectedProperty?._id);
      toast.success(sendEmail ? "Invitation Sent Successfully" : "Password Reset Successfully", {
        description: sendEmail
          ? `An invitation email has been sent to ${userName}.`
          : `The password for ${userName} has been updated.`,
      });
      onOpenChange(false);
      setPassword("");
      setSendEmail(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Reset Password</DialogTitle>
          <DialogDescription className="text-slate-500">
            Enter a new password for <span className="font-bold text-slate-900">{userName}</span>.
            The user will be able to log in with this new password immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between min-h-[20px]">
              {passwordError && (
                <p className="text-[11px] text-rose-500 font-bold animate-in fade-in slide-in-from-top-1">
                  {passwordError}
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generateStrongPassword}
                className="h-7 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
                disabled={loading}
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                Auto-generate
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-white dark:hover:bg-slate-900 shadow-sm cursor-pointer group">
              <Checkbox
                id="send-email-reset"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(!!checked)}
                disabled={loading}
                className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <Label
                htmlFor="send-email-reset"
                className="text-[13px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
              >
                Send email invitation with login instructions
              </Label>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 leading-relaxed px-1">
              If enabled, the user will be forced to set a new password on their first login via a secure magic link.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReset}
            disabled={loading || (!sendEmail && (!!passwordError || !password))}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/10"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Confirm Reset"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
