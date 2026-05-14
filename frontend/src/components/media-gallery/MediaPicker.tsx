import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getMediaFiles, getUsers } from '@/lib/api';
import { MediaFile, UserData } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Image as ImageIcon, FileVideo, File, X, ChevronDown, ChevronUp, SlidersHorizontal, Check, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { usePropertyStore } from '@/lib/store';
import { getImageUrl } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

import { DateRangePicker, DateRangePickerHandle } from '@/components/ui/date-range-picker';

interface MediaFileWithSelection extends MediaFile {
    selected: boolean;
    selectedRank: number;
}

interface MediaPickerProps {
    multiSelect?: boolean;
    onSelect?: (files: MediaFileWithSelection[]) => void;
    onTotalChange?: (total: number) => void;
    aspectRatio?: number;
    allowedTypes?: 'all' | 'image' | 'video' | 'shorts';
    orientation?: 'landscape' | 'portrait' | 'square';
}


export function MediaPicker({
    multiSelect = true,
    onSelect,
    onTotalChange,
    aspectRatio,
    allowedTypes,
    orientation,
}: MediaPickerProps): JSX.Element {
    const [files, setFiles] = useState<MediaFileWithSelection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [previewFile, setPreviewFile] = useState<MediaFileWithSelection | null>(null);
    const { toast } = useToast();
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [authors, setAuthors] = useState<UserData[]>([]);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const datePickerRef = useRef<DateRangePickerHandle>(null);

    // Filter states
    const [draftSearch, setDraftSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [draftAuthor, setDraftAuthor] = useState('all');
    const [appliedAuthor, setAppliedAuthor] = useState('all');
    const [draftType, setDraftType] = useState(allowedTypes);
    const [appliedType, setAppliedType] = useState(allowedTypes);
    const [draftStartDate, setDraftStartDate] = useState('');
    const [draftEndDate, setDraftEndDate] = useState('');
    const [draftPreset, setDraftPreset] = useState<string | null>(null);
    const [draftOrientation, setDraftOrientation] = useState(orientation || 'all');
    const [appliedOrientation, setAppliedOrientation] = useState(orientation || 'all');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const [appliedPreset, setAppliedPreset] = useState<string | null>(null);

    // Fetch Authors
    const handleAuthorSearch = useCallback(async (query: string) => {
        if (!selectedProperty?._id) return;
        try {
            const response = await getUsers({ search: query, limit: 40, propertyId: selectedProperty?._id } as any);
            setAuthors(response.data);
        } catch (error) {
            console.error('Failed to fetch authors:', error);
        }
    }, [selectedProperty?._id]);

    useEffect(() => {
        handleAuthorSearch('');
    }, [handleAuthorSearch]);

    useEffect(() => {
        if (orientation) {
            setDraftOrientation(orientation);
            setAppliedOrientation(orientation);
        }
    }, [orientation]);

    // Fetch files
    const loadFiles = useCallback(async () => {
        if (!selectedProperty?._id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const params: Record<string, any> = {
                isPrivate: false,
                page: currentPage,
                limit: 20,
                propertyId: selectedProperty._id,
            };

            if (appliedSearch) params.searchTerm = appliedSearch;
            if (appliedAuthor !== 'all') params.author = appliedAuthor;
            if (appliedType !== 'all') {
                if (appliedType === 'shorts') {
                    params.mimeType = 'video/*';
                    params.orientation = 'portrait';
                } else {
                    params.mimeType = `${appliedType}/*`;
                }
            }

            if (appliedOrientation !== 'all') {
                params.orientation = appliedOrientation;
            }

            if (appliedStartDate) {
                params['createdAt.gte'] = appliedStartDate;
            }
            if (appliedEndDate) {
                params['createdAt.lte'] = appliedEndDate;
            }

            const response = await getMediaFiles(params);
            const newFiles = response.data.map((file) => ({
                ...file,
                selected: false,
                selectedRank: 0,
            }));

            setFiles((prev) => currentPage === 1 ? newFiles : [...prev, ...newFiles]);
            setTotal(response.total);
            onTotalChange?.(response.total);
            setHasMore(currentPage < response.pageCount);
        } catch (error) {
            console.error('Failed to fetch files:', error);
            toast({ title: 'Error', description: 'Failed to load media files', variant: 'destructive' });
        } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
        }
    }, [currentPage, appliedSearch, appliedAuthor, appliedType, appliedOrientation, appliedStartDate, appliedEndDate, selectedProperty?._id, aspectRatio]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    const applyCurrentFilters = useCallback(() => {
        isLoadingRef.current = true;
        setAppliedSearch(draftSearch);
        setAppliedAuthor(draftAuthor);
        setAppliedType(draftType);
        setAppliedOrientation(draftOrientation);
        setAppliedStartDate(draftStartDate);
        setAppliedEndDate(draftEndDate);
        setAppliedPreset(draftPreset);
        setCurrentPage(1);
    }, [draftSearch, draftAuthor, draftType, draftOrientation, draftStartDate, draftEndDate, draftPreset]);

    const handleClearAll = () => {
        setDraftSearch('');
        setDraftAuthor('all');
        setDraftType('all');
        setDraftOrientation('all');
        setDraftStartDate('');
        setDraftEndDate('');
        setDraftPreset(null);

        setAppliedSearch('');
        setAppliedAuthor('all');
        setAppliedType('all');
        setAppliedOrientation('all');
        setAppliedStartDate('');
        setAppliedEndDate('');
        setAppliedPreset(null);

        setCurrentPage(1);
        datePickerRef.current?.clear();
    };

    const hasActiveDraftFilters = !!(
        draftSearch ||
        draftAuthor !== "all" ||
        draftType !== "all" ||
        draftStartDate ||
        draftEndDate ||
        draftPreset ||
        draftOrientation !== 'all'
    );

    const hasAppliedFilters = !!(
        appliedSearch ||
        appliedAuthor !== "all" ||
        appliedType !== "all" ||
        appliedStartDate ||
        appliedEndDate ||
        appliedPreset ||
        appliedOrientation !== 'all'
    );

    const hasActiveFilters = hasAppliedFilters;

    const handleFileClick = (file: MediaFileWithSelection) => {
        if (multiSelect) {
            handleToggleSelect(file);
        } else {
            setPreviewFile(file);
        }
    };

    const handleToggleSelect = (file: MediaFileWithSelection) => {
        setFiles(prev => {
            const isCurrentlySelected = prev.find(f => f._id === file._id)?.selected;
            if (isCurrentlySelected) {
                // Deselect and re-rank
                const removedRank = prev.find(f => f._id === file._id)?.selectedRank ?? 0;
                return prev.map(f => {
                    if (f._id === file._id) return { ...f, selected: false, selectedRank: 0 };
                    if (f.selected && f.selectedRank > removedRank) return { ...f, selectedRank: f.selectedRank - 1 };
                    return f;
                });
            } else {
                // Select with next rank
                const maxRank = Math.max(0, ...prev.filter(f => f.selected).map(f => f.selectedRank));
                return prev.map(f =>
                    f._id === file._id ? { ...f, selected: true, selectedRank: maxRank + 1 } : f
                );
            }
        });
    };

    const selectedFiles = files.filter(f => f.selected).sort((a, b) => a.selectedRank - b.selectedRank);

    const handleInsertSelected = () => {
        if (selectedFiles.length > 0 && onSelect) {
            onSelect(selectedFiles);
        }
    };

    const handleConfirmSelect = () => {
        if (previewFile && onSelect) {
            onSelect([{ ...previewFile, selected: true, selectedRank: 1 }]);
            setPreviewFile(null);
        }
    };

    const isLoadingRef = useRef(false);

    const handleLoadMore = useCallback(() => {
        if (hasMore && !isLoading && !isLoadingRef.current) {
            isLoadingRef.current = true;
            setCurrentPage((prev) => prev + 1);
        }
    }, [hasMore, isLoading]);


    const getFileIcon = (mimeType: string, url?: string, fileName?: string) => {
        if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
        if (isLikelyVideoFile(mimeType, url, fileName)) return <FileVideo className="w-4 h-4" />;
        return <File className="w-4 h-4" />;
    };

    const formatFileSize = (bytes: number) => (bytes / 1024).toFixed(2) + ' KB';

    return (
        <div className="w-full space-y-6 flex-1 flex flex-col min-h-0 pt-2">
            {/* Filter Bar */}
            <div className="flex flex-col gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex flex-wrap gap-3 items-end w-full">

                    {/* Search — always visible */}
                    <div className="relative flex flex-col gap-1 w-full sm:flex-[2] sm:min-w-[200px]">
                        <label className="text-xs font-medium text-muted-foreground sm:invisible select-none uppercase tracking-wider ml-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors" />
                            <Input
                                ref={searchInputRef}
                                placeholder="Search files..."
                                value={draftSearch}
                                onChange={(e) => setDraftSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && applyCurrentFilters()}
                                className="pl-10 pr-10 h-10 w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 rounded-lg transition-all"
                            />
                            {draftSearch && (
                                <button
                                    type="button"
                                    onClick={() => { setDraftSearch(""); setAppliedSearch(""); setCurrentPage(1); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    {isAdvancedOpen && (
                        <>
                            {/* Author — 1/2 width on mobile */}
                            <div className="relative flex flex-col gap-1 w-[calc(50%-6px)] sm:flex-1 sm:min-w-[200px]">
                                <label className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider ml-1">Author</label>
                                <div className="relative">
                                    <Combobox
                                        value={draftAuthor}
                                        onChange={setDraftAuthor}
                                        onSearch={handleAuthorSearch}
                                        options={[
                                            { value: "all", label: "All Authors" },
                                            ...(draftAuthor !== "all" && !authors.some(a => (a.id || (a as any)._id) === draftAuthor)
                                                ? [{ value: draftAuthor, label: "Selected Author" }]
                                                : []),
                                            ...authors.map((a) => ({
                                                value: a.id || (a as any)._id,
                                                label: a.name || a.email || (a as any).username || "Unknown"
                                            })),
                                        ]}
                                        placeholder="All Authors"
                                        searchPlaceholder="Search author..."
                                        className="w-full"
                                    />
                                    {draftAuthor !== "all" && (
                                        <button
                                            type="button"
                                            onClick={() => { setDraftAuthor("all"); setAppliedAuthor("all"); setCurrentPage(1); }}
                                            className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* File Type — 1/2 width on mobile */}
                            <div className="relative flex flex-col gap-1 w-[calc(50%-6px)] sm:flex-1 sm:min-w-[140px]">
                                <label className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider ml-1">Type</label>
                                <div className="relative">
                                    <Select value={draftType} onValueChange={(val) => setDraftType(val as any)}>
                                        <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10 rounded-lg pr-16 relative [&>svg]:absolute [&>svg]:right-2">
                                            <SelectValue placeholder="All Files" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all" disabled={allowedTypes !== 'all'}>All Files</SelectItem>
                                            <SelectItem value="image" disabled={allowedTypes !== 'all' && allowedTypes !== 'image'}>Images</SelectItem>
                                            <SelectItem value="video" disabled={allowedTypes !== 'all' && allowedTypes !== 'video'}>Videos</SelectItem>
                                            <SelectItem value="shorts" disabled={allowedTypes !== 'all' && allowedTypes !== 'shorts'}>Shorts (Portrait)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {draftType !== "all" && (
                                        <button
                                            type="button"
                                            onClick={() => { setDraftType("all"); setAppliedType("all"); setCurrentPage(1); }}
                                            className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Orientation — 1/2 width on mobile */}
                            <div className="relative flex flex-col gap-1 w-[calc(50%-6px)] sm:flex-1 sm:min-w-[140px]">
                                <label className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider ml-1">Orientation</label>
                                <div className="relative">
                                    <Select value={draftOrientation} onValueChange={(val) => setDraftOrientation(val as any)}>
                                        <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10 rounded-lg pr-16 relative [&>svg]:absolute [&>svg]:right-2">
                                            <SelectValue placeholder="All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            <SelectItem value="landscape">Landscape</SelectItem>
                                            <SelectItem value="portrait">Portrait</SelectItem>
                                            <SelectItem value="square">Square</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {draftOrientation !== "all" && (
                                        <button
                                            type="button"
                                            onClick={() => { setDraftOrientation("all"); setAppliedOrientation("all"); setCurrentPage(1); }}
                                            className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Date Picker — full width on mobile */}
                            <div className="relative flex flex-col gap-1 w-full sm:min-w-[210px] sm:w-auto">
                                <label className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider ml-1">Date Range</label>
                                <DateRangePicker
                                    ref={datePickerRef}
                                    onRangeChange={(range, preset) => {
                                        if (range) {
                                            setDraftStartDate(range.start);
                                            setDraftEndDate(range.end);
                                            setDraftPreset(preset);
                                        } else {
                                            setDraftStartDate('');
                                            setDraftEndDate('');
                                            setDraftPreset(null);
                                            setAppliedStartDate('');
                                            setAppliedEndDate('');
                                            setAppliedPreset(null);
                                            setCurrentPage(1);
                                        }
                                    }}
                                    initialRange={draftStartDate && draftEndDate ? { start: draftStartDate, end: draftEndDate } : undefined}
                                    initialPreset={draftPreset}
                                    placeholder="Select dates"
                                />
                            </div>
                        </>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className={`h-10 px-3 gap-1 shrink-0 ${isAdvancedOpen ? "bg-secondary" : ""}`}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            Advanced
                            {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>

                        <Button
                            onClick={applyCurrentFilters}
                            className="h-10 px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shrink-0"
                            disabled={!hasActiveDraftFilters && !hasAppliedFilters}
                        >
                            <SlidersHorizontal className="h-4 w-4 shrink-0" />
                            Apply Filter
                        </Button>

                        {hasAppliedFilters && (
                            <Button
                                variant="ghost"
                                onClick={handleClearAll}
                                size="sm"
                                className="h-10 px-3 gap-1 bg-secondary shrink-0"
                            >
                                <X className="h-4 w-4" />
                                Clear
                            </Button>
                        )}
                    </div>

                </div>
            </div>

            {/* Total Media Found */}
            <div className="flex items-center gap-2 px-1">
                <span className="text-sm text-muted-foreground uppercase tracking-wider">
                    Total {appliedType === 'all' ? 'media' : appliedType === 'image' ? 'images' : 'videos'} found ({new Intl.NumberFormat('en-IN').format(total)})
                </span>
                <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800" />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">
                <div className="col-span-1 flex-1 flex flex-col min-h-0">
                    {isLoading && currentPage === 1 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                            {[...Array(10)].map((_, i) => (
                                <Skeleton key={i} className="aspect-square rounded-lg" />
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto pr-2 min-h-[200px]">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                                {files.map((file) => (
                                    <div
                                        key={file._id}
                                        onClick={() => handleFileClick(file)}
                                        className={`relative group cursor-pointer aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 hover:shadow-lg ${file.selected
                                            ? 'border-primary ring-2 ring-primary/30'
                                            : 'border-transparent hover:border-primary/50'
                                            }`}
                                    >
                                        {isLikelyVideoFile(file.mimeType, file.url, file.fileName) ? (
                                            <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                                <video src={getImageUrl(file.url) ?? undefined} className="w-full h-full object-cover transition-transform group-hover:scale-105" muted />
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0">
                                                    <div className="bg-black/30 rounded-full p-2 backdrop-blur-sm"><FileVideo className="w-6 h-6 text-white" /></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <img src={getImageUrl(file.url) ?? undefined} alt={file.fileName} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {/* Checkbox */}
                                        <div
                                            className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${file.selected
                                                ? 'bg-primary border-primary text-primary-foreground'
                                                : 'bg-white/80 border-gray-400 opacity-0 group-hover:opacity-100'
                                                }`}
                                        >
                                            {file.selected && <Check className="w-4 h-4" strokeWidth={3} />}
                                        </div>
                                        {/* Selection rank badge */}
                                        {file.selected && file.selectedRank > 0 && (
                                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                {file.selectedRank}
                                            </div>
                                        )}
                                        {/* Preview button */}
                                        {multiSelect && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                                                className={`absolute top-2 bg-black/50 backdrop-blur-sm text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10 ${file.selected && file.selectedRank > 0 ? 'right-9' : 'right-2'
                                                    }`}
                                                title="Preview"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs truncate opacity-0 group-hover:opacity-100">
                                            {file.fileName}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Load More Button */}
                            {hasMore && (
                                <div className="flex justify-center py-8">
                                    <Button
                                        variant="outline"
                                        onClick={handleLoadMore}
                                        disabled={isLoading}
                                        className="gap-2 px-8 h-11 border-2 hover:bg-secondary transition-all"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Skeleton className="h-4 w-4 rounded-full animate-spin font-medium" />
                                                Loading More...
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="w-4 h-4" />
                                                Load More Media
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                            {files.length === 0 && !isLoading && (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                    <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                                    <p>No media files found matching your criteria</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Multi-select action bar */}
            {multiSelect && (
                <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-4 py-3 flex-shrink-0">
                    <span className="text-sm text-muted-foreground">
                        {selectedFiles.length > 0
                            ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                            : 'Click images to select'}
                    </span>
                    <div className="flex gap-2">
                        {selectedFiles.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFiles(prev => prev.map(f => ({ ...f, selected: false, selectedRank: 0 })))}
                            >
                                Clear
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={handleInsertSelected}
                            disabled={selectedFiles.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            Insert {selectedFiles.length > 0 ? `${selectedFiles.length} Image${selectedFiles.length > 1 ? 's' : ''}` : 'Selected'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Preview Dialog */}
            <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
                <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col p-0 overflow-hidden">
                    <div className="flex flex-col md:flex-row h-full">
                        <div className="flex-1 bg-black/5 flex items-center justify-center p-6 relative overflow-hidden">
                             {previewFile && (
                                isLikelyVideoFile(previewFile.mimeType, previewFile.url, previewFile.fileName) ? (
                                    <video src={getImageUrl(previewFile.url) ?? undefined} controls className="max-w-full max-h-full object-contain shadow-lg" />
                                ) : (
                                    <img src={getImageUrl(previewFile.url) ?? undefined} alt={previewFile.fileName} className="max-w-full max-h-full object-contain shadow-lg" />
                                )
                            )}
                        </div>
                        <div className="w-full md:w-[320px] bg-background border-l flex flex-col h-full">
                            <DialogHeader className="p-6 border-b">
                                <DialogTitle className="truncate">{previewFile?.fileName}</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="flex-1 p-6">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">File Details</h4>
                                        <dl className="space-y-3 text-sm">
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">Size</dt><dd className="col-span-2">{previewFile ? formatFileSize(previewFile.size) : '-'}</dd></div>
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">Type</dt><dd className="col-span-2 truncate">{previewFile?.mimeType}</dd></div>
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">Uploaded</dt><dd className="col-span-2">{previewFile ? new Date(previewFile.createdAt).toLocaleString() : '-'}</dd></div>
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">By</dt><dd className="col-span-2 truncate">{previewFile?.createdBy.userName}</dd></div>
                                        </dl>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Usage</h4>
                                        <div className="rounded-md bg-muted p-3 text-xs font-mono break-all">{getImageUrl(previewFile?.url) ?? ""}</div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <DialogFooter className="p-6 border-t mt-auto">
                                <Button onClick={handleConfirmSelect} className="w-full bg-purple-600 hover:bg-purple-700">Select This Image</Button>
                            </DialogFooter>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function isLikelyVideoFile(mimeType: string, url?: string, fileName?: string): boolean {
    if (mimeType?.startsWith('video/')) return true;
    const target = `${url || ""} ${fileName || ""}`.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?|$)/i.test(target);
}
