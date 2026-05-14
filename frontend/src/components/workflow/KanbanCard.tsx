"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Article } from "@/lib/types";

export const KanbanCard = ({ article }: { article: Article }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: article._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="mb-4 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <p className="font-medium mb-2">{article.title}</p>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{article.user.name}</span>
            {article.primaryCategory && (
              <Badge variant="outline">
                {typeof article.primaryCategory === 'string'
                  ? article.primaryCategory
                  : (article.primaryCategory.name || article.primaryCategory.title || "Unknown")}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
