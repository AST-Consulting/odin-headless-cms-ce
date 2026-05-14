"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, Pin, Trash2, Check, X, Zap, User, Clock, RotateCcw } from "lucide-react";
import { formatTimestamp } from "../TimestampBlock";
import type { LiveUpdate, ContentBlock, InlineContent } from "./types";
import { getUpdateText, getBlockText } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AuthorSelector } from "../../common/AuthorSelector";
import { AuthorStub } from "@/lib/types";
import { toast } from "sonner";
import { TwitterEmbed, extractTweetId } from "../TwitterEmbedBlock";
import { InstagramEmbed, extractInstagramPostId } from "../InstagramEmbedBlock";
import { YouTubeEmbed, extractYouTubeVideoId } from "../YouTubeEmbedBlock";

interface LiveTimelineProps {
  updates: LiveUpdate[];
  onEdit: (updateId: string) => void;
  onEditTime: (updateId: string, newTimestamp: string) => void;
  onEditAuthor: (updateId: string, author: AuthorStub) => void;
  onPin: (updateId: string) => void;
  onDelete: (updateId: string) => void;
  onPublish: (updateId: string) => void;
}

export function LiveTimeline({ updates, onEdit, onEditTime, onEditAuthor, onPin, onDelete, onPublish }: LiveTimelineProps) {
  const [isAuthorDialogOpen, setIsAuthorDialogOpen] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorStub[]>([]);

  const handleStartAuthorEdit = useCallback((update: LiveUpdate) => {
    setEditingUpdateId(update.id);
    setSelectedAuthor([{
      id: update.authorId,
      name: update.authorName,
      slug: update.authorSlug,
    }]);
    setIsAuthorDialogOpen(true);
  }, []);

  const handleSaveAuthor = useCallback(() => {
    if (!editingUpdateId || selectedAuthor.length === 0) return;
    onEditAuthor(editingUpdateId, selectedAuthor[0]);
    setIsAuthorDialogOpen(false);
    setEditingUpdateId(null);
  }, [editingUpdateId, selectedAuthor, onEditAuthor]);

  if (updates.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">No updates yet</p>
        <p className="text-xs text-muted-foreground/70">
          Post your first update to start the live blog
        </p>
      </div>
    );
  }

  // Display in reverse order (newest first) but keep original order in data for saving
  const displayUpdates = [...updates].reverse();

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-3">
        {displayUpdates.map((update, index) => (
          <LiveUpdateCard
            key={update.id}
            update={update}
            isLatest={index === 0}
            onEdit={onEdit}
            onEditTime={onEditTime}
            onEditAuthor={() => handleStartAuthorEdit(update)}
            onPin={onPin}
            onDelete={onDelete}
            onPublish={onPublish}
          />
        ))}
      </div>

      <Dialog open={isAuthorDialogOpen} onOpenChange={setIsAuthorDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Author</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 font-sans">
            <Label>Select Author</Label>
            <AuthorSelector
              selected={selectedAuthor}
              onChange={setSelectedAuthor}
              placeholder="Search and select author..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuthorDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAuthor}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

// --- Rich content renderers ---

function RichInlineContent({ content }: { content: InlineContent[] }) {
  if (!content || !Array.isArray(content)) return null;

  return (
    <>
      {content.map((item, i) => {
        if (item.type === "link") {
          return (
            <a
              key={i}
              href={item.href || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              {item.content ? <RichInlineContent content={item.content} /> : item.text || item.href}
            </a>
          );
        }

        // Text with styles
        let el: React.ReactNode = item.text || "";
        const styles = item.styles || {};
        if (styles.bold) el = <strong key={`b-${i}`}>{el}</strong>;
        if (styles.italic) el = <em key={`i-${i}`}>{el}</em>;
        if (styles.underline) el = <u key={`u-${i}`}>{el}</u>;
        if (styles.strike) el = <s key={`s-${i}`}>{el}</s>;
        if (styles.code)
          el = (
            <code key={`c-${i}`} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
              {el}
            </code>
          );

        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

function RichBlock({ block }: { block: ContentBlock }) {
  const { type, content, props } = block;

  // Embeds
  if (type === "twitterEmbed") {
    const url = props?.url as string;
    // Fallback to extraction if tweetId is missing (common with auto-embeds)
    const tweetId = (props?.tweetId as string) || (url ? extractTweetId(url) : "") || "";
    return url ? <TwitterEmbed url={url} tweetId={tweetId} /> : null;
  }

  if (type === "youtubeEmbed") {
    const url = props?.url as string;
    // Fallback to extraction if videoId is missing
    const videoId = (props?.videoId as string) || (url ? extractYouTubeVideoId(url) : "") || "";
    return url ? <YouTubeEmbed url={url} videoId={videoId} /> : null;
  }

  if (type === "instagramEmbed") {
    const url = props?.url as string;
    // Fallback to extraction if postId is missing
    const postId = (props?.postId as string) || (url ? extractInstagramPostId(url) : "") || "";
    return url ? <InstagramEmbed url={url} postId={postId} /> : null;
  }

  if (type === "soundcloudEmbed") {
    const url = props?.url as string;
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs text-primary underline truncate"
      >
        🎵 {url}
      </a>
    ) : null;
  }

  if (type === "snapchatEmbed") {
    const url = props?.url as string;
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs text-primary underline truncate"
      >
        👻 {url}
      </a>
    ) : null;
  }

  // Image
  if (type === "image") {
    const url = props?.url as string;
    if (!url) return null;
    const caption = props?.caption as string;
    return (
      <figure>
        <img
          src={url}
          alt={(props?.alt as string) || ""}
          className="rounded-md max-h-48 object-cover w-full"
        />
        {caption && (
          <figcaption className="text-xs text-muted-foreground mt-1">{caption}</figcaption>
        )}
      </figure>
    );
  }

  // Video
  if (type === "video") {
    const url = (props?.url || props?.src) as string;
    if (!url) return null;
    return <video src={url} controls className="rounded-md max-h-48 w-full" />;
  }

  // No text content for remaining types
  const text = getBlockText(content);
  if (!text && type !== "table") return null;

  // Heading
  if (type === "heading") {
    const level = props?.level as number;
    const className =
      level === 1
        ? "text-base font-bold leading-snug"
        : level === 2
          ? "text-sm font-bold leading-snug"
          : "text-sm font-semibold leading-snug";
    return (
      <div className={className}>
        <RichInlineContent content={content} />
      </div>
    );
  }

  // Bullet list item
  if (type === "bulletListItem") {
    return (
      <div className="flex gap-1.5 text-sm leading-relaxed text-foreground/90">
        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground/40 shrink-0" />
        <span>
          <RichInlineContent content={content} />
        </span>
      </div>
    );
  }

  // Numbered list item
  if (type === "numberedListItem") {
    return (
      <div className="flex gap-1.5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
        <span className="text-muted-foreground shrink-0 font-mono">#.</span>
        <span>
          <RichInlineContent content={content} />
        </span>
      </div>
    );
  }

  // Check list item
  if (type === "checkListItem") {
    const checked = props?.checked as boolean;
    return (
      <div className="flex gap-1.5 text-sm leading-relaxed text-foreground/90">
        <span className="shrink-0">{checked ? "☑" : "☐"}</span>
        <span className={checked ? "line-through text-muted-foreground" : ""}>
          <RichInlineContent content={content} />
        </span>
      </div>
    );
  }

  // Blockquote
  if (type === "quote") {
    return (
      <blockquote className="border-l-2 border-primary/30 pl-3 text-sm italic text-foreground/80 leading-relaxed whitespace-pre-wrap">
        <RichInlineContent content={content} />
      </blockquote>
    );
  }

  // Code block
  if (type === "codeBlock") {
    return (
      <pre className="bg-muted rounded-md p-2 text-xs font-mono overflow-x-auto">
        <code>{text}</code>
      </pre>
    );
  }

  // Divider
  if (type === "divider") {
    return <hr className="border-border my-1" />;
  }

  // Default paragraph
  return (
    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
      <RichInlineContent content={content} />
    </p>
  );
}

// --- LiveUpdateCard (inline, only used by LiveTimeline) ---

interface LiveUpdateCardProps {
  update: LiveUpdate;
  isLatest: boolean;
  onEdit: (updateId: string) => void;
  onEditTime: (updateId: string, newTimestamp: string) => void;
  onEditAuthor: () => void;
  onPin: (updateId: string) => void;
  onDelete: (updateId: string) => void;
  onPublish: (updateId: string) => void;
}

function LiveUpdateCard({
  update,
  isLatest,
  onEdit,
  onEditTime,
  onEditAuthor,
  onPin,
  onDelete,
  onPublish,
}: LiveUpdateCardProps) {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editDay, setEditDay] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editHour, setEditHour] = useState("");
  const [editMinute, setEditMinute] = useState("");
  const [editPeriod, setEditPeriod] = useState<"AM" | "PM">("AM");

  const formattedTime = formatTimestamp(new Date(update.timestamp));

  const handleStartEdit = useCallback(() => {
    onEdit(update.id);
  }, [onEdit, update.id]);

  const handleStartEditTime = useCallback(() => {
    const date = new Date(update.timestamp);
    setEditDay(date.getDate().toString().padStart(2, "0"));
    setEditMonth((date.getMonth() + 1).toString().padStart(2, "0"));
    setEditYear(date.getFullYear().toString());
    const hours = date.getHours();
    const isPM = hours >= 12;
    setEditHour((hours % 12 || 12).toString());
    setEditMinute(date.getMinutes().toString().padStart(2, "0"));
    setEditPeriod(isPM ? "PM" : "AM");
    setIsEditingTime(true);
  }, [update.timestamp]);

  const handleSaveTime = useCallback(() => {
    const day = parseInt(editDay);
    const month = parseInt(editMonth);
    const year = parseInt(editYear);
    let hour = parseInt(editHour) || 12;
    const minute = parseInt(editMinute) || 0;

    if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12) {
      setIsEditingTime(false);
      return;
    }

    if (editPeriod === "PM" && hour !== 12) hour += 12;
    else if (editPeriod === "AM" && hour === 12) hour = 0;

    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    onEditTime(update.id, date.toISOString());
    setIsEditingTime(false);
  }, [editDay, editMonth, editYear, editHour, editMinute, editPeriod, onEditTime, update.id]);

  const handleCancelTimeEdit = useCallback(() => {
    setIsEditingTime(false);
  }, []);

  return (
    <div
      className={`group relative rounded-lg border bg-card transition-all ${isLatest ? "animate-in slide-in-from-top-2 fade-in duration-300" : ""
        } ${update.isAlert ? "border-l-4 border-l-red-500" : ""} ${update.isPinned ? "ring-1 ring-amber-200 dark:ring-amber-800" : ""
        } ${update.status === 'deleted' ? 'opacity-70 bg-muted/30' : ''}`}
    >
      {/* Header: timestamp + author + badges */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        {isEditingTime ? (
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              <input
                type="text"
                value={editDay}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setEditDay(v);
                }}
                className="h-6 w-7 text-xs border rounded px-0.5 bg-background text-center"
                placeholder="DD"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTime();
                  }
                  if (e.key === "Escape") handleCancelTimeEdit();
                }}
              />
              <span className="text-xs text-muted-foreground">/</span>
              <input
                type="text"
                value={editMonth}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setEditMonth(v);
                }}
                className="h-6 w-7 text-xs border rounded px-0.5 bg-background text-center"
                placeholder="MM"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTime();
                  }
                  if (e.key === "Escape") handleCancelTimeEdit();
                }}
              />
              <span className="text-xs text-muted-foreground">/</span>
              <input
                type="text"
                value={editYear}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setEditYear(v);
                }}
                className="h-6 w-12 text-xs border rounded px-0.5 bg-background text-center"
                placeholder="YYYY"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTime();
                  }
                  if (e.key === "Escape") handleCancelTimeEdit();
                }}
              />
            </div>
            <div className="flex items-center gap-0.5">
              <input
                type="text"
                value={editHour}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  const n = parseInt(v);
                  if (v === "" || (n >= 1 && n <= 12)) setEditHour(v);
                }}
                className="h-6 w-7 text-xs border rounded px-0.5 bg-background text-center"
                placeholder="HH"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTime();
                  }
                  if (e.key === "Escape") handleCancelTimeEdit();
                }}
              />
              <span className="text-xs font-bold">:</span>
              <input
                type="text"
                value={editMinute}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                  const n = parseInt(v);
                  if (v === "" || (n >= 0 && n <= 59)) setEditMinute(v);
                }}
                className="h-6 w-7 text-xs border rounded px-0.5 bg-background text-center"
                placeholder="MM"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTime();
                  }
                  if (e.key === "Escape") handleCancelTimeEdit();
                }}
              />
              <button
                type="button"
                onClick={() => setEditPeriod(editPeriod === "AM" ? "PM" : "AM")}
                className="h-6 px-1 text-[10px] font-semibold border rounded bg-muted hover:bg-muted/80 transition-colors"
              >
                {editPeriod}
              </button>
            </div>
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={handleSaveTime}>
              <Check className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0"
              onClick={handleCancelTimeEdit}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <button
            onClick={handleStartEditTime}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            title="Click to edit time"
          >
            {formattedTime}
          </button>
        )}
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <User className="w-3 h-3" />
          {update.authorName}
          <button
            onClick={onEditAuthor}
            className="hover:text-foreground transition-colors p-0.5"
            title="Edit author"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
        </span>
        <div className="flex items-center gap-1 ml-auto">
          {update.isAlert && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-semibold">
              BREAKING
            </Badge>
          )}
          {update.isPinned && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              <Pin className="w-2.5 h-2.5 mr-0.5 fill-current" />
              KEY
            </Badge>
          )}
          {update.status && (
            <Badge variant="outline" className={`h-4 px-1.5 text-[10px] uppercase ${
              update.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 
              update.status === 'deleted' ? 'bg-red-50 text-red-700 border-red-200' : ''}`}>
              {update.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-2">
        <div className="space-y-1.5">
          {update.contentBlocks.map((block) => (
            <RichBlock key={block.id} block={block} />
          ))}
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-0.5 px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleStartEdit}
              >
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Edit this update</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleStartEditTime}
                disabled={update.status === 'deleted'}
              >
                <Clock className="w-3 h-3" /> Time
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Edit timestamp</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-2 text-xs gap-1 ${update.isPinned
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
                onClick={() => onPin(update.id)}
                disabled={update.status === 'deleted'}
              >
                <Pin className={`w-3 h-3 ${update.isPinned ? "fill-current" : ""}`} />
                {update.isPinned ? "Unpin" : "Pin"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {update.isPinned ? "Remove from Key Points" : "Add to Key Points"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              {update.status === 'deleted' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 text-green-600 hover:text-green-700"
                  onClick={() => onPublish(update.id)}
                >
                  <RotateCcw className="w-3 h-3" /> Publish
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(update.id)}
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {update.status === 'deleted' ? 'Restore this update' : 'Delete this update'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
