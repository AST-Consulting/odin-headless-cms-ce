"use client";

import { useState, useCallback, useRef } from 'react';
import { uploadFiles } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Update imports to include Chevrons
import { Upload, X, FileImage, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { usePropertyStore } from '@/lib/store';
interface UploadedFile {
    file: File;
    url?: string;
    preview?: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
    title: string;
    caption: string;
    isExpanded: boolean;
}

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB

export function UploadSection() {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [source, setSource] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        addFiles(droppedFiles);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            addFiles(selectedFiles);
        }
    };

    const addFiles = (newFiles: File[]) => {
        const uploadedFiles: UploadedFile[] = newFiles
            .filter((file) => {
                if (file.size > MAX_UPLOAD_SIZE) {
                    toast({ title: 'File too large', description: `${file.name} exceeds 20MB limit`, variant: 'destructive' });
                    return false;
                }
                return true;
            })
            .map((file) => ({
                file,
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
                status: 'pending' as const,
                progress: 0,
                title: file.name.split('.').slice(0, -1).join('.') || file.name,
                caption: '',
                isExpanded: false,
            }));
        setFiles((prev) => [...prev, ...uploadedFiles]);
    };

    const toggleDetails = (index: number) => {
        setFiles((prev) => prev.map((f, i) => i === index ? { ...f, isExpanded: !f.isExpanded } : f));
    };

    const updateFileDetails = (index: number, field: 'title' | 'caption', value: string) => {
        setFiles((prev) => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
    };

    const removeFile = (index: number) => {
        setFiles((prev) => {
            const file = prev[index];
            if (file?.preview) URL.revokeObjectURL(file.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const uploadAllFiles = async () => {
        const pendingFiles = files.filter((f) => f.status === 'pending');

        if (pendingFiles.length === 0) {
            toast({
                title: 'No files to upload',
                description: 'Please add files before uploading',
                variant: 'destructive',
            });
            return;
        }

        // Update all pending files to uploading state initially
        setFiles((prev) =>
            prev.map((f) => (f.status === 'pending' ? { ...f, status: 'uploading' as const } : f))
        );

        // Upload sequentially to handle per-file metadata (rename, caption)
        for (let i = 0; i < files.length; i++) {
            const fileItem = files[i];
            if (fileItem.status !== 'pending' && fileItem.status !== 'uploading') continue; // Skip if handled or not pending (caught by previous setFiles but we are iterating current 'files' state, wait. 'files' in closure is stale? No, 'files' in loop is from state? No, 'files' is from render scope. We need current 'files'.)

            // To be safe with closure stale state, we'll iterate the ORIGINAL indices logic or just use the local 'pendingFiles' and find them in state.
            // Better: Iterate 'pendingFiles' and find their index in the master list to update.
        }

        // Actually, let's just loop through the indices of pending files from the current render scope
        const pendingIndices = files
            .map((f, index) => ({ ...f, index }))
            .filter((f) => f.status === 'pending');

        let successCount = 0;
        let failCount = 0;

        for (const item of pendingIndices) {
            try {
                // Rename file if title changed
                const originalFile = item.file;
                const extension = originalFile.name.split('.').pop();
                const newName = `${item.title}.${extension}`;

                // Create a new File object with the new name
                const fileToUpload = new File([originalFile], newName, { type: originalFile.type });

                // Simulate progress for this specific file
                // Start a progress interval for this file index
                const progressInterval = setInterval(() => {
                    setFiles((prev) =>
                        prev.map((f, idx) =>
                            idx === item.index && f.status === 'uploading' && f.progress < 90
                                ? { ...f, progress: Math.min(f.progress + 10, 90) }
                                : f
                        )
                    );
                }, 200);

                // Call API for single file
                const response = await uploadFiles([fileToUpload], false, source, item.caption, selectedProperty?._id);

                clearInterval(progressInterval);

                setFiles((prev) =>
                    prev.map((f, idx) => {
                        if (idx === item.index) {
                            return {
                                ...f,
                                url: response[0].url,
                                status: 'success' as const,
                                progress: 100,
                            };
                        }
                        return f;
                    })
                );
                successCount++;

            } catch (error: any) {
                setFiles((prev) =>
                    prev.map((f, idx) =>
                        idx === item.index
                            ? { ...f, status: 'error' as const, error: error.message }
                            : f
                    )
                );
                failCount++;
            }
        }

        if (successCount > 0) {
            toast({
                title: 'Upload complete',
                description: `${successCount} file(s) uploaded successfully.`,
            });
        }
        if (failCount > 0) {
            toast({
                title: 'Upload finished with errors',
                description: `${failCount} file(s) failed.`,
                variant: 'destructive',
            });
        }
    };

    const clearAll = () => {
        files.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
        setFiles([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const getStatusIcon = (status: UploadedFile['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            default:
                return <FileImage className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusBadge = (status: UploadedFile['status']) => {
        switch (status) {
            case 'pending':
                return <Badge variant="secondary">Pending</Badge>;
            case 'uploading':
                return <Badge variant="default">Uploading...</Badge>;
            case 'success':
                return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Success</Badge>;
            case 'error':
                return <Badge variant="destructive">Failed</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Source Input */}
            <Card className="p-4">
                <div className="space-y-2">
                    <Label htmlFor="source" className="text-sm font-medium">
                        Source (Optional)
                    </Label>
                    <Input
                        id="source"
                        type="text"
                        placeholder="e.g., ANI, Getty, Reuters..."
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">
                        Specify the source or origin of these files for better tracking
                    </p>
                </div>
            </Card>

            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
          relative border-2 border-dashed rounded-lg transition-all duration-200
          ${isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary'
                    }
        `}
            >
                <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div
                        className={`
            p-4 rounded-full mb-4 transition-colors duration-200
            ${isDragging
                                ? 'bg-primary/10'
                                : 'bg-muted'
                            }
          `}
                    >
                        <Upload
                            className={`w-12 h-12 transition-colors duration-300 ${isDragging
                                ? 'text-primary'
                                : 'text-muted-foreground'
                                }`}
                        />
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {isDragging ? 'Drop files here' : 'Upload Files'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                        Drag and drop your files here or click the button below
                    </p>

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                    />
                    <label htmlFor="file-upload">
                        <Button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileImage className="w-4 h-4 mr-2" />
                            Browse Files
                        </Button>
                    </label>

                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                        Supported formats: Images, Videos, Documents · Max 20MB per file
                    </p>
                </div>
            </div>

            {/* Files List */}
            {files.length > 0 && (
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Files ({files.length})
                        </h3>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearAll}
                                className="text-gray-600"
                            >
                                Clear All
                            </Button>
                            <Button
                                size="sm"
                                onClick={uploadAllFiles}
                                disabled={files.every((f) => f.status !== 'pending')}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload All
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {files.map((uploadedFile, index) => (
                            <div
                                key={index}
                                className="flex flex-col gap-2 p-4 bg-card rounded-lg border transition-all hover:border-primary/50"
                            >
                                <div className="flex items-center gap-4">
                                    {/* Preview / Icon */}
                                    <div className="flex-shrink-0">
                                        {uploadedFile.preview ? (
                                            <img src={uploadedFile.preview} alt={uploadedFile.title} className="w-16 h-16 object-cover rounded-md border" />
                                        ) : (
                                            getStatusIcon(uploadedFile.status)
                                        )}
                                    </div>

                                    {/* File Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {uploadedFile.title}
                                            </p>
                                            {getStatusBadge(uploadedFile.status)}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatFileSize(uploadedFile.file.size)} •{' '}
                                            {uploadedFile.file.type || 'Unknown type'}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleDetails(index)}
                                            className="h-8 w-8 p-0"
                                        >
                                            {uploadedFile.isExpanded ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeFile(index)}
                                            className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                                            disabled={uploadedFile.status === 'uploading'}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {(uploadedFile.status === 'uploading' ||
                                    uploadedFile.status === 'success') && (
                                        <Progress
                                            value={uploadedFile.progress}
                                            className="h-1.5"
                                        />
                                    )}

                                {/* Error Message */}
                                {uploadedFile.status === 'error' && uploadedFile.error && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {uploadedFile.error}
                                    </p>
                                )}

                                {/* Metadata Form (Collapsible) */}
                                {uploadedFile.isExpanded && (
                                    <div className="mt-3 space-y-3 pl-9 border-t pt-3">
                                        <div className="grid gap-2">
                                            <Label htmlFor={`title-${index}`} className="text-xs">Title (Filename)</Label>
                                            <Input
                                                id={`title-${index}`}
                                                value={uploadedFile.title}
                                                onChange={(e) => updateFileDetails(index, 'title', e.target.value)}
                                                className="h-8 text-sm"
                                                disabled={uploadedFile.status !== 'pending'}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor={`caption-${index}`} className="text-xs">Caption</Label>
                                            <Input
                                                id={`caption-${index}`}
                                                value={uploadedFile.caption}
                                                onChange={(e) => updateFileDetails(index, 'caption', e.target.value)}
                                                className="h-8 text-sm"
                                                disabled={uploadedFile.status !== 'pending'}
                                                placeholder="Enter a caption..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
