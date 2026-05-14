import { AppShell } from "@/components/layout/AppShell";
import { ReactNode, Suspense } from "react";
import AuthProvider from "./AuthProvider";
import { PropertyInitializer } from "@/components/providers/PropertyInitializer";

export default function MainAppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PropertyInitializer />
      <AppShell>
        <Suspense fallback={<div className="flex justify-center items-center h-full">Loading page...</div>}>
          {children}
        </Suspense>
      </AppShell>
    </AuthProvider>
  );
}
