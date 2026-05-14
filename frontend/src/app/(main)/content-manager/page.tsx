"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { getContentTypes } from "@/lib/api";
import { ContentTypeSchema } from "@/lib/types";

export default function ContentManagerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [contentTypes, setContentTypes] = useState<ContentTypeSchema[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getContentTypes()
      .then(data => setContentTypes(Array.isArray(data) ? data : []))
      .catch(() => toast({ title: "Error", description: "Failed to load content types", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const published = contentTypes.filter(ct => ct.status === "published");
  const draft = contentTypes.filter(ct => ct.status === "draft");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Manager</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Browse and manage entries for your content types.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : published.length === 0 ? (
        <div className="border border-dashed rounded-lg py-20 text-center">
          <Rocket className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No published content types yet.</p>
          <Button variant="link" onClick={() => router.push("/content-builder")}>
            Go to Content-Type Builder →
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {published.map(ct => (
              <Card
                key={ct._id}
                className="cursor-pointer hover:border-primary/60 transition-colors"
                onClick={() => router.push(`/content-manager/${ct.pluralName}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{ct.displayName}</CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{ct.pluralName}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{ct.fields.length} field{ct.fields.length !== 1 ? "s" : ""}</span>
                    {ct.description && <span className="text-xs line-clamp-1">— {ct.description}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {draft.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Draft content types (not yet published)</p>
              <div className="flex flex-wrap gap-2">
                {draft.map(ct => (
                  <Badge key={ct._id} variant="secondary" className="cursor-pointer"
                    onClick={() => router.push(`/content-builder/${ct._id}`)}>
                    {ct.displayName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
