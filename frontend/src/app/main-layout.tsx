import "@/styles/globals.css";
import { QueryProvider } from "@/lib/query";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Toaster } from "@/components/ui/toaster";
import { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Odin CMS - Next-Gen CMS",
  description: "AI-powered content management system for modern newsrooms",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <QueryProvider>
          {children}
          <CommandPalette />
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
