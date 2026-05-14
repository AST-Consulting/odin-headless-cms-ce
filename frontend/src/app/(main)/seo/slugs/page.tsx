"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, X, History, SlidersHorizontal, ChevronUp, ChevronDown, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { getSlugs, deleteSlug, type Slug } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { TablePagination } from "@/components/ui/table-pagination";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlugCard } from "@/components/cards/SlugCard";

const MODULE_TYPES = [
  "article", "static-page", "category", "tag", "author", "testimonial",
  "blog", "faq", "location", "banner"
];

export default function SlugsPage() {
  const { toast } = useToast();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [slugs, setSlugs] = useState<Slug[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [cursors, setCursors] = useState<Record<number, string | null>>({ 0: null });

  // Draft filter states
  const [draftSlug, setDraftSlug] = useState("");
  const [draftType, setDraftType] = useState<string>("all");
  const [draftStatus, setDraftStatus] = useState<string>("all");

  // Applied filter states
  const [appliedSlug, setAppliedSlug] = useState("");
  const [appliedType, setAppliedType] = useState<string>("all");
  const [appliedStatus, setAppliedStatus] = useState<string>("all");

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [sort, setSort] = useState(searchParams.get("sort") || "updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get("sortOrder") as "asc" | "desc") || "desc");

  const router = useRouter();

  const delayedRefresh = async (delayMs = 700) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    fetchSlugs();
  };

  const fetchSlugs = useCallback(async () => {
    if (!selectedProperty?._id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await getSlugs({
        page,
        limit,
        lastId: cursors[page - 1] || undefined,
        propertyId: selectedProperty._id,
        slug: appliedSlug || undefined,
        type: appliedType !== "all" ? appliedType : undefined,
        status: appliedStatus !== "all" ? appliedStatus : undefined,
        sort: sort || undefined,
        sortOrder: sortOrder || undefined,
      });
      const slugsData = (response.data as any)?.slugs || [];
      setSlugs(slugsData);
      setTotal(response.total || 0);

      if (response.lastId) {
        setCursors((prev) => ({ ...prev, [page]: response.lastId!! }));
      }
    } catch (error) {
      console.error("Failed to load slugs:", error);
      toast({
        title: "Error",
        description: "Failed to load slugs",
        variant: "destructive",
      });
      setSlugs([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, selectedProperty?._id, appliedType, appliedStatus, appliedSlug, sort, sortOrder]);

  // Reset cursors when filters or limit change
  useEffect(() => {
    setCursors({ 0: null });
    setPage(1);
  }, [appliedSlug, appliedType, appliedStatus, limit, selectedProperty?._id, sort, sortOrder]);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedSlug) params.set("slug", appliedSlug);
    if (appliedType !== "all") params.set("type", appliedType);
    if (appliedStatus !== "all") params.set("status", appliedStatus);
    if (sort !== "updatedAt") params.set("sort", sort);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

    const queryString = params.toString();
    const newPath = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newPath);
  }, [appliedSlug, appliedType, appliedStatus, sort, sortOrder, pathname, router]);

  useEffect(() => {
    fetchSlugs();
  }, [fetchSlugs]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this slug?")) return;
    try {
      await deleteSlug(id);
      toast({ title: "Success", description: "Slug deleted successfully" });
      delayedRefresh();
    } catch {
      toast({ title: "Error", description: "Failed to delete slug", variant: "destructive" });
    }
  };

  const handleEdit = (slug: Slug) => {
    router.push(`/seo/slugs/edit/${slug._id}`);
  };

  const handleApplyFilter = () => {
    setAppliedSlug(draftSlug);
    setAppliedType(draftType);
    setAppliedStatus(draftStatus);
    setPage(1);
  };

  const handleClearAll = () => {
    setDraftSlug("");
    setDraftType("all");
    setDraftStatus("all");
    setAppliedSlug("");
    setAppliedType("all");
    setAppliedStatus("all");
    setPage(1);
  };

  const hasActiveDraftFilters =
    draftSlug.length > 0 || draftType !== "all" || draftStatus !== "all";

  const hasAppliedFilters =
    appliedSlug.length > 0 || appliedType !== "all" || appliedStatus !== "all";

  const formatDate = (date: any) => {
    if (!date) return "-";
    const dateVal = (date as any).$date || date;
    try {
      return new Date(dateVal).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  const getStatusBadge = (status: string) =>
    status === "active" ? (
      <Badge variant="default">Active</Badge>
    ) : (
      <Badge variant="secondary">Inactive</Badge>
    );

  const baseUrl = selectedProperty?.domain
    ? (selectedProperty.domain.startsWith("http") ? selectedProperty.domain : `https://${selectedProperty.domain}`)
    : "";

  const getDisplayFullSlug = (slug: Slug) => {
    if (!selectedProperty || !selectedProperty.urlPatterns) return slug.fullSlug || slug.slug;
    const patterns = selectedProperty.urlPatterns;

    switch (slug.type) {
      case 'tag':
        const tagPrefix = patterns.tag ?? 'topic';
        return tagPrefix ? `${tagPrefix}/${slug.slug}` : slug.slug;
      case 'author':
      case 'user':
        const authorPrefix = patterns.author ?? 'author';
        return authorPrefix ? `${authorPrefix}/${slug.slug}` : slug.slug;
      case 'static-page':
        const pagePrefix = patterns.page ?? '';
        return pagePrefix ? `${pagePrefix}/${slug.slug}` : slug.slug;
      case 'category':
        const catPrefix = patterns.category ?? '';
        return catPrefix ? `${catPrefix}/${slug.slug}` : slug.slug;
      default:
        return slug.fullSlug || slug.slug;
    }
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{`Slugs (${total})`}</CardTitle>
            <Button
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              onClick={() => router.push("/seo/slugs/create")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Filter Bar ── */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Slug search */}
            <div className="relative w-full sm:w-auto sm:max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by slug..."
                value={draftSlug}
                onChange={(e) => setDraftSlug(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                className="pl-8 pr-8 w-full"
              />
              {draftSlug && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftSlug("");
                    setAppliedSlug("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear slug filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Type filter */}
            <div className="relative w-full sm:w-44">
              <Select value={draftType} onValueChange={setDraftType}>
                <SelectTrigger className="w-full pr-8 relative [&>svg]:absolute [&>svg]:right-2">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {MODULE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draftType !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftType("all");
                    setAppliedType("all");
                    setPage(1);
                  }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                  aria-label="Clear type filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="relative w-full sm:w-40">
              <Select value={draftStatus} onValueChange={setDraftStatus}>
                <SelectTrigger className="w-full pr-8 relative [&>svg]:absolute [&>svg]:right-2">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {draftStatus !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftStatus("all");
                    setAppliedStatus("all");
                    setPage(1);
                  }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                  aria-label="Clear status filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              onClick={handleApplyFilter}
              size="sm"
              className="h-10 px-4 gap-2"
              disabled={!hasActiveDraftFilters && !hasAppliedFilters}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Apply Filter
            </Button>

            {hasAppliedFilters && (
              <Button
                variant="ghost"
                onClick={handleClearAll}
                size="sm"
                className="h-10 text-muted-foreground hover:text-foreground gap-1"
              >
                <X className="h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>

          {/* ── Desktop Table (lg+) ── */}
          <div className="hidden xl:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Full Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
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
                  <TableHead>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : slugs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No slugs found
                    </TableCell>
                  </TableRow>
                ) : (
                  slugs.map((slug) => (
                    <TableRow key={slug._id}>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <span 
                            className="font-mono font-medium cursor-pointer hover:underline text-primary transition-colors"
                            onClick={() => handleEdit(slug)}
                          >
                            {slug.slug}
                          </span>
                          {baseUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                const fullPath = getDisplayFullSlug(slug);
                                const path = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;
                                window.open(`${baseUrl}/${path}`, "_blank");
                              }}
                              title="View page"
                            >
                              <SquareArrowOutUpRight className="h-[10px] w-[10px]" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{slug.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex flex-col gap-1 items-start">
                          <span>{getDisplayFullSlug(slug)}</span>
                          {baseUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                const fullPath = getDisplayFullSlug(slug);
                                const path = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;
                                window.open(`${baseUrl}/${path}`, "_blank");
                              }}
                              title="View page"
                            >
                              <SquareArrowOutUpRight className="h-[10px] w-[10px]" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(slug.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{slug.createdBy?.name || "-"}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(slug.createdAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{slug.updatedBy?.name || "-"}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(slug.updatedAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/audit-trail/${slug._id}`)}>
                            <History className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(slug)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(slug._id)}>
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

          {/* ── Mobile / Tablet Card Grid (< lg) ── */}
          <div className="xl:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                Loading...
              </div>
            ) : slugs.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground bg-card rounded-xl border border-dashed">
                No slugs found
              </div>
            ) : (
              slugs.map((slug) => (
                <SlugCard
                  key={slug._id}
                  slug={slug}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAuditTrail={(id) => router.push(`/audit-trail/${id}`)}
                />
              ))
            )}
          </div>

          <TablePagination
            page={page}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
