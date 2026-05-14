"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Rocket, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { getContentTypes, deleteContentType, publishContentType, getComponents, deleteComponent } from "@/lib/api";
import { ContentTypeSchema, ComponentSchema } from "@/lib/types";

export default function ContentBuilderPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [contentTypes, setContentTypes] = useState<ContentTypeSchema[]>([]);
  const [components, setComponents] = useState<ComponentSchema[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cts, comps] = await Promise.all([getContentTypes(), getComponents()]);
      setContentTypes(Array.isArray(cts) ? cts : []);
      setComponents(Array.isArray(comps) ? comps : []);
    } catch {
      toast({ title: "Error", description: "Failed to load schemas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDeleteContentType = async (ct: ContentTypeSchema) => {
    if (!confirm(`Delete content type "${ct.displayName}"? This cannot be undone.`)) return;
    try {
      await deleteContentType(ct._id);
      toast({ title: "Deleted", description: ct.displayName });
      fetchAll();
    } catch {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    }
  };

  const handlePublish = async (ct: ContentTypeSchema) => {
    try {
      await publishContentType(ct._id);
      toast({ title: "Published", description: ct.displayName });
      fetchAll();
    } catch {
      toast({ title: "Error", description: "Publish failed", variant: "destructive" });
    }
  };

  const handleDeleteComponent = async (c: ComponentSchema) => {
    if (!confirm(`Delete component "${c.displayName}"?`)) return;
    try {
      await deleteComponent(c._id);
      toast({ title: "Deleted", description: c.displayName });
      fetchAll();
    } catch {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content-Type Builder</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Define your data structures — like Strapi's schema builder.</p>
        </div>
      </div>

      <Tabs defaultValue="content-types">
        <TabsList>
          <TabsTrigger value="content-types" className="gap-2">
            <Rocket className="h-4 w-4" /> Content Types ({contentTypes.length})
          </TabsTrigger>
          <TabsTrigger value="components" className="gap-2">
            <Layers className="h-4 w-4" /> Components ({components.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Content Types ── */}
        <TabsContent value="content-types" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => router.push("/content-builder/new")} className="gap-2">
              <Plus className="h-4 w-4" /> Create Content Type
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : contentTypes.length === 0 ? (
            <div className="border border-dashed rounded-lg py-16 text-center text-muted-foreground">
              No content types yet. Create your first one.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {contentTypes.map(ct => (
                <Card key={ct._id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{ct.displayName}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{ct.pluralName}</p>
                      </div>
                      <Badge variant={ct.status === "published" ? "default" : "secondary"}>
                        {ct.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{ct.fields.length} field{ct.fields.length !== 1 ? "s" : ""}</span>
                    </div>
                    {ct.description && <p className="text-xs text-muted-foreground line-clamp-2">{ct.description}</p>}
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5"
                        onClick={() => router.push(`/content-builder/${ct._id}`)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {ct.status === "draft" && (
                        <Button variant="outline" size="sm" className="gap-1.5"
                          onClick={() => handlePublish(ct)}>
                          <Rocket className="h-3.5 w-3.5" /> Publish
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteContentType(ct)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Components ── */}
        <TabsContent value="components" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => router.push("/content-builder/components/new")} className="gap-2">
              <Plus className="h-4 w-4" /> Create Component
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : components.length === 0 ? (
            <div className="border border-dashed rounded-lg py-16 text-center text-muted-foreground">
              No components yet. Components are reusable field groups.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {components.map(c => (
                <Card key={c._id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{c.displayName}</CardTitle>
                      </div>
                      <Badge variant="outline">{c.fields.length} fields</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5"
                        onClick={() => router.push(`/content-builder/components/${c._id}`)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteComponent(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
