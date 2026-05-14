"use client";

import { useRouter } from "next/navigation";
import { TestimonialForm } from "../TestimonialForm";

export default function CreateTestimonialPage() {
    const router = useRouter();

    return (
        <TestimonialForm
            onSuccess={async () => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                router.push("/testimonials")
            }}
            onCancel={() => router.push("/testimonials")}
        />
    );
}
