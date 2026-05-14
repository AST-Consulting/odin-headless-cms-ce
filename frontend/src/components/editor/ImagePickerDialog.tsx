"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Upload, FolderOpen, File as FileIcon, X, Pencil, ChevronUp, ChevronDown, Eye } from "lucide-react";
import {
    generateImage,
    uploadFiles,
    AspectRatio,
} from "@/lib/api";
import { toast } from "sonner";
import { MediaPicker } from "@/components/media-gallery/MediaPicker";
import { MediaFile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePropertyStore } from "@/lib/store";
import { ImageEditorDialog } from "./ImageEditorDialog";
import { InfographicBuilderDialog } from "./InfographicBuilderDialog";

interface MediaFileWithSelection extends MediaFile {
    selected: boolean;
    selectedRank: number;
}

export interface MediaPickerContentProps {
    onComplete: (images: Array<{ url: string; id: string; path: string; mimeType?: string; duration?: string | number }>) => void;
    onUploadSuccess?: (files: MediaFile[]) => void;
    onCancel?: () => void;
    hideGalleryTab?: boolean;
    galleryAspectRatio?: number;
    cropConstraint?: { aspect: number; minWidth: number };
    allowedTypes?: 'all' | 'image' | 'video' | 'shorts';
    orientation?: 'landscape' | 'portrait' | 'square';
    multiSelect?: boolean;
}

