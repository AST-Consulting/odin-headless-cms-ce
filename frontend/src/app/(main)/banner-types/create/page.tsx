"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { createBannerType } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateBannerTypeDTO } from "@/lib/types";

export default function CreateBannerTypePage() {
  const router = useRouter();
  const { toast } = useToast();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [entity, setEntity] = useState("");
  const [status, setStatus] = useState("active");

  const handleSubmit = async () => {
    if (!name) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (!selectedProperty) {
      toast({ title: "Error", description: "No property selected", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload: CreateBannerTypeDTO = {
        name,
        entity: entity || undefined,
        status,
        propertyId: selectedProperty._id,
      };

      await createBannerType(payload);
      toast({ title: "Success", description: "Banner Type created successfully" });
      await new Promise(resolve => setTimeout(resolve, 700));
      router.push("/banner-types");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create banner type",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/banner-types")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Create Banner Type</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-1 sm:space-y-1.5">
          <CardTitle className="text-lg sm:text-xl">Banner Type Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Banner Type Name"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entity">Entity</Label>
            <Input
              id="entity"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="Entity (optional)"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - Responsive */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-4 sm:pb-0">
        <Button
          variant="outline"
          onClick={() => router.push("/banner-types")}
          disabled={loading}
          className="w-full sm:w-auto h-10"
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto h-10">
          {loading ? "Creating..." : "Create Banner Type"}
        </Button>
      </div>
    </div>
  );
}
