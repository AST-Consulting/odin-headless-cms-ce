"use client";

import { useRouter } from "next/dist/client/components/navigation";
import AddItemComponent from "../../AddItemComponent";

export default function CreatePriorityPage() {
    const router = useRouter();

    return (
        <AddItemComponent 
            type="create" 
            onCancel={() => router.push("/menu/priority")} 
            onSuccess={() => router.push("/menu/priority")}
        />
    )
}

