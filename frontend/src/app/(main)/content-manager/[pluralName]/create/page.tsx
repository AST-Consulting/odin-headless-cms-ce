"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { getContentTypes, getComponents, createEntry } from "@/lib/api";
import { ContentTypeField, ContentTypeSchema, ComponentSchema } from "@/lib/types";
import { DynamicEntryForm } from "@/components/content-manager/DynamicEntryForm";
import { usePropertyStore, useOrganizationStore } from "@/lib/store";

function resolveDefault(field: ContentTypeField): any {
  const raw = field.default;
  if (raw === undefined || raw === null) return undefined;

  if (raw === "$now") {
    const now = new Date();
    if (field.type === "date") return now.toISOString().slice(0, 10);
    if (field.type === "datetime") return now.toISOString().slice(0, 16);
    if (field.type === "time") return now.toTimeString().slice(0, 5);
  }

  return raw;
}

function buildDefaults(fields: ContentTypeField[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of fields) {
    const val = resolveDefault(field);
    if (val !== undefined) out[field.name] = val;
  }
  return out;
}

export default function CreateEntryPage() {
  const { pluralName } = useParams<{ pluralName: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const selectedProperty = usePropertyStore(s => s.selectedProperty);
  const selectedOrganization = useOrganizationStore(s => s.selectedOrganization);

  const [schema, setSchema] = useState<ContentTypeSchema | null>(null);
  const [components, setComponents] = useState<ComponentSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<"draft" | "published">("draft");

  useEffect(() => {
    Promise.all([getContentTypes(), getComponents()])
      .then(([cts, comps]) => {
        const found = (Array.isArray(cts) ? cts : []).find(ct => ct.pluralName === pluralName);
        setSchema(found ?? null);
        setComponents(Array.isArray(comps) ? comps : []);
        if (found?.fields) {
          setData(buildDefaults(found.fields));
        }
      })
      .catch(() => toast({ title: "Error", description: "Failed to load schema", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [pluralName]);

  const handleSave = async (publishNow = false) => {
    if (!schema) return;
    setSaving(true);
    try {
      await createEntry(schema.singularName, {
        data,
        status: publishNow ? "published" : status,
        propertyId: selectedProperty?._id,
        organizationId: selectedOrganization?._id,
      });
      toast({ title: publishNow ? "Published" : "Saved", description: `${schema.displayName} entry created.` });
      router.push(`/content-manager/${pluralName}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!schema) {
    return <div className="text-center py-20 text-muted-foreground">Content type "{pluralName}" not found.</div>;
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/content-manager/${pluralName}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold flex-1">Create {schema.displayName}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2">
            <Rocket className="h-4 w-4" /> Publish
          </Button>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Entry Data</CardTitle>
            <Badge variant="secondary">{schema.fields.length} fields</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <DynamicEntryForm
            schema={schema}
            components={components}
            data={data}
            onChange={setData}
          />
        </CardContent>
      </Card>

      {/* Status selector */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
        <CardContent>
          <Select value={status} onValueChange={v => setStatus(v as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Bottom actions */}
      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={() => router.push(`/content-manager/${pluralName}`)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => handleSave(false)} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Draft"}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2">
          <Rocket className="h-4 w-4" /> Publish
        </Button>
      </div>
    </div>
  );
}
