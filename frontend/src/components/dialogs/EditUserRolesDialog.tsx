"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { fetchRoles, updateUserRoles } from "@/lib/api";
import { Role, OrganizationUser } from "@/lib/types";
import { toast } from "sonner";
import { usePropertyStore } from "@/lib/store";

interface EditUserRolesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    user: OrganizationUser | null;
    onSuccess: () => void;
}

export function EditUserRolesDialog({
    isOpen,
    onClose,
    user,
    onSuccess,
}: EditUserRolesDialogProps) {
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { selectedProperty } = usePropertyStore();

    useEffect(() => {
        if (isOpen) {
            loadRoles();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && user && roles.length > 0) {
            // Map user roles (which can be IDs or Names) to Role IDs for the UI
            const initialSelectedRoles = user.roles.map(userRole => {
                // Check if userRole matches an ID
                const roleById = roles.find(r => r._id === userRole);
                if (roleById) return roleById._id;

                // Check if userRole matches a Name
                const roleByName = roles.find(r => r.name === userRole);
                if (roleByName) return roleByName._id;

                return null;
            }).filter((id): id is string => id !== null);

            setSelectedRoles(initialSelectedRoles);
        }
    }, [isOpen, user, roles]);

    const loadRoles = async () => {
        setLoading(true);
        try {
            const response = await fetchRoles({ propertyId: selectedProperty?._id });
            setRoles(response.data);
        } catch (error) {
            console.error("Failed to load roles:", error);
            toast.error("Failed to load roles");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleToggle = (roleId: string) => {
        setSelectedRoles((prev) =>
            prev.includes(roleId)
                ? prev.filter((id) => id !== roleId)
                : [...prev, roleId]
        );
    };

    const handleSubmit = async () => {
        if (!user) return;

        setSaving(true);
        try {
            const propId = selectedProperty?._id;
            if (!propId) {
                toast.error("No active property selected. Please select a property first.");
                setSaving(false);
                return;
            }
            await updateUserRoles(user.id, selectedRoles, propId);
            toast.success("User roles updated successfully");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Failed to update user roles:", error);
            toast.error(error.message || "Failed to update user roles");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit User Roles</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    {loading ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">Loading roles...</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                                Select roles for <span className="font-medium text-foreground">{user?.name}</span>
                            </div>
                            <div className="grid gap-3 max-h-[300px] overflow-y-auto p-1">
                                {roles.length === 0 ? (
                                    <div className="text-sm text-muted-foreground italic">No roles available</div>
                                ) : (
                                    roles.map((role) => (
                                        <div key={role._id} className="flex items-center space-x-2 rounded-md border p-3 hover:bg-accent transition-colors">
                                            <Checkbox
                                                id={role._id}
                                                checked={selectedRoles.includes(role._id)}
                                                onCheckedChange={() => handleRoleToggle(role._id)}
                                            />
                                            <Label
                                                htmlFor={role._id}
                                                className="flex-1 text-sm font-medium leading-none cursor-pointer"
                                            >
                                                {role.name}
                                            </Label>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
