"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ContentTypeField, EnumOption, FieldType, ComponentSchema } from "@/lib/types";
import { FieldTypeIcon, FIELD_TYPE_LABELS } from "./FieldTypeIcon";
import { SchemaEditor } from "./SchemaEditor";
import { X, Plus } from "lucide-react";

const FIELD_TYPES: FieldType[] = [
  "string", "text", "richtext", "int", "float", "decimal",
  "boolean", "date", "datetime", "time", "json", "enum",
  "uid", "email", "url", "media", "relation", "component", "dynamiczone",
];

// Types that manage their own repeatable logic internally
const SELF_REPEATING: FieldType[] = ["component", "dynamiczone"];

const RELATION_TYPES = ["oneToOne", "oneToMany", "manyToOne", "manyToMany"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (field: ContentTypeField) => void;
  existing?: ContentTypeField;
  components: ComponentSchema[];
  allContentTypePlurals: string[];
}

const EMPTY: ContentTypeField = {
  name: "", type: "string", required: false, unique: false,
  searchable: false, indexed: false,
};

export function AddFieldModal({ open, onClose, onSave, existing, components, allContentTypePlurals }: Props) {
  const [step, setStep] = useState<"pick" | "config">(existing ? "config" : "pick");
  const [field, setField] = useState<ContentTypeField>(existing ?? EMPTY);

  const initEnumOptions = (): EnumOption[] => {
    if (existing?.validation?.enumOptions?.length) return existing.validation.enumOptions;
    if (existing?.validation?.enumValues?.length)
      return existing.validation.enumValues.map(v => ({ label: v, value: v }));
    return [];
  };
  const [enumOptions, setEnumOptions] = useState<EnumOption[]>(initEnumOptions);
  const [bulkInput, setBulkInput] = useState("");
  // used only for the default-value select dropdown
  const enumInput = enumOptions.map(o => o.value).join(", ");

  const parseBulk = () => {
    const parsed = bulkInput
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(v => ({ label: v, value: v }));
    setEnumOptions(o => [...o, ...parsed]);
    setBulkInput("");
  };

  const reset = () => { setStep("pick"); setField(EMPTY); setEnumOptions([]); setBulkInput(""); };

  const handleClose = () => { reset(); onClose(); };

  const handlePickType = (type: FieldType) => {
    setField(f => ({
      name: f.name,
      label: f.label,
      description: f.description,
      required: f.required,
      unique: f.unique,
      indexed: f.indexed,
      type,
    }));
    setEnumOptions([]);
    setStep("config");
  };

  const handleSave = () => {
    if (!field.name.trim()) return;
    const out = { ...field };
    if (field.type === "enum") {
      const values = enumOptions.map(o => o.value);
      out.validation = { ...out.validation, enumOptions, enumValues: values };
    }
    onSave(out);
    handleClose();
  };

  const set = (key: keyof ContentTypeField, val: any) => setField(f => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Field" : step === "pick" ? "Select Field Type" : `Add ${FIELD_TYPE_LABELS[field.type]} Field`}</DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
            {FIELD_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handlePickType(type)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:border-primary hover:bg-accent transition-colors text-center"
              >
                <FieldTypeIcon type={type} className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium leading-tight">{FIELD_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        )}

        {step === "config" && (
          <div className="space-y-4 pt-2">
            {/* Badge showing type */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                <FieldTypeIcon type={field.type} className="h-3.5 w-3.5" />
                {FIELD_TYPE_LABELS[field.type]}
              </Badge>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setStep("pick")}>
                Change type
              </Button>
            </div>

            {/* Base config */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Field Name <span className="text-destructive">*</span></Label>
                <Input
                  value={field.name}
                  onChange={e => set("name", e.target.value.replace(/\s/g, "_").toLowerCase())}
                  placeholder="field_name"
                />
                <p className="text-xs text-muted-foreground">Lowercase, underscores only</p>
              </div>
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={field.label ?? ""} onChange={e => set("label", e.target.value)} placeholder="Human-readable label" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={field.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="Optional hint for editors" />
            </div>

            {/* Enum options — label (display) + value (stored/searchable) */}
            {field.type === "enum" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Enum Options <span className="text-destructive">*</span></Label>
                  <Button
                    type="button" variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => setEnumOptions(o => [...o, { label: "", value: "" }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Option
                  </Button>
                </div>

                {/* Bulk paste — always visible when list is empty, collapsible otherwise */}
                {enumOptions.length === 0 ? (
                  <div className="space-y-1.5">
                    <textarea
                      className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                      placeholder="option1, option2, option3…"
                      value={bulkInput}
                      onChange={e => setBulkInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (bulkInput.trim()) parseBulk(); } }}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Comma-separated. Press Enter or click Parse.</p>
                      <Button type="button" size="sm" className="h-7 text-xs" onClick={parseBulk} disabled={!bulkInput.trim()}>
                        Parse
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Bulk-add-more row when options already exist */
                  <div className="flex gap-2">
                    <Input
                      value={bulkInput}
                      onChange={e => setBulkInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (bulkInput.trim()) parseBulk(); } }}
                      placeholder="Add more: option4, option5…"
                      className="h-8 text-xs"
                    />
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={parseBulk} disabled={!bulkInput.trim()}>
                      Add
                    </Button>
                  </div>
                )}

                {/* Row editor */}
                {enumOptions.length > 0 && (
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-x-2 gap-y-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Label (display)</span>
                    <span className="text-xs text-muted-foreground font-medium">Value (stored / searchable)</span>
                    <span />
                    {enumOptions.map((opt, i) => (
                      <>
                        <Input
                          key={`label-${i}`}
                          value={opt.label}
                          placeholder="Display label"
                          onChange={e => {
                            const next = [...enumOptions];
                            next[i] = { ...next[i], label: e.target.value };
                            setEnumOptions(next);
                          }}
                        />
                        <Input
                          key={`value-${i}`}
                          value={opt.value}
                          placeholder="Stored value"
                          onChange={e => {
                            const next = [...enumOptions];
                            next[i] = { ...next[i], value: e.target.value };
                            setEnumOptions(next);
                          }}
                        />
                        <Button
                          key={`del-${i}`}
                          type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive"
                          onClick={() => setEnumOptions(o => o.filter((_, j) => j !== i))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Label is shown to editors. Value is what gets stored and used for filtering.
                </p>
              </div>
            )}

            {/* Media config */}
            {field.type === "media" && (
              <div className="flex items-center gap-3">
                <Switch checked={!!field.mediaMultiple} onCheckedChange={v => set("mediaMultiple", v)} />
                <Label>Allow multiple files</Label>
              </div>
            )}

            {/* Relation config */}
            {field.type === "relation" && (
              <div className="space-y-1.5">
                <Label>Target Collection (plural name)</Label>
                <Select value={field.relationTarget ?? ""} onValueChange={v => set("relationTarget", v)}>
                  <SelectTrigger><SelectValue placeholder="Select target" /></SelectTrigger>
                  <SelectContent>
                    {allContentTypePlurals.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Enable "Repeatable" below to allow selecting multiple entries.</p>
              </div>
            )}

            {/* Component config */}
            {(field.type === "component" || field.type === "dynamiczone") && (
              <div className="space-y-4">
                {field.type === "component" && (
                  <div className="space-y-1.5">
                    <Label>Component <span className="text-destructive">*</span></Label>
                    <Select value={field.componentRef ?? ""} onValueChange={v => set("componentRef", v)}>
                      <SelectTrigger><SelectValue placeholder="Select component" /></SelectTrigger>
                      <SelectContent>
                        {components.map(c => <SelectItem key={c._id} value={c._id}>{c.displayName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {field.type === "dynamiczone" && (
                  <div className="space-y-1.5">
                    <Label>Zone Fields</Label>
                    <p className="text-xs text-muted-foreground">
                      Define the fields each item in this zone will have.
                    </p>
                    <SchemaEditor
                      fields={field.zoneFields ?? []}
                      components={components}
                      allContentTypes={[]}
                      onChange={zf => set("zoneFields", zf)}
                    />
                  </div>
                )}
                {field.type === "component" && (
                  <div className="flex items-center gap-3">
                    <Switch checked={!!field.repeatable} onCheckedChange={v => set("repeatable", v)} />
                    <Label>Repeatable</Label>
                  </div>
                )}
              </div>
            )}

            {/* Repeatable toggle for all scalar types */}
            {!SELF_REPEATING.includes(field.type) && (
              <div className="flex items-center gap-3">
                <Switch checked={!!field.repeatable} onCheckedChange={v => set("repeatable", v)} />
                <Label>Repeatable <span className="text-xs text-muted-foreground font-normal">(stores as array)</span></Label>
              </div>
            )}

            {/* Default value — shown for scalar types only, hidden when repeatable */}
            {!field.repeatable && !["media", "relation", "component", "dynamiczone", "richblock", "richtext", "json"].includes(field.type) && (
              <div className="space-y-1.5">
                <Label>Default Value</Label>

                {field.type === "boolean" && (
                  <div className="flex items-center gap-3 pt-1">
                    <Switch
                      checked={!!field.default}
                      onCheckedChange={v => set("default", v)}
                    />
                    <span className="text-sm text-muted-foreground">{field.default ? "true" : "false"}</span>
                  </div>
                )}

                {["int", "float", "decimal"].includes(field.type) && (
                  <Input
                    type="number"
                    value={field.default ?? ""}
                    onChange={e => set("default", e.target.value !== "" ? +e.target.value : undefined)}
                    placeholder="e.g. 0"
                  />
                )}

                {field.type === "enum" && (
                  <Select
                    value={field.default ?? "__none__"}
                    onValueChange={v => set("default", v === "__none__" ? undefined : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="No default" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No default</SelectItem>
                      {enumInput.split(",").map(s => s.trim()).filter(Boolean).map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {field.type === "date" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={field.default === "$now"}
                        onCheckedChange={v => set("default", v ? "$now" : undefined)}
                      />
                      <span className="text-sm text-muted-foreground">Use today's date</span>
                    </div>
                    {field.default !== "$now" && (
                      <Input
                        type="date"
                        value={field.default ?? ""}
                        onChange={e => set("default", e.target.value || undefined)}
                      />
                    )}
                  </div>
                )}

                {field.type === "datetime" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={field.default === "$now"}
                        onCheckedChange={v => set("default", v ? "$now" : undefined)}
                      />
                      <span className="text-sm text-muted-foreground">Use current date & time</span>
                    </div>
                    {field.default !== "$now" && (
                      <Input
                        type="datetime-local"
                        value={field.default ?? ""}
                        onChange={e => set("default", e.target.value || undefined)}
                      />
                    )}
                  </div>
                )}

                {field.type === "time" && (
                  <Input
                    type="time"
                    value={field.default ?? ""}
                    onChange={e => set("default", e.target.value || undefined)}
                  />
                )}

                {["string", "text", "uid", "email", "url"].includes(field.type) && (
                  <Input
                    value={field.default ?? ""}
                    onChange={e => set("default", e.target.value || undefined)}
                    placeholder="Default text…"
                  />
                )}
              </div>
            )}

            {/* Validation — min/max length for text types */}
            {["string", "text", "richtext", "uid", "email", "url"].includes(field.type) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Min Length</Label>
                  <Input type="number" value={field.validation?.minLength ?? ""} onChange={e => set("validation", { ...field.validation, minLength: e.target.value ? +e.target.value : undefined })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Length</Label>
                  <Input type="number" value={field.validation?.maxLength ?? ""} onChange={e => set("validation", { ...field.validation, maxLength: e.target.value ? +e.target.value : undefined })} />
                </div>
              </div>
            )}

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              {[
                { key: "required", label: "Required" },
                { key: "unique", label: "Unique" },
                { key: "indexed", label: "Indexed" },
                ...(!["component", "dynamiczone", "richblock", "richtext", "json", "text"].includes(field.type)
                  ? [{ key: "filterable", label: "Filterable" }]
                  : []),
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    checked={!!(field as any)[key]}
                    onCheckedChange={v => set(key as keyof ContentTypeField, v)}
                  />
                  <Label className="text-sm">{label}</Label>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!field.name.trim()}>
                {existing ? "Update Field" : "Add Field"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

