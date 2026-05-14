"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { usePropertyStore } from "@/lib/store";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { CategorySelector } from "@/components/common/CategorySelector";
import { TagSelector } from "@/components/common/TagSelector";
import { createPage, updatePage, type Page, type CreatePageData } from "@/lib/api";

interface CreateStaticPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  pageToEdit?: Page | null;
}

export function CreateStaticPageDialog({
  open,
  onOpenChange,
  onSuccess,
  pageToEdit,
}: CreateStaticPageDialogProps) {
  const { toast } = useToast();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [loading, setLoading] = useState(false);
  const [isSeoOpen, setIsSeoOpen] = useState(false);

  // Basic Information
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [metaKeywords, setMetaKeywords] = useState("");
  const [content, setContent] = useState("");

  // SEO Fields
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogUrl, setOgUrl] = useState("");
  const [ogImage, setOgImage] = useState("");

  useEffect(() => {
    if (open) {
      if (pageToEdit) {
        setTitle(pageToEdit.title || "");
        setStatus(pageToEdit.status || "");
        setContent(pageToEdit.content || "");
        setSelectedTags(pageToEdit.tags?.map((t) => (typeof t === "string" ? t : t.id)) || []);
        setSelectedCategories(pageToEdit.categories?.map((c) => (typeof c === "string" ? c : c.id)) || []);

        if (pageToEdit.seo) {
          setSeoTitle(pageToEdit.seo.title || "");
          setSeoDescription(pageToEdit.seo.metaDescription || "");
          setSeoKeywords(pageToEdit.seo.keywords?.join(", ") || "");
        }
      } else {
        resetForm();
      }
    }
  }, [open, pageToEdit]);

  const resetForm = () => {
    setTitle("");
    setStatus("");
    setSelectedTags([]);
    setSelectedCategories([]);
    setMetaKeywords("");
    setContent("");
    setSeoTitle("");
    setSeoDescription("");
    setSeoKeywords("");
    setOgTitle("");
    setOgDescription("");
    setOgUrl("");
    setOgImage("");
  };

  const handleSubmit = async () => {
    if (!title) {
      toast({ title: "Error", description: "Please fill in the title", variant: "destructive" });
      return;
    }
    if (!selectedProperty) {
      toast({ title: "Error", description: "No property selected", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const hasSeoData =
        seoTitle ||
        seoDescription ||
        seoKeywords ||
        ogTitle ||
        ogDescription ||
        ogUrl ||
        ogImage;

      const payload: any = {
        title,
        status,
        content,
        propertyId: selectedProperty._id,
        tags: selectedTags,
        categories: selectedCategories,
        isPublished: false,
      };

      if (seoDescription) {
        payload.metaDescription = seoDescription;
      }

      if (metaKeywords) {
        payload.metaKeywords = metaKeywords.split(",").map((k) => k.trim());
      } else {
        payload.metaKeywords = [];
      }

      if (hasSeoData) {
        payload.seo = {
          title: seoTitle || title,
          description: seoDescription,
          keywords: seoKeywords ? seoKeywords.split(",").map((k) => k.trim()) : [],
          og: {
            title: ogTitle || seoTitle || title,
            description: ogDescription || seoDescription,
            url: ogUrl,
            image: ogImage,
          },
        };
      }

      if (pageToEdit) {
        await updatePage(pageToEdit._id, payload);
        toast({ title: "Success", description: "Page updated successfully" });
      } else {
        await createPage(payload);
        toast({ title: "Success", description: "Page created successfully" });
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${pageToEdit ? "update" : "create"} page`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pageToEdit ? "Edit Static Page" : "Create Static Page"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information Section */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-4">Basic Information:</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter page title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Tags</Label>
                <TagSelector
                  selected={selectedTags}
                  onChange={setSelectedTags}
                />
              </div>
              <div className="space-y-2">
                <Label>Categories</Label>
                <CategorySelector
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label>Keywords</Label>
              <Input
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                placeholder="Enter keywords separated by commas"
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label>Description</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                title="page description"
              />
            </div>
          </div>

          {/* SEO Section */}
          <Collapsible open={isSeoOpen} onOpenChange={setIsSeoOpen}>
            <div className="border rounded-lg p-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <h3 className="text-sm font-semibold">SEO</h3>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isSeoOpen ? "transform rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="seoTitle">SEO Title</Label>
                  <Input
                    id="seoTitle"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder="Enter SEO title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoDescription">SEO Description</Label>
                  <Textarea
                    id="seoDescription"
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder="Enter SEO description"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoKeywords">SEO Keywords</Label>
                  <Input
                    id="seoKeywords"
                    value={seoKeywords}
                    onChange={(e) => setSeoKeywords(e.target.value)}
                    placeholder="Enter SEO keywords separated by commas"
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3">Open Graph (OG) Tags</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ogTitle">OG Title</Label>
                      <Input
                        id="ogTitle"
                        value={ogTitle}
                        onChange={(e) => setOgTitle(e.target.value)}
                        placeholder="Enter OG title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ogUrl">OG URL</Label>
                      <Input
                        id="ogUrl"
                        value={ogUrl}
                        onChange={(e) => setOgUrl(e.target.value)}
                        placeholder="Enter OG URL"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <Label htmlFor="ogDescription">OG Description</Label>
                    <Textarea
                      id="ogDescription"
                      value={ogDescription}
                      onChange={(e) => setOgDescription(e.target.value)}
                      placeholder="Enter OG description"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 mt-4">
                    <Label htmlFor="ogImage">OG Image URL</Label>
                    <Input
                      id="ogImage"
                      value={ogImage}
                      onChange={(e) => setOgImage(e.target.value)}
                      placeholder="Enter OG image URL"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : pageToEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
