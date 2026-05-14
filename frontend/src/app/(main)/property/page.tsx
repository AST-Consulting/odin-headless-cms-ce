"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {PropertyTable} from "@/components/tables/PropertyTable";
import { useRouter } from "next/navigation";

export default function PropertyPage() {
    const router = useRouter();
    return (
       <div>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Property Management</CardTitle>
                        <Button 
                        size="sm" 
                        className="h-8 w-8 rounded-full p-0" 
                        onClick={() => router.push("/property/create")}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <PropertyTable/>
                </CardContent>
            </Card>
       </div>
    )
}
