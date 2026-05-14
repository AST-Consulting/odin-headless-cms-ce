import "@/styles/globals.css";
import { QueryProvider } from "@/lib/query";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { ClientProviders } from "@/components/layout/ClientProviders";

export const metadata: Metadata = {
  title: "Odin CMS - Next-Gen CMS",
  description: "AI-powered content management system for modern newsrooms",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <QueryProvider>
          {children}
          <ClientProviders />
        </QueryProvider>
      </body>
    </html>
  );
}
