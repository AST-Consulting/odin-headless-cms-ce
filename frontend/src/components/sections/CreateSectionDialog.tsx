"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { createSection, updateSection, getCategories, uploadFile } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { contentTypeOptions } from "@/lib/sectionConstants";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { usePropertyStore } from "@/lib/store";
import { CategorySelector } from "@/components/common/CategorySelector";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { AuthorStub } from "@/lib/types";

interface Section {
  _id: string;
  title: string;
  titleHindi?: string;
  slug?: string;
  description?: string;
  contentType?: string;
  status?: string;
  rank?: number;
  link?: string;
  widgetCode?: string;
  displayType?: string;
  startDate?: string;
  endDate?: string;
  category?: string[];
  sectionUrls?: string[];
  periodicUpdate?: boolean;
  fixedArticleIds?: string[];
  count?: number;
  author?: {
    id: string;
    name: string;
    slug?: string;
  };
  image?: {
    fileName: string;
    path: string;
    id: string;
  };
  seo?: {
    title?: string;
    metaDescription?: string;
    keywords?: string[];
  };
}

interface CreateSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  sectionToEdit?: Section | null;
}

export function CreateSectionDialog({
  open,
  onOpenChange,
  onSuccess,
  sectionToEdit,
}: CreateSectionDialogProps) {
  const { toast } = useToast();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [seoKeywords, setSeoKeywords] = useState("");

  useEffect(() => {
    if (open) {
      if (sectionToEdit) {
        setTitle(sectionToEdit.title || "");
        setTitleHindi(sectionToEdit.titleHindi || "");
        setSlug(sectionToEdit.slug || "");
        setDescription(sectionToEdit.description || "");
        setStatus(sectionToEdit.status || "active");
        setLink(sectionToEdit.link || "");
        setWidgetCode(sectionToEdit.widgetCode || "");
        setDisplayType(sectionToEdit.displayType || "");
        setContentType(sectionToEdit.contentType || "");
        setRank(sectionToEdit.rank?.toString() || "0");
        setStartDate(sectionToEdit.startDate ? formatDateForInput(sectionToEdit.startDate) : "");
        setEndDate(sectionToEdit.endDate ? formatDateForInput(sectionToEdit.endDate) : "");
        setSelectedCategories(sectionToEdit.category || []);
        setSectionUrls(
          sectionToEdit.sectionUrls && sectionToEdit.sectionUrls.length > 0
            ? sectionToEdit.sectionUrls
            : [""]
        );
        setPeriodicUpdate(
          sectionToEdit.periodicUpdate !== undefined ? sectionToEdit.periodicUpdate : true
        );
        setImage(sectionToEdit.image || null);
        setSeoTitle(sectionToEdit.seo?.title || "");
        setSeoMetaDescription(sectionToEdit.seo?.metaDescription || "");
        setSeoKeywords(sectionToEdit.seo?.keywords?.join(", ") || "");
        setCount(sectionToEdit.count?.toString() || "10");
        setSelectedAuthors(sectionToEdit.author ? [{ id: sectionToEdit.author.id, name: sectionToEdit.author.name, slug: sectionToEdit.author.slug }] : []);
      } else {
        resetForm();
      }
    }
  }, [open, sectionToEdit]);

  // Collapsible states
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isUrlsOpen, setIsUrlsOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [titleHindi, setTitleHindi] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [link, setLink] = useState("");
  const [widgetCode, setWidgetCode] = useState("");
  const [displayType, setDisplayType] = useState("");
  const [contentType, setContentType] = useState("");
  const [rank, setRank] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sectionUrls, setSectionUrls] = useState<string[]>([""]);
  const [periodicUpdate, setPeriodicUpdate] = useState(true);
  const [image, setImage] = useState<{ fileName: string; path: string; id: string } | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoMetaDescription, setSeoMetaDescription] = useState("");
  const [count, setCount] = useState("10");
  const [selectedAuthors, setSelectedAuthors] = useState<AuthorStub[]>([]);
  const currentUser = useAuthStore((state) => state.user);

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  const resetForm = () => {
    setTitle("");
    setTitleHindi("");
    setSlug("");
    setDescription("");
    setStatus("active");
    setLink("");
    setWidgetCode("");
    setDisplayType("");
    setContentType("");
    setRank("0");
    setStartDate("");
    setEndDate("");
    setSelectedCategories([]);
    setSectionUrls([""]);
    setPeriodicUpdate(true);
    setImage(null);
    setSeoTitle("");
    setSeoMetaDescription("");
    setSeoKeywords("");
    setCount("10");
    if (currentUser) {
      setSelectedAuthors([{ id: currentUser.id, name: currentUser.name, slug: currentUser.slug || "" }]);
    } else {
      setSelectedAuthors([]);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const url = await uploadFile(file, false);
      // Get file info from response - we'll need to adjust based on actual API response
      setImage({
        fileName: file.name,
        path: url,
        id: url, // Using URL as ID for now
      });
      toast({ title: "Success", description: "Image uploaded successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddUrl = () => {
    setSectionUrls([...sectionUrls, ""]);
  };

  const handleRemoveUrl = (index: number) => {
    if (sectionUrls.length > 1) {
      setSectionUrls(sectionUrls.filter((_, i) => i !== index));
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...sectionUrls];
    newUrls[index] = value;
    setSectionUrls(newUrls);
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }
    // if (!titleHindi.trim()) {
    //     toast({ title: "Error", description: "Hindi Title is required", variant: "destructive" });
    //     return;
    // }
    if (!slug.trim()) {
      toast({ title: "Error", description: "Slug is required", variant: "destructive" });
      return;
    }
    // if (!description.trim()) {
    //     toast({ title: "Error", description: "Description is required", variant: "destructive" });
    //     return;
    // }
    if (!displayType) {
      toast({ title: "Error", description: "Display Type is required", variant: "destructive" });
      return;
    }
    if (!contentType) {
      toast({ title: "Error", description: "Content Type is required", variant: "destructive" });
      return;
    }
    if (!startDate) {
      toast({ title: "Error", description: "Start Date is required", variant: "destructive" });
      return;
    }
    if (!endDate) {
      toast({ title: "Error", description: "End Date is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        title: title.trim(),
        titleHindi: titleHindi.trim(),
        slug: slug.trim(),
        description: description.trim(),
        status: status,
        rank: parseInt(rank) || 0,
        displayType: displayType,
        contentType: contentType,
        startDate: startDate,
        endDate: endDate,
        count: parseInt(count) || 0,
      };

      if (selectedAuthors.length > 0) {
        payload.author = {
          id: selectedAuthors[0].id,
          name: selectedAuthors[0].name,
          slug: selectedAuthors[0].slug || "",
        };
      }

      if (link) payload.link = link;
      if (widgetCode) payload.widgetCode = widgetCode;
      if (selectedCategories.length > 0) payload.category = selectedCategories;
      if (sectionUrls.filter((url) => url.trim()).length > 0) {
        payload.sectionUrls = sectionUrls.filter((url) => url.trim());
      }
      payload.periodicUpdate = periodicUpdate;
      if (image) payload.image = image;
      if (seoTitle || seoMetaDescription || seoKeywords) {
        payload.seo = {
          title: seoTitle || undefined,
          metaDescription: seoMetaDescription || undefined,
          keywords: seoKeywords
            ? seoKeywords
              .split(",")
              .map((k) => k.trim())
              .filter((k) => k)
            : undefined,
        };
      }

      if (sectionToEdit) {
        await updateSection(sectionToEdit._id, payload);
        toast({ title: "Success", description: "Section updated successfully" });
      } else {
        await createSection(payload);
        toast({ title: "Success", description: "Section created successfully" });
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${sectionToEdit ? "update" : "create"} section`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const contentTypeDisplayValue = contentType || "__none__";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-full md:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sectionToEdit ? "Edit Section" : "Create New Section"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6 py-4">
          {/* Section Details */}{" "}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-semibold">Section Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Section Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter section title"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="titleHindi">Section Title (Hindi)</Label>
                <Input
                  id="titleHindi"
                  value={titleHindi}
                  onChange={(e) => setTitleHindi(e.target.value)}
                  placeholder="Enter Hindi title"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Slug <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="section-slug"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rank">
                  Order <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rank"
                  type="number"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  placeholder="0"
                  className="h-10"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter section description"
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">ACTIVE</SelectItem>
                    <SelectItem value="inactive">INACTIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="link">Section Link</Label>
                <Input
                  id="link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://example.com"
                  className="h-10"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="widgetCode">Widget Code</Label>
                <Textarea
                  id="widgetCode"
                  value={widgetCode}
                  onChange={(e) => setWidgetCode(e.target.value)}
                  placeholder="Enter widget code"
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayType">
                  Display Type <span className="text-red-500">*</span>
                </Label>
                <Select value={displayType} onValueChange={setDisplayType}>
                  <SelectTrigger id="displayType" className="h-10">
                    <SelectValue placeholder="Select display type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carousel">Carousel</SelectItem>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="list">List</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentType">
                  Content Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={contentTypeDisplayValue}
                  onValueChange={(value) => setContentType(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger id="contentType" className="h-10">
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypeOptions.map((type: any) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.option_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  id="startDate"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Select start date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">
                  End Date <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  id="endDate"
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Select end date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Number of Items</Label>
                <Input
                  id="count"
                  type="number"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  placeholder="10"
                  className="h-10"
                />
              </div>


              <div className="space-y-2 md:col-span-2">
                <Label>Categories</Label>
                <CategorySelector selected={selectedCategories} onChange={setSelectedCategories} />
              </div>

              {contentType === "articles" && (
                <div className="space-y-2 col-span-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="periodicUpdate" className="cursor-pointer">
                      Enable Periodic Updates
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            When enabled, this section will automatically update every hour with the
                            latest articles from selected categories. Fixed articles (marked in
                            content priority) will always remain in the section.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="periodicUpdate"
                      checked={periodicUpdate}
                      onCheckedChange={setPeriodicUpdate}
                    />
                    <span className="text-sm text-muted-foreground">
                      {periodicUpdate ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Section URLs */}
          <Collapsible open={isUrlsOpen} onOpenChange={setIsUrlsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent rounded-md">
              <h3 className="text-base sm:text-lg font-semibold">Section URLs</h3>
              {isUrlsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-2">
              {sectionUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="https://example.com"
                    type="url"
                    className="flex-1 h-10"
                  />
                  {sectionUrls.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveUrl(index)}
                      className="shrink-0 h-10 w-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {index === sectionUrls.length - 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleAddUrl}
                      className="shrink-0 h-10 w-10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
          {/* SEO Details */}
          <Collapsible open={isSeoOpen} onOpenChange={setIsSeoOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent rounded-md">
              <h3 className="text-base sm:text-lg font-semibold">SEO Details</h3>
              {isSeoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">Meta Title</Label>
                <Input
                  id="seoTitle"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Enter meta title"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoKeywords">Keywords</Label>
                <Input
                  id="seoKeywords"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  placeholder="keyword1, keyword2, keyword3"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoMetaDescription">Meta Description</Label>
                <Textarea
                  id="seoMetaDescription"
                  value={seoMetaDescription}
                  onChange={(e) => setSeoMetaDescription(e.target.value)}
                  placeholder="Enter meta description"
                  rows={2}
                  className="resize-none"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
          {/* Section Image */}
          <Collapsible open={isImageOpen} onOpenChange={setIsImageOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent rounded-md">
              <h3 className="text-base sm:text-lg font-semibold">Section Image</h3>
              {isImageOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="image">Upload Section Image</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="h-10"
                />
                {uploadingImage && (
                  <div className="text-sm text-muted-foreground">Uploading...</div>
                )}
                {image && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">{image.fileName}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setImage(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || uploadingImage}
            className="w-full sm:w-auto h-10"
          >
            {loading ? "Saving..." : sectionToEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
