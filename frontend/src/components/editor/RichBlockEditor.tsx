"use client";

import { useEditorStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, GripVertical } from "lucide-react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateOutline } from "@/lib/api";
import { Block } from "@/lib/types";

// Sortable Block component
const SortableBlock = ({ block }: { block: Block }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const { updateBlock } = useEditorStore();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 mb-4">
      <button {...attributes} {...listeners} className="cursor-grab mt-2">
        <GripVertical />
      </button>
      <div className="flex-1">
        <Textarea
          value={typeof block.content === 'string' ? block.content : ''}
          onChange={(e) => updateBlock(block.id, { ...block, content: e.target.value })}
          className="w-full"
          rows={3}
        />
      </div>
    </div>
  );
};

export function RichBlockEditor() {
  const { blocks, addBlock, moveBlock, setBlocks } = useEditorStore();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveBlock(active.id as string, over.id as string);
    }
  };
  
  const handleGenerateOutline = async () => {
    // This assumes there's a title block or some other source for the title
    const title = "New Article Title"; // Placeholder
    const outline = await generateOutline(title);
    const newBlocks: Block[] = outline.map((item, index) => ({
      id: `block-${Date.now()}-${index}`,
      type: 'paragraph',
      content: item,
      order: blocks.length + index,
    }));
    setBlocks([...blocks, ...newBlocks]);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Content Editor</CardTitle>
        <Button onClick={handleGenerateOutline} variant="outline">
          Generate Outline with AI
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => (
              <SortableBlock key={block.id} block={block} />
            ))}
          </SortableContext>
        </DndContext>
        <Button onClick={() => addBlock({ id: `block-${Date.now()}`, type: 'paragraph', content: '', order: blocks.length })} variant="secondary" className="mt-4">
          <Plus className="w-4 h-4 mr-2" />
          Add Block
        </Button>
      </CardContent>
    </Card>
  );
}

