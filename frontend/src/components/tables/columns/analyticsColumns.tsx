"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatNumber } from "@/lib/utils";

export const deskReportColumns: ColumnDef<any>[] = [
  {
    accessorKey: "desk",
    header: "Desk (Beat)",
  },
  {
    accessorKey: "numberOfStories",
    header: "Stories",
  },
  {
    accessorKey: "totalPageviews",
    header: "Total Pageviews",
    cell: ({ row }) => formatNumber(row.getValue("totalPageviews")),
  },
];

export const categoryReportColumns: ColumnDef<any>[] = [
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => row.getValue("category") || "Uncategorized",
  },
  {
    accessorKey: "numberOfStories",
    header: "Stories",
  },
  {
    accessorKey: "totalPageviews",
    header: "Total Pageviews",
    cell: ({ row }) => formatNumber(row.getValue("totalPageviews")),
  },
];
