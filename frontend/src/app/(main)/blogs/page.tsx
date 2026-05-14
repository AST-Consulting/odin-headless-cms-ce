"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, SlidersHorizontal, ListOrdered, History, Globe, X, SquareArrowOutUpRight, Minus, ChevronUp, ChevronDown, Sparkles, Check, MessageCircle, Twitter, Image as ImageIcon, BookOpen, Mail, Bell, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ContentPriority from "@/components/sections/ContentPriority";

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
import { useRouter, useSearchParams, usePathname, redirect } from "next/navigation";
import { getArticles, deleteArticle, getArticleById, updateArticle, getCategories, getTags, getUsers } from "@/lib/api";
import { Article, Category, Tag, AuthorStub } from "@/lib/types";
import { FilterBar } from "@/components/common/FilterBar";
import { AuthorSelector } from "@/components/common/AuthorSelector";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import { useEditorStore } from "@/lib/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker, DateRangePickerHandle } from "@/components/ui/date-range-picker";
import { Combobox } from "@/components/ui/combobox";
import { saveArticle, getOrganizationDetails, type Slug } from "@/lib/api";
import { repurposeArticle, type RepurposeFormat } from "@/lib/repurpose-api";
import { useAuthStore } from "@/lib/auth";
import { usePropertyStore } from "@/lib/store";
import { ArticleCard } from "@/components/cards/ArticleCard";
import { getImageUrl } from "@/lib/utils";

