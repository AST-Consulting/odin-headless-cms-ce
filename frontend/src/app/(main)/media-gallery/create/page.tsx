"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaPickerContent } from "@/components/editor/ImagePickerDialog";

export default function CreateMediaPage() {
    const router = useRouter();

    const handleComplete = (images: any) => {
        // Refresh the router to clear any cached data for the gallery
        router.refresh();
        // Redirect back to gallery after successful upload or selection
        router.push("/media-gallery");
    };

    const handleCancel = () => {
        router.push("/media-gallery");
    };

    return (
        <div className="w-full max-w-full space-y-4 sm:space-y-6">
            <Card className="border shadow-sm">
                <CardHeader className="border-b">
                    <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold">
                        ADD NEW MEDIA
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Upload files from your computer or generate new images with AI
                    </p>
                </CardHeader>
                <CardContent className="pt-6">
                    <MediaPickerContent 
                        onComplete={handleComplete} 
                        onCancel={handleCancel}
                        hideGalleryTab={true} // In the create page, we don't need to select from existing gallery
                    />
                </CardContent>
            </Card>
        </div>
    );
}
