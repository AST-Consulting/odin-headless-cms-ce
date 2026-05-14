"use client";

import { useRouter, useParams } from "next/navigation";
import { SlugForm } from "../../SlugForm";
import { useState, useEffect } from "react";
import { getSlugById, type Slug } from "@/lib/api";
import { toast } from "sonner";

export default function EditSlugPage() {
    const router = useRouter();
    const params = useParams();
    const slugId = params?.slugId as string;
    const [slug, setSlug] = useState<Slug | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSlug = async () => {
            try {
                if (!slugId) {
                    toast.error("Slug ID not found");
                    router.push("/seo/slugs");
                    return;
                }
                const slugData = await getSlugById(slugId);
                setSlug(slugData);
            } catch (error) {
                toast.error("Failed to load slug details");
                router.push("/seo/slugs");
            } finally {
                setLoading(false);
            }
        };

        fetchSlug();
    }, [slugId, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">Loading slug details...</div>
            </div>
        );
    }

    return (
        <SlugForm
            slug={slug}
            type="edit"
            onSuccess={async () => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                router.push("/seo/slugs")
            }}
            onCancel={() => router.push("/seo/slugs")}
        />
    );
}