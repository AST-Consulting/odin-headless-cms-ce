"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Star, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  getTestimonials,
  deleteTestimonial,
  type Testimonial,
} from "@/lib/api";
import { TablePagination } from "@/components/ui/table-pagination";
import { useRouter } from "next/navigation";
import { usePropertyStore } from "@/lib/store";

export default function TestimonialsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [cursors, setCursors] = useState<Record<number, string | null>>({ 0: null });

  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFeatured, setFilterFeatured] = useState<string>("all");
  const [filterRating, setFilterRating] = useState<string>("all");

  const delayedRefresh = async (delayMs = 700) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    loadTestimonials();
  }

  const loadTestimonials = useCallback(async () => {
    if (!selectedProperty?._id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await getTestimonials({
        page,
        limit,
        lastId: cursors[page - 1] || undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        isFeatured: filterFeatured !== "all" ? filterFeatured === "true" : undefined,
        rating: filterRating !== "all" ? parseInt(filterRating) : undefined,
        propertyId: selectedProperty._id,
      });

      if (response.lastId) {
        setCursors(prev => ({ ...prev, [page]: response.lastId!! }));
      }
      // Handle both response.data (array) and response.data.data (nested)
      const testimonialsData = Array.isArray(response.data) ? response.data : (response.data as any)?.data || [];
      setTestimonials(testimonialsData);
      setTotal(response.total || 0);
    } catch (error) {
      console.error("Failed to load testimonials:", error);
      toast({
        title: "Error",
        description: "Failed to load testimonials",
        variant: "destructive",
      });
      setTestimonials([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filterStatus, filterFeatured, filterRating, selectedProperty, cursors]);

  // Reset cursors when filters or limit change
  useEffect(() => {
    setCursors({ 0: null });
  }, [filterStatus, filterFeatured, filterRating, limit, selectedProperty]);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;

    try {
      await deleteTestimonial(id);
      toast({
        title: "Success",
        description: "Testimonial deleted successfully",
      });
      delayedRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete testimonial",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (testimonial: Testimonial) => {
    router.push(`/testimonials/edit/${testimonial._id}`);
  };

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterFeatured("all");
    setFilterRating("all");
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      approved: "default",
      pending: "secondary",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
              }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{`Testimonials (${total})`}</h1>
          <p className="text-muted-foreground">Manage customer testimonials</p>
        </div>
        <Button onClick={() => router.push("/testimonials/create")} size="icon" className="rounded-full h-10 w-10">
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div className="w-full sm:w-48">
          <label className="text-sm font-medium mb-1 block">Status</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-48">
          <label className="text-sm font-medium mb-1 block">Featured</label>
          <Select value={filterFeatured} onValueChange={setFilterFeatured}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Featured</SelectItem>
              <SelectItem value="false">Not Featured</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-48">
          <label className="text-sm font-medium mb-1 block">Rating</label>
          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger>
              <SelectValue placeholder="All Ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(filterStatus !== "all" || filterFeatured !== "all" || filterRating !== "all") && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="mb-0.5"
          >
            <X className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Author</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Testimonial</TableHead>
              <TableHead>Featured</TableHead>
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
            ) : testimonials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No testimonials found
                </TableCell>
              </TableRow>
            ) : (
              testimonials.map((testimonial) => (
                <TableRow key={testimonial._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{testimonial.authorName}</div>
                      {testimonial.authorDesignation && (
                        <div className="text-sm text-muted-foreground">
                          {testimonial.authorDesignation}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{testimonial.authorCompany || "-"}</TableCell>
                  <TableCell>{renderStars(testimonial.rating)}</TableCell>
                  <TableCell>{getStatusBadge(testimonial.status)}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="truncate">{testimonial.testimonialText}</p>
                  </TableCell>
                  <TableCell>
                    {testimonial.isFeatured ? (
                      <Badge variant="default">Featured</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost"
                        size="sm" onClick={() => router.push(`audit-trail/${testimonial._id}`)}>
                        <History className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(testimonial)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(testimonial._id)}
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
  );
}
