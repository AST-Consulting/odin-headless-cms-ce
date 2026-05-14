"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MediaGallery } from '@/components/media-gallery/MediaGallery';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { MediaPickerContent } from '@/components/editor/ImagePickerDialog';
import { MediaFile } from '@/lib/types';

export default function MediaGalleryPage() {
    const [total, setTotal] = useState(0);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [recentlyUploaded, setRecentlyUploaded] = useState<MediaFile[]>([]);

    const handleComplete = () => {
        setIsDialogOpen(false);
    };

    const handleUploadSuccess = (files: MediaFile[]) => {
        setRecentlyUploaded(files);
    };

    const handleCancel = () => {
        setIsDialogOpen(false);
    };

    return (
        <div className="w-full max-w-full space-y-4 sm:space-y-6">
            <Card className="border shadow-sm">
                <CardHeader className="border-b space-y-1 sm:space-y-1.5 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2">
                            MEDIA GALLERY ({total.toLocaleString()})
                        </CardTitle>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                            Browse and manage your media files
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsDialogOpen(true)}
                        size="icon"
                        className="rounded-full h-10 w-10"
                    >
                        <Plus className="h-6 w-6" />
                    </Button>
                </CardHeader>
                <CardContent className="pt-6">
                    <MediaGallery
                        onUnfilteredTotalChange={setTotal}
                        prependedFiles={recentlyUploaded}
                    />
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="text-xl font-semibold">
                            Add New Media
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Upload files, select from gallery, or generate images with AI
                        </p>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2">
                        <MediaPickerContent
                            onComplete={handleComplete}
                            onUploadSuccess={handleUploadSuccess}
                            onCancel={handleCancel}
                            hideGalleryTab={true}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
