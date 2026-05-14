"use client";

import { useQuery } from "@tanstack/react-query";
import { usePropertyStore } from "@/lib/store";
import {
  fetchGARealtime,
  fetchGADeepRealtimePages,
  fetchGADeepRealtimeDimensions,
} from "@/lib/api";
import { DataTable } from "@/components/tables/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi, Loader2, Users, FileText, UserSquare, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const pageColumns: ColumnDef<any>[] = [
  { accessorKey: "page", header: "Page path and screen class", cell: ({ row }) => (
    <span className="text-sm line-clamp-1 max-w-[500px]" title={row.getValue("page")}>
      {row.getValue("page")}
    </span>
  )},
  { accessorKey: "activeUsers", header: "Active users", cell: ({ row }) => row.getValue<number>("activeUsers").toLocaleString() },
  { accessorKey: "pageviews", header: "Pageviews", cell: ({ row }) => {
      const pv = row.getValue<number>("pageviews");
      return pv !== undefined ? pv.toLocaleString() : "—";
    } 
  },
];

const authorColumns: ColumnDef<any>[] = [
  { accessorKey: "label", header: "Author Name" },
  { accessorKey: "activeUsers", header: "Active users", cell: ({ row }) => row.getValue<number>("activeUsers").toLocaleString() },
];

const categoryColumns: ColumnDef<any>[] = [
  { accessorKey: "label", header: "Category" },
  { accessorKey: "activeUsers", header: "Active users", cell: ({ row }) => row.getValue<number>("activeUsers").toLocaleString() },
];

export default function RealtimePages() {
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const gaPropertyId = selectedProperty?._id ?? null;

  // Realtime Headline
  const { data: realtime, isLoading: loadingRealtime } = useQuery({
    queryKey: ["ga", "realtime", gaPropertyId],
    queryFn: () => fetchGARealtime(gaPropertyId!),
    enabled: !!gaPropertyId,
    refetchInterval: 60000,
  });

  // Deep Pages (200)
  const { data: realtimePages, isLoading: loadingPages } = useQuery({
    queryKey: ["ga", "realtime-pages", gaPropertyId],
    queryFn: () => fetchGADeepRealtimePages(gaPropertyId!),
    enabled: !!gaPropertyId,
    refetchInterval: 60000,
  });

  // Authors
  const { data: realtimeAuthors, isLoading: loadingAuthors } = useQuery({
    queryKey: ["ga", "realtime-authors", gaPropertyId],
    queryFn: () => fetchGADeepRealtimeDimensions(gaPropertyId!, 'customEvent:author'),
    enabled: !!gaPropertyId,
    refetchInterval: 60000,
  });

  // Categories
  const { data: realtimeCategories, isLoading: loadingCategories } = useQuery({
    queryKey: ["ga", "realtime-categories", gaPropertyId],
    queryFn: () => fetchGADeepRealtimeDimensions(gaPropertyId!, 'customEvent:category'),
    enabled: !!gaPropertyId,
    refetchInterval: 60000,
  });

  if (!gaPropertyId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Select a property to view realtime data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Strip (Dual Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-muted p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-dashed border-muted-foreground/30 pb-0.5">
              Active Users in last 30 minutes
            </span>
          </div>
          {loadingRealtime ? (
            <div className="h-10 w-32 bg-muted rounded animate-pulse mt-2" />
          ) : (
            <div className="min-h-[3.5rem] overflow-hidden mt-2">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={realtime?.activeUsers}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="text-5xl font-black tabular-nums tracking-tight block"
                >
                  {realtime?.activeUsers?.toLocaleString() ?? 0}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </Card>

        <Card className="shadow-sm border-muted p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-dashed border-muted-foreground/30 pb-0.5">
              Views in last 30 minutes
            </span>
          </div>
          {loadingRealtime ? (
            <div className="h-10 w-32 bg-muted rounded animate-pulse mt-2" />
          ) : (
            <div className="min-h-[3.5rem] overflow-hidden mt-2">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={realtime?.pageViews}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="text-5xl font-black tabular-nums tracking-tight block"
                >
                  {realtime?.pageViews?.toLocaleString() ?? 0}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </Card>
      </div>

      {/* Tabbed Dimension Section */}
      <Tabs defaultValue="pages" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="pages" className="gap-2"><FileText className="w-4 h-4" /> Pages</TabsTrigger>
          <TabsTrigger value="authors" className="gap-2"><UserSquare className="w-4 h-4" /> Authors</TabsTrigger>
          <TabsTrigger value="categories" className="gap-2"><FolderOpen className="w-4 h-4" /> Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="pages">
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Page path and screen class</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPages ? (
                <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <DataTable
                  columns={pageColumns}
                  data={realtimePages || []}
                  searchKey="page"
                  searchPlaceholder="Search paths..."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authors">
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Realtime Author Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAuthors ? (
                <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <DataTable
                  columns={authorColumns}
                  data={realtimeAuthors || []}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Realtime Category Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCategories ? (
                <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <DataTable
                  columns={categoryColumns}
                  data={realtimeCategories || []}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
