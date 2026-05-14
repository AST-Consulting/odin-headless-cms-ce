"use client";

import { useEffect, useState } from "react";
import { CreatePollDialog } from "@/components/polls/CreatePollDialog";
import { useRouter, useParams } from "next/navigation";
import { getPollById } from "@/lib/api";
import { Poll } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditPollPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [poll, setPoll] = useState<Poll | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getPollById(id).then(data => {
                setPoll(data);
                setLoading(false);
            }).catch(err => {
                console.error("Failed to fetch poll", err);
                setLoading(false);
            });
        }
    }, [id]);

    const handleSuccess = () => {
        router.push("/polls");
    };

    const handleCancel = () => {
        router.push("/polls");
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-64 w-full" />
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>
        );
    }

    if (!poll) {
        return (
            <div className="max-w-4xl mx-auto py-20 px-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Poll not found</h1>
                <p className="text-muted-foreground mb-8">The poll you are looking for does not exist or has been deleted.</p>
                <div className="flex justify-center gap-4">
                    <button 
                        onClick={() => router.push("/polls")}
                        className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                    >
                        Back to Polls
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <CreatePollDialog 
                type="edit"
                pollToEdit={poll}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                className="p-0"
            />
        </div>
    );
}
