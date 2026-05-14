import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getMediaFiles } from '@/lib/api';
import { MediaFile, UserData } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Image as ImageIcon, FileVideo, File, X, ChevronDown, ChevronUp, SlidersHorizontal, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { usePropertyStore } from '@/lib/store';
import { getImageUrl } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { FilterBar } from '@/components/common/FilterBar';
import { DateRangePicker, DateRangePickerHandle } from '@/components/ui/date-range-picker';
import { AuthorSelector } from '@/components/common/AuthorSelector';
import { AuthorStub } from '@/lib/types';

interface MediaFileWithSelection extends MediaFile {
    selected: boolean;
    selectedRank: number;
}


interface MediaGalleryProps {
    onTotalChange?: (total: number) => void;
    onUnfilteredTotalChange?: (total: number) => void;
    isModal?: boolean;
    multiSelect?: boolean;
    onSelect?: (files: MediaFileWithSelection[]) => void;
    prependedFiles?: MediaFile[];
}

export function MediaGallery({
    onTotalChange,
    onUnfilteredTotalChange,
    isModal = false,
    multiSelect = true,
    onSelect,
    prependedFiles
}: MediaGalleryProps = {}): JSX.Element {
    const [files, setFiles] = useState<MediaFileWithSelection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [unfilteredTotal, setUnfilteredTotal] = useState(0);

    useEffect(() => {
        if (onTotalChange) {
            onTotalChange(total);
        }
    }, [total, onTotalChange]);

    useEffect(() => {
        if (onUnfilteredTotalChange) {
            onUnfilteredTotalChange(unfilteredTotal);
        }
    }, [unfilteredTotal, onUnfilteredTotalChange]);

    const [hasMore, setHasMore] = useState(true);
    const [previewFile, setPreviewFile] = useState<MediaFileWithSelection | null>(null);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const selectedProperty = usePropertyStore((state) => state.selectedProperty);
    const [selectedAuthors, setSelectedAuthors] = useState<AuthorStub[]>([]);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const datePickerRef = useRef<DateRangePickerHandle>(null);

    // Draft filter states
    const [draftSearch, setDraftSearch] = useState('');
    const [draftType, setDraftType] = useState<string>('all');
    const [draftAuthor, setDraftAuthor] = useState<string>('all');
    const [draftStartDate, setDraftStartDate] = useState<string>('');
    const [draftEndDate, setDraftEndDate] = useState<string>('');
    const [draftPreset, setDraftPreset] = useState<string | null>(null);

    // Applied filter states
    const [appliedSearch, setAppliedSearch] = useState('');
    const [appliedType, setAppliedType] = useState<string>('all');
    const [appliedAuthor, setAppliedAuthor] = useState<string>('all');
    const [appliedStartDate, setAppliedStartDate] = useState<string>('');
    const [appliedEndDate, setAppliedEndDate] = useState<string>('');
    const [appliedPreset, setAppliedPreset] = useState<string | null>(null);

    // Initialize from URL
    useEffect(() => {
        const search = searchParams.get('search') || '';
        const type = searchParams.get('type') || 'all';
        const author = searchParams.get('author') || 'all';
        const start = searchParams.get('startDate') || '';
        const end = searchParams.get('endDate') || '';
        const preset = searchParams.get('preset') || null;

        setDraftSearch(search);
        setDraftType(type);
        setDraftAuthor(author);
        setDraftStartDate(start);
        setDraftEndDate(end);
        setDraftPreset(preset);

        setAppliedSearch(search);
        setAppliedType(type);
        setAppliedAuthor(author);
        setAppliedStartDate(start);
        setAppliedEndDate(end);
        setAppliedPreset(preset);
    }, [searchParams]);



    useEffect(() => {
        if (selectedAuthors.length > 0) {
            setDraftAuthor(selectedAuthors[0].id);
        } else {
            setDraftAuthor('all');
        }
    }, [selectedAuthors]);

    useEffect(() => {
        if (draftAuthor === 'all') {
            setSelectedAuthors([]);
        }
    }, [draftAuthor]);

    useEffect(() => {
        setIsCopied(false);
    }, [previewFile]);

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
            if (appliedType !== 'all') params.mimeType = `${appliedType}/*`;
            if (appliedAuthor !== 'all') params.author = appliedAuthor;

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
            setHasMore(currentPage < response.pageCount);
        } catch (error) {
            console.error('Failed to fetch files:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, appliedSearch, appliedType, appliedAuthor, appliedStartDate, appliedEndDate, selectedProperty?._id]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    useEffect(() => {
        if (!prependedFiles || prependedFiles.length === 0) return;
        let addedCount = 0;
        setFiles((prev) => {
            const existingIds = new Set(prev.map((f) => f._id));
            const toAdd = prependedFiles
                .filter((f) => !existingIds.has(f._id))
                .map((f) => ({ ...f, selected: false, selectedRank: 0 }));
            addedCount = toAdd.length;
            if (toAdd.length === 0) return prev;
            return [...toAdd, ...prev];
        });
        if (addedCount > 0) {
            setUnfilteredTotal((prev) => prev + addedCount);
            setTotal((prev) => prev + addedCount);
        }
    }, [prependedFiles]);

    // Fetch absolute total once
    useEffect(() => {
        const fetchAbsoluteTotal = async () => {
            if (!selectedProperty?._id) return;
            try {
                const response = await getMediaFiles({
                    isPrivate: false,
                    limit: 1,
                    propertyId: selectedProperty._id,
                });
                setUnfilteredTotal(response.total);
            } catch (error) {
                console.error('Failed to fetch absolute total:', error);
            }
        };
        fetchAbsoluteTotal();
    }, [selectedProperty?._id]);

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (appliedSearch) params.set('search', appliedSearch);
        if (appliedType !== 'all') params.set('type', appliedType);
        if (appliedAuthor !== 'all') params.set('author', appliedAuthor);
        if (appliedStartDate) params.set('startDate', appliedStartDate);
        if (appliedEndDate) params.set('endDate', appliedEndDate);
        if (appliedPreset) params.set('preset', appliedPreset);

        const queryString = params.toString();
        const newPath = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(newPath);
    }, [appliedSearch, appliedType, appliedAuthor, appliedStartDate, appliedEndDate, appliedPreset, pathname, router]);

    const applyCurrentFilters = useCallback(() => {
        setAppliedSearch(draftSearch);
        setAppliedType(draftType);
        setAppliedAuthor(draftAuthor);
        setAppliedStartDate(draftStartDate);
        setAppliedEndDate(draftEndDate);
        setAppliedPreset(draftPreset);
        setCurrentPage(1);
    }, [draftSearch, draftType, draftAuthor, draftStartDate, draftEndDate, draftPreset]);

    const handleClearAll = () => {
        setDraftSearch('');
        setDraftType('all');
        setDraftAuthor('all');
        setDraftStartDate('');
        setDraftEndDate('');
        setDraftPreset(null);
        setAppliedSearch('');
        setAppliedType('all');
        setAppliedAuthor('all');
        setAppliedStartDate('');
        setAppliedEndDate('');
        setAppliedPreset(null);
        setCurrentPage(1);
        datePickerRef.current?.clear();
    };

    const hasActiveDraftFilters = !!(
        draftSearch ||
        draftType !== 'all' ||
        draftAuthor !== 'all' ||
        draftStartDate ||
        draftEndDate
    );

    const hasAppliedFilters = !!(
        appliedSearch ||
        appliedType !== 'all' ||
        appliedAuthor !== 'all' ||
        appliedStartDate ||
        appliedEndDate
    );

    const hasActiveFilters = hasAppliedFilters; // for compatibility with existing code

    const handleFileClick = (file: MediaFileWithSelection) => {
        if (isModal) {
            setFiles((prev) => {
                const updated = prev.map((f) => {
                    if (f._id === file._id) {
                        const newSelected = !f.selected;
                        if (!multiSelect && newSelected) {
                            // Clear other selections if single select
                            return { ...f, selected: true };
                        }
                        return { ...f, selected: newSelected };
                    }
                    if (!multiSelect) return { ...f, selected: false };
                    return f;
                });
                return updated;
            });
        } else {
            setPreviewFile(file);
        }
    };

    const handleSelectConfirm = () => {
        const selected = files.filter(f => f.selected);
        onSelect?.(selected);
    };

    const handleLoadMore = useCallback(() => {
        if (hasMore && !isLoading) setCurrentPage((prev) => prev + 1);
    }, [hasMore, isLoading]);

    // Infinite scroll — auto-load when sentinel enters viewport
    const sentinelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    handleLoadMore();
                }
            },
            { rootMargin: "200px" }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [handleLoadMore]);

    const getFileIcon = (mimeType: string, url?: string, fileName?: string) => {
        if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
        if (isLikelyVideoFile(mimeType, url, fileName)) return <FileVideo className="w-4 h-4" />;
        return <File className="w-4 h-4" />;
    };

    const formatFileSize = (bytes: number) => (bytes / 1024).toFixed(2) + ' KB';

    return (
        <div className="w-full space-y-6">
            <FilterBar onClear={handleClearAll} showClear={false}>
                <div className="flex flex-col gap-3 w-full">
                    <div className="flex flex-wrap gap-3 items-end w-full">

                        {/* Search — always visible */}
                        <div className="relative flex flex-col gap-1 flex-[2] min-w-[200px]">
                            <label className="text-xs font-medium text-muted-foreground invisible select-none">Search</label>
                            <div className="relative">
                                <Input
                                    placeholder="Search files..."
                                    value={draftSearch}
                                    onChange={(e) => setDraftSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && applyCurrentFilters()}
                                    className="w-full pr-8"
                                />
                                {draftSearch && (
                                    <button
                                        type="button"
                                        onClick={() => { setDraftSearch(""); setAppliedSearch(""); setCurrentPage(1); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* File Type — hidden on mobile unless expanded */}
                        <div className={`relative flex-col gap-1 flex-1 min-w-[140px] ${isAdvancedOpen ? "flex" : "hidden sm:flex"}`}>
                            <label className="text-xs font-medium text-muted-foreground invisible select-none">Type</label>
                            <div className="relative">
                                <Select value={draftType} onValueChange={setDraftType}>
                                    <SelectTrigger className="w-full pr-16 relative [&>svg]:absolute [&>svg]:right-2">
                                        <SelectValue placeholder="File Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Files</SelectItem>
                                        <SelectItem value="image">Images</SelectItem>
                                        <SelectItem value="video">Videos</SelectItem>
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

                        {/* Author — hidden on mobile unless expanded */}
                        <div className={`relative flex-col gap-1 flex-1 min-w-[200px] ${isAdvancedOpen ? "flex" : "hidden sm:flex"}`}>
                            <label className="text-xs font-medium text-muted-foreground invisible select-none">Author</label>
                            <AuthorSelector
                                selected={selectedAuthors}
                                onChange={setSelectedAuthors}
                                placeholder="All Authors"
                            />
                        </div>

                        {/* Date Picker — hidden on mobile unless expanded */}
                        <div className={`relative flex-col gap-1 min-w-[210px] ${isAdvancedOpen ? "flex" : "hidden sm:flex"}`}>
                            <label className="text-xs font-medium text-muted-foreground invisible select-none">Date Range</label>
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

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                            <Button
                                variant="outline"
                                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                className={`sm:hidden h-10 px-3 gap-1 shrink-0 ${isAdvancedOpen ? "bg-secondary" : ""}`}
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
            </FilterBar>

            {hasAppliedFilters && (
                <div className="flex items-center px-1">
                    <div className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {total.toLocaleString()} Media Items Found
                    </div>
                </div>
            )}

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 gap-6">
                <div className="col-span-1">
                    {isLoading && currentPage === 1 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                            {[...Array(10)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                                {files.map((file) => (
                                    <div
                                        key={file._id}
                                        onClick={() => handleFileClick(file)}
                                        className={`relative group cursor-pointer aspect-square rounded-lg overflow-hidden border transition-all duration-200 hover:border-primary/50 hover:shadow-lg ${file.selected ? 'ring-4 ring-purple-500 border-purple-500' : ''
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
                                        {file.selected && (
                                            <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1 shadow-md z-10">
                                                <X className="w-4 h-4 rotate-45" /> {/* Use plus icon or similar? Lucide check is better */}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 transition-opacity" />
                                        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white rounded-full p-2 opacity-100">
                                            {getFileIcon(file.mimeType, file.url, file.fileName)}
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-2 text-white opacity-100 flex flex-col gap-0.5">
                                            <span className="text-xs font-medium break-all line-clamp-1">{file.fileName}</span>
                                            <span className="text-[10px] opacity-80">
                                                {new Date(file.createdAt).toLocaleString(undefined, {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Infinite scroll sentinel */}
                            {hasMore && (
                                <div ref={sentinelRef} className="flex justify-center py-6">
                                    {isLoading && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Skeleton className="h-4 w-4 rounded-full animate-spin" />
                                            Loading more...
                                        </div>
                                    )}
                                </div>
                            )}

                            {isModal && (
                                <div className="sticky bottom-0 p-4 bg-background border-t flex justify-end gap-3 z-20">
                                    <Button variant="outline" onClick={() => onSelect?.([])}>Cancel</Button>
                                    <Button
                                        onClick={handleSelectConfirm}
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                        disabled={!files.some(f => f.selected)}
                                    >
                                        Select {files.filter(f => f.selected).length} {files.filter(f => f.selected).length === 1 ? 'File' : 'Files'}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                    {!isLoading && files.length === 0 && (
                        <div className="text-center py-12">
                            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
                            <h3 className="mt-4 text-lg font-medium">No media found</h3>
                            <p className="text-muted-foreground">Try adjusting your filters or upload new files.</p>
                        </div>
                    )}
                </div>
            </div >

            < Dialog open={!!previewFile
            } onOpenChange={(open) => !open && setPreviewFile(null)}>
                <DialogContent className="w-[95vw] sm:max-w-[900px] h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <div className="flex flex-col md:flex-row h-full sm:h-auto overflow-hidden">
                        <div className="w-full h-[40vh] md:h-auto md:min-h-[500px] md:flex-1 bg-black/5 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden shrink-0">
                            {previewFile && (
                                isLikelyVideoFile(previewFile.mimeType, previewFile.url, previewFile.fileName) ? (
                                    <video
                                        src={getImageUrl(previewFile.url) ?? undefined}
                                        controls
                                        className="max-w-full max-h-full object-contain shadow-lg"
                                    />
                                ) : (
                                    <img
                                        src={getImageUrl(previewFile.url) ?? undefined}
                                        alt={previewFile.fileName}
                                        className="max-w-full max-h-full object-contain shadow-lg"
                                    />
                                )
                            )}
                        </div>
                        <div className="w-full md:w-[320px] bg-background border-t md:border-t-0 md:border-l flex flex-col min-h-0 flex-1 md:flex-none">
                            <DialogHeader className="p-6 border-b">
                                <DialogTitle className="truncate">{previewFile?.fileName}</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="flex-1 p-6">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">File Details</h4>
                                        <dl className="space-y-3 text-sm">
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">Size</dt><dd className="col-span-2">{previewFile ? formatFileSize(previewFile.size) : '-'}</dd></div>
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">Dimensions</dt><dd className="col-span-2">{previewFile?.media_details?.width && previewFile?.media_details?.height ? `${previewFile.media_details.width} × ${previewFile.media_details.height}` : '-'}</dd></div>
                                            {previewFile && isLikelyVideoFile(previewFile.mimeType, previewFile.url, previewFile.fileName) && (
                                                <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">Length</dt><dd className="col-span-2">{previewFile?.media_details?.length || '-'}</dd></div>
                                            )}
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">Type</dt><dd className="col-span-2 truncate">{previewFile?.mimeType}</dd></div>
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">Uploaded</dt><dd className="col-span-2">{previewFile ? new Date(previewFile.createdAt).toLocaleString() : '-'}</dd></div>
                                            <div className="grid grid-cols-3 gap-2"><dt className="font-medium text-gray-500">By</dt><dd className="col-span-2 truncate">
                                                {(() => {
                                                    const creatorId = previewFile?.createdBy?.id || previewFile?.createdBy?.userId;
                                                    if (creatorId && creatorId !== 'undefined') {
                                                        return (
                                                            <span
                                                                className="text-blue-600 hover:underline cursor-pointer transition-colors font-medium"
                                                                onClick={() => router.push(`/users/edit/${creatorId}`)}
                                                            >
                                                                {previewFile?.createdBy.userName}
                                                            </span>
                                                        );
                                                    }
                                                    return <span className="text-muted-foreground">{previewFile?.createdBy?.userName || '-'}</span>;
                                                })()}
                                            </dd></div>
                                        </dl>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Usage</h4>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-muted"
                                                onClick={() => {
                                                    const url = getImageUrl(previewFile?.url) ?? "";
                                                    navigator.clipboard.writeText(url);
                                                    setIsCopied(true);
                                                    setTimeout(() => setIsCopied(false), 2000);
                                                    toast({
                                                        title: "Copied!",
                                                        description: "URL copied to clipboard",
                                                    });
                                                }}
                                            >
                                                {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <div className="group relative rounded-md bg-muted p-3">
                                            <a
                                                href={getImageUrl(previewFile?.url) ?? "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-mono break-all text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-2"
                                            >
                                                {getImageUrl(previewFile?.url) ?? ""}
                                                <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >
        </div >
    );
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isLikelyVideoFile(mimeType: string, url?: string, fileName?: string): boolean {
    if (mimeType?.startsWith('video/')) return true;
    const target = `${url || ""} ${fileName || ""}`.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?|$)/i.test(target);
}

function getFileIcon(mimeType: string, url?: string, fileName?: string) {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (isLikelyVideoFile(mimeType, url, fileName)) return <FileVideo className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
}
