"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CreateRoleDialog } from "@/components/dialogs/CreateRoleDialog";
import { getRoleById } from "@/lib/api";
import { Role } from "@/lib/types";

export default function EditRolePage() {
    const { id } = useParams();
    const router = useRouter();

    const [role, setRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRole() {
            try {
                const data = await getRoleById(id as string);
                console.log("Role data:", data);
                setRole(data);
            } catch (error) {
                console.error("Failed to fetch role:", error);
                router.push("/roles");
            } finally {
                setLoading(false);
            }
        }
        fetchRole();
    }, [id]);

    if (loading) return <div className="p-6">Loading...</div>;
    if (!role) return <div className="p-6">Role not found</div>;

    return (
        <CreateRoleDialog
            type="edit"
            roleData={role}
            onCancel={() => router.back()}
            onSuccess={() => router.back()}
        />
    );
}
