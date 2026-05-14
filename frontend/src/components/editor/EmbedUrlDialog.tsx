"use client";

import { useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmbedUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => boolean;
  title: string;
  description?: string;
  placeholder?: string;
  submitLabel?: string;
}

export function EmbedUrlDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  placeholder = "Enter URL...",
  submitLabel = "Embed",
}: EmbedUrlDialogProps) {
  const [url, setUrl] = useState("");

  // Reset URL when dialog opens
  useEffect(() => {
    if (open) {
      setUrl("");
    }
  }, [open]);

  const handleSubmit = useCallback(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    const success = onSubmit(trimmedUrl);
    if (success) {
      onOpenChange(false);
    }
  }, [url, onSubmit, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && url.trim()) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, url]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="embed-url">URL</Label>
            <Input
              id="embed-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
