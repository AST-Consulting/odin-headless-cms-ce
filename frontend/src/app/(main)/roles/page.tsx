"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RolesTable } from "@/components/tables/RolesTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function RolesPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/roles") {
      router.replace("/roles");
    }
  }, [pathname, router]);

  // Determine the active tab from the URL
  const activeTab = pathname.split("/roles/")[1] || "roles";

  const handleRoleCreated = () => {
    router.push("/roles/create");
  };

  const handleTabChange = (value: string) => {
    router.push(`/roles/${value}`);
  };

  return (
    <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Role Management</CardTitle>
                <Button size="sm" className="h-8 w-8 rounded-full p-0" onClick={handleRoleCreated}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <RolesTable />
            </CardContent>
          </Card>
    </div>
  );
}