export default function BlogsListPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [cursors, setCursors] = useState<Record<number, any>>({ 0: null });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
  const [activePriorityArticle, setActivePriorityArticle] = useState<Article | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Initialize state from URL params
  const formatForDateTimeLocal = (dateStr: string | null) => {
    if (!dateStr) return "";
    if (dateStr.includes('T')) return dateStr.substring(0, 16);
    return dateStr;
  };

  // Draft filter states (what user sees/types)
  const [draftSearch, setDraftSearch] = useState(searchParams.get("search") || "");
  const [draftStatus, setDraftStatus] = useState<string>(searchParams.get("status") || "all");
  const [draftCategory, setDraftCategory] = useState<string>(searchParams.get("primaryCategory.id") || "all");
  const [draftTag, setDraftTag] = useState<string>(searchParams.get("tag") || "all");
  const [draftAuthor, setDraftAuthor] = useState<AuthorStub[]>(
    searchParams.get("author") ? [{ id: searchParams.get("author")!, name: "Selected Author" }] : []
  );
  const [draftType, setDraftType] = useState<string>(searchParams.get("type") || "all");
  const [draftStartDate, setDraftStartDate] = useState<string>(formatForDateTimeLocal(searchParams.get("startDate")));
  const [draftEndDate, setDraftEndDate] = useState<string>(formatForDateTimeLocal(searchParams.get("endDate")));
  const [draftPreset, setDraftPreset] = useState<string | null>(searchParams.get("preset") || null);

  // Applied filter states (what is actually used for the API call)
  const [appliedSearch, setAppliedSearch] = useState(searchParams.get("search") || "");
  const [appliedStatus, setAppliedStatus] = useState<string>(searchParams.get("status") || "all");
  const [appliedCategory, setAppliedCategory] = useState<string>(searchParams.get("primaryCategory.id") || "all");
  const [appliedTag, setAppliedTag] = useState<string>(searchParams.get("tag") || "all");
  const [appliedAuthor, setAppliedAuthor] = useState<AuthorStub[]>(
    searchParams.get("author") ? [{ id: searchParams.get("author")!, name: "Selected Author" }] : []
  );
  const [appliedType, setAppliedType] = useState<string>(searchParams.get("type") || "all");
  const [appliedStartDate, setAppliedStartDate] = useState<string>(searchParams.get("startDate") || "");
  const [appliedEndDate, setAppliedEndDate] = useState<string>(searchParams.get("endDate") || "");
  const [appliedPreset, setAppliedPreset] = useState<string | null>(searchParams.get("preset") || null);
  const datePickerRef = useRef<DateRangePickerHandle>(null);

  const [filterCategories, setFilterCategories] = useState<Category[]>([]);
  const [filterTags, setFilterTags] = useState<Tag[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [sort, setSort] = useState(searchParams.get("sort") || "updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get("sortOrder") as "asc" | "desc") || "desc");

  // Editor store actions
  const {
    resetEditor
  } = useEditorStore();

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedSearch) params.set("search", appliedSearch);
    if (sort !== "updatedAt") params.set("sort", sort);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (appliedStatus !== "all") params.set("status", appliedStatus);
    if (appliedCategory !== "all") params.set("primaryCategory.id", appliedCategory);
    if (appliedTag !== "all") params.set("tag", appliedTag);
    if (appliedAuthor.length > 0) params.set("author", appliedAuthor[0].id);
    if (appliedType !== "all") params.set("type", appliedType);
    if (appliedStartDate) params.set("startDate", appliedStartDate);
    if (appliedEndDate) params.set("endDate", appliedEndDate);
    if (appliedPreset) params.set("preset", appliedPreset);

    const queryString = params.toString();
    const newPath = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newPath);
  }, [appliedSearch, sort, sortOrder, appliedStatus, appliedCategory, appliedTag, appliedAuthor, appliedType, appliedStartDate, appliedEndDate, appliedPreset, pathname, router]);

  const delayedRefresh = async (delayMs = 700) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    loadArticles();
  }

  const loadArticles = useCallback(async () => {
    if (!selectedProperty?._id) {
      setLoading(false);
      return;
    }

    try {

      setLoading(true);
      let cursorToSend: any = undefined;

      // if sequential pagination is used
      if (page > 1 && cursors[page - 1]) {
        cursorToSend = cursors[page - 1];
      } else {
        //random jump -> reset cursors
        cursorToSend = undefined;

      }

      const result = await getArticles({
        page,
        limit,
        search: appliedSearch,
        sort,
        sortOrder,
        lastSortValues: cursorToSend,
        status: appliedStatus !== "all" ? appliedStatus : undefined,
        categories: appliedCategory !== "all" ? appliedCategory : undefined,
        tags: appliedTag !== "all" ? appliedTag : undefined,
        author: appliedAuthor.length > 0 ? appliedAuthor[0].id : undefined,
        type: appliedType !== "all" ? appliedType : undefined,
        startDate: appliedStartDate ? (() => {
          try {
            const d = new Date(appliedStartDate);
            // If it's just a date without T, ensure it starts at 00:00:00
            if (!appliedStartDate.includes('T')) d.setHours(0, 0, 0, 0);
            return d.toISOString();
          } catch { return undefined; }
        })() : undefined,
        endDate: appliedEndDate ? (() => {
          try {
            const d = new Date(appliedEndDate);
            // If it's just a date without T, ensure it ends at 23:59:59.999
            if (!appliedEndDate.includes('T')) d.setHours(23, 59, 59, 999);
            // If it's a datetime-local and just has HH:mm, make sure we cover the whole minute
            else if (appliedEndDate.length === 16) d.setSeconds(59, 999);
            return d.toISOString();
          } catch { return undefined; }
        })() : undefined,
        propertyId: selectedProperty._id,
        fields: '_id,title,status,primaryCategory,categories,tags,authors,createdBy,updatedBy,createdAt,updatedAt,slug,fullSlug,type,scheduledAt,featuredMedia,images',
      });

      setArticles(result.data);
      const newTotal = result.total || 0;
      setTotal(newTotal);

      // Update cursors for the next page
      if (result.lastSortValues) {
        setCursors(prev => ({
          ...prev,
          [page]: result.lastSortValues ?? null
        }));
      }
    } catch (error) {
      console.error("Failed to load articles:", error);
      toast({
        title: "Error",
        description: "Failed to load articles",
        variant: "destructive",
      });
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, appliedSearch, sort, sortOrder, appliedStatus, appliedCategory, appliedTag, appliedAuthor, appliedType, appliedStartDate, appliedEndDate, appliedPreset, selectedProperty]);

  // Reset cursors when applied filters or limit change
  useEffect(() => {
    setCursors({ 0: null });
    setPage(1);
  }, [appliedSearch, appliedStatus, appliedCategory, appliedTag, appliedAuthor, appliedType, appliedStartDate, appliedEndDate, appliedPreset, limit, selectedProperty, sort, sortOrder]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const getSafeId = (id: any) => {
    if (!id) return "";
    if (typeof id === 'string') return id;
    if (id.$oid) return id.$oid;
    if (typeof id === 'object' && id._id) return getSafeId(id._id);
    return id.toString();
  };

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

  const handleEdit = (id: string) => {
    // Navigate to the dynamic editor page
    router.push(`/editor/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;

    try {
      await deleteArticle(id);
      toast({
        title: "Success",
        description: "Article deleted successfully",
      });
      delayedRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete article",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateArticle(id, { status: newStatus });
      toast({
        title: "Success",
        description: `Article status updated to ${newStatus}`,
      });
      delayedRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update article status",
        variant: "destructive",
      });
    }
  };

  const handleCategorySearch = useCallback(async (query: string) => {
    if (!selectedProperty) return;
    try {
      const res = await getCategories({ search: query, limit: 15, propertyId: selectedProperty._id });
      setFilterCategories(res.data || []);
    } catch (e) {
      console.error(e);
      setFilterCategories([]);
    }
  }, []);

  const handleTagSearch = useCallback(async (query: string) => {
    if (!selectedProperty) return;
    try {
      const res = await getTags({ search: query, limit: 15, propertyId: selectedProperty._id });
      setFilterTags(res.data || []);
    } catch (e) {
      console.error(e);
      setFilterTags([]);
    }
  }, []);


  const handleAuthorFilterSelect = useCallback((id: any, name?: string) => {
    const safeId = getSafeId(id);
    const author: AuthorStub = { id: safeId, name: name || "Unknown" };
    setDraftAuthor([author]);
    setAppliedAuthor([author]);
  }, [getSafeId]);

  const handleCategoryFilterSelect = useCallback((id: string, title?: string) => {
    setDraftCategory(id);
    setAppliedCategory(id);
    if (title && id !== "all") {
      setFilterCategories(prev => {
        if (prev.some(c => c._id === id)) return prev;
        return [...prev, { _id: id, title: title } as Category];
      });
    }
  }, []);

  const handleApplyFilter = () => {
    setAppliedSearch(draftSearch);
    setAppliedStatus(draftStatus);
    setAppliedCategory(draftCategory);
    setAppliedTag(draftTag);
    setAppliedAuthor(draftAuthor);
    setAppliedType(draftType);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setAppliedPreset(draftPreset);
    setPage(1);
  };

  const handleClearAll = () => {
    setDraftSearch("");
    setDraftStatus("all");
    setDraftCategory("all");
    setDraftTag("all");
    setDraftAuthor([]);
    setDraftType("all");
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftPreset(null);

    setAppliedSearch("");
    setAppliedStatus("all");
    setAppliedCategory("all");
    setAppliedTag("all");
    setAppliedAuthor([]);
    setAppliedType("all");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setAppliedPreset(null);
    setPage(1);
    datePickerRef.current?.clear();
  };

  const handleMapStoryToArticle = (article: Article) => {
    setActivePriorityArticle(article);
    setIsPriorityModalOpen(true);
  };

  const handleConvertToVideo = (article: Article) => {
    const id = getSafeId(article._id);
    if (!id) {
      toast({
        title: "Error",
        description: "Cannot convert this article because its id is missing.",
        variant: "destructive",
      });
      return;
    }
    router.push(`/video-generator?articleId=${encodeURIComponent(id)}`);
  };

  const handleCreateArticle = async () => {
    try {
      const { user } = useAuthStore.getState();
      const { selectedProperty } = usePropertyStore.getState();

      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to create an article",
          variant: "destructive",
        });
        return;
      }

      resetEditor();

      let organizationId = user.organizationId;

      // If organizationId is missing from user object, try to fetch it
      if (!organizationId) {
        try {
          // Check if it's stored as orgId
          if ((user as any).orgId) {
            organizationId = (user as any).orgId;
          } else {
            // Fetch from API
            const orgDetails = await getOrganizationDetails();
            organizationId = orgDetails.data._id;
          }
        } catch (e) {
          console.error("Failed to retrieve organization ID", e);
        }
      }

      if (!organizationId) {
        toast({
          title: "Error",
          description: "Could not determine Organization ID",
          variant: "destructive",
        });
        return;
      }

      // Get language preference or default to 'hi' (as seen in BlockNoteEditor)
      const lang = typeof window !== 'undefined' ? localStorage.getItem('odin_language') || 'hi' : 'hi';

      const newArticlePayload = {
        title: "Untitled Article",
        richBlocks: [
          {
            id: crypto.randomUUID(),
            type: "heading",
            content: [{ type: "text", text: "Untitled Article", styles: {} }],
            metadata: {
              props: {
                backgroundColor: "default",
                textColor: "default",
                textAlignment: "left",
                level: 1
              },
              children: []
            },
            order: 0
          },
          {
            id: crypto.randomUUID(),
            type: "paragraph",
            content: [{ type: "text", text: "Start writing...", styles: {} }],
            metadata: {
              props: {
                backgroundColor: "default",
                textColor: "default",
                textAlignment: "left"
              },
              children: []
            },
            order: 1
          }
        ],
        status: "draft",
        organizationId: organizationId,
        propertyId: selectedProperty?._id || user.propertyId,
        type: 'article',
        lang: lang
      };

      const response = await saveArticle(newArticlePayload);

      // Handle response structure (direct object or { data: object })
      const articleId = response._id || response.data?._id;

      if (articleId) {
        useEditorStore.getState().setCurrentArticleId(articleId);
        // Navigate to the dynamic editor page with the new ID
        router.push(`/editor/${articleId}`);
      } else {
        throw new Error("No article ID returned from creation");
      }
    } catch (error) {
      console.error("Failed to create article:", error);
      toast({
        title: "Error",
        description: "Failed to create new article",
        variant: "destructive",
      });
    }
  };

  const handleViewArticle = (article: Article) => {
    if (baseUrl && article.fullSlug) {
      // Ensure no double slashes if fullSlug starts with /
      const fullSlug = article.fullSlug.startsWith("/") ? article.fullSlug.substring(1) : article.fullSlug;
      window.open(`${baseUrl}/${fullSlug}`, "_blank");
    } else {
      toast({
        title: "Link not available",
        description: "Article URL or property domain is missing",
        variant: "destructive",
      });
    }
  };

  const hasActiveDraftFilters = !!(
    draftSearch ||
    draftStatus !== "all" ||
    draftCategory !== "all" ||
    draftTag !== "all" ||
    draftAuthor.length > 0 ||
    draftType !== "all" ||
    draftStartDate ||
    draftEndDate ||
    draftPreset
  );

  const hasAppliedFilters = !!(
    appliedSearch ||
    appliedStatus !== "all" ||
    appliedCategory !== "all" ||
    appliedTag !== "all" ||
    appliedAuthor.length > 0 ||
    appliedType !== "all" ||
    appliedStartDate ||
    appliedEndDate ||
    appliedPreset
  );

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'published':
        return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
      case 'draft':
        return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200';
      case 'review':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
      case 'scheduled':
        return 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200';
      case 'archived':
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200';
      default:
        return 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';
    }
  };

  const baseUrl = selectedProperty?.domain
    ? (selectedProperty.domain.startsWith("http") ? selectedProperty.domain : `https://${selectedProperty.domain}`)
    : "";

  const getDisplayFullSlug = (slugOrPath: string | Slug | any, type?: string) => {
    if (!slugOrPath) return "";
    
    // If it's a string (like author.slug or a direct path), handle prefixing
    if (typeof slugOrPath === 'string') {
      if (!selectedProperty || !selectedProperty.urlPatterns) return slugOrPath;
      const patterns = selectedProperty.urlPatterns;
      const patternKey = (type === 'user' ? 'author' : type) as keyof typeof patterns;
      const prefix = patterns[patternKey] ?? type;
      return prefix ? `${prefix}/${slugOrPath}` : slugOrPath;
    }
    
    // If it's an object, assume it's a Slug-like object
    if (!selectedProperty || !selectedProperty.urlPatterns) return slugOrPath.fullSlug || slugOrPath.slug || "";
    const patterns = selectedProperty.urlPatterns;

    switch (slugOrPath.type) {
      case 'tag':
        const tagPrefix = patterns.tag ?? 'topic';
        return tagPrefix ? `${tagPrefix}/${slugOrPath.slug}` : slugOrPath.slug;
      case 'author':
      case 'user':
        const authorPrefix = patterns.author ?? 'author';
        return authorPrefix ? `${authorPrefix}/${slugOrPath.slug}` : slugOrPath.slug;
      case 'static-page':
        const pagePrefix = patterns.page ?? '';
        return pagePrefix ? `${pagePrefix}/${slugOrPath.slug}` : slugOrPath.slug;
      case 'category':
        const catPrefix = patterns.category ?? '';
        return catPrefix ? `${catPrefix}/${slugOrPath.slug}` : slugOrPath.slug;
      default:
        return slugOrPath.fullSlug || slugOrPath.slug || "";
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] -m-4 sm:-m-6 pt-4 sm:pt-6 md:pt-8 px-4 sm:px-6 md:px-8 pb-0 overflow-hidden">
      <div className="flex-shrink-0 space-y-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Articles ({total.toLocaleString()})</h1>
            <p className="text-muted-foreground">
              Manage your saved articles from the editor
            </p>
          </div>
          <Button onClick={handleCreateArticle} size="icon" className="rounded-full h-10 w-10">
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        <FilterBar onClear={handleClearAll} showClear={false}>
          <div className="flex flex-col gap-3 w-full">

            {/* Mobile: Search + toggle button in one row */}
            {/* Desktop: all filters in one flex-wrap row */}
            <div className="flex flex-wrap gap-3 items-end w-full">

              {/* Search — always visible */}
              <div className="relative flex flex-col gap-1 flex-[2] min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground invisible select-none">Search</label>
                <div className="relative">
                  <Input
                    placeholder="Search across all fields..."
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                    className="w-full pr-8"
                  />
                  {draftSearch && (
                    <button
                      type="button"
                      onClick={() => { setDraftSearch(""); setAppliedSearch(""); setPage(1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status — hidden on mobile unless expanded */}
              <div className={`relative flex-col gap-1 flex-1 min-w-[140px] ${showAdvancedFilters ? "flex" : "hidden sm:flex"}`}>
                <label className="text-xs font-medium text-muted-foreground invisible select-none">Status</label>
                <div className="relative">
                  <Select value={draftStatus} onValueChange={setDraftStatus}>
                    <SelectTrigger className="w-full pr-16 relative [&>svg]:absolute [&>svg]:right-2">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  {draftStatus !== "all" && (
                    <button
                      type="button"
                      onClick={() => { setDraftStatus("all"); setAppliedStatus("all"); setPage(1); }}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category — hidden on mobile unless expanded */}
              <div className={`relative flex-col gap-1 flex-1 min-w-[200px] ${showAdvancedFilters ? "flex" : "hidden sm:flex"}`}>
                <label className="text-xs font-medium text-muted-foreground invisible select-none">Category</label>
                <div className="relative">
                  <Combobox
                    value={draftCategory}
                    onChange={setDraftCategory}
                    onSearch={handleCategorySearch}
                    options={[
                      { value: "all", label: "All Categories" },
                      ...(draftCategory !== "all" && !(filterCategories || []).some(c => c._id === draftCategory)
                        ? [{ value: draftCategory, label: draftCategory }]
                        : []),
                      ...(filterCategories || []).map((c) => ({ value: c._id, label: c.title })),
                    ]}
                    placeholder="All Categories"
                    searchPlaceholder="Search category..."
                    className="w-full"
                  />
                  {draftCategory !== "all" && (
                    <button
                      type="button"
                      onClick={() => { setDraftCategory("all"); setAppliedCategory("all"); setPage(1); }}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tag — hidden on mobile unless expanded */}
              <div className={`relative flex-col gap-1 flex-1 min-w-[180px] ${showAdvancedFilters ? "flex" : "hidden sm:flex"}`}>
                <label className="text-xs font-medium text-muted-foreground invisible select-none">Tag</label>
                <div className="relative">
                  <Combobox
                    value={draftTag}
                    onChange={setDraftTag}
                    onSearch={handleTagSearch}
                    options={[
                      { value: "all", label: "All Tags" },
                      ...(draftTag !== "all" && !(filterTags || []).some(t => t.slug === draftTag)
                        ? [{ value: draftTag, label: draftTag }]
                        : []),
                      ...(filterTags || []).map((t) => ({ value: t.slug || t._id, label: t.name })),
                    ]}
                    placeholder="All Tags"
                    searchPlaceholder="Search tag..."
                    className="w-full"
                  />
                  {draftTag !== "all" && (
                    <button
                      type="button"
                      onClick={() => { setDraftTag("all"); setAppliedTag("all"); setPage(1); }}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Advanced Inline Filters — always stacked, only when showAdvancedFilters */}
              {showAdvancedFilters && (
                <>
                  {/* Type */}
                  <div className="relative flex flex-col gap-1 flex-1 min-w-[180px]">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <div className="relative">
                      <Select value={draftType} onValueChange={setDraftType}>
                        <SelectTrigger className="w-full pr-16 relative [&>svg]:absolute [&>svg]:right-2">
                          <SelectValue placeholder="Story Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {['article', 'liveblog', 'photo_story', 'video', 'post', 'shorts'].map(type => (
                            <SelectItem key={type} value={type}>
                              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {draftType !== "all" && (
                        <button
                          type="button"
                          onClick={() => { setDraftType("all"); setAppliedType("all"); setPage(1); }}
                          className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Author */}
                  <div className="relative flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-muted-foreground">Author</label>
                    <div className="relative">
                      <AuthorSelector
                        selected={draftAuthor}
                        onChange={setDraftAuthor}
                        placeholder="All Authors"
                        propertyId={selectedProperty?._id}
                        className="w-full"
                      />
                      {draftAuthor.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setDraftAuthor([]); setAppliedAuthor([]); setPage(1); }}
                          className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Date Picker */}
                  <div className="relative flex flex-col gap-1 min-w-[210px]">
                    <label className="text-xs font-medium text-muted-foreground">Date Range</label>
                    <DateRangePicker
                      ref={datePickerRef}
                      onRangeChange={(range, preset) => {
                        if (range) {
                          setDraftStartDate(range.start);
                          setDraftEndDate(range.end);
                          setDraftPreset(preset);
                        } else {
                          setDraftStartDate('');
                          setDraftEndDate('');
                          setDraftPreset(null);
                          setAppliedStartDate('');
                          setAppliedEndDate('');
                          setAppliedPreset(null);
                          setPage(1);
                        }
                      }}
                      initialRange={draftStartDate && draftEndDate ? { start: draftStartDate, end: draftEndDate } : undefined}
                      initialPreset={draftPreset}
                      placeholder="Select dates"
                      align="right"
                    />
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                <Button
                  variant="outline"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`h-10 px-3 gap-1 shrink-0 ${showAdvancedFilters ? "bg-secondary" : ""}`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Advanced
                  {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>

                <Button
                  onClick={handleApplyFilter}
                  className="h-10 px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shrink-0"
                  disabled={!hasActiveDraftFilters && !hasAppliedFilters}
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0" />
                  Apply Filter
                </Button>

                {hasAppliedFilters && (
                  <Button
                    variant="ghost"
                    onClick={handleClearAll}
                    size="sm"
                    className="h-10 px-3 gap-1 bg-secondary shrink-0"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>

            </div>
          </div>
        </FilterBar>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 space-y-6 pb-6">
        <div className="hidden xl:block bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tags</TableHead>
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading articles...
                  </TableCell>
                </TableRow>
              ) : articles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">No articles found</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/editor')}
                      >
                        Create your first article
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                articles.map((article) => {
                  const articleId = getSafeId(article._id);
                  const isExpanded = expandedRows.has(articleId);

                  return (
                    <TableRow key={articleId} className={isExpanded ? "bg-muted/30" : ""}>
                      <TableCell className="align-top">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => toggleRow(articleId)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>

                          {/* Featured Image Thumbnail */}
                          {(() => {
                            const imageUrl = article.featuredMedia?.url || (article.images && article.images.length > 0 ? article.images[0].url : null);
                            if (!imageUrl) return (
                              <div className="h-10 w-16 bg-muted rounded grow-0 shrink-0 flex items-center justify-center text-[10px] text-muted-foreground border">
                                No Image
                              </div>
                            );
                            return (
                              <div className="h-10 w-16 rounded overflow-hidden grow-0 shrink-0 border bg-muted">
                                <img
                                  src={getImageUrl(imageUrl) || undefined}
                                  alt={article.title}
                                  className="h-full w-full object-cover"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              </div>
                            );
                          })()}

                          <div className="flex flex-col gap-1">
                            <div
                              className="font-bold cursor-pointer hover:underline text-primary transition-colors"
                              onClick={() => handleEdit(articleId)}
                            >
                              {article.title}
                            </div>
                            {baseUrl && article.fullSlug && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`${baseUrl}/${article.fullSlug}`, "_blank");
                                }}
                                title="View article page"
                              >
                                <SquareArrowOutUpRight className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {article.authors && article.authors.length > 0 ? (
                          <div className="flex flex-col text-sm">
                            {article.authors.map((author, idx) => {
                              return (
                                <div key={idx} className="mb-2 last:mb-0">
                                  <span
                                    className="text-primary font-bold hover:underline cursor-pointer transition-colors"
                                    onClick={() => router.push(`/users/edit/${getSafeId(author.id)}`)}
                                    title="Open author editor"
                                  >
                                    {author.name || 'Unknown'}
                                  </span>
                                  <div className="flex items-center gap-1 mt-1">
                                    {appliedAuthor[0]?.id !== getSafeId(author.id) ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                                        onClick={() => handleAuthorFilterSelect(author.id, author.name)}
                                        title="Filter by this author"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-7 w-7 p-0 flex items-center justify-center bg-primary text-primary-foreground"
                                        onClick={() => {
                                          setDraftAuthor([]);
                                          setAppliedAuthor([]);
                                        }}
                                        title="Clear author filter"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                    )}

                                    {author.slug && baseUrl && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const fullSlug = getDisplayFullSlug(author.slug, 'author');
                                          window.open(`${baseUrl}/${fullSlug}`, "_blank");
                                        }}
                                        title="View consumer page"
                                      >
                                        <SquareArrowOutUpRight className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2">
                          {/* Primary Category always visible */}
                          {article.primaryCategory && (() => {
                            const cat = article.primaryCategory as any;
                            const catId = (cat && typeof cat === 'object') ? cat._id || cat.id : cat;
                            const catTitle = (cat && typeof cat === 'object') ? cat.title || cat.name : cat;
                            const isFiltered = appliedCategory === catId;

                            return (
                              <div className="flex flex-col group">
                                <Badge variant="default" className="bg-purple-600 hover:bg-purple-700 text-white border-transparent w-fit">
                                  {catTitle}
                                </Badge>
                                <div className="flex items-center gap-1 mt-1">
                                  {isFiltered ? (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex items-center justify-center bg-primary text-primary-foreground"
                                      onClick={() => {
                                        setDraftCategory("all");
                                        setAppliedCategory("all");
                                      }}
                                      title="Clear category filter"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                                      onClick={() => handleCategoryFilterSelect(catId, catTitle)}
                                      title="Filter by this category"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {cat && typeof cat === 'object' && cat.fullSlug && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                                      onClick={() => {
                                        const slug = cat.fullSlug.startsWith('/') ? cat.fullSlug.substring(1) : cat.fullSlug;
                                        window.open(`${baseUrl}/${getDisplayFullSlug(slug, 'category')}`, "_blank");
                                      }}
                                      title="View category page"
                                    >
                                      <SquareArrowOutUpRight className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Remaining Categories */}
                          {(() => {
                            const primaryCategory = article.primaryCategory;
                            const primaryCategoryId = (primaryCategory && typeof primaryCategory === 'object')
                              ? (primaryCategory as any)._id || (primaryCategory as any).id
                              : primaryCategory;

                            const filteredCategories = (article.categories || []).filter(cat => {
                              const catId = (cat && typeof cat === 'object') ? (cat as any)._id || (cat as any).id : cat;
                              return catId !== primaryCategoryId;
                            });

                            if (!isExpanded && filteredCategories.length > 0) {
                              return (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 w-fit cursor-pointer" onClick={() => toggleRow(articleId)}>
                                  +{filteredCategories.length} more
                                </Badge>
                              );
                            }

                            if (isExpanded) {
                              return filteredCategories.map((cat, idx) => {
                                const c = cat as any;
                                const catId = (c && typeof c === 'object') ? c._id || c.id : c;
                                const catTitle = (c && typeof c === 'object') ? c.title || c.name : c;
                                const isFiltered = appliedCategory === catId;

                                return (
                                  <div key={idx} className="flex flex-col group">
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 w-fit">
                                      {catTitle}
                                    </Badge>
                                    <div className="flex items-center gap-1 mt-1">
                                      {isFiltered ? (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          className="h-6 w-6 p-0 flex items-center justify-center bg-primary text-primary-foreground"
                                          onClick={() => {
                                            setDraftCategory("all");
                                            setAppliedCategory("all");
                                          }}
                                          title="Clear category filter"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 w-6 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                                          onClick={() => handleCategoryFilterSelect(catId, catTitle)}
                                          title="Filter by this category"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            }
                            return null;
                          })()}
                          {!article.primaryCategory && (!article.categories || article.categories.length === 0) && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {article.tags && article.tags.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {(isExpanded ? article.tags : article.tags.slice(0, 1)).map((tag, idx) => {
                              const t = tag as any;
                              const tagName = (t && typeof t === 'object') ? t.name : t;
                              const tagSlug = (t && typeof t === 'object') ? (t.fullSlug || t.slug) : null;
                              const isFiltered = appliedTag === tagName;

                              return (
                                <div key={idx} className="flex flex-col group">
                                  <Badge variant="secondary" className="text-xs w-fit">
                                    {tagName}
                                  </Badge>
                                  <div className="flex items-center gap-1 mt-1">
                                    {isFiltered ? (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-6 w-6 p-0 flex items-center justify-center bg-primary text-primary-foreground"
                                        onClick={() => {
                                          setDraftTag("all");
                                          setAppliedTag("all");
                                        }}
                                        title="Clear tag filter"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 w-6 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                                        onClick={() => {
                                          setDraftTag(tagName);
                                          setAppliedTag(tagName);
                                        }}
                                        title="Filter by this tag"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {baseUrl && tagSlug && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 w-6 p-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary border-muted-foreground/30"
                                        onClick={() => {
                                          const slug = tagSlug.startsWith('/') ? tagSlug.substring(1) : tagSlug;
                                          const fullPath = getDisplayFullSlug(slug, 'tag');
                                          window.open(`${baseUrl}/${fullPath}`, "_blank");
                                        }}
                                        title="View tag page"
                                      >
                                        <SquareArrowOutUpRight className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {!isExpanded && article.tags.length > 1 && (
                              <Badge variant="secondary" className="text-xs w-fit cursor-pointer" onClick={() => toggleRow(articleId)}>
                                +{article.tags.length - 1} more
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col">
                          <span
                            className="text-sm font-medium cursor-pointer hover:underline text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const creatorId = article.createdBy?.id || (article.createdBy as any)?._id;
                              if (creatorId) router.push(`/users/edit/${creatorId}`);
                            }}
                          >
                            {article.createdBy?.name || '-'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(article.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col">
                          <span
                            className="text-sm font-medium cursor-pointer hover:underline text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updaterId = article.updatedBy?.id || (article.updatedBy as any)?._id;
                              if (updaterId) router.push(`/users/edit/${updaterId}`);
                            }}
                          >
                            {article.updatedBy?.name || '-'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(article.updatedAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1 items-center">
                          <Badge
                            variant="outline"
                            className={`font-bold transition-colors ${getStatusColor(article.status || "")}`}
                          >
                            {article.status?.toUpperCase() || '-'}
                          </Badge>
                          {article.status === 'scheduled' && article.scheduledAt && (
                            <span className="text-[10px] text-muted-foreground font-medium text-center">
                              {formatDate(article.scheduledAt)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex flex-col gap-1 items-end">
                          <div className="flex gap-1 justify-end">
                            <Button onClick={() => handleViewArticle(article)} variant="ghost" size="sm" title="View article" className="h-8 w-8 p-0">
                              <Globe className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                router.push(`/repurpose/${getSafeId(article._id)}`);
                              }}
                              variant="ghost"
                              size="sm"
                              title="Repurpose article"
                              className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <Sparkles className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMapStoryToArticle(article)}
                              title="Manage priority"
                              className="h-8 w-8 p-0"
                            >
                              <ListOrdered className="w-4 h-4" />
                            </Button>
                            <Button onClick={() => router.push(`/audit-trail/${getSafeId(article._id)}`)} variant="ghost" size="sm" title="View audit-trail" className="h-8 w-8 p-0">
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConvertToVideo(article)}
                              title="Convert to video"
                              className="h-8 w-8 p-0"
                            >
                              <Video className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(getSafeId(article._id))}
                              title="Edit article"
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(getSafeId(article._id))}
                              title="Delete article"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile / Tablet Card View — hidden on wide desktop */}
        <div className="xl:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Loading articles...
            </div>
          ) : articles.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-white rounded-xl border border-dashed">
              No articles found
            </div>
          ) : (
            articles.map((article) => (
              <ArticleCard
                key={getSafeId(article._id)}
                article={article}
                selectedPropertyDomain={selectedProperty?.domain}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={handleViewArticle}
                onMapStory={handleMapStoryToArticle}
                onConvertToVideo={handleConvertToVideo}
                onAuditTrail={(id) => router.push(`/audit-trail/${id}`)}
                onAuthorFilterSelect={handleAuthorFilterSelect}
                appliedAuthorId={appliedAuthor[0]?.id || "all"}
                onCategoryFilterSelect={handleCategoryFilterSelect}
                appliedCategoryId={appliedCategory}
                onTagFilterSelect={(tag) => {
                  setDraftTag(tag);
                  setAppliedTag(tag);
                }}
                appliedTagId={appliedTag}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 z-10">
        <TablePagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>

      <Dialog open={isPriorityModalOpen} onOpenChange={(open) => {
        setIsPriorityModalOpen(open);
        if (!open) setActivePriorityArticle(null);
      }}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Content Priority</DialogTitle>
          </DialogHeader>
          {activePriorityArticle && (
            <ContentPriority 
              selectedArticleId={getSafeId(activePriorityArticle._id)} 
              initialArticle={activePriorityArticle}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
