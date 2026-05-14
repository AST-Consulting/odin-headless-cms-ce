"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Rocket, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { getContentTypes, getComponents, getEntry, updateEntry, publishEntry, unpublishEntry } from "@/lib/api";
import { ContentTypeSchema, ComponentSchema, Entry } from "@/lib/types";
import { DynamicEntryForm } from "@/components/content-manager/DynamicEntryForm";

const STATUS_VARIANT: Record<string, any> = {
  published: "default", draft: "secondary", scheduled: "outline", archived: "destructive",
};

export default function EditEntryPage() {
  const { pluralName, id } = useParams<{ pluralName: string; id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [schema, setSchema] = useState<ContentTypeSchema | null>(null);
  const [components, setComponents] = useState<ComponentSchema[]>([]);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cts, comps] = await Promise.all([getContentTypes(), getComponents()]);
      const found = (Array.isArray(cts) ? cts : []).find(ct => ct.pluralName === pluralName);
      setSchema(found ?? null);
      setComponents(Array.isArray(comps) ? comps : []);

      if (found) {
        const e = await getEntry(found.singularName, id);
        setEntry(e);
        setData(e.data ?? {});
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pluralName, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async () => {
    if (!schema || !entry) return;
    setSaving(true);
    try {
      await updateEntry(schema.singularName, id, { data });
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!schema || !entry) return;
    setSaving(true);
    try {
      if (entry.status === "published") {
        await unpublishEntry(schema.singularName, id);
        toast({ title: "Unpublished" });
      } else {
        await publishEntry(schema.singularName, id);
        toast({ title: "Published" });
      }
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!schema || !entry) {
    return <div className="text-center py-20 text-muted-foreground">Entry not found.</div>;
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/content-manager/${pluralName}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">Edit {schema.displayName}</h1>
          <p className="text-xs text-muted-foreground font-mono">{entry._id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[entry.status] ?? "secondary"}>{entry.status}</Badge>
          <Button
            variant="outline"
            onClick={handlePublish}
            disabled={saving}
            className="gap-2"
          >
            {entry.status === "published"
              ? <><EyeOff className="h-4 w-4" /> Unpublish</>
              : <><Rocket className="h-4 w-4" /> Publish</>}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
        {entry.createdAt && <span>Created: {new Date(entry.createdAt).toLocaleString()}</span>}
        {entry.updatedAt && <span>Updated: {new Date(entry.updatedAt).toLocaleString()}</span>}
        {entry.version && <span>v{entry.version}</span>}
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Entry Data</CardTitle>
            <Badge variant="outline">{schema.fields.length} fields</Badge>
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

      {/* Bottom actions */}
      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={() => router.push(`/content-manager/${pluralName}`)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
