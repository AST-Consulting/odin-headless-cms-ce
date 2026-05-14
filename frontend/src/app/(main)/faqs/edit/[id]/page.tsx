"use client";

import { CreateFAQDialog } from "@/components/faqs/CreateFAQDialog";
import { getFAQById } from "@/lib/api";
import { FAQ } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function EditFAQPage() {
    const router = useRouter();
    const params = useParams();
    const faqId = params?.id as string;
    const [faqToEdit, setFaqToEdit] = useState<FAQ | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFAQ = async () => {
            try {
                if (!faqId) {
                    toast.error("FAQ ID not found");
                    router.push("/faqs");
                    return;
                }
                const faqData = await getFAQById(faqId);
                setFaqToEdit(faqData);

            } catch (error) {
                toast.error("Failed to load FAQ details");
                router.push("/faqs");
            } finally {
                setLoading(false);
            }
        }
        fetchFAQ();
    }, [faqId, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">Loading FAQs details...</div>
            </div>
        );
    }

    return (
        <CreateFAQDialog faqToEdit={faqToEdit}
            onCancel={() => router.push("/faqs")}
            onSuccess={async () => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                router.push("/faqs")
            }} />
    )
}