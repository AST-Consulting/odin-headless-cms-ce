"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBannerType, updateBannerType } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { CreateBannerTypeDTO, BannerType } from "@/lib/types";

interface CreateBannerTypeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    bannerTypeToEdit?: BannerType | null;
}

export function CreateBannerTypeDialog({ open, onOpenChange, onSuccess, bannerTypeToEdit }: CreateBannerTypeDialogProps) {
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [entity, setEntity] = useState("");
    const [status, setStatus] = useState("active");

    useEffect(() => {
        if (open) {
            if (bannerTypeToEdit) {
                setName(bannerTypeToEdit.name || "");
                setEntity(bannerTypeToEdit.entity || "");
                setStatus(bannerTypeToEdit.status || "active");
            } else {
                resetForm();
            }
        }
    }, [open, bannerTypeToEdit]);

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

            if (bannerTypeToEdit) {
                await updateBannerType(bannerTypeToEdit._id, payload);
                toast({ title: "Success", description: "Banner Type updated successfully" });
            } else {
                await createBannerType(payload);
                toast({ title: "Success", description: "Banner Type created successfully" });
            }

            onSuccess();
            onOpenChange(false);
            resetForm();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || `Failed to ${bannerTypeToEdit ? 'update' : 'create'} banner type`, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName("");
        setEntity("");
        setStatus("active");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-full sm:max-h-[90vh] overflow-y-auto flex flex-col justify-center">
                <DialogHeader>
                    <DialogTitle>{bannerTypeToEdit ? "Edit Banner Type" : "Create Banner Type"}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 sm:gap-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
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
                </div>

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                    <Button 
                        variant="outline" 
                        onClick={() => onOpenChange(false)} 
                        disabled={loading}
                        className="w-full sm:w-auto h-10"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={loading}
                        className="w-full sm:w-auto h-10"
                    >
                        {loading ? "Saving..." : (bannerTypeToEdit ? "Update" : "Create")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
