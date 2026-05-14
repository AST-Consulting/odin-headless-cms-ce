"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileVideo, ExternalLink, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getVideoGenerationJobs,
  publishVideoGenerationJob,
  type VideoGenerationJobResult,
  type VideoGenerationStatus,
} from "@/lib/api";
import { usePropertyStore } from "@/lib/store";

function statusLabel(status: VideoGenerationStatus): string {
  if (status === "completed") return "Ready";
  if (status === "cancelled") return "Cancelled";
  if (status === "failed") return "Failed";
  if (status === "timeout") return "Timed out";
  if (status === "partial_failure") return "Partial";
  return "Processing";
}

function statusVariant(status: VideoGenerationStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "failed" || status === "timeout") return "destructive";
  if (status === "cancelled") return "outline";
  if (status === "partial_failure") return "secondary";
  return "outline";
}

function StatusIcon({ status }: { status: VideoGenerationStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "failed" || status === "timeout") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === "cancelled") return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === "partial_failure") return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CDN_BASE = process.env.NEXT_PUBLIC_CDN_URL || "";

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) return url;
  if (url.startsWith("/uploads")) return `${CDN_BASE}${url}`;
  if (url.startsWith("/public/") || url.startsWith("/media/")) return `${API_BASE}${url}`;
  return url;
}

function getVideoUrl(job: VideoGenerationJobResult): string | null {
  const result = job.result as Record<string, unknown> | null;
  const publishResult = job.publishResult as Record<string, unknown> | null;
  const uploadedVideo = publishResult?.uploadedVideo as Record<string, unknown> | null;
  const videoUrl = result?.videoUrl as string | undefined;
  // Accept result.videoUrl only if it's a real https URL (not the mock /media/generated-video/ path)
  const realVideoUrl = videoUrl?.startsWith("https://") ? videoUrl : undefined;
  // Priority: published URL → uploadedVideoUrl → real videoUrl → nothing
  const raw =
    (uploadedVideo?.url as string | undefined) ||
    (result?.uploadedVideoUrl as string | undefined) ||
    realVideoUrl ||
    null;
  return resolveMediaUrl(raw);
}

function getArticleId(job: VideoGenerationJobResult): string | null {
  const publishResult = job.publishResult as Record<string, unknown> | null;
  return (publishResult?.articleId as string) || job.articleId || null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(sec: number | string | undefined): string {
  const s = Number(sec || 0);
  if (!s) return "";
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

// ─── Single job card ──────────────────────────────────────────────────────────

function JobCard({ job, onRepublish }: { job: VideoGenerationJobResult; onRepublish: (job: VideoGenerationJobResult) => void }) {
  const videoUrl = getVideoUrl(job);
  const articleId = getArticleId(job);
  const isPublished = !!job.publishedAt;
  const result = job.result as Record<string, unknown> | null;
  const durationSec = (result?.durationSec as number) || undefined;
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isHovered) {
      v.play().catch(() => undefined);
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isHovered]);

  return (
    <div
      className="relative group rounded-lg overflow-hidden border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail / video preview */}
      <div className="relative aspect-[9/16] bg-muted overflow-hidden">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
              <div className="bg-black/40 rounded-full p-3 backdrop-blur-sm">
                <FileVideo className="h-6 w-6 text-white" />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileVideo className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Status badge top-left */}
        <div className="absolute top-2 left-2">
          <Badge variant={statusVariant(job.status)} className="text-[10px] px-1.5 py-0.5 flex items-center gap-1">
            <StatusIcon status={job.status} />
            {statusLabel(job.status)}
          </Badge>
        </div>

        {/* Published indicator top-right */}
        {isPublished && (
          <div className="absolute top-2 right-2">
            <Badge variant="default" className="text-[10px] px-1.5 py-0.5 bg-green-600 hover:bg-green-600">
              Published
            </Badge>
          </div>
        )}

        {/* Duration bottom-left */}
        {durationSec && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
            {formatDuration(durationSec)}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-2.5 space-y-1.5">
        <p className="text-xs font-medium line-clamp-2 leading-snug">{job.title || "Untitled video"}</p>
        <p className="text-[10px] text-muted-foreground">{formatDate((job as any).createdAt)}</p>

        {/* Actions */}
        <div className="flex gap-1.5 pt-0.5">
          {articleId && (
            <a
              href={`/articles/${articleId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Article
            </a>
          )}
          {job.status === "completed" && videoUrl && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 ml-auto"
              onClick={() => onRepublish(job)}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Re-publish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Re-publish dialog (inline, no modal lib needed) ─────────────────────────

function RepublishPanel({
  job,
  onClose,
  onDone,
}: {
  job: VideoGenerationJobResult;
  onClose: () => void;
  onDone: () => void;
}) {
  const [articleId, setArticleId] = useState(getArticleId(job) || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!articleId.trim()) {
      toast.error("Enter an article ID");
      return;
    }
    const videoUrl = getVideoUrl(job);
    if (!videoUrl) {
      toast.error("No video URL on this job");
      return;
    }
    setIsLoading(true);
    try {
      const publishResult = job.publishResult as Record<string, unknown> | null;
      const uploadedVideo = publishResult?.uploadedVideo as Record<string, unknown> | null;
      await publishVideoGenerationJob(job._id, {
        articleId: articleId.trim(),
        uploadedVideo: uploadedVideo ? {
          id: (uploadedVideo.id as string) || job._id,
          url: uploadedVideo.url as string,
          path: uploadedVideo.path as string,
          fileName: uploadedVideo.fileName as string | undefined,
          mimeType: uploadedVideo.mimeType as string | undefined,
          size: uploadedVideo.size as number | undefined,
          duration: uploadedVideo.duration as string | undefined,
        } : undefined,
      });
      toast.success("Video published to article");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setIsLoading(false);
    }
  }, [articleId, job, onDone]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Re-publish video</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter the article ID to set this video as its featured video.
      </p>
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        placeholder="Article ID"
        value={articleId}
        onChange={(e) => setArticleId(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main history component ───────────────────────────────────────────────────

export function VideoGeneratorHistory() {
  const selectedProperty = usePropertyStore((s) => s.selectedProperty);
  const [jobs, setJobs] = useState<VideoGenerationJobResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [republishJob, setRepublishJob] = useState<VideoGenerationJobResult | null>(null);
  const limit = 12;

  const load = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const res = await getVideoGenerationJobs({
        page: p,
        limit,
        // Pass propertyId for display filtering but backend also returns
        // jobs with no propertyId so nothing is accidentally excluded.
        propertyId: selectedProperty?._id,
      });
      setJobs(res.data);
      setTotal(res.total);
      setPage(res.page);
      setPageCount(res.pageCount);
    } catch {
      toast.error("Failed to load video history");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProperty?._id]);

  useEffect(() => { load(1); }, [load]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Generated videos</p>
          {!isLoading && <p className="text-xs text-muted-foreground">{total} total</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(page)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Re-publish panel */}
      {republishJob && (
        <RepublishPanel
          job={republishJob}
          onClose={() => setRepublishJob(null)}
          onDone={() => { setRepublishJob(null); load(page); }}
        />
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[9/16] rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="h-12 w-12 rounded-xl border border-border/30 bg-muted flex items-center justify-center">
            <FileVideo className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground/60 max-w-[200px] leading-relaxed">
            No videos generated yet. Use the Generator tab to create your first video.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} onRepublish={setRepublishJob} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount || isLoading}
            onClick={() => load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
