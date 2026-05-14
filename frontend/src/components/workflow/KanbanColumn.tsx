"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KanbanCard } from "./KanbanCard";
import { Article } from "@/lib/types";

interface KanbanColumnProps {
  id: string;
  title: string;
  articles: Article[];
}

export const KanbanColumn = ({ id, title, articles }: KanbanColumnProps) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <Card ref={setNodeRef} className="bg-muted/40 min-h-[200px]">
      <CardHeader>
        <CardTitle className="text-lg flex justify-between items-center">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">{articles.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SortableContext items={articles.map(a => a._id)} strategy={verticalListSortingStrategy}>
          {articles.map((article) => (
            <KanbanCard key={article._id} article={article} />
          ))}
        </SortableContext>
      </CardContent>
    </Card>
  );
};
