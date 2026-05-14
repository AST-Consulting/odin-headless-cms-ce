"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getInvitationEmail, login } from "@/lib/api";
import { PRODUCT_NAME } from "@/lib/constants";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

// Types for verification state
type VerificationStatus = "idle" | "verifying" | "success" | "error";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [tokenPayload, setTokenPayload] = useState<string | null>(null);

  useEffect(() => {
    const payload = searchParams.get("token");
    setTokenPayload(payload);

    if (payload) {
      handleAutoLogin(payload);
    }
  }, [searchParams]);

  const handleAutoLogin = async (payload: string) => {
    setStatus("verifying");
    try {
      // 1. Decode token
      let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";

      const decoded = atob(base64);
      const parts = decoded.split(":");
      const inviteToken = parts[0];
      const tempPassword = parts.slice(1).join(":");

      if (!inviteToken || !tempPassword) {
        throw new Error("Invalid invitation token format.");
      }

      // 2. Fetch email
      const data = await getInvitationEmail(payload);
      const email = data.email;

      // 3. Perform login
      await login(email, tempPassword);

      setStatus("success");
      toast.success("Welcome!", {
        description: "You have been logged in automatically.",
      });

      // 4. Redirect after short delay
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err: any) {
      console.error("Verification error:", err);
      setStatus("error");
      setErrorMessage(err.message || "Invalid or expired invitation link.");
    }
  };

  // Rendering logic based on status
  if (status === "verifying") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-sm border-none shadow-xl bg-white/80 backdrop-blur-md">
          <CardContent className="pt-10 pb-10 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <Loader2 className="w-12 h-12 text-primary animate-spin relative" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Verifying Invitation</h3>
              <p className="text-slate-500 text-sm">Please wait while we secure your account access...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-max-sm border-none shadow-xl bg-white/80 backdrop-blur-md">
          <CardContent className="pt-10 pb-10 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-in zoom-in duration-300">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Success!</h3>
              <p className="text-slate-500 text-sm">Welcome back. Redirecting you to the dashboard...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md border-none shadow-xl bg-white">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 line-clamp-1">Verification Failed</CardTitle>
            <CardDescription className="text-slate-500">
              The invitation link could not be verified.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 pb-8 space-y-6">
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-900 text-sm text-center font-medium">
              {errorMessage}
            </div>
            <Button 
              variant="outline" 
              className="w-full h-11 border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
              onClick={() => router.push("/login")}
            >
              Back to Login
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use standard registration form only as fallback or if no token
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
          <CardTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            {PRODUCT_NAME}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Sign up to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 text-center pb-8 space-y-4">
          <p className="text-slate-500 text-sm">
            Please use the invitation link sent to your email to join.
          </p>
          <Button 
            className="w-full h-11"
            onClick={() => router.push("/login")}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
