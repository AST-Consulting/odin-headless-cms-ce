"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { getContentTypeById, updateContentType, publishContentType, getComponents, getContentTypes } from "@/lib/api";
import { ContentTypeSchema, ComponentSchema, ContentTypeField } from "@/lib/types";
import { SchemaEditor } from "@/components/content-builder/SchemaEditor";

const IS_NEW = "new";

function toSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function ContentTypeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === IS_NEW;
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState<Partial<ContentTypeSchema>>({
    displayName: "", singularName: "", pluralName: "", description: "", fields: [],
  });
  const [components, setComponents] = useState<ComponentSchema[]>([]);
  const [allContentTypes, setAllContentTypes] = useState<ContentTypeSchema[]>([]);

  const fetchSchema = useCallback(async () => {
    try {
      const [comps, cts] = await Promise.all([getComponents(), getContentTypes()]);
      setComponents(Array.isArray(comps) ? comps : []);
      setAllContentTypes(Array.isArray(cts) ? cts : []);
      if (!isNew) {
        const ct = await getContentTypeById(id);
        setSchema(ct);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { fetchSchema(); }, [fetchSchema]);

  const handleSave = async () => {
    if (!schema.displayName?.trim()) {
      toast({ title: "Validation", description: "Display name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await import("@/lib/api").then(m => m.createContentType({
          displayName: schema.displayName,
          singularName: schema.singularName || toSlug(schema.displayName ?? ""),
          pluralName: schema.pluralName || toSlug(schema.displayName ?? "") + "s",
          description: schema.description,
          fields: schema.fields ?? [],
        }));
        toast({ title: "Created", description: schema.displayName });
        router.push(`/content-builder/${created._id}`);
      } else {
        await updateContentType(id, { displayName: schema.displayName, description: schema.description, fields: schema.fields });
        toast({ title: "Saved" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isNew) return;
    setSaving(true);
    try {
      await publishContentType(id);
      toast({ title: "Published" });
      fetchSchema();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push("/content-builder")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">
            {isNew ? "New Content Type" : schema.displayName}
          </h1>
          {!isNew && schema.pluralName && (
            <p className="text-xs text-muted-foreground font-mono">{schema.pluralName}</p>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && (schema as ContentTypeSchema).status === "draft" && (
            <Button variant="outline" onClick={handlePublish} disabled={saving} className="gap-2">
              <Rocket className="h-4 w-4" /> Publish
            </Button>
          )}
          {!isNew && (schema as ContentTypeSchema).status && (
            <Badge variant={(schema as ContentTypeSchema).status === "published" ? "default" : "secondary"}>
              {(schema as ContentTypeSchema).status}
            </Badge>
          )}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Display Name <span className="text-destructive">*</span></Label>
              <Input
                value={schema.displayName ?? ""}
                onChange={e => {
                  const v = e.target.value;
                  setSchema(s => ({
                    ...s,
                    displayName: v,
                    ...(isNew ? {
                      singularName: toSlug(v),
                      pluralName: toSlug(v) + "s",
                    } : {}),
                  }));
                }}
                placeholder="Content Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Singular Name</Label>
              <Input
                value={schema.singularName ?? ""}
                onChange={e => setSchema(s => ({ ...s, singularName: e.target.value }))}
                placeholder="content-name"
                className="font-mono"
                disabled={!isNew}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plural Name</Label>
              <Input
                value={schema.pluralName ?? ""}
                onChange={e => setSchema(s => ({ ...s, pluralName: e.target.value }))}
                placeholder="content-names"
                className="font-mono"
                disabled={!isNew}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={schema.description ?? ""}
              onChange={e => setSchema(s => ({ ...s, description: e.target.value }))}
              placeholder="Optional description of this content type"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Fields ({schema.fields?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <SchemaEditor
            fields={schema.fields ?? []}
            components={components}
            allContentTypes={allContentTypes}
            onChange={fields => setSchema(s => ({ ...s, fields }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
