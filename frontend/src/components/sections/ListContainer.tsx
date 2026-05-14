"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ListContainerProps {
  id: string;
  children: React.ReactNode;
  title: string;
  save?: boolean;
  saveFunction?: () => void;
  search?: boolean;
  searchTerm?: string;
  setSearchTerm?: (value: string) => void;
}

const ListContainer = ({
  id,
  children,
  title,
  save,
  saveFunction,
  search,
  searchTerm,
  setSearchTerm,
}: ListContainerProps) => {
  const { setNodeRef } = useDroppable({
    id: id,
    data: {
      type: "container",
    },
  });

  return (
    <Card className="flex-1 flex flex-col max-h-[75vh]" ref={setNodeRef}>
      <CardHeader className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-3 sm:pb-4">
        <CardTitle className="text-base sm:text-lg font-semibold truncate">{title}</CardTitle>
        {save && saveFunction && (
          <Button onClick={saveFunction} size="sm" className="w-full sm:w-auto h-9">
            Save
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 sm:gap-4 overflow-hidden min-h-[400px]">
        {search && setSearchTerm !== undefined && (
          <Input
            placeholder="Search Story"
            value={searchTerm || ""}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-shrink-0 mb-2 h-10"
          />
        )}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-10">{children}</div>
      </CardContent>
    </Card>
  );

};

export default ListContainer;

