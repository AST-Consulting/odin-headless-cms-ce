"use client";

import { CreateRoleDialog } from "@/components/dialogs/CreateRoleDialog";
import { useRouter } from "next/navigation";

export default function CreateRolePage() {
    const router = useRouter();


    return (
        <CreateRoleDialog type="create" onCancel={() => router.push("/roles")} onSuccess={() => router.push("/roles")}/>
    )
}