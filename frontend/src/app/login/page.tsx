"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { login, forgetPassword, verifyOtp, resetPassword } from "@/lib/api";
import { PRODUCT_NAME } from "@/lib/constants";
import { Sparkles, ArrowLeft, Eye, EyeOff, RefreshCw } from "lucide-react";
import { cn, generateRandomPassword, validatePassword } from "@/lib/utils";

// Schemas
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

const verifyOtpSchema = z.object({
  otp: z.string().length(6, { message: "OTP must be 6 digits" }).regex(/^\d+$/, { message: "OTP must be numbers only" }),
});

const resetPasswordSchema = z.object({
  password: z.string()
    .min(12, { message: "Password must be at least 12 characters long" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
type VerifyOtpValues = z.infer<typeof verifyOtpSchema>;
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

type ViewState = 'LOGIN' | 'FORGOT_PASSWORD' | 'VERIFY_OTP' | 'RESET_PASSWORD';

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [is2faFlow, setIs2faFlow] = useState(false);

  // Visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const generateStrongPassword = () => {
    const pwd = generateRandomPassword(14);
    resetPasswordForm.setValue("password", pwd);
    resetPasswordForm.setValue("confirmPassword", pwd);
    setShowResetPassword(true);
    setShowConfirmPassword(true);
    setPasswordError("");
    toast.success("Strong password generated");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    resetPasswordForm.setValue("password", val);
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

  // Login Form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Forgot Password Form
  const forgotPasswordForm = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  // Verify OTP Form
  const verifyOtpForm = useForm<VerifyOtpValues>({
    resolver: zodResolver(verifyOtpSchema),
  });

  // Reset Password Form
  const resetPasswordForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const response = await login(data.email, data.password);
      
      // Check if 2FA is required
      if ((response as any)?.requiresOtp) {
        setResetEmail(data.email);
        setTempPassword(data.password);
        setIs2faFlow(true);
        setView('VERIFY_OTP');
        toast.success("Password verified", {
          description: "Please enter the OTP sent to your email.",
        });
        setIsLoading(false);
        return;
      }

      toast.success("Login Successful", {
        description: "Welcome back!",
        duration: 2000,
      });

      setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (error) {
      toast.error("Login Failed", {
        description: "Invalid email or password. Please try again.",
      });
      setIsLoading(false);
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordValues) => {
    setIsLoading(true);
    try {
      await forgetPassword(data.email);
      setResetEmail(data.email);
      setView('VERIFY_OTP');
      toast.success("OTP Sent", {
        description: "Please check your email for the OTP.",
      });
    } catch (error) {
      toast.error("Request Failed", {
        description: "Could not send OTP. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyOtpSubmit = async (data: VerifyOtpValues) => {
    setIsLoading(true);
    try {
      if (is2faFlow) {
        // Handle 2FA completion: call login with OTP
        await login(resetEmail, tempPassword, parseInt(data.otp));
        toast.success("Login Successful", {
          description: "Welcome back!",
          duration: 2000,
        });
        setTimeout(() => {
          router.push("/");
        }, 500);
      } else {
        // Handle normal Forgot Password flow
        const response = await verifyOtp(resetEmail, parseInt(data.otp));
        if (response.success && response.data?.token) {
          setResetToken(response.data.token);
          setView('RESET_PASSWORD');
          toast.success("OTP Verified", {
            description: "You can now reset your password.",
          });
        } else {
          throw new Error("Invalid OTP response");
        }
      }
    } catch (error) {
      toast.error("Verification Failed", {
        description: "Invalid OTP. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onResendOtp = async () => {
    setIsLoading(true);
    try {
      if (is2faFlow) {
        // Re-call login with same credentials to trigger new OTP
        await login(resetEmail, tempPassword);
      } else {
        // Re-call forgot password
        await forgetPassword(resetEmail);
      }
      toast.success("OTP Resent", {
        description: "Please check your email for the new code.",
      });
    } catch (error) {
      toast.error("Resend Failed", {
        description: "Could not resend OTP. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPasswordSubmit = async (data: ResetPasswordValues) => {
    const validation = validatePassword(data.password);
    if (!validation.isValid) {
      setPasswordError(validation.message || "Invalid password");
      toast.error(validation.message || "Invalid password");
      return;
    }
    
    setIsLoading(true);
    try {
      await resetPassword(data.password, resetToken);
      toast.success("Password Reset Successful", {
        description: "You can now login with your new password.",
      });
      setView('LOGIN');
    } catch (error) {
      toast.error("Reset Failed", {
        description: "Could not reset password. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'LOGIN':
        return (
          <>
            <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
              <CardTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                {PRODUCT_NAME}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6">
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="email" className="text-sm sm:text-base">Email</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="editor@example.com"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && <p className="text-sm text-red-500">{loginForm.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="password" className="text-sm sm:text-base">Password</label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...loginForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full h-10 sm:h-11" disabled={isLoading}>
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
                <div className="text-center mt-4 space-y-2">
                  {/* <p className="text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto font-normal"
                      onClick={() => router.push("/signup")}
                      type="button"
                    >
                      Sign up
                    </Button>
                  </p> */}
                  <p className="text-sm text-muted-foreground">
                    <Button
                      variant="link"
                      className="p-0 h-auto font-normal"
                      onClick={() => setView('FORGOT_PASSWORD')}
                      type="button"
                    >
                      Forgot password?
                    </Button>
                  </p>
                </div>
              </form>
            </CardContent>
          </>
        );

      case 'FORGOT_PASSWORD':
        return (
          <>
            <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
              <div className="flex justify-start w-full mb-2">
                <Button variant="ghost" size="icon" onClick={() => {
                  setView('LOGIN');
                  setIs2faFlow(false);
                }} className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-lg sm:text-xl font-bold">Forgot Password</CardTitle>
              <CardDescription>Enter your email to receive a reset OTP</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6">
              <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="reset-email" className="text-sm sm:text-base">Email</label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="editor@example.com"
                    {...forgotPasswordForm.register("email")}
                  />
                  {forgotPasswordForm.formState.errors.email && <p className="text-sm text-red-500">{forgotPasswordForm.formState.errors.email.message}</p>}
                </div>
                <Button type="submit" className="w-full h-10 sm:h-11" disabled={isLoading}>
                  {isLoading ? "Sending OTP..." : "Send OTP"}
                </Button>
              </form>
            </CardContent>
          </>
        );

      case 'VERIFY_OTP':
        return (
          <>
            <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
              <div className="flex justify-start w-full mb-2">
                <Button variant="ghost" size="icon" onClick={() => {
                  if (is2faFlow) {
                    setView('LOGIN');
                    setIs2faFlow(false);
                  } else {
                    setView('FORGOT_PASSWORD');
                  }
                }} className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                {PRODUCT_NAME}
              </CardTitle>
              <CardTitle className="text-lg sm:text-xl font-bold">Verify OTP</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Enter the 6-digit code sent to {resetEmail}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6">
              <form onSubmit={verifyOtpForm.handleSubmit(onVerifyOtpSubmit)} className="space-y-6" autoComplete="off">
                <div className="flex justify-between gap-2 sm:gap-4">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength={1}
                      className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all bg-background"
                      value={verifyOtpForm.watch("otp")?.[index] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!/^\d*$/.test(val)) return;
                        
                        const currentOtp = verifyOtpForm.getValues("otp") || "";
                        const otpArray = currentOtp.split("").concat(Array(6).fill("")).slice(0, 6);
                        otpArray[index] = val;
                        const newOtp = otpArray.join("").slice(0, 6);
                        verifyOtpForm.setValue("otp", newOtp);

                        if (val && index < 5) {
                          const nextInput = e.target.nextElementSibling as HTMLInputElement;
                          nextInput?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
                          const prevInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                          prevInput?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData("text").slice(0, 6).replace(/[^\d]/g, "");
                        if (pastedData) {
                          verifyOtpForm.setValue("otp", pastedData);
                        }
                      }}
                    />
                  ))}
                </div>
                <input type="hidden" {...verifyOtpForm.register("otp")} />
                {verifyOtpForm.formState.errors.otp && <p className="text-sm text-red-500 text-center">{verifyOtpForm.formState.errors.otp.message}</p>}

                <div className="space-y-4">
                  <Button type="submit" className="w-full h-11 sm:h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all" disabled={isLoading}>
                    {isLoading ? "Verifying..." : "Verify OTP"}
                  </Button>
                  
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Didn't get the code?</p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={onResendOtp}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Resend OTP
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </>
        );

      case 'RESET_PASSWORD':
        return (
          <>
            <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
              <CardTitle className="text-lg sm:text-xl font-bold">Reset Password</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Create a new strong password (min 12 characters)</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6">
              <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="new-password" className="text-sm sm:text-base font-bold text-slate-500 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showResetPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      {...resetPasswordForm.register("password", {
                        onChange: handlePasswordChange
                      })}
                      className="h-11 pr-10 border-slate-200 focus-visible:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between min-h-[20px] mt-1">
                    {passwordError ? (
                      <p className="text-[11px] text-rose-500 font-bold animate-in fade-in slide-in-from-top-1">
                        {passwordError}
                      </p>
                    ) : resetPasswordForm.watch("password")?.length >= 12 ? (
                      <p className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                         Strong Password
                      </p>
                    ) : null}
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
                
                <div className="space-y-1.5 sm:space-y-2">
                  <label htmlFor="confirm-password" className="text-sm sm:text-base font-bold text-slate-500 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      {...resetPasswordForm.register("confirmPassword")}
                      className={cn(
                        "h-11 pr-10 transition-colors",
                        resetPasswordForm.watch("confirmPassword")?.length > 0 && (
                          resetPasswordForm.watch("password") === resetPasswordForm.watch("confirmPassword")
                            ? "border-emerald-400 focus-visible:ring-emerald-400/10"
                            : "border-rose-400 focus-visible:ring-rose-400/10"
                        )
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {resetPasswordForm.watch("confirmPassword")?.length > 0 && (
                      <span
                        className={cn(
                          "absolute right-9 top-1/2 -translate-y-1/2 text-[10px] font-bold transition-colors",
                          resetPasswordForm.watch("password") === resetPasswordForm.watch("confirmPassword")
                            ? "text-emerald-500"
                            : "text-rose-400"
                        )}
                      >
                        {resetPasswordForm.watch("password") === resetPasswordForm.watch("confirmPassword") ? "✓ Match" : "✗ No match"}
                      </span>
                    )}
                  </div>
                  {resetPasswordForm.formState.errors.confirmPassword && <p className="text-sm text-red-500">{resetPasswordForm.formState.errors.confirmPassword.message}</p>}
                </div>
                
                <Button type="submit" className="w-full h-11 shadow-lg shadow-primary/20 font-bold text-sm uppercase tracking-wide" disabled={isLoading || !!passwordError || !resetPasswordForm.watch("password")}>
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </CardContent>
          </>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-lg">
        {renderContent()}
      </Card>
    </div>
  );
}
