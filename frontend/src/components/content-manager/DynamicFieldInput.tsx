"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentTypeField, ComponentSchema, MediaRef } from "@/lib/types";
import { MediaFieldInput } from "./MediaFieldInput";
import { RelationFieldInput } from "./RelationFieldInput";
import { Plus, X } from "lucide-react";

const SELF_REPEATING = new Set(["component", "dynamiczone", "relation"]);
const isSelfRepeating = (field: ContentTypeField) =>
  SELF_REPEATING.has(field.type) || (field.type === "media" && !!field.mediaMultiple);

interface Props {
  field: ContentTypeField;
  value: any;
  onChange: (val: any) => void;
  components: ComponentSchema[];
}

export function DynamicFieldInput({ field, value, onChange, components }: Props) {
  const component = components.find(c => c._id === field.componentRef);

  // Universal repeatable wrapper for all scalar types
  if (field.repeatable && !isSelfRepeating(field)) {
    const items: any[] = Array.isArray(value) ? value : [];
    const scalarField = { ...field, repeatable: false };
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <DynamicFieldInput
                field={scalarField}
                value={item}
                onChange={v => { const next = [...items]; next[i] = v; onChange(next); }}
                components={components}
              />
            </div>
            <Button
              variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 text-destructive"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1.5"
          onClick={() => onChange([...items, null])}>
          <Plus className="h-3.5 w-3.5" /> Add {field.label ?? field.name}
        </Button>
      </div>
    );
  }

  switch (field.type) {
    // ── Text variants ─────────────────────────────────────────────────────────
    case "string":
    case "uid":
    case "email":
    case "url":
      return (
        <Input
          type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.label ?? field.name}
        />
      );

    case "password":
      return (
        <Input
          type="password"
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.label ?? field.name}
        />
      );

    case "text":
    case "richtext":
    case "richblock":
      return (
        <Textarea
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.label ?? field.name}
          rows={4}
        />
      );

    // ── Numbers ───────────────────────────────────────────────────────────────
    case "int":
      return (
        <Input
          type="number" step="1"
          value={value ?? ""}
          onChange={e => onChange(e.target.value === "" ? null : parseInt(e.target.value))}
          placeholder={field.label ?? field.name}
        />
      );

    case "float":
    case "decimal":
      return (
        <Input
          type="number" step="any"
          value={value ?? ""}
          onChange={e => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
          placeholder={field.label ?? field.name}
        />
      );

    // ── Boolean ───────────────────────────────────────────────────────────────
    case "boolean":
      return (
        <div className="flex items-center gap-2 h-10">
          <Switch checked={!!value} onCheckedChange={onChange} />
          <span className="text-sm text-muted-foreground">{value ? "Yes" : "No"}</span>
        </div>
      );

    // ── Date / time ───────────────────────────────────────────────────────────
    case "date":
      return (
        <Input
          type="date"
          value={value ? new Date(value).toISOString().slice(0, 10) : ""}
          onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      );

    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={value ? new Date(value).toISOString().slice(0, 16) : ""}
          onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      );

    case "time":
      return (
        <Input
          type="time"
          value={value ? new Date(value).toISOString().slice(11, 16) : ""}
          onChange={e => {
            if (!e.target.value) { onChange(null); return; }
            onChange(`1970-01-01T${e.target.value}:00.000Z`);
          }}
        />
      );

    // ── JSON ──────────────────────────────────────────────────────────────────
    case "json":
      return (
        <Textarea
          value={typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2)}
          onChange={e => {
            try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
          }}
          placeholder='["value1", "value2"]'
          rows={4}
          className="font-mono text-sm"
        />
      );

    // ── Enum ──────────────────────────────────────────────────────────────────
    case "enum": {
      const rawOptions = field.validation?.enumOptions?.length
        ? field.validation.enumOptions
        : (field.validation?.enumValues ?? []).map(v => ({ label: v, value: v }));
      const comboOptions = [
        ...(!field.required ? [{ value: "__none__", label: "— none —" }] : []),
        ...rawOptions.map(o => ({ value: o.value, label: o.label })),
      ];
      return (
        <Combobox
          options={comboOptions}
          value={value ?? ""}
          onChange={v => onChange(v === "__none__" ? null : v)}
          placeholder={`Select ${field.label ?? field.name}`}
          searchPlaceholder={`Search ${field.label ?? field.name}...`}
        />
      );
    }

    // ── Media ─────────────────────────────────────────────────────────────────
    case "media":
      return <MediaFieldInput field={field} value={value} onChange={onChange} />;

    // ── Relation ──────────────────────────────────────────────────────────────
    case "relation":
      return <RelationFieldInput field={field} value={value} onChange={onChange} />;

    // ── Component ─────────────────────────────────────────────────────────────
    case "component": {
      if (!component) {
        return <p className="text-sm text-muted-foreground">Component not found (ref: {field.componentRef})</p>;
      }
      if (field.repeatable) {
        const items: any[] = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{component.displayName} #{i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <ComponentFields
                  fields={component.fields}
                  value={item}
                  onChange={v => { const next = [...items]; next[i] = v; onChange(next); }}
                  components={components}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => onChange([...items, {}])}>
              <Plus className="h-3.5 w-3.5" /> Add {component.displayName}
            </Button>
          </div>
        );
      }
      return (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <ComponentFields
            fields={component.fields}
            value={value ?? {}}
            onChange={onChange}
            components={components}
          />
        </div>
      );
    }

    // ── Dynamic Zone ──────────────────────────────────────────────────────────
    case "dynamiczone": {
      const items: any[] = Array.isArray(value) ? value : [];
      const zoneFields = field.zoneFields ?? [];

      return (
        <div className="space-y-3">
          {zoneFields.length === 0 && items.length === 0 && (
            <p className="text-xs text-muted-foreground">No fields defined for this zone. Configure them in the builder.</p>
          )}

          {items.map((item, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {field.label ?? field.name} #{i + 1}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <ComponentFields
                fields={zoneFields}
                value={item}
                onChange={v => { const next = [...items]; next[i] = v; onChange(next); }}
                components={components}
              />
            </div>
          ))}

          {zoneFields.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => onChange([...items, {}])}>
              <Plus className="h-3.5 w-3.5" /> Add {field.label ?? field.name}
            </Button>
          )}
        </div>
      );
    }

    default:
      return <Input value={value ?? ""} onChange={e => onChange(e.target.value)} />;
  }
}

// Renders all fields of a component inline
function ComponentFields({
  fields, value, onChange, components,
}: {
  fields: ContentTypeField[];
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  components: ComponentSchema[];
}) {
  return (
    <div className="space-y-3">
      {fields.map(f => (
        <div key={f.name} className="space-y-1.5">
          <Label className="text-xs">
            {f.label ?? f.name}
            {f.required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <DynamicFieldInput
            field={f}
            value={value?.[f.name]}
            onChange={v => onChange({ ...value, [f.name]: v })}
            components={components}
          />
        </div>
      ))}
    </div>
  );
}
