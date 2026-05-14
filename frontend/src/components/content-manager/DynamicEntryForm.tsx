"use client";

import { Label } from "@/components/ui/label";
import { ContentTypeSchema, ComponentSchema } from "@/lib/types";
import { DynamicFieldInput } from "./DynamicFieldInput";

interface Props {
  schema: ContentTypeSchema;
  components: ComponentSchema[];
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

export function DynamicEntryForm({ schema, components, data, onChange }: Props) {
  const sorted = [...(schema.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const setField = (name: string, val: any) => onChange({ ...data, [name]: val });

  return (
    <div className="space-y-5">
      {sorted.filter(f => !f.private).map(field => (
        <div key={field.name} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor={field.name}>
              {field.label ?? field.name}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {field.description && (
              <span className="text-xs text-muted-foreground">— {field.description}</span>
            )}
          </div>
          <DynamicFieldInput
            field={field}
            value={data[field.name]}
            onChange={v => setField(field.name, v)}
            components={components}
          />
        </div>
      ))}
    </div>
  );
}
