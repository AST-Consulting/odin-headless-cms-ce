"use client";

import { CreatePollDialog } from "@/components/polls/CreatePollDialog";
import { useRouter } from "next/navigation";

export default function CreatePollPage() {
    const router = useRouter();

    const handleSuccess = () => {
        router.push("/polls");
    };

    const handleCancel = () => {
        router.push("/polls");
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <CreatePollDialog 
                type="create"
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                className="p-0"
            />
        </div>
    );
}
