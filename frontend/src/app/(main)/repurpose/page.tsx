"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Layers, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore, havePermission } from "@/lib/auth";
import {
  listRepurposeJobs,
  type RepurposeJobSummary,
} from "@/lib/repurpose-api";
import { cn } from "@/lib/utils";

export default function RepurposeListPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [jobs, setJobs] = useState<RepurposeJobSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!havePermission(user, "repurpose", "read")) {
      toast.error("You do not have permission to view repurpose history");
      router.push("/dashboard");
    }
  }, [user, hasHydrated, router]);

  useEffect(() => {
    if (!hasHydrated || !havePermission(user, "repurpose", "read")) return;
    let cancelled = false;
    listRepurposeJobs(1, 50)
      .then((res) => {
        if (cancelled) return;
        setJobs(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Could not load history";
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, hasHydrated]);

  return (
    <div className="container mx-auto max-w-5xl py-6 px-4 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">
            Repurpose history
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6" />
          Recently repurposed articles
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Every article you have repurposed across web stories, social posts,
          push notifications, newsletters and short-form scripts. Click any to
          jump back into its outputs.
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">
              Could not load history
            </p>
            <p className="text-xs text-destructive/80 mt-1">{error}</p>
          </CardContent>
        </Card>
      ) : !jobs || jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Link
              key={job.jobId}
              href={`/repurpose/${job.articleId}`}
              className="block"
            >
              <Card
                className={cn(
                  "transition-all hover:border-primary/40",
                  "dark:hover:border-primary/50 dark:hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.4)]"
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {job.articleTitle || "Untitled article"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      {job.language && (
                        <span className="uppercase tracking-wide">
                          {job.language}
                        </span>
                      )}
                      <span>•</span>
                      <span>{formatRelative(job.generatedAt)}</span>
                      <span>•</span>
                      <span>{job.formatsCount} formats</span>
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Loader2 className="h-8 w-8 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium">No repurposed articles yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Open any article in the editor and hit the{" "}
            <span className="font-medium text-foreground">Repurpose</span>{" "}
            button to generate web stories, social cards, newsletters and
            more in one shot.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}
