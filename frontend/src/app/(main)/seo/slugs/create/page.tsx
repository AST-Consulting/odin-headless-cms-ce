"use client";

import { useRouter } from "next/navigation";
import { SlugForm } from "../SlugForm";

export default function CreateMenuPage() {
    const router = useRouter();

    return (
        <SlugForm
            type="create"
            onSuccess={async () => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                router.push("/seo/slugs")
            }}
            onCancel={() => router.push("/seo/slugs")}
        />
    );
}
