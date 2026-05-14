"use client";

import { useAuthStore } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode, useState } from "react";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const { token, hasHydrated } = useAuthStore();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait for hydration to complete before checking authentication
    if (!hasHydrated) {
      return;
    }

    // console.log("AuthProvider token after hydration:", token);
    
    if (!token) {
      router.push("/login");
    }
  }, [token, hasHydrated, router]);

  // Show loading state while hydrating or checking authentication
  if (!hasHydrated || (isChecking && !token)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If we don't have a token after hydration, we'll be redirected
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  // If authenticated, render the children components.
  return <>{children}</>;
}
