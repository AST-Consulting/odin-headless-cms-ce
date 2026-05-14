"use client";

import { useState, useEffect } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { fetchArticles } from "@/lib/api";
import { Article } from "@/lib/types";
import { ARTICLE_STATUSES } from "@/lib/constants";
import { Loader2 } from "lucide-react";

type ArticlesByStatus = {
  [key: string]: Article[];
};

export function KanbanBoard() {
  const [articlesByStatus, setArticlesByStatus] = useState<ArticlesByStatus>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadArticles = async () => {
      setIsLoading(true);
      const allArticles = await fetchArticles();
      const grouped = ARTICLE_STATUSES.reduce((acc, status) => {
        acc[status.value] = allArticles.filter(a => a.status === status.value);
        return acc;
      }, {} as ArticlesByStatus);
      setArticlesByStatus(grouped);
      setIsLoading(false);
    };
    loadArticles();
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const sourceColumnId = Object.keys(articlesByStatus).find(status => 
        articlesByStatus[status].some(a => a._id === active.id)
      );
      const destColumnId = over.id as string;

      if (sourceColumnId && destColumnId && sourceColumnId !== destColumnId) {
        const articleToMove = articlesByStatus[sourceColumnId].find(a => a._id === active.id);
        
        if (articleToMove) {
          // Optimistic UI Update
          setArticlesByStatus(prev => {
            const newStatus = { ...prev };
            newStatus[sourceColumnId] = newStatus[sourceColumnId].filter(a => a._id !== active.id);
            newStatus[destColumnId] = [...newStatus[destColumnId], { ...articleToMove, status: destColumnId as Article["status"] }];
            return newStatus;
          });
          
          // TODO: API call to update article status in the backend
          // updateArticle(active.id, { status: destColumnId });
        }
      }
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
        {ARTICLE_STATUSES.map((status) => (
          <KanbanColumn
            key={status.value}
            id={status.value}
            title={status.label}
            articles={articlesByStatus[status.value] || []}
          />
        ))}
      </div>
    </DndContext>
  );
}

