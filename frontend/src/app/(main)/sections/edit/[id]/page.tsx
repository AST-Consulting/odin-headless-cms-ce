"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getSectionById, updateSection, uploadFile } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { ChevronDown, ChevronUp, Plus, Trash2, X, ArrowLeft, HelpCircle } from "lucide-react";
import { CategorySelector } from "@/components/common/CategorySelector";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { usePropertyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { AuthorStub } from "@/lib/types";
interface Section {
  _id: string;
  title: string;
  titleHindi?: string;
  slug?: string;
  description?: string;
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

export default function EditSectionPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const sectionId = params?.id as string;

  const [loading, setLoading] = useState(false);
  const [fetchingSection, setFetchingSection] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const queryClient = useQueryClient();
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
  const [rank, setRank] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sectionUrls, setSectionUrls] = useState<string[]>([""]);
  const [periodicUpdate, setPeriodicUpdate] = useState(true);
  const [image, setImage] = useState<{ fileName: string; path: string; id: string } | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoMetaDescription, setSeoMetaDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [count, setCount] = useState("10");
  const [selectedAuthors, setSelectedAuthors] = useState<AuthorStub[]>([]);
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  useEffect(() => {
    const fetchSection = async () => {
      if (!sectionId) {
        toast({ title: "Error", description: "Section ID not found", variant: "destructive" });
        router.push("/sections");
        return;
      }

      setFetchingSection(true);
      try {
        const response = await getSectionById({ sectionId });
        const section = response.data;
        // console.log(section);
        setTitle(section.title || "");
        setTitleHindi(section.titleHindi || "");
        setSlug(section.slug || "");
        setDescription(section.description || "");
        setStatus(section.status || "active");
        setLink(section.link || "");
        setWidgetCode(section.widgetCode || "");
        setDisplayType(section.displayType || "");
        setRank(section.rank?.toString() || "0");
        setStartDate(section.startDate ? formatDateForInput(section.startDate) : "");
        setEndDate(section.endDate ? formatDateForInput(section.endDate) : "");
        setSelectedCategories(section.category || []);
        setSectionUrls(
          section.sectionUrls && section.sectionUrls.length > 0
            ? section.sectionUrls
            : [""]
        );
        setPeriodicUpdate(
          section.periodicUpdate !== undefined ? section.periodicUpdate : true
        );
        setImage(section.image || null);
        setSeoTitle(section.seo?.title || "");
        setSeoMetaDescription(section.seo?.metaDescription || "");
        setSeoKeywords(section.seo?.keywords?.join(", ") || "");
        setCount(section.count?.toString() || "10");
        setSelectedAuthors(section.author ? [{ id: section.author.id, name: section.author.name, slug: section.author.slug }] : []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to fetch section",
          variant: "destructive",
        });
        router.push("/sections");
      } finally {
        setFetchingSection(false);
      }
    };

    fetchSection();
  }, [sectionId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const url = await uploadFile(file, false);
      setImage({
        fileName: file.name,
        path: url,
        id: url,
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
    if (!slug.trim()) {
      toast({ title: "Error", description: "Slug is required", variant: "destructive" });
      return;
    }
    if (!displayType) {
      toast({ title: "Error", description: "Display Type is required", variant: "destructive" });
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
    if (!selectedProperty) {
      toast({ title: "Error", description: "No property selected", variant: "destructive" });
      return;
    }
    if (selectedAuthors.length === 0) {
      toast({ title: "Error", description: "Author is required", variant: "destructive" });
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
        startDate: startDate,
        endDate: endDate,
        propertyId: selectedProperty?._id || "",
        count: parseInt(count) || 0,
      };

      payload.author = {
        id: selectedAuthors[0].id,
        name: selectedAuthors[0].name,
        slug: selectedAuthors[0].slug,
      };

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
      await updateSection(sectionId, payload);
      toast({ title: "Success", description: "Section updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      //wait for Elastic Search to index the updated section before redirecting
      await new Promise((resolve) => setTimeout(resolve, 700));
      router.push("/sections");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update section",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingSection) {
    return (
      <div className="w-full max-w-full space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/sections")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Edit Section</h1>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-muted-foreground">Loading section...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/sections")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Edit Section</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-1 sm:space-y-1.5">
          <CardTitle className="text-lg sm:text-xl">Section Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

            <div className="space-y-2 col-span-1 md:col-span-2">
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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

            <div className="space-y-2 col-span-1 md:col-span-2">
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
              <Label htmlFor="count">
                Number of Items <span className="text-red-500">*</span>
              </Label>
              <Input
                id="count"
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="10"
                className="h-10"
              />
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
              <Label>Categories</Label>
              <CategorySelector selected={selectedCategories} onChange={setSelectedCategories} />
            </div>

            <div className="space-y-2 col-span-1 md:col-span-2">
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
          </div>
        </CardContent>
      </Card>

      {/* Section URLs */}
      <Collapsible open={isUrlsOpen} onOpenChange={setIsUrlsOpen}>
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-lg sm:text-xl">Section URLs</CardTitle>
              {isUrlsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3">
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible >

      {/* SEO Details */}
      < Collapsible open={isSeoOpen} onOpenChange={setIsSeoOpen} >
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-lg sm:text-xl">SEO Details</CardTitle>
              {isSeoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible >

      {/* Section Image */}
      < Collapsible open={isImageOpen} onOpenChange={setIsImageOpen} >
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-lg sm:text-xl">Section Image</CardTitle>
              {isImageOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-2">
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-4 sm:pb-0">
        <Button
          variant="outline"
          onClick={() => router.push("/sections")}
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
          {loading ? "Updating..." : "Update Section"}
        </Button>
      </div>
    </div>
  );
}
