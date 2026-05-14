"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Store } from "lucide-react";
import { OrganizationTable } from "@/components/tables/OrganizationTable";
import { CreateOrganizationDialog } from "@/components/dialogs/CreateOrganizationDialog";

export default function OrganizationPage() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-md">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Building2 className="h-6 w-6 text-primary" />
                                Organization Management
                            </CardTitle>
                            <CardDescription>
                                Manage your multi-tenant entities and brand presence.
                            </CardDescription>
                        </div>
                        <Button 
                            size="sm" 
                            className="h-8 w-8 rounded-full p-0 shadow-lg" 
                            onClick={() => setIsCreateOpen(true)}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <OrganizationTable />
                </CardContent>
            </Card>

            <CreateOrganizationDialog 
                open={isCreateOpen} 
                onOpenChange={setIsCreateOpen}
                onSuccess={() => {
                    window.location.reload(); 
                }}
            />
        </div>
    );
}
