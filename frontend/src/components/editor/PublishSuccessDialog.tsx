"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Copy, Check, Facebook, Twitter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface PublishSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleTitle: string;
  articleUrl: string;
}

export function PublishSuccessDialog({
  open,
  onOpenChange,
  articleTitle,
  articleUrl,
}: PublishSuccessDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyLink = () => {
    if (!articleUrl) return;
    navigator.clipboard.writeText(articleUrl);
    setCopied(true);
    toast({
      title: "Success",
      description: "Link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewArticle = () => {
    if (!articleUrl) return;
    window.open(articleUrl, "_blank", "noopener,noreferrer");
  };

  const shareLinks = [
    {
      name: "WhatsApp",
      icon: WhatsAppIcon,
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(articleTitle + " " + articleUrl)}`,
      color: "hover:bg-[#25D366]/10 hover:text-[#25D366]",
    },
    {
      name: "Facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`,
      color: "hover:bg-[#1877F2]/10 hover:text-[#1877F2]",
    },
    {
      name: "X (Twitter)",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(articleTitle)}`,
      color: "hover:bg-foreground/10 hover:text-foreground",
    }
  ];

  const handleShare = async (name: string, linkUrl: string | null) => {
    if (name === "Instagram") {
      if (navigator.share) {
        try {
          await navigator.share({
            title: articleTitle,
            text: `Check out this article: ${articleTitle}`,
            url: articleUrl,
          });
          return;
        } catch (err) {
          // If cancelled or failed, fall through to window.open
        }
      }
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      return;
    }

    if (linkUrl) {
      window.open(linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl dark:bg-zinc-950 block">
        {/* Header with Gradient */}
        <div className="w-full bg-gradient-to-b from-blue-600/15 to-transparent p-6 sm:p-8 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-600/20 blur-2xl rounded-full" />
            <div className="relative w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
              <CheckCircle2 className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          <div className="space-y-2">
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
              Published Successfully!
            </DialogTitle>
            <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
              Your article is now live and available to your readers.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 pb-8 sm:px-8 space-y-6">
          <div className="w-full bg-muted/30 rounded-xl p-4 border border-border/50 space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">
              Article Title
            </p>
            <p className="text-sm sm:text-base font-medium text-foreground text-left line-clamp-2 leading-relaxed">
              {articleTitle || "Untitled Article"}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Share this article
              </p>
              <div className="flex flex-wrap gap-2 align-center justify-center">
                {shareLinks.map((link) => (
                  <Button
                    key={link.name}
                    variant="outline"
                    size="icon"
                    className={`h-10 w-10 border-border/50 transition-all duration-300 rounded-md ${link.color}`}
                    onClick={() => handleShare(link.name, link.url)}
                    title={`Share on ${link.name}`}
                  >
                    <link.icon className="h-5 w-5" />
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 border-border/50 hover:bg-blue-600/10 hover:text-blue-600 transition-all duration-300 rounded-md"
                  onClick={handleCopyLink}
                  title="Copy Link"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                className="w-full h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all duration-300"
                onClick={handleViewArticle}
                disabled={!articleUrl}
              >
                <ExternalLink className="h-4 w-4" />
                View Article
              </Button>
              <Button
                variant="ghost"
                className="w-full h-10 text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
