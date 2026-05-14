"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { GripVertical, Lock, ExternalLink } from "lucide-react";
import { truncateWithEllipsis } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePropertyStore } from "@/lib/store";

interface StoryTileProps {
  id: string;
  story: any;
  isFixed?: boolean;
}

const articleTypeLabels: Record<string, string> = {
  article: "Article",
  standard: "Standard",
  liveblog: "Live Blog",
  explainer: "Explainer",
  photo_story: "Photo Story",
  video: "Video",
  shorts: "Shorts",
  web_story: "Web Story",
  opinion: "Opinion",
};

const StoryTile = ({ id, story, isFixed = false }: StoryTileProps) => {
  const router = useRouter();
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    isDragging,
  } = useSortable({
    id: id,
    data: {
      type: "item",
      storyId: story.id,
    },
  });

  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    }
    : undefined;

  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const domain = selectedProperty?.domain;
  const baseUrl = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "";
  const storyPath = story.url || story.fullSlug || "";
  const storyUrl = storyPath.startsWith("http") 
    ? storyPath 
    : (storyPath && baseUrl ? `${baseUrl}/${storyPath.startsWith("/") ? storyPath.substring(1) : storyPath}` : "#");

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/editor/${story.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing",
        isDragging
          ? "bg-muted opacity-50"
          : isFixed
            ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
            : "bg-card hover:bg-accent"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0" />
      
      <div 
        className="flex flex-col flex-1 min-w-0 py-0.5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/editor/${story.id}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 min-w-0"
          >
            <span className="text-sm font-medium text-foreground line-clamp-2 leading-tight hover:text-primary transition-colors hover:underline">
              {story.name ||
                story.title ||
                story.headline ||
                (story.testimonialText &&
                  truncateWithEllipsis(story.testimonialText, 20)) ||
                story.user?.name ||
                story.awardName ||
                "Untitled"}
            </span>
          </Link>
          <a
            href={storyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {story.type && (
            <Badge variant="outline" className="h-[18px] px-1.5 py-0 text-[10px] uppercase tracking-wider font-bold bg-muted/40 border-muted-foreground/30 text-muted-foreground/80">
              {articleTypeLabels[story.type.toLowerCase()] || story.type}
            </Badge>
          )}

          {story.primaryCategory && (
            <div className="flex items-center gap-1">
              <span className="opacity-60">in</span>
              <Link
                href={`/categories/edit/${story.primaryCategory.id || story.primaryCategory._id}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:text-primary hover:underline font-semibold transition-colors truncate max-w-[100px]"
              >
                {story.primaryCategory.title || story.primaryCategory.name}
              </Link>
            </div>
          )}

          {(story.author || (story.authors && story.authors.length > 0)) && (
            <div className="flex items-center gap-1">
              <span className="opacity-60">by</span>
              <div className="flex items-center gap-1">
                {story.author ? (
                  <Link
                    href={`/users/edit/${story.author.id || story.author._id}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="hover:text-primary hover:underline font-semibold transition-colors truncate max-w-[100px]"
                  >
                    {story.author.name}
                  </Link>
                ) : (
                  story.authors.map((author: any, idx: number) => (
                    <React.Fragment key={author.id || author._id}>
                      {idx > 0 && <span>&</span>}
                      <Link
                        href={`/users/edit/${author.id || author._id}`}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="hover:text-primary hover:underline font-semibold transition-colors truncate max-w-[100px]"
                      >
                        {author.name}
                      </Link>
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* {isFixed && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="flex items-center gap-1 cursor-help">
                <Lock className="h-3 w-3" />
                Fixed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>This article will remain in the section during automatic updates</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )} */}
    </div>
  );
};

export default StoryTile;

