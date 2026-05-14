"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  createSlug,
  updateSlug,
  type Slug,
  type CreateSlugData,
} from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";

interface SlugFormProps {
  slug?: Slug | null;
  type?: "create" | "edit";
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MODULE_TYPES = [
  "article", "static-page", "category", "tag", "author", "testimonial",
  "blog", "faq", "location","banner"
];

export function SlugForm({ slug = null, onSuccess, onCancel, type = "create" }: SlugFormProps) {
  const { toast } = useToast();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateSlugData>>({
    slug: slug?.slug || "",
    type: slug?.type || "page",
    fullSlug: slug?.fullSlug || "",
    status: slug?.status || "inactive",
    redirectTo: slug?.redirectTo || "",
    redirectCode: slug?.redirectCode || "",
    canonicalUrl: slug?.canonicalUrl || "",
    seo: {
      title: slug?.seo?.title || "",
      metaDescription: slug?.seo?.metaDescription || "",
      keywords: slug?.seo?.keywords || [],
      og: {
        title: slug?.seo?.og?.title || "",
        description: slug?.seo?.og?.description || "",
        url: slug?.seo?.og?.url || "",
        image: slug?.seo?.og?.image || "",
      },
    },
    propertyId: selectedProperty?._id || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.slug || !formData.type) {
        toast({
          title: "Validation Error",
          description: "Please fill in required fields",
          variant: "destructive",
        });
        return;
      }

      // Check if SEO data has any content
      const hasSeoData =
        formData.seo?.title?.trim() ||
        formData.seo?.metaDescription?.trim() ||
        (formData.seo?.keywords && formData.seo.keywords.length > 0) ||
        formData.seo?.og?.title?.trim() ||
        formData.seo?.og?.description?.trim() ||
        formData.seo?.og?.url?.trim() ||
        formData.seo?.og?.image?.trim();

      // Prepare payload
      const payload: Partial<CreateSlugData> = {
        slug: formData.slug,
        type: formData.type,
        fullSlug: formData.fullSlug,
        status: formData.status,
        propertyId: selectedProperty?._id || "",
      };

      // Add optional fields only if they have values
      if (formData.redirectTo?.trim()) {
        payload.redirectTo = formData.redirectTo;
      }
      if (formData.redirectCode?.trim()) {
        payload.redirectCode = formData.redirectCode;
      }
      if (formData.canonicalUrl?.trim()) {
        payload.canonicalUrl = formData.canonicalUrl;
      }

      // Add SEO only if it has content
      if (hasSeoData) {
        payload.seo = formData.seo;
      }

      if (slug) {
        await updateSlug(slug._id, payload);
        toast({
          title: "Success",
          description: "Slug updated successfully",
        });
      } else {
        await createSlug(payload as CreateSlugData);
        toast({
          title: "Success",
          description: "Slug created successfully",
        });
      }

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${slug ? "update" : "create"} slug`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="md:p-4 lg:p-8 p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{type === "create" ? "Create Slug" : "Update Slug"}</h1>
        <p className="text-muted-foreground">
          {type === "create" ? "Add a new slug to your site" : "Update slug details"}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="md:space-y-6 space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 md:gap-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="slug">
                  Slug <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="my-page-slug"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">
                  Type <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullSlug">Full Slug</Label>
                <Input
                  id="fullSlug"
                  value={formData.fullSlug}
                  onChange={(e) =>
                    setFormData({ ...formData, fullSlug: e.target.value })
                  }
                  placeholder="/parent/my-page-slug"
                />
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>


            <div className="md:col-span-2">
              <Collapsible>
                <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-medium">
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  Redirect Settings (Optional)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="redirectTo">Redirect To URL</Label>
                    <Input
                      id="redirectTo"
                      value={formData.redirectTo}
                      onChange={(e) =>
                        setFormData({ ...formData, redirectTo: e.target.value })
                      }
                      placeholder="https://example.com/redirect"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="redirectCode">Redirect Code</Label>
                    <Select
                      value={formData.redirectCode}
                      onValueChange={(value) =>
                        setFormData({ ...formData, redirectCode: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select code" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="301">301 - Permanent</SelectItem>
                        <SelectItem value="302">302 - Temporary</SelectItem>
                        <SelectItem value="307">307 - Temporary (Preserve Method)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="canonicalUrl">Canonical URL</Label>
                    <Input
                      id="canonicalUrl"
                      value={formData.canonicalUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, canonicalUrl: e.target.value })
                      }
                      placeholder="https://example.com/original"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="md:col-span-2">
              <Collapsible>
                <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-medium">
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  SEO Settings (Optional)
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="seoTitle">Meta Title</Label>
                    <Input
                      id="seoTitle"
                      value={formData.seo?.title}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seo: {
                            title: e.target.value,
                            metaDescription: formData.seo?.metaDescription || "",
                            keywords: formData.seo?.keywords || [],
                            og: formData.seo?.og || { title: "", description: "" },
                          },
                        })
                      }
                      placeholder="Page title for SEO"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seoDescription">Meta Description</Label>
                    <Input
                      id="seoDescription"
                      value={formData.seo?.metaDescription}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seo: {
                            title: formData.seo?.title || "",
                            metaDescription: e.target.value,
                            keywords: formData.seo?.keywords || [],
                            og: formData.seo?.og || { title: "", description: "" },
                          },
                        })
                      }
                      placeholder="Page description for SEO"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>

        <div className="flex md:justify-end justify-between gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : slug ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
