"use client";

import { OrganizationForm } from "@/components/settings/OrganizationForm";
import { ArrowLeft, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function OrganizationDetailsPage() {
  const router = useRouter();

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <ArrowLeft className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </Button>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 border-none flex items-center gap-3">
               Organization Profile
            </h1>
            <p className="text-slate-500 font-medium mt-1 text-sm md:text-base">Manage your corporate identity, contact points, and brand presence.</p>
          </div>
        </div>
      </div>

      <div className="mt-4 px-4 md:px-0">
        <OrganizationForm />
      </div>
    </div>
  );
}