export function MediaPickerContent({
    onComplete,
    onUploadSuccess,
    onCancel,
    hideGalleryTab = false,
    defaultAspectRatio = "16:9",
    galleryAspectRatio,
    cropConstraint,
    allowedTypes = 'all',
    orientation,
    multiSelect,
}: MediaPickerContentProps & { defaultAspectRatio?: AspectRatio }) {
    const [aiPrompt, setAiPrompt] = useState("");
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultAspectRatio);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<{
        url: string;
        id: string;
        path: string;
        mimeType?: string;
        title?: string;
        caption?: string;
    } | null>(null);
    const [pendingFiles, setPendingFiles] = useState<Array<{
        file: File,
        title: string,
        caption: string,
        expanded: boolean
    }>>([]);

    const { selectedProperty } = usePropertyStore();

    // Image editor state
    const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
    const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
    const [editingSource, setEditingSource] = useState<"upload" | "gallery" | "ai" | null>(null);
    const [isEditorSaving, setIsEditorSaving] = useState(false);

    // Image preview
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Staged images ready for insert (from gallery selection)
    const [stagedImages, setStagedImages] = useState<Array<{ url: string; id: string; path: string; mimeType?: string; duration?: string | number }>>([]);

    // Infographic builder state
    const [showInfographicSuggestion, setShowInfographicSuggestion] = useState(false);
    const [infographicBuilderOpen, setInfographicBuilderOpen] = useState(false);
    const [detectedTopic, setDetectedTopic] = useState("");

    const CDN = process.env.NEXT_PUBLIC_CDN_URL || "";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const resolveImageUrl = useCallback((url?: string) => {
        if (!url) return "";
        if (url.startsWith("/uploads")) return `${CDN}${url}`;
        if (url.startsWith("/public/")) return `${API_BASE}${url}`;
        return url;
    }, [CDN, API_BASE]);


    // Smart detection for infographic keywords
    useEffect(() => {
        const infographicKeywords = [
            "ranking", "rank", "top 10", "top 5", "leaderboard", "scoreboard",
            "comparison", "compare", "vs", "versus", "difference",
            "timeline", "history", "evolution", "progression", "milestones",
            "statistics", "stats", "data", "chart", "graph", "infographic"
        ];

        const promptLower = aiPrompt.toLowerCase();
        const hasKeyword = infographicKeywords.some(keyword => promptLower.includes(keyword));

        if (hasKeyword && aiPrompt.length > 10) {
            setShowInfographicSuggestion(true);
            setDetectedTopic(aiPrompt.slice(0, 100));
        } else {
            setShowInfographicSuggestion(false);
        }
    }, [aiPrompt]);

    const proxyIfCrossOrigin = (url: string): string => {
        if (!url) return url;
        try {
            const imageOrigin = new URL(url).origin;
            if (imageOrigin !== window.location.origin) {
                return `/media-proxy?url=${encodeURIComponent(url)}`;
            }
        } catch {
            // relative/blob URL — same origin, no proxy needed
        }
        return url;
    };

    const handleOpenEditor = (imageUrl: string, index: number, source: "upload" | "gallery" | "ai") => {
        const resolved = resolveImageUrl(imageUrl);
        const proxied = proxyIfCrossOrigin(resolved);
        setEditingImageUrl(proxied);
        setEditingImageIndex(index);
        setEditingSource(source);
    };

    const handleEditorSave = async (blob: Blob) => {
        setIsEditorSaving(true);
        try {
            const file = new File([blob], `edited-${Date.now()}.png`, { type: "image/png" });
            const response = await uploadFiles([file], false, undefined, undefined, selectedProperty?._id);

            if (response && response.length > 0) {
                const edited = {
                    url: response[0].url,
                    id: response[0]._id,
                    path: response[0].path,
                    mimeType: response[0].mimeType,
                };

                if (editingSource === "gallery" && editingImageIndex !== null) {
                    setStagedImages(prev => prev.map((img, i) => i === editingImageIndex ? edited : img));
                } else if (editingSource === "ai") {
                    setGeneratedImage(prev => prev ? { ...prev, ...edited } : null);
                } else if (editingSource === "upload" && editingImageIndex !== null) {
                    setStagedImages(prev => [...prev, edited]);
                    setPendingFiles(prev => prev.filter((_, i) => i !== editingImageIndex));
                }

                toast.success("Image edited and saved!");
            }
        } catch (error) {
            console.error("Failed to save edited image:", error);
            toast.error("Failed to save edited image");
        } finally {
            setIsEditorSaving(false);
            setEditingImageUrl(null);
            setEditingImageIndex(null);
            setEditingSource(null);
        }
    };

    const handleInsertStagedImages = () => {
        if (stagedImages.length > 0) {
            onComplete(stagedImages);
            handleClose();
        }
    };

    const handleGenerateAI = async () => {
        const effectivePrompt = aiPrompt.trim();

        if (!effectivePrompt) {
            toast.error("Please enter a prompt");
            return;
        }

        setIsGenerating(true);
        try {
            const image = await generateImage(effectivePrompt, aspectRatio, undefined, undefined, selectedProperty?._id);
            const mappedImage = {
                url: image.url,
                id: image._id,
                path: image.path,
                mimeType: image.mimeType || "image/webp",
                title: effectivePrompt.slice(0, 50),
                caption: effectivePrompt
            };
            setGeneratedImage(mappedImage);
            toast.success("Image generated successfully!");
        } catch (error) {
            console.error("Failed to generate image:", error);
            toast.error("Failed to generate image. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleInsertGeneratedImage = () => {
        if (generatedImage) {
            onComplete([generatedImage]);
            handleClose();
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newPending = Array.from(files).map(file => ({
            file,
            title: file.name.split('.').slice(0, -1).join('.'),
            caption: "",
            expanded: true
        }));

        setPendingFiles(prev => [...prev, ...newPending]);
        // Reset input
        event.target.value = '';
    };

    const handleRemovePending = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const toggleExpand = (index: number) => {
        setPendingFiles(prev => prev.map((item, i) => i === index ? { ...item, expanded: !item.expanded } : item));
    };

    const updatePendingFile = (index: number, field: 'title' | 'caption', value: string) => {
        setPendingFiles(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const handleClearAll = () => {
        setPendingFiles([]);
    };

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0) return;

        setIsUploading(true);
        const uploadedMedia: Array<{ url: string; id: string; path: string; mimeType?: string; duration?: string | number }> = [];
        const uploadedFiles: MediaFile[] = [];

        try {
            for (const item of pendingFiles) {
                // Rename file to use the title provided by user
                const extension = item.file.name.split('.').pop();
                const renamedFile = new File([item.file], `${item.title}.${extension}`, {
                    type: item.file.type,
                });

                const response = await uploadFiles(
                    [renamedFile],
                    false,
                    undefined,
                    item.caption || undefined,
                    selectedProperty?._id
                );

                if (response && response.length > 0) {
                    uploadedFiles.push(response[0]);
                    uploadedMedia.push({
                        url: response[0].url,
                        id: response[0]._id,
                        path: response[0].path,
                        mimeType: response[0].mimeType,
                        duration: response[0].media_details?.length
                    });
                }
            }

            if (uploadedMedia.length > 0) {
                toast.success(`${uploadedMedia.length} file(s) uploaded successfully!`);
                onUploadSuccess?.(uploadedFiles);
                onComplete(uploadedMedia);
                handleClose();
            }
        } catch (error) {
            console.error("Failed to upload files:", error);
            toast.error("Failed to upload files. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleMediaGallerySelect = (files: MediaFileWithSelection[]) => {
        if (files.length > 0) {
            const selectedImages = files.map(file => ({
                url: file.url,
                id: file._id,
                path: file.path,
                mimeType: file.mimeType,
                duration: file.media_details?.length
            }));
            if (cropConstraint || multiSelect === false) {
                onComplete(selectedImages);
                return;
            }
            setStagedImages(selectedImages);
        }
    };

    const handleClose = () => {
        if (onCancel) onCancel();
        // Reset state
        setAiPrompt("");
        setAspectRatio("16:9");
        setGeneratedImage(null);
        setPendingFiles([]);
        setStagedImages([]);
        setShowInfographicSuggestion(false);
        setDetectedTopic("");
    };

    return (
        <Tabs defaultValue={hideGalleryTab ? "upload" : "gallery"} className="w-full flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 sm:px-0 flex justify-center">
                <TabsList className={`grid ${hideGalleryTab ? 'grid-cols-2' : 'grid-cols-3'} w-full max-w-2xl`}>
                    <TabsTrigger value="upload">
                        <Upload className="h-4 w-4 mr-1.5" />
                        Upload
                    </TabsTrigger>
                    {!hideGalleryTab && (
                        <TabsTrigger value="gallery">
                            <FolderOpen className="h-4 w-4 mr-1.5" />
                            Gallery
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="ai">
                        <Sparkles className="h-4 w-4 mr-1.5" />
                        AI Generate
                    </TabsTrigger>
                </TabsList>
            </div>

            {/* Upload Tab */}
            <TabsContent value="upload" className="flex-1 overflow-y-auto px-4 py-4 sm:px-0">
                {pendingFiles.length === 0 ? (
                    <Label htmlFor="file-upload" className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-12 hover:border-primary transition-colors min-h-[300px] cursor-pointer">
                        <Upload className="h-12 w-12 text-gray-400 mb-4" />
                        <span className="text-lg font-medium text-primary hover:underline">
                            Choose files to upload
                        </span>
                        <Input
                            id="file-upload"
                            type="file"
                            accept={allowedTypes === 'image' ? 'image/*' : (allowedTypes === 'video' || allowedTypes === 'shorts') ? 'video/*' : 'image/*,video/*'}
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={isUploading}
                        />
                        <p className="text-sm text-gray-500 mt-2">
                            {isUploading ? "Uploading..." : "or drag and drop images"}
                        </p>
                    </Label>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-4">
                            <h3 className="font-semibold text-lg">Files ({pendingFiles.length})</h3>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearAll}
                                    disabled={isUploading}
                                >
                                    Clear All
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleUploadAll}
                                    disabled={isUploading}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {isUploading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Upload className="h-4 w-4 mr-2" />
                                    )}
                                    Upload All
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {pendingFiles.map((item, index) => (
                                <Card key={index} className="overflow-hidden">
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {item.file.type.startsWith("image/") ? (
                                                <div className="relative group w-24 h-24 shrink-0">
                                                <img src={URL.createObjectURL(item.file)} alt={item.title} className="w-24 h-24 object-cover rounded-lg border" />
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewUrl(URL.createObjectURL(item.file))}
                                                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Eye className="w-5 h-5 text-white" />
                                                </button>
                                            </div>
                                            ) : (
                                                <div className="p-2 bg-gray-100 rounded-lg">
                                                    <FileIcon className="h-5 w-5 text-gray-400" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">{item.file.name}</span>
                                                    <Badge variant="secondary" className="text-[10px] h-4">Pending</Badge>
                                                </div>
                                                <p className="text-[10px] text-gray-500">
                                                    {(item.file.size / 1024).toFixed(2)} KB • {item.file.type}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {item.file.type.startsWith("image/") && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleOpenEditor(URL.createObjectURL(item.file), index, "upload")}
                                                    title="Edit image"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => toggleExpand(index)}
                                            >
                                                {item.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                                onClick={() => handleRemovePending(index)}
                                                disabled={isUploading}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {item.expanded && (
                                        <div className="px-4 pb-4 border-t pt-4 space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold">Title (Filename)</Label>
                                                <Input
                                                    value={item.title}
                                                    onChange={(e) => updatePendingFile(index, 'title', e.target.value)}
                                                    className="h-9 text-sm"
                                                    placeholder="Enter title..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold">Caption</Label>
                                                <Input
                                                    value={item.caption}
                                                    onChange={(e) => updatePendingFile(index, 'caption', e.target.value)}
                                                    className="h-9 text-sm"
                                                    placeholder="Enter a caption..."
                                                />
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>

                        <div className="border-t pt-4">
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-6 hover:border-primary transition-colors cursor-pointer"
                                onClick={() => document.getElementById('more-files-upload')?.click()}>
                                <Upload className="h-6 w-6 text-gray-400 mb-2" />
                                <span className="text-sm font-medium text-gray-600">Click or drag more files</span>
                                <Input
                                    id="more-files-upload"
                                    type="file"
                                    accept={allowedTypes === 'image' ? 'image/*' : (allowedTypes === 'video' || allowedTypes === 'shorts') ? 'video/*' : 'image/*,video/*'}
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    disabled={isUploading}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </TabsContent>

            {/* Media Gallery Tab */}
            {!hideGalleryTab && (
                <TabsContent value="gallery" className="flex-1 data-[state=active]:flex flex-col overflow-hidden px-4 sm:px-0 mt-0">
                    {stagedImages.length === 0 ? (
                        <MediaPicker
                            multiSelect={multiSelect !== undefined ? multiSelect : !cropConstraint}
                            onSelect={handleMediaGallerySelect}
                            aspectRatio={galleryAspectRatio}
                            allowedTypes={allowedTypes}
                            orientation={orientation}
                        />
                    ) : (
                        <div className="flex flex-col gap-4 p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm">Selected Images ({stagedImages.length})</h3>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setStagedImages([])}>
                                        Back to Gallery
                                    </Button>
                                    <Button size="sm" onClick={handleInsertStagedImages} className="bg-blue-600 hover:bg-blue-700">
                                        Insert {stagedImages.length > 1 ? `${stagedImages.length} Images` : "Image"}
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[60vh]">
                                {stagedImages.map((img, index) => (
                                    <div key={img.id} className="relative group rounded-lg overflow-hidden border bg-muted">
                                        {img.mimeType?.startsWith("video/") ? (
                                            <video 
                                                src={resolveImageUrl(img.url)} 
                                                className="w-full h-48 sm:h-56 object-cover" 
                                                muted 
                                                playsInline
                                                autoPlay
                                                loop
                                            />
                                        ) : (
                                            <img
                                                src={resolveImageUrl(img.url)}
                                                alt=""
                                                className="w-full h-48 sm:h-56 object-cover"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                                            {img.mimeType?.startsWith("image/") !== false && (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8"
                                                    onClick={() => handleOpenEditor(img.url, index, "gallery")}
                                                >
                                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                                    Edit
                                                </Button>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70 text-white"
                                            onClick={() => setStagedImages(prev => prev.filter((_, i) => i !== index))}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>
            )}

            {/* AI Generate Tab */}
            <TabsContent value="ai" className="flex-1 overflow-y-auto space-y-4 px-4 py-4 sm:px-1">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ai-prompt">Image Description</Label>
                        <Textarea
                            id="ai-prompt"
                            placeholder="Describe the image you want to generate, e.g., A beautiful sunset over mountains with warm golden light..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && !isGenerating && !generatedImage) {
                                    e.preventDefault();
                                    handleGenerateAI();
                                }
                            }}
                            disabled={isGenerating}
                            rows={4}
                            className="resize-none focus-visible:ring-offset-0"
                        />
                    </div>

                    {/* Smart Infographic Suggestion */}
                    {showInfographicSuggestion && (
                        <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg shrink-0">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div>
                                        <h4 className="font-semibold text-blue-900">Looks like an infographic!</h4>
                                        <p className="text-sm text-blue-800 mt-1">
                                            Get better results with our structured Infographic Builder.
                                            Add data from CSV, screenshots, or let AI search the web.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setInfographicBuilderOpen(true);
                                                setShowInfographicSuggestion(false);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                            Use Infographic Builder
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setShowInfographicSuggestion(false)}
                                        >
                                            Continue as Simple Image
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Manual Infographic Builder Option */}
                    {!showInfographicSuggestion && (
                        <div className="flex items-center justify-center py-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setInfographicBuilderOpen(true);
                                    setDetectedTopic(aiPrompt);
                                }}
                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                Need an Infographic? Try our Builder
                            </Button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="ai-aspect-ratio">Aspect Ratio</Label>
                        <Select
                            value={aspectRatio}
                            onValueChange={(value) => setAspectRatio(value as AspectRatio)}
                            disabled={isGenerating}
                        >
                            <SelectTrigger id="ai-aspect-ratio" className="w-full">
                                <SelectValue placeholder="Select aspect ratio" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                                <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                                <SelectItem value="1:1">Square (1:1)</SelectItem>
                                <SelectItem value="4:5">Social Portrait (4:5)</SelectItem>
                                <SelectItem value="5:4">Social Landscape (5:4)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {generatedImage && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Generated Image</Label>
                                <div className="relative group rounded-lg overflow-hidden border bg-muted">
                                    <img
                                        src={resolveImageUrl(generatedImage.url)}
                                        alt="Generated"
                                        className="w-full h-auto max-h-96 object-contain"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleOpenEditor(generatedImage.url, 0, "ai")}
                                        >
                                            <Pencil className="h-3.5 w-3.5 mr-1" />
                                            Edit Image
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Title</Label>
                                    <Input
                                        value={generatedImage.title}
                                        onChange={(e) => setGeneratedImage(prev => prev ? { ...prev, title: e.target.value } : null)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Caption</Label>
                                    <Input
                                        value={generatedImage.caption}
                                        onChange={(e) => setGeneratedImage(prev => prev ? { ...prev, caption: e.target.value } : null)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
                            Cancel
                        </Button>
                        {!generatedImage ? (
                            <Button onClick={handleGenerateAI} disabled={isGenerating}>
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Generate
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button onClick={handleInsertGeneratedImage}>
                                Insert Image
                            </Button>
                        )}
                    </div>
                </div>
            </TabsContent>

            {/* Image Editor Dialog */}
            <ImageEditorDialog
                open={!!editingImageUrl}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingImageUrl(null);
                        setEditingImageIndex(null);
                        setEditingSource(null);
                    }
                }}
                imageUrl={editingImageUrl || ""}
                onSave={handleEditorSave}
                isSaving={isEditorSaving}
                cropConstraint={cropConstraint}
            />

            {/* Infographic Builder Dialog */}
            <InfographicBuilderDialog
                open={infographicBuilderOpen}
                onOpenChange={setInfographicBuilderOpen}
                onComplete={(image) => {
                    setGeneratedImage(image);
                    setInfographicBuilderOpen(false);
                    toast.success("Infographic ready! You can edit or insert it.");
                }}
                initialTopic={detectedTopic}
            />
            {/* Image Preview Modal */}
            {previewUrl && (
                <Dialog open={true} onOpenChange={() => setPreviewUrl(null)}>
                    <DialogContent className="max-w-[70vw] max-h-[80vh] p-4 flex items-center justify-center bg-neutral-900 border border-neutral-700 [&>button]:bg-white [&>button]:rounded-full [&>button]:p-1 [&>button]:shadow-lg">
                        {previewUrl.match(/\.(mp4|webm|ogg|mov)$|^blob:.*video/) || stagedImages.find(img => resolveImageUrl(img.url) === previewUrl)?.mimeType?.startsWith('video/') ? (
                            <video src={previewUrl} controls autoPlay className="max-w-full max-h-[73vh] object-contain rounded" />
                        ) : (
                            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[73vh] object-contain rounded" />
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </Tabs>
    );
}

export interface ImagePickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImageSelected: (images: Array<{ url: string; id: string; path: string; mimeType?: string; duration?: string | number }>) => void;
    defaultAspectRatio?: AspectRatio;
    galleryAspectRatio?: number;
    cropConstraint?: { aspect: number; minWidth: number };
    allowedTypes?: 'all' | 'image' | 'video' | 'shorts';
    orientation?: 'landscape' | 'portrait' | 'square';
    multiSelect?: boolean;
}

export function ImagePickerDialog({
    open,
    onOpenChange,
    onImageSelected,
    defaultAspectRatio,
    galleryAspectRatio,
    cropConstraint,
    allowedTypes,
    orientation,
    multiSelect,
}: ImagePickerDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[900px] h-full sm:h-auto sm:max-h-[90vh] top-0 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] rounded-none sm:rounded-lg overflow-hidden flex flex-col p-0 sm:p-6"
            >
                <DialogHeader className="p-4 sm:p-0 border-b sm:border-0">
                    <DialogTitle>Add Image</DialogTitle>
                    <DialogDescription>
                        Upload from computer, select from media gallery, or generate with AI
                    </DialogDescription>
                </DialogHeader>

                <MediaPickerContent
                    onComplete={(images) => {
                        onImageSelected(images);
                        onOpenChange(false);
                    }}
                    onCancel={() => onOpenChange(false)}
                    defaultAspectRatio={defaultAspectRatio}
                    galleryAspectRatio={galleryAspectRatio}
                    cropConstraint={cropConstraint}
                    allowedTypes={allowedTypes}
                    orientation={orientation}
                    multiSelect={multiSelect}
                />
            </DialogContent>
        </Dialog>
    );
}

