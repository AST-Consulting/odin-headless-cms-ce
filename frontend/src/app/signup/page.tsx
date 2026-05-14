"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { createOrganizationGuest, signup, verifyOtp } from "@/lib/api";
import { PRODUCT_NAME } from "@/lib/constants";
import { Sparkles, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { cn, validatePassword } from "@/lib/utils";

// Step 1: Organization Schema
const organizationSchema = z.object({
  organizationName: z.string().min(2, { message: "Organization name must be at least 2 characters" }),
  domain: z.string().url({ message: "Please enter a valid URL starting with https://" }).refine((url) => url.startsWith("https://"), {
    message: "Domain must start with https://",
  }),
});

// Step 2: User Details Schema
const userDetailsSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(12, { message: "Password must be at least 12 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Step 3: OTP Schema
const otpSchema = z.object({
  otp: z.string().length(6, { message: "OTP must be 6 digits" }),
});

type OrganizationFormValues = z.infer<typeof organizationSchema>;
type UserDetailsFormValues = z.infer<typeof userDetailsSchema>;
type OtpFormValues = z.infer<typeof otpSchema>;

export default function SignupPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [orgId, setOrgId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Step 1 Form
  const {
    register: registerOrg,
    handleSubmit: handleSubmitOrg,
    formState: { errors: errorsOrg },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
  });

  // Step 2 Form
  const {
    register: registerUser,
    handleSubmit: handleSubmitUser,
    watch: watchUser,
    formState: { errors: errorsUser },
  } = useForm<UserDetailsFormValues>({
    resolver: zodResolver(userDetailsSchema),
  });

  // Step 3 Form
  const {
    register: registerOtp,
    handleSubmit: handleSubmitOtp,
    formState: { errors: errorsOtp },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
  });

  const onSubmitOrganization = async (data: OrganizationFormValues) => {
    setIsLoading(true);
    try {
      const result = await createOrganizationGuest(data.organizationName, data.domain);
      setOrgId(result._id);
      toast.success("Organization Created", {
        description: "Please provide your user details",
      });
      setStep(2);
    } catch (error: any) {
      toast.error("Organization Creation Failed", {
        description: error.message || "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitUserDetails = async (data: UserDetailsFormValues) => {
    setIsLoading(true);
    try {
      await signup(data.name, data.email, data.password, orgId);
      setUserEmail(data.email);
      toast.success("Account Created", {
        description: "Please check your email for the OTP",
      });
      setStep(3);
    } catch (error: any) {
      toast.error("Signup Failed", {
        description: error.message || "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitOtp = async (data: OtpFormValues) => {
    setIsLoading(true);
    try {
      await verifyOtp(userEmail, parseInt(data.otp));
      toast.success("Account Verified", {
        description: "Redirecting to login...",
        duration: 2000,
      });

      setTimeout(() => {
        router.push("/login");
      }, 500);
    } catch (error: any) {
      toast.error("OTP Verification Failed", {
        description: error.message || "Please try again.",
      });
      setIsLoading(false);
    }
  };

  const [passwordError, setPasswordError] = useState("");

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length > 0) {
      const validation = validatePassword(val);
      if (!validation.isValid) {
        setPasswordError(validation.message || "Invalid password");
      } else {
        setPasswordError("");
      }
    } else {
      setPasswordError("");
    }
  };

  // Temporarily disable signup route
  useEffect(() => {
    router.push("/login");
  }, [router]);
  return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
          <CardTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            {PRODUCT_NAME}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {step === 1 && "Step 1: Create Organization"}
            {step === 2 && "Step 2: User Details"}
            {step === 3 && "Step 3: Verify Email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          {/* Step 1: Organization */}
          {step === 1 && (
            <form onSubmit={handleSubmitOrg(onSubmitOrganization)} className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="organizationName" className="text-sm sm:text-base">Organization Name</label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="My Organization"
                  {...registerOrg("organizationName")}
                />
                {errorsOrg.organizationName && (
                  <p className="text-sm text-red-500">{errorsOrg.organizationName?.message as string}</p>
                )}
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="domain" className="text-sm sm:text-base">Domain</label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="https://example.com"
                  {...registerOrg("domain")}
                />
                {errorsOrg.domain && (
                  <p className="text-sm text-red-500">{errorsOrg.domain?.message as string}</p>
                )}
              </div>
              <Button type="submit" className="w-full h-10 sm:h-11" disabled={isLoading}>
                {isLoading ? "Creating..." : "Continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-10 sm:h-11"
                onClick={() => router.push("/login")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </form>
          )}

          {/* Step 2: User Details */}
          {step === 2 && (
            <form onSubmit={handleSubmitUser(onSubmitUserDetails)} className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="name" className="text-sm sm:text-base">Full Name</label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Piyush Chauhan"
                  {...registerUser("name")}
                />
                {errorsUser.name && (
                  <p className="text-sm text-red-500">{errorsUser.name?.message as string}</p>
                )}
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="email" className="text-sm sm:text-base">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  {...registerUser("email")}
                />
                {errorsUser.email && (
                  <p className="text-sm text-red-500">{errorsUser.email?.message as string}</p>
                )}
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="password" className="text-sm sm:text-base font-bold text-slate-500 uppercase tracking-wider">Password</label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  {...registerUser("password", {
                    onChange: handlePasswordChange
                  })}
                  className="h-11"
                />
                {passwordError ? (
                  <p className="text-[11px] text-rose-500 font-bold">{passwordError}</p>
                ) : errorsUser.password && (
                  <p className="text-[11px] text-red-500 font-bold">{errorsUser.password?.message as string}</p>
                )}
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="confirmPassword" className="text-sm sm:text-base font-bold text-slate-500 uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••••••"
                    {...registerUser("confirmPassword")}
                    className={cn(
                      "h-11 pr-10",
                      watchUser("confirmPassword")?.length > 0 && (
                        watchUser("password") === watchUser("confirmPassword")
                          ? "border-emerald-400"
                          : "border-rose-400"
                      )
                    )}
                  />
                  {watchUser("confirmPassword")?.length > 0 && (
                    <span
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold",
                        watchUser("password") === watchUser("confirmPassword")
                          ? "text-emerald-500"
                          : "text-rose-400"
                      )}
                    >
                      {watchUser("password") === watchUser("confirmPassword") ? "✓ Match" : "✗ No match"}
                    </span>
                  )}
                </div>
                {errorsUser.confirmPassword && (
                  <p className="text-sm text-red-500">{errorsUser.confirmPassword?.message as string}</p>
                )}
              </div>
              <Button type="submit" className="w-full h-10 sm:h-11" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-10 sm:h-11"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </form>
          )}

          {/* Step 3: OTP Verification */}
          {step === 3 && (
            <form onSubmit={handleSubmitOtp(onSubmitOtp)} className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="otp" className="text-sm sm:text-base">Enter OTP</label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="518682"
                  maxLength={6}
                  {...registerOtp("otp")}
                />
                {errorsOtp.otp && (
                  <p className="text-sm text-red-500">{errorsOtp.otp?.message as string}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  We&apos;ve sent a 6-digit OTP to {userEmail}
                </p>
              </div>
              <Button type="submit" className="w-full h-10 sm:h-11" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify OTP"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-10 sm:h-11"
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
