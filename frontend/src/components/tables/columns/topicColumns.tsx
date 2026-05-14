"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const createTopicColumns = (onCreateDraft: (topic: string, hindiTopic?: string) => void, language: string = 'en'): ColumnDef<any>[] => [
  {
    accessorKey: "topic",
    header: "Topic",
    cell: ({ row }) => {
      const englishTopic = row.getValue("topic") as string;
      const hindiTopic = row.original.hindiTopic as string | undefined;
      const displayTopic = language === 'hi' && hindiTopic ? hindiTopic : englishTopic;
      return (
        <div className="font-medium">{displayTopic}</div>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      const category = row.getValue("category") as string;
      return category && category !== "—" ? <Badge>{category}</Badge> : <span>—</span>;
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const englishTopic = row.getValue("topic") as string;
      const hindiTopic = row.original.hindiTopic as string | undefined;
      return (
        <div className="text-right">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCreateDraft(englishTopic, hindiTopic)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Draft
          </Button>
        </div>
      );
    },
  },
];
