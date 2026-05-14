"use client";

import { useRouter, useParams } from "next/navigation";
import { TestimonialForm } from "../../TestimonialForm";
import { useState, useEffect } from "react";
import { getTestimonialById, type Testimonial } from "@/lib/api";
import { toast } from "sonner";

export default function EditTestimonialPage() {
    const router = useRouter();
    const params = useParams();
    const testimonialId = params?.testimonialId as string;
    const [testimonial, setTestimonial] = useState<Testimonial | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTestimonial = async () => {
            try {
                if (!testimonialId) {
                    toast.error("Testimonial ID not found");
                    router.push("/testimonials");
                    return;
                }
                const testimonialData = await getTestimonialById(testimonialId);
                setTestimonial(testimonialData);
            } catch (error) {
                toast.error("Failed to load testimonial details");
                router.push("/testimonials");
            } finally {
                setLoading(false);
            }
        };

        fetchTestimonial();
    }, [testimonialId, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">Loading testimonial details...</div>
            </div>
        );
    }

    return (
        <TestimonialForm
            testimonial={testimonial}
            onSuccess={async () => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                router.push("/testimonials")
            }}
            onCancel={() => router.push("/testimonials")}
            type="edit"
        />
    );
}
