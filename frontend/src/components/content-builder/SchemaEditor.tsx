"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentTypeField, ComponentSchema, ContentTypeSchema } from "@/lib/types";
import { FieldTypeIcon, fieldTypeLabel } from "./FieldTypeIcon";
import { AddFieldModal } from "./AddFieldModal";
import { GripVertical, Pencil, Trash2, Plus } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  fields: ContentTypeField[];
  components: ComponentSchema[];
  allContentTypes: ContentTypeSchema[];
  onChange: (fields: ContentTypeField[]) => void;
}

function SortableFieldRow({
  field,
  idx,
  componentName,
  onEdit,
  onDelete,
}: {
  field: ContentTypeField;
  idx: number;
  componentName: (ref?: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/40 transition-colors group"
    >
      <GripVertical
        className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FieldTypeIcon type={field.type} className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium">{field.name}</span>
            {field.label && <span className="text-xs text-muted-foreground">({field.label})</span>}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{fieldTypeLabel(field.type)}</Badge>
            {field.required && <Badge variant="destructive" className="text-[10px] h-4 px-1">required</Badge>}
            {field.unique && <Badge variant="outline" className="text-[10px] h-4 px-1">unique</Badge>}
            {field.indexed && <Badge variant="outline" className="text-[10px] h-4 px-1">indexed</Badge>}
            {field.type === "component" && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {componentName(field.componentRef)}{field.repeatable ? " (repeatable)" : ""}
              </Badge>
            )}
            {field.type === "relation" && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {field.relationType} → {field.relationTarget}
              </Badge>
            )}
            {field.type === "enum" && (field.validation?.enumOptions?.length || field.validation?.enumValues?.length) && (() => {
              const labels = field.validation?.enumOptions?.length
                ? field.validation.enumOptions.map(o => o.label)
                : (field.validation?.enumValues ?? []);
              return (
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {labels.slice(0, 3).join(", ")}{labels.length > 3 ? "…" : ""}
                </Badge>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SchemaEditor({ fields, components, allContentTypes, onChange }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const allPlurals = allContentTypes.map(ct => ct.pluralName);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleAdd = (field: ContentTypeField) => {
    onChange([...fields, { ...field, order: fields.length }]);
  };

  const handleEdit = (field: ContentTypeField) => {
    if (editIdx === null) return;
    const updated = [...fields];
    updated[editIdx] = { ...field, order: editIdx };
    onChange(updated);
    setEditIdx(null);
  };

  const handleDelete = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex(f => f.name === active.id);
    const newIdx = fields.findIndex(f => f.name === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(fields, oldIdx, newIdx).map((f, i) => ({ ...f, order: i }));
    onChange(reordered);
  };

  const componentName = (ref?: string) =>
    components.find(c => c._id === ref)?.displayName ?? ref ?? "—";

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
          No fields yet. Click "Add Field" to start building your schema.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map(f => f.name)} strategy={verticalListSortingStrategy}>
          {fields.map((field, idx) => (
            <SortableFieldRow
              key={field.name}
              field={field}
              idx={idx}
              componentName={componentName}
              onEdit={() => setEditIdx(idx)}
              onDelete={() => handleDelete(idx)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button variant="outline" className="w-full border-dashed" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Add Field
      </Button>

      <AddFieldModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
        components={components}
        allContentTypePlurals={allPlurals}
      />

      {editIdx !== null && (
        <AddFieldModal
          open={true}
          onClose={() => setEditIdx(null)}
          onSave={handleEdit}
          existing={fields[editIdx]}
          components={components}
          allContentTypePlurals={allPlurals}
        />
      )}
    </div>
  );
}
