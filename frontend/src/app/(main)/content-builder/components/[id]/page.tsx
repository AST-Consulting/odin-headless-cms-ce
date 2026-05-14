"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { getComponentById, updateComponent, createComponent, getComponents, getContentTypes } from "@/lib/api";
import { ComponentSchema, ContentTypeSchema } from "@/lib/types";
import { SchemaEditor } from "@/components/content-builder/SchemaEditor";

export default function ComponentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState<Partial<ComponentSchema>>({
    displayName: "", description: "", fields: [],
  });
  const [components, setComponents] = useState<ComponentSchema[]>([]);
  const [allContentTypes, setAllContentTypes] = useState<ContentTypeSchema[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [comps, cts] = await Promise.all([getComponents(), getContentTypes()]);
      setComponents(Array.isArray(comps) ? comps : []);
      setAllContentTypes(Array.isArray(cts) ? cts : []);
      if (!isNew) {
        const comp = await getComponentById(id);
        setSchema(comp);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!schema.displayName?.trim()) {
      toast({ title: "Validation", description: "Display name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createComponent({
          displayName: schema.displayName,
          description: schema.description,
          fields: schema.fields ?? [],
        });
        toast({ title: "Created", description: schema.displayName });
        router.push(`/content-builder/components/${created._id}`);
      } else {
        await updateComponent(id, { displayName: schema.displayName, description: schema.description, fields: schema.fields });
        toast({ title: "Saved" });
      }
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
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push("/content-builder")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold flex-1">
          {isNew ? "New Component" : schema.displayName}
        </h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Display Name <span className="text-destructive">*</span></Label>
            <Input
              value={schema.displayName ?? ""}
              onChange={e => setSchema(s => ({ ...s, displayName: e.target.value }))}
              placeholder="Address"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={schema.description ?? ""}
              onChange={e => setSchema(s => ({ ...s, description: e.target.value }))}
              placeholder="What this component represents"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Fields ({schema.fields?.length ?? 0})</CardTitle></CardHeader>
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
