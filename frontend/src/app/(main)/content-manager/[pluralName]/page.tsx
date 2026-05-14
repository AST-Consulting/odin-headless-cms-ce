"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Eye, EyeOff, Pencil, Trash2, SlidersHorizontal, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { getContentTypes, listEntries, deleteEntry, publishEntry, unpublishEntry, setContentTypeListColumns } from "@/lib/api";
import { ContentTypeField, ContentTypeSchema, Entry } from "@/lib/types";

const COMPLEX_TYPES = new Set(["component", "dynamiczone", "richblock", "richtext", "json", "text"]);

const STATUS_VARIANT: Record<string, any> = {
  published: "default", draft: "secondary", scheduled: "outline", archived: "destructive",
};

function FilterBar({ fields, appliedFilters, onApply }: {
  fields: ContentTypeField[];
  appliedFilters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}) {
  const filterableFields = fields.filter(f => f.filterable);
  const [pending, setPending] = useState<Record<string, string>>({});

  if (!filterableFields.length) return null;

  const set = (key: string, value: string) => setPending(p => ({ ...p, [key]: value }));
  const val = (name: string) => pending[name] ?? "";
  const hasApplied = Object.values(appliedFilters).some(v => v !== "");

  const apply = () => onApply(Object.fromEntries(Object.entries(pending).filter(([, v]) => v !== "")));

  const clear = () => {
    setPending({});
    onApply({});
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
      {filterableFields.map(f => {
        if (f.type === "enum") {
          const opts = f.validation?.enumOptions?.length
            ? f.validation.enumOptions
            : (f.validation?.enumValues ?? []).map(v => ({ label: v, value: v }));
          return (
            <Combobox
              key={f.name}
              options={[
                { value: "__all__", label: `All ${f.label ?? f.name}` },
                ...opts.map(o => ({ value: o.value, label: o.label })),
              ]}
              value={val(f.name) || "__all__"}
              onChange={v => set(f.name, v === "__all__" ? "" : v)}
              placeholder={f.label ?? f.name}
              searchPlaceholder={`Search ${f.label ?? f.name}...`}
              className="w-44"
              buttonClassName="h-8 text-xs"
            />
          );
        }
        if (f.type === "boolean") {
          return (
            <Select key={f.name} value={val(f.name) || "__all__"} onValueChange={v => set(f.name, v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder={f.label ?? f.name} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            key={f.name}
            className="h-8 w-40 text-xs"
            placeholder={f.label ?? f.name}
            value={val(f.name)}
            onChange={e => set(f.name, e.target.value)}
            onKeyDown={e => e.key === "Enter" && apply()}
          />
        );
      })}
      <Button size="sm" className="h-8 gap-1 text-xs" onClick={apply}>
        Apply
      </Button>
      {hasApplied && (
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={clear}>
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}

function defaultColumns(fields: ContentTypeField[]): string[] {
  const first = fields.find(f => !f.private && !COMPLEX_TYPES.has(f.type));
  return first ? [first.name] : [];
}

function userStub(u: any): { id: string; name: string } | null {
  if (!u) return null;
  if (typeof u === "object" && u.id) return u;
  return null;
}

function cellValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return Array.isArray(val) ? `[${val.length}]` : "{…}";
  return String(val);
}

export default function EntriesListPage() {
  const { pluralName } = useParams<{ pluralName: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [schema, setSchema] = useState<ContentTypeSchema | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingColumns, setPendingColumns] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const selectableFields = useMemo(
    () => (schema?.fields ?? []).filter(f => !f.private && !COMPLEX_TYPES.has(f.type)),
    [schema]
  );

  // active columns: saved listColumns from schema, or auto-default to first field
  const activeColumns = useMemo(() => {
    if (!schema) return [];
    return schema.listColumns?.length ? schema.listColumns : defaultColumns(schema.fields);
  }, [schema]);

  const visibleFields = useMemo(
    () => selectableFields.filter(f => activeColumns.includes(f.name)),
    [selectableFields, activeColumns]
  );

  // close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
      const [cts, res] = await Promise.all([
        getContentTypes(),
        listEntries(pluralName, { page, limit, ...activeFilters }),
      ]);
      const found = (Array.isArray(cts) ? cts : []).find((ct: ContentTypeSchema) => ct.pluralName === pluralName);
      setSchema(found ?? null);
      setEntries(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pluralName, page, limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const singularName = schema?.singularName ?? pluralName.replace(/s$/, "");

  const handleDelete = async (entry: Entry) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await deleteEntry(singularName, entry._id);
      toast({ title: "Deleted" });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    }
  };

  const handleTogglePublish = async (entry: Entry) => {
    try {
      if (entry.status === "published") await unpublishEntry(singularName, entry._id);
      else await publishEntry(singularName, entry._id);
      toast({ title: entry.status === "published" ? "Unpublished" : "Published" });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Status update failed", variant: "destructive" });
    }
  };

  const openPicker = () => { setPendingColumns(activeColumns); setPickerOpen(true); };

  const applyColumns = async () => {
    if (!schema) return;
    setSaving(true);
    try {
      await setContentTypeListColumns(schema._id, pendingColumns);
      setSchema(s => s ? { ...s, listColumns: pendingColumns } : s);
      setPickerOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save columns", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const togglePending = (name: string) => {
    setPendingColumns(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{schema?.displayName ?? pluralName} ({total})</h1>
          {schema?.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={pickerRef}>
            <Button variant="outline" size="sm" className="gap-2" onClick={openPicker}>
              <SlidersHorizontal className="h-4 w-4" />
              Columns
              {activeColumns.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-xs">{activeColumns.length}</Badge>
              )}
            </Button>
            {pickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border bg-popover shadow-md p-1">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Toggle columns</p>
                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                  {selectableFields.map(f => (
                    <label
                      key={f.name}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm select-none"
                    >
                      <Checkbox
                        checked={pendingColumns.includes(f.name)}
                        onCheckedChange={() => togglePending(f.name)}
                      />
                      {f.label ?? f.name}
                    </label>
                  ))}
                  {selectableFields.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No selectable fields</p>
                  )}
                </div>
                <div className="border-t mt-1 pt-1 px-1">
                  <Button size="sm" className="w-full gap-1.5" onClick={applyColumns} disabled={saving}>
                    <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={() => router.push(`/content-manager/${pluralName}/create`)}
            size="icon" className="rounded-full h-10 w-10"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <FilterBar
        fields={schema?.fields ?? []}
        appliedFilters={filters}
        onApply={f => { setFilters(f); setPage(1); }}
      />

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleFields.map(f => (
                    <TableHead key={f.name}>{f.label ?? f.name}</TableHead>
                  ))}
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry._id}>
                    {visibleFields.map((f, i) => (
                      <TableCell key={f.name}>
                        {i === 0 ? (
                          <span
                            className="font-medium cursor-pointer hover:underline text-primary"
                            onClick={() => router.push(`/content-manager/${pluralName}/${entry._id}`)}
                          >
                            {cellValue(entry.data?.[f.name])}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{cellValue(entry.data?.[f.name])}</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[entry.status] ?? "secondary"}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col">
                        {(() => { const u = userStub(entry.createdBy); return u ? (
                          <span className="text-sm font-medium cursor-pointer hover:underline text-primary transition-colors"
                            onClick={e => { e.stopPropagation(); router.push(`/users/edit/${u.id}`); }}>
                            {u.name || "—"}
                          </span>
                        ) : <span className="text-sm text-muted-foreground">—</span>; })()}
                        <span className="text-xs text-muted-foreground">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col">
                        {(() => { const u = userStub(entry.updatedBy); return u ? (
                          <span className="text-sm font-medium cursor-pointer hover:underline text-primary transition-colors"
                            onClick={e => { e.stopPropagation(); router.push(`/users/edit/${u.id}`); }}>
                            {u.name || "—"}
                          </span>
                        ) : <span className="text-sm text-muted-foreground">—</span>; })()}
                        <span className="text-xs text-muted-foreground">
                          {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          title={entry.status === "published" ? "Unpublish" : "Publish"}
                          onClick={() => handleTogglePublish(entry)}>
                          {entry.status === "published" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => router.push(`/content-manager/${pluralName}/${entry._id}`)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(entry)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={visibleFields.length + 4} className="h-24 text-center text-muted-foreground">
                      No entries yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={setLimit} />
        </>
      )}
    </div>
  );
}
