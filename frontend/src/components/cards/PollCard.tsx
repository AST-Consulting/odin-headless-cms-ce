"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, BarChart2 } from "lucide-react";
import { Poll } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { getImageUrl } from "@/lib/utils";

interface PollCardProps {
  poll: Poll;
  onEdit: (poll: Poll) => void;
  onDelete: (poll: Poll) => void;
  onStatusChange: (poll: Poll, checked: boolean) => void;
}

export function PollCard({ poll, onEdit, onDelete, onStatusChange }: PollCardProps) {

  return (
    <Card className="overflow-hidden border-gray-100 dark:border-gray-800 hover:shadow-md transition-all">
      <CardContent className="p-0">
        <div className="flex h-32">
          <div className="w-40 bg-gray-100 dark:bg-gray-800 shrink-0">
            {(() => {
              const imageUrl = getImageUrl(Array.isArray(poll.image) ? poll.image[0]?.url : (poll.image as any)?.url);
              return imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <BarChart2 className="w-12 h-12" />
                </div>
              );
            })()}
          </div>
          <div className="flex-1 p-4 flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                  {poll.question}
                </h4>
                <Switch
                  checked={poll.status === 'active'}
                  onCheckedChange={(checked) => onStatusChange(poll, checked)}
                  className="scale-75"
                />
              </div>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] h-4 font-normal">
                  {poll.options.length} options
                </Badge>
                <Badge variant="secondary" className="text-[10px] h-4 font-normal capitalize">
                  {poll.status || "active"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground italic">
                {poll.createdAt ? new Date(poll.createdAt).toLocaleDateString() : 'N/A'}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(poll)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(poll)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
