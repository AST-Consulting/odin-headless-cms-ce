"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MediaPicker } from "@/components/media-gallery/MediaPicker";
import { uploadFiles } from "@/lib/api";
import { ContentTypeField, MediaFile, MediaRef } from "@/lib/types";
import { getImageUrl } from "@/lib/utils";
import { usePropertyStore } from "@/lib/store";
import { useToast } from "@/components/ui/use-toast";
import { Image as ImageIcon, Upload, X, Eye, Copy, Check } from "lucide-react";

interface Props {
  field: ContentTypeField;
  /** Stored as MediaRef or MediaRef[] in entry data */
  value: MediaRef | MediaRef[] | null;
  onChange: (val: MediaRef | MediaRef[] | null) => void;
}

export function MediaFieldInput({ field, value, onChange }: Props) {
  const isMultiple = !!field.mediaMultiple;
  const { toast } = useToast();
  const selectedProperty = usePropertyStore(s => s.selectedProperty);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState<MediaRef | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "URL copied to clipboard" });
  };

  const current: MediaRef[] = isMultiple
    ? (Array.isArray(value) ? value : value ? [value as MediaRef] : [])
    : (value && !Array.isArray(value) ? [value] : Array.isArray(value) && value.length ? [value[0]] : []);

  const toRef = (m: MediaFile): MediaRef => ({
    id: m._id,
    url: m.url,
    path: m.path,
    fileName: m.fileName,
    mimeType: m.mimeType,
  });

  const handlePickerSelect = (selected: (MediaFile & { selected: boolean; selectedRank: number })[]) => {
    const sorted = selected.sort((a, b) => a.selectedRank - b.selectedRank).map(toRef);

    if (isMultiple) {
      const existing = current.filter(r => !sorted.find(s => s.id === r.id));
      const merged = [...existing, ...sorted];
      onChange(merged.length ? merged : null);
    } else {
      onChange(sorted[0] ?? null);
    }
    setPickerOpen(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await uploadFiles(files, false, "content-manager", undefined, selectedProperty?._id);
      const refs = uploaded.map(toRef);

      if (isMultiple) {
        const merged = [...current, ...refs];
        onChange(merged.length ? merged : null);
      } else {
        onChange(refs[0] ?? null);
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (id: string) => {
    if (isMultiple) {
      const next = current.filter(r => r.id !== id);
      onChange(next.length ? next : null);
    } else {
      onChange(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Thumbnails */}
      {current.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {current.map(ref => (
            <div
              key={ref.id}
              className="relative group w-24 h-24 rounded-lg overflow-hidden border bg-muted flex-shrink-0"
            >
              {ref.mimeType?.startsWith("video/") ? (
                <video src={getImageUrl(ref.url) ?? undefined} className="w-full h-full object-cover" muted />
              ) : (
                <img src={getImageUrl(ref.url) ?? undefined} alt={ref.fileName} className="w-full h-full object-cover" />
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreview(ref)}
                  className="p-1 rounded bg-white/20 hover:bg-white/40 text-white"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(ref.id)}
                  className="p-1 rounded bg-white/20 hover:bg-red-500/80 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {ref.fileName && (
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-white text-[10px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {ref.fileName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {(isMultiple || current.length === 0) && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setPickerOpen(true)}>
            <ImageIcon className="h-3.5 w-3.5" /> Browse Gallery
          </Button>
          <Button
            type="button" variant="outline" size="sm" className="gap-2"
            disabled={uploading} onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={fileInputRef} type="file" className="hidden"
            multiple={isMultiple}
            accept={field.mediaAllowedTypes?.length ? field.mediaAllowedTypes.map(t => `${t}/*`).join(",") : "image/*,video/*"}
            onChange={handleUpload}
          />
        </div>
      )}

      {/* Replace button for single */}
      {!isMultiple && current.length > 0 && (
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setPickerOpen(true)}>
            Replace
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading…" : "Upload new"}
          </Button>
          <input
            ref={fileInputRef} type="file" className="hidden"
            accept={field.mediaAllowedTypes?.length ? field.mediaAllowedTypes.map(t => `${t}/*`).join(",") : "image/*,video/*"}
            onChange={handleUpload}
          />
        </div>
      )}

      {/* Gallery picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle>{isMultiple ? "Select Media (multiple)" : "Select Media"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 py-4">
            <MediaPicker
              multiSelect={isMultiple}
              onSelect={handlePickerSelect}
              allowedTypes={
                field.mediaAllowedTypes?.includes("image") ? "image"
                  : field.mediaAllowedTypes?.includes("video") ? "video"
                  : "all"
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={open => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.fileName}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted rounded-lg overflow-hidden max-h-[60vh]">
            {preview?.mimeType?.startsWith("video/") ? (
              <video src={getImageUrl(preview.url) ?? undefined} controls className="max-w-full max-h-[60vh] object-contain" />
            ) : preview ? (
              <img src={getImageUrl(preview.url) ?? undefined} alt={preview.fileName} className="max-w-full max-h-[60vh] object-contain" />
            ) : null}
          </div>
          {preview && (
            <div className="text-xs text-muted-foreground space-y-2 font-mono">
              <div className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded border">
                <div className="break-all text-blue-500 overflow-hidden">
                  <span className="text-muted-foreground mr-1">URL:</span>
                  {getImageUrl(preview.url)}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 shrink-0" 
                  onClick={() => handleCopy(getImageUrl(preview.url) || "")}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="px-2 opacity-70">id: {preview.id}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
