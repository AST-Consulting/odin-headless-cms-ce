"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentTypeField, ContentTypeSchema, ComponentSchema, Entry } from "@/lib/types";
import { listEntries, getEntry, createEntry, updateEntry, getContentTypes, getComponents } from "@/lib/api";
import { Plus, X, ChevronUp, Save, Pencil, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Lazy to break circular dep: RelationFieldInput → DynamicEntryForm → DynamicFieldInput → RelationFieldInput
const DynamicEntryForm = dynamic(
  () => import("./DynamicEntryForm").then(m => ({ default: m.DynamicEntryForm })),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> },
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function entryLabel(entry: Entry): string {
  const data = (entry as any).data ?? {};
  for (const key of ["name", "title", "displayName", "fullName", "label", "heading"]) {
    if (typeof data[key] === "string" && data[key]) return data[key];
  }
  const firstStr = Object.values(data).find(v => typeof v === "string" && v) as string | undefined;
  return firstStr ?? `…${entry._id.slice(-6)}`;
}

/** Normalize a value item — may be a string ID or an already-embedded doc */
function toId(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return null;
}

function toEntry(v: any): Entry | null {
  if (!v || typeof v !== "object" || !v._id) return null;
  return v as Entry;
}

// ── Entry card (label only) ───────────────────────────────────────────────────

function EntryCard({
  entry,
  onRemove,
  onEdit,
}: {
  entry: Entry;
  onRemove: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="border rounded-lg px-3 py-2 bg-card flex items-center justify-between gap-2">
      <span className="text-sm font-medium truncate">{entryLabel(entry)}</span>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button" variant="ghost" size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateDialog({
  open, onClose, relatedCT, allComponents, onCreated,
}: {
  open: boolean; onClose: () => void; relatedCT: ContentTypeSchema;
  allComponents: ComponentSchema[]; onCreated: (entry: Entry) => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entry = await createEntry(relatedCT.singularName, { data: formData });
      toast({ title: "Created", description: `${relatedCT.displayName} entry created.` });
      onCreated(entry);
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create {relatedCT.displayName}</DialogTitle></DialogHeader>
        <DynamicEntryForm schema={relatedCT} components={allComponents} data={formData} onChange={setFormData} />
        <div className="flex justify-end gap-2 pt-2 border-t mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : `Save ${relatedCT.displayName}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditDialog({
  open, onClose, relatedCT, allComponents, entry, onUpdated,
}: {
  open: boolean; onClose: () => void; relatedCT: ContentTypeSchema;
  allComponents: ComponentSchema[]; entry: Entry; onUpdated: (entry: Entry) => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, any>>((entry as any).data ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setFormData((entry as any).data ?? {}); }, [entry._id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateEntry(relatedCT.singularName, entry._id, { data: formData });
      toast({ title: "Updated", description: `${relatedCT.displayName} entry updated.` });
      onUpdated(updated);
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {relatedCT.displayName}</DialogTitle></DialogHeader>
        <DynamicEntryForm schema={relatedCT} components={allComponents} data={formData} onChange={setFormData} />
        <div className="flex justify-end gap-2 pt-2 border-t mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  field: ContentTypeField;
  value: any;
  onChange: (val: any) => void;
}

export function RelationFieldInput({ field, value, onChange }: Props) {
  const pluralName = field.relationTarget ?? "";
  const isMany = !!field.repeatable;

  const { toast } = useToast();

  const [relatedCT, setRelatedCT] = useState<ContentTypeSchema | null>(null);
  const [allComponents, setAllComponents] = useState<ComponentSchema[]>([]);
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: string }[]>([]);
  // entryCache holds full Entry objects keyed by _id
  const [entryCache, setEntryCache] = useState<Map<string, Entry>>(new Map());
  // IDs for which we've already started a fetch (avoid duplicate requests)
  const [fetchedIds, setFetchedIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Load related content type schema + components
  useEffect(() => {
    if (!pluralName) return;
    Promise.all([getContentTypes(), getComponents()])
      .then(([cts, comps]) => {
        const ct = (Array.isArray(cts) ? cts : []).find(c => c.pluralName === pluralName);
        setRelatedCT(ct ?? null);
        setAllComponents(Array.isArray(comps) ? comps : []);
      })
      .catch(() => {})
      .finally(() => setLoadingSchema(false));
  }, [pluralName]);

  // Seed cache with any embedded objects already present in value
  useEffect(() => {
    if (!value) return;
    const items = Array.isArray(value) ? value : [value];
    const embedded = items.map(toEntry).filter(Boolean) as Entry[];
    if (!embedded.length) return;
    setEntryCache(prev => {
      const next = new Map(prev);
      embedded.forEach(e => next.set(String(e._id), e));
      return next;
    });
  }, [value]);

  const addToCache = useCallback((entries: Entry[]) => {
    setEntryCache(prev => {
      const next = new Map(prev);
      entries.forEach(e => next.set(String(e._id), e));
      return next;
    });
  }, []);

  // Fetch search options (also seeds cache)
  const fetchOptions = useCallback(async (search?: string) => {
    if (!pluralName) return;
    setLoadingEntries(true);
    try {
      const res = await listEntries(pluralName, { limit: 50, ...(search ? { searchTerm: search } : {}) });
      const entries: Entry[] = res.data ?? [];
      setSearchOptions(entries.map(e => ({ value: String(e._id), label: entryLabel(e) })));
      addToCache(entries);
    } catch {
      setSearchOptions([]);
    } finally {
      setLoadingEntries(false);
    }
  }, [pluralName, addToCache]);

  // Initial fetch to seed cache on mount
  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  // Fetch individual entries for string IDs not yet in cache
  useEffect(() => {
    if (!relatedCT) return;
    const items = Array.isArray(value) ? value : (value ? [value] : []);
    const stringIds = items.map(toId).filter((id): id is string => !!id);
    const missing = stringIds.filter(id => !entryCache.has(id) && !fetchedIds.has(id));
    if (!missing.length) return;

    setFetchedIds(prev => { const n = new Set(prev); missing.forEach(id => n.add(id)); return n; });
    missing.forEach(id => {
      getEntry(relatedCT.singularName, id)
        .then(entry => addToCache([entry]))
        .catch(() => {}); // entry doesn't exist — card will show broken state
    });
  }, [relatedCT, value, entryCache, fetchedIds, addToCache]);

  const openSearch = () => {
    setSearchOptions([]);
    fetchOptions();
    setShowSearch(true);
  };

  if (loadingSchema) return <Skeleton className="h-9 w-full" />;
  if (!relatedCT) return <p className="text-sm text-muted-foreground">Related type "{pluralName}" not found.</p>;

  const label = field.label ?? field.name;

  const handleCreated = (entry: Entry) => {
    addToCache([entry]);
    if (isMany) {
      const items: any[] = Array.isArray(value) ? value : [];
      onChange([...items, entry._id]);
    } else {
      onChange(entry._id);
    }
  };

  const handleUpdated = (entry: Entry) => { addToCache([entry]); };

  // Resolve a value item to an Entry for display
  const resolveEntry = (v: any): Entry | null => {
    const embedded = toEntry(v);
    if (embedded) return embedded;
    const id = toId(v);
    return id ? (entryCache.get(id) ?? null) : null;
  };

  const resolveId = (v: any): string | null => toId(v);

  // ── Many relation ──────────────────────────────────────────────────────────
  if (isMany) {
    const items: any[] = Array.isArray(value) ? value : [];
    const selectedIds = new Set(items.map(resolveId).filter(Boolean) as string[]);
    const availableOptions = searchOptions.filter(o => !selectedIds.has(o.value));

    return (
      <div className="space-y-2">
        {items.map((item, idx) => {
          const entry = resolveEntry(item);
          const id = resolveId(item) ?? String(idx);
          return entry ? (
            <EntryCard
              key={id}
              entry={entry}
              onRemove={() => onChange(items.filter((_, i) => i !== idx))}
              onEdit={() => setEditingEntry(entry)}
            />
          ) : (
            <div key={id} className="border rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-muted-foreground">
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{id}</span>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}

        {!showSearch ? (
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openSearch}>
            <Plus className="h-4 w-4" /> Add {label}
          </Button>
        ) : (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Search {label}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSearch(false)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
            <Combobox
              options={availableOptions}
              value=""
              onChange={v => {
                if (v && !selectedIds.has(v)) {
                  onChange([...items, v]);
                  setShowSearch(false);
                }
              }}
              placeholder={loadingEntries ? "Loading…" : `Search ${label}…`}
              searchPlaceholder="Type to search…"
              onSearch={fetchOptions}
              footer={
                <Button type="button" variant="ghost" size="sm"
                  className="w-full justify-start gap-2 text-xs"
                  onClick={() => { setShowCreate(true); setShowSearch(false); }}>
                  <Plus className="h-3.5 w-3.5" /> Create new {label}
                </Button>
              }
            />
          </div>
        )}

        <CreateDialog open={showCreate} onClose={() => setShowCreate(false)}
          relatedCT={relatedCT} allComponents={allComponents} onCreated={handleCreated} />

        {editingEntry && (
          <EditDialog open={!!editingEntry} onClose={() => setEditingEntry(null)}
            relatedCT={relatedCT} allComponents={allComponents}
            entry={editingEntry} onUpdated={handleUpdated} />
        )}
      </div>
    );
  }

  // ── Single relation ────────────────────────────────────────────────────────
  const selectedEntry = value ? resolveEntry(value) : null;

  return (
    <div className="space-y-2">
      {selectedEntry && !showSearch && (
        <EntryCard
          entry={selectedEntry}
          onRemove={() => { onChange(null); setShowSearch(false); }}
          onEdit={() => setEditingEntry(selectedEntry)}
        />
      )}

      {!showSearch ? (
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openSearch}>
          {selectedEntry ? `Change ${label}` : `Add ${label}`}
        </Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Search {label}</span>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSearch(false)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
          <Combobox
            options={[
              ...(!field.required ? [{ value: "__none__", label: "— none —" }] : []),
              ...searchOptions,
            ]}
            value={resolveId(value) ?? "__none__"}
            onChange={v => { onChange(v === "__none__" ? null : v); setShowSearch(false); }}
            placeholder={loadingEntries ? "Loading…" : `Search ${label}…`}
            searchPlaceholder="Type to search…"
            onSearch={fetchOptions}
            footer={
              <Button type="button" variant="ghost" size="sm"
                className="w-full justify-start gap-2 text-xs"
                onClick={() => { setShowCreate(true); setShowSearch(false); }}>
                <Plus className="h-3.5 w-3.5" /> Create new {label}
              </Button>
            }
          />
        </div>
      )}

      <CreateDialog open={showCreate} onClose={() => setShowCreate(false)}
        relatedCT={relatedCT} allComponents={allComponents} onCreated={handleCreated} />

      {editingEntry && (
        <EditDialog open={!!editingEntry} onClose={() => setEditingEntry(null)}
          relatedCT={relatedCT} allComponents={allComponents}
          entry={editingEntry} onUpdated={handleUpdated} />
      )}
    </div>
  );
}
