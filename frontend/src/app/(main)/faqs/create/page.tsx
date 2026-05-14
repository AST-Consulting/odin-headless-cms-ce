"use client";

import { useRouter } from "next/navigation";
import { CreateFAQDialog } from "@/components/faqs/CreateFAQDialog";

export default function CreateFAQPage() {
    const router = useRouter();

    return (
        <CreateFAQDialog
            onSuccess={async () => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                router.push("/faqs")
            }}
            onCancel={() => router.push("/faqs")}
        />
    );
}