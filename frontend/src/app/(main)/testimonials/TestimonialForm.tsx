"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  createTestimonial,
  updateTestimonial,
  type Testimonial,
  type CreateTestimonialData,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { usePropertyStore } from "@/lib/store";

interface TestimonialFormProps {
  testimonial?: Testimonial | null;
  type?: "create" | "edit";
  onSuccess: () => void;
  onCancel: () => void;
}

export function TestimonialForm({
  testimonial,
  onSuccess,
  onCancel,
  type = "create",
}: TestimonialFormProps) {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateTestimonialData>>({
    testimonialText: testimonial?.testimonialText || "",
    authorName: testimonial?.authorName || "",
    authorDesignation: testimonial?.authorDesignation || "",
    authorCompany: testimonial?.authorCompany || "",
    status: testimonial?.status || "pending",
    rating: testimonial?.rating || 5,
    rank: testimonial?.rank || 0,
    isFeatured: testimonial?.isFeatured || false,
    videoURL: testimonial?.videoURL || "",
    organizationId: user?.organizationId || "default-org",
    propertyId: selectedProperty?._id || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.testimonialText || !formData.authorName || !formData.rating) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log("[TestimonialForm] Submitting data:", formData);

      if (testimonial) {
        await updateTestimonial(testimonial._id, formData);
        toast({
          title: "Success",
          description: "Testimonial updated successfully",
        });
      } else {
        await createTestimonial(formData as CreateTestimonialData);
        toast({
          title: "Success",
          description: "Testimonial created successfully",
        });
      }

      onSuccess();
    } catch (error: unknown) {
      console.error("[TestimonialForm] Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error",
        description: `Failed to ${testimonial ? "update" : "create"} testimonial: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="md:p-4 lg:p-8 p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{type === "create" ? "Create Testimonial" : "Update Testimonial"}</h1>
        <p className="text-muted-foreground">
          {type === "create" ? "Add a new testimonial to your site" : "Update testimonial details"}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="md:space-y-6 space-y-4">
        <Card>
          <CardContent>
            <div className="grid md:grid-cols-2 grid-cols-1 md:gap-4 gap-3">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="authorName">
                  Author Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="authorName"
                  value={formData.authorName}
                  onChange={(e) =>
                    setFormData({ ...formData, authorName: e.target.value })
                  }
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="authorDesignation">Designation</Label>
                <Input
                  id="authorDesignation"
                  value={formData.authorDesignation}
                  onChange={(e) =>
                    setFormData({ ...formData, authorDesignation: e.target.value })
                  }
                  placeholder="CEO"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="authorCompany">Company</Label>
                <Input
                  id="authorCompany"
                  value={formData.authorCompany}
                  onChange={(e) =>
                    setFormData({ ...formData, authorCompany: e.target.value })
                  }
                  placeholder="Tech Corp"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="testimonialText">
                  Testimonial <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="testimonialText"
                  value={formData.testimonialText}
                  onChange={(e) =>
                    setFormData({ ...formData, testimonialText: e.target.value })
                  }
                  placeholder="Enter the testimonial text..."
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating">
                  Rating <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.rating?.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, rating: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Star</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rank">Rank (Order)</Label>
                <Input
                  id="rank"
                  type="number"
                  value={formData.rank}
                  onChange={(e) =>
                    setFormData({ ...formData, rank: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isFeatured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isFeatured: checked })
                  }
                />
                <Label htmlFor="isFeatured">Featured</Label>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="videoURL">Video URL (Optional)</Label>
                <Input
                  id="videoURL"
                  type="url"
                  value={formData.videoURL}
                  onChange={(e) =>
                    setFormData({ ...formData, videoURL: e.target.value })
                  }
                  placeholder="https://example.com/video.mp4"
                />
              </div>

            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : testimonial ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
