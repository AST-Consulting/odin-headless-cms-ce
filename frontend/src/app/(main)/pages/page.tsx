"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, History, SlidersHorizontal, Globe, Link as LinkIcon, SquareArrowOutUpRight, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { getPages, deletePage, updatePage, type Page } from "@/lib/api";
import { TablePagination } from "@/components/ui/table-pagination";
import { useDebounce } from "@/hooks/use-debounce";

import { FilterBar } from "@/components/common/FilterBar";
import { usePropertyStore } from "@/lib/store";
import { PageCard } from "@/components/cards/PageCard";
import { decodeHtmlEntities } from "@/lib/utils";

const formatDate = (date: any) => {
  if (!date) return "-";
  const dateVal = (date as any).$date || date;
  try {
    return new Date(dateVal).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

export default function PagesListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [cursors, setCursors] = useState<Record<number, any>>({ 0: null });
  const [draftSearch, setDraftSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState<string>("all");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<string>("all");
  const [sort, setSort] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);

  const loadPages = useCallback(async () => {
    if (!selectedProperty?._id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let cursorToSend: any = undefined;

      if (page > 1 && cursors[page - 1]) {
        cursorToSend = cursors[page - 1];
      } else {
        cursorToSend = undefined;
      }

      const queryParams = {
        page,
        limit,
        sort,
        sortOrder,
        lastSortValues: cursorToSend,
        search: appliedSearch,
        status: appliedStatus !== "all" ? appliedStatus : undefined,
        propertyId: selectedProperty._id,
      };

      const response = await getPages(queryParams);
      // Handle both response.data (array) and response.data.data (nested)
      const resultData = (response as any).data;
      const pagesData = Array.isArray(resultData) ? resultData : resultData?.pages || [];
      setPages(pagesData);
      setTotal(response.total || 0);

      // Update cursors for the next page
      if (response.lastSortValues) {
        setCursors(prev => ({
          ...prev,
          [page]: response.lastSortValues ?? null
        }));
      }
    } catch (error) {
      console.error("Failed to load pages:", error);
      toast({
        title: "Error",
        description: "Failed to load pages",
        variant: "destructive",
      });
      setPages([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, appliedSearch, appliedStatus, selectedProperty, sort, sortOrder]);

  // Helper function for delayed refresh to allow Elasticsearch to index changes
  const delayedRefresh = async (delayMs = 700) => {
    setLoading(true);
    // Wait for Elasticsearch to refresh its index (default refresh interval is ~1 second)
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await loadPages();
  };

  // Reset cursors when filters or limit change
  useEffect(() => {
    setCursors({ 0: null });
    setPage(1);
  }, [appliedSearch, appliedStatus, limit, selectedProperty, sort, sortOrder]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this page?")) return;

    try {
      await deletePage(id);
      toast({
        title: "Success",
        description: "Page deleted successfully",
      });
      // Wait for Elasticsearch to refresh before reloading
      await delayedRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete page",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleStatusToggle = async (pageItem: Page) => {
    try {
      const newStatus = pageItem.isPublished ? false : true;
      await updatePage(pageItem._id, { isPublished: newStatus });
      toast({
        title: "Success",
        description: `Page ${pageItem.isPublished ? "unpublished" : "published"} successfully`,
      });
      // Wait for Elasticsearch to refresh before reloading
      await delayedRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update page status",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleEdit = (pageItem: Page) => {
    router.push(`/pages/edit/${pageItem._id}`);
  };

  const handleAdd = () => {
    router.push("/pages/create");
  };

  const handleApplyFilter = () => {
    setAppliedSearch(draftSearch);
    setAppliedStatus(draftStatus);
    setPage(1);
  };

  const handleClear = () => {
    setDraftSearch("");
    setDraftStatus("all");
    setAppliedSearch("");
    setAppliedStatus("all");
    setPage(1);
  };

  const handleViewPage = (pageItem: Page) => {
    if (baseUrl && pageItem.slug) {
      const slug = pageItem.slug.startsWith("/") ? pageItem.slug.substring(1) : pageItem.slug;
      window.open(`${baseUrl}/${slug}`, "_blank");
    } else {
      toast({
        title: "Link not available",
        description: "Page URL or property domain is missing",
        variant: "destructive",
      });
    }
  };

  const hasActiveFilters = Boolean(appliedSearch || (appliedStatus && appliedStatus !== "all"));

  const baseUrl = selectedProperty?.domain
    ? (selectedProperty.domain.startsWith("http") ? selectedProperty.domain : `https://${selectedProperty.domain}`)
    : "";

  return (
    // Container with proper max-width and responsive spacing
    <div className="w-full max-w-full space-y-4 sm:space-y-6">

      {/* Header with responsive title and add button */}
      <div className="flex justify-between items-center gap-2 sm:gap-3">
        <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight truncate">
          PAGES ({total})
        </h1>
        <Button
          onClick={handleAdd}
          size="icon"
          className="rounded-full h-9 w-9 sm:h-10 sm:w-10 shrink-0"
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>

      {/* Filter bar with responsive layout */}
      <FilterBar
        onClear={handleClear}
        showClear={hasActiveFilters}
      >
        <div className="flex flex-wrap gap-4 items-center w-full">
          <div className="relative w-full sm:max-w-xs">
            <Input
              placeholder="Search by title..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
              className="w-full pr-10 h-10 bg-white dark:bg-gray-800"
            />
            {draftSearch && (
              <button
                type="button"
                onClick={() => setDraftSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-[200px]">
            <Select
              value={draftStatus}
              onValueChange={setDraftStatus}
            >
              <SelectTrigger className="w-full pr-10 h-10 bg-white dark:bg-gray-800 relative">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
            {draftStatus && draftStatus !== "all" && (
              <button
                type="button"
                onClick={() => setDraftStatus("all")}
                className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                title="Clear status filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            onClick={handleApplyFilter}
            size="sm"
            className="h-10 px-4 gap-2"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            Apply Filter
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-10 px-4 text-muted-foreground hover:text-foreground"
            >
              Clear All
            </Button>
          )}
        </div>
      </FilterBar>

      {/* Desktop Table View */}
      <div className="hidden xl:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap min-w-[200px]">
                Title
              </TableHead>
              <TableHead className="whitespace-nowrap min-w-[150px]">
                Slug
              </TableHead>
              <TableHead className="whitespace-nowrap min-w-[150px]">
                <div className="flex items-center gap-2">
                  <span>Created</span>
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'createdAt' && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => {
                        setSort('createdAt');
                        setSortOrder('asc');
                      }}
                      title="Sort by oldest"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'createdAt' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => {
                        setSort('createdAt');
                        setSortOrder('desc');
                      }}
                      title="Sort by latest"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </TableHead>
              <TableHead className="whitespace-nowrap min-w-[150px]">
                <div className="flex items-center gap-2">
                  <span>Updated</span>
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'updatedAt' && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => {
                        setSort('updatedAt');
                        setSortOrder('asc');
                      }}
                      title="Sort by oldest"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-4 w-4 p-0 hover:bg-transparent ${sort === 'updatedAt' && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => {
                        setSort('updatedAt');
                        setSortOrder('desc');
                      }}
                      title="Sort by latest"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </TableHead>
              <TableHead className="whitespace-nowrap text-center min-w-[120px]">
                Publish Status
              </TableHead>
              <TableHead className="whitespace-nowrap min-w-[140px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No pages found
                </TableCell>
              </TableRow>
            ) : (
              pages.map((pageItem) => (
                <TableRow key={pageItem._id}>
                  {/* Title cell */}
                  <TableCell className="max-w-[200px]">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleEdit(pageItem)}
                        className="font-bold truncate cursor-pointer hover:underline text-primary transition-colors text-left w-full"
                      >
                        {decodeHtmlEntities(pageItem.title)}
                      </button>
                      {baseUrl && pageItem.slug && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`${baseUrl}/${pageItem.slug}`, "_blank");
                          }}
                          title="View article page"
                        >
                          <SquareArrowOutUpRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    {pageItem.slug}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className="text-sm font-medium cursor-pointer hover:underline text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const creatorId = (pageItem as any).createdBy?.id || (pageItem as any).createdBy?._id;
                          if (creatorId) router.push(`/users/edit/${creatorId}`);
                        }}
                      >
                        {(pageItem as any).createdBy?.name || "N/A"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate((pageItem as any).createdAt)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className="text-sm font-medium cursor-pointer hover:underline text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const updaterId = (pageItem as any).updatedBy?.id || (pageItem as any).updatedBy?._id;
                          if (updaterId) router.push(`/users/edit/${updaterId}`);
                        }}
                      >
                        {(pageItem as any).updatedBy?.name || "N/A"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate((pageItem as any).updatedAt)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Publish Status Switch */}
                  <TableCell>
                    <div className="flex justify-center">
                      <Switch
                        checked={pageItem.isPublished === true}
                        onCheckedChange={() => handleStatusToggle(pageItem)}
                      />
                    </div>
                  </TableCell>

                  {/* Action buttons */}
                  <TableCell>
                    <div className="flex gap-1 sm:gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPage(pageItem)}
                        className="h-8 w-8 p-0"
                        title="View on site"
                      >
                        <Globe className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`audit-trail/${pageItem._id}`)}
                        className="h-8 w-8 p-0"
                        title="View History"
                      >
                        <History className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(pageItem)}
                        className="h-8 w-8 p-0"
                        title="Edit Page"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pageItem._id)}
                        className="text-destructive h-8 w-8 p-0"
                        title="Delete Page"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile/Tablet Card View */}
      <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
          ))
        ) : pages.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-white rounded-xl border border-dashed">
            No pages found
          </div>
        ) : (
          pages.map((pageItem) => (
            <PageCard
              key={pageItem._id}
              page={pageItem}
              selectedPropertyDomain={baseUrl}
              onEdit={handleEdit}
              onView={handleViewPage}
              onAuditTrail={(id) => router.push(`audit-trail/${id}`)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="w-full pb-4 sm:pb-0">
        <TablePagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
        />
      </div>

    </div>
  );
}