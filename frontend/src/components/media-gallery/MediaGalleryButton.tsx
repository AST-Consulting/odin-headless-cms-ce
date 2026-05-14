"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { MediaGallery } from './MediaGallery';
import { MediaFile } from '@/lib/types';
import { Image as ImageIcon, X } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface MediaFileWithSelection extends MediaFile {
    selected: boolean;
    selectedRank: number;
}

interface MediaGalleryButtonProps {
    title?: string;
    multiSelect?: boolean;
    showPreview?: boolean;
    previousSelectedFiles?: Array<{ id: string; fileName: string; path: string }>;
    onSelect?: (files: Array<{ id: string; fileName: string; path: string }>) => void;
}

export function MediaGalleryButton({
    title = 'Upload',
    multiSelect = true,
    showPreview = true,
    previousSelectedFiles,
    onSelect,
}: MediaGalleryButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<
        Array<{ id: string; fileName: string; path: string; url?: string }>
    >([]);

    // Set initial selected files from props
    useEffect(() => {
        if (previousSelectedFiles) {
            const files = Array.isArray(previousSelectedFiles)
                ? previousSelectedFiles
                : [previousSelectedFiles];

            // Add URL if path exists
            const filesWithUrls = files.map((file) => ({
                ...file,
                url: file.path ? `${process.env.NEXT_PUBLIC_API_URL}/${file.path}` : undefined,
            }));

            setSelectedFiles(filesWithUrls);
        }
    }, [previousSelectedFiles]);

    const handleSelect = (files: MediaFileWithSelection[]) => {
        const formatted = files.map((file) => ({
            id: file._id,
            fileName: file.fileName,
            path: file.path,
            url: file.url,
        }));

        setSelectedFiles(formatted);
        setIsOpen(false);

        onSelect?.(formatted);
    };

    const handleRemove = (index: number) => {
        const updated = selectedFiles.filter((_, i) => i !== index);
        setSelectedFiles(updated);
        onSelect?.(updated);
    };

    return (
        <div className="space-y-4">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button type="button">
                        <ImageIcon className="w-4 h-4 mr-2" />
                        {title}
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="text-xl font-semibold">
                            Select Media
                        </DialogTitle>
                        <DialogDescription>
                            Choose {multiSelect ? 'one or more files' : 'a file'} from your media library
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2 py-4">
                        <MediaGallery
                            isModal={true}
                            multiSelect={multiSelect}
                            onSelect={handleSelect}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Preview Selected Files */}
            {showPreview && selectedFiles.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {selectedFiles.map((file, index) => (
                        <Card
                            key={index}
                            className="relative group overflow-hidden aspect-square"
                        >
                            <img
                                src={file.url}
                                alt={file.fileName}
                                className="w-full h-full object-cover"
                            />

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleRemove(index)}
                                    className="bg-red-500 hover:bg-red-600"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Filename */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <p className="text-white text-xs truncate">{file.fileName}</p>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
