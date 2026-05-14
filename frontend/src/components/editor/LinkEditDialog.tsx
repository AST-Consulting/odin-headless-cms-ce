"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link2, Type, ExternalLink } from "lucide-react";

interface LinkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUrl?: string;
  initialText?: string;
  onSubmit: (url: string, text: string) => void;
}

export function LinkEditDialog({
  open,
  onOpenChange,
  initialUrl = "",
  initialText = "",
  onSubmit,
}: LinkEditDialogProps) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setText(initialText);
    }
  }, [open, initialUrl, initialText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim(), text.trim() || url.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-6 gap-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Link2 className="h-5 w-5 text-blue-500" />
            Edit Link
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="link-url" className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
              <ExternalLink className="h-4 w-4 text-zinc-400" />
              Link URL
            </Label>
            <Input
              id="link-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-10 transition-all focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-text" className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
              <Type className="h-4 w-4 text-zinc-400" />
              Display Text
            </Label>
            <Input
              id="link-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Google"
              className="h-10 transition-all focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <DialogFooter className="pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 px-4 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 px-6 font-medium bg-blue-600 hover:bg-blue-700 transition-colors"
              disabled={!url.trim()}
            >
              Update Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
