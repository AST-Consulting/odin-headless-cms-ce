"use client";
import { KanbanBoard } from "@/components/workflow/KanbanBoard";

export default function WorkflowPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Content Workflow</h1>
      <KanbanBoard />
    </div>
  );
}

