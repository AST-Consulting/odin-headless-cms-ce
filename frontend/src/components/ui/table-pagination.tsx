"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function TablePagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: TablePaginationProps) {
  const totalPages = Math.ceil(total / limit) || 1;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-2 md:px-4 py-2 border-t gap-2 md:gap-4 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
            Rows<span className="hidden md:inline"> per page</span>:
          </span>
          <Select
            value={limit.toString()}
            onValueChange={(value) => {
              onLimitChange(parseInt(value));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="w-[60px] md:w-[70px] h-7 md:h-8 text-xs md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
          {startItem}–{endItem} of {total}
        </span>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 md:h-8 md:w-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-xs md:text-sm font-medium px-1 md:px-2 whitespace-nowrap min-w-[50px] md:min-w-[100px] text-center">
          <span className="hidden md:inline">Page </span>{page}
          <span className="md:hidden"> / {totalPages}</span>
          <span className="hidden md:inline"> of {totalPages}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 md:h-8 md:w-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
