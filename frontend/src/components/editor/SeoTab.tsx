"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEditorContext } from "./EditorContext";
import { useEditorStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { generateSeoMetadata } from "@/lib/api";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  X,
  Plus,
  Check,
  XCircle,
  HelpCircle,
  Pencil,
  Video,
  Clock,
  Utensils,
  Star,
  Clapperboard,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { AuthorSelector } from "@/components/common/AuthorSelector";
import { CategoryNameSelector } from "@/components/common/CategoryNameSelector";
import { ImagePickerDialog } from "./ImagePickerDialog";
import { ImagePlus } from "lucide-react";
import { refitToFeaturedAspect } from "@/lib/refit-featured-image";
import { Combobox } from "@/components/ui/combobox";
import { getCategories, getCategoryById, getSlugs } from "@/lib/api";
import { slugify, getImageUrl } from "@/lib/utils";
import { usePropertyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import type { FeaturedMedia } from "@/lib/types";

interface SeoMetadata {
  title: string;
  description: string;
}


interface ImageData {
  url: string;
  id: string;
  path: string;
  alt?: string;
  caption?: string;
}

const FeaturedImageSection = React.memo(function FeaturedImageSection({ defaultAlt }: { defaultAlt: string }) {
  const images = useEditorStore((s) => s.images);
  const setImages = useEditorStore((s) => s.setImages);
  const articleType = useEditorStore((s) => s.articleType);
  const isPortrait = articleType === "web_story" || articleType === "shorts";
  const aspectRatio = isPortrait ? 9 / 16 : 16 / 9;
  const aspectLabel = isPortrait ? "9:16" : "16:9";
  const selectedProperty = usePropertyStore((s) => s.selectedProperty);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [metadataAlt, setMetadataAlt] = useState("");
  const [metadataCaption, setMetadataCaption] = useState("");

  const handleImageSelected = useCallback(async (selected: { url: string; id: string; path: string }[]) => {
    if (selected.length === 0) return;
    const image = selected[0];
    const refitted = await refitToFeaturedAspect(image, articleType, selectedProperty?._id);
    setImages([{
      url: refitted.url,
      id: refitted.id,
      path: refitted.path,
      alt: defaultAlt || "Featured Image",
      caption: ""
    }]);
    toast.success("Featured image updated");

    if (selected.length > 1) {
      toast.info("Only the first image was set as featured image");
    }
  }, [defaultAlt, setImages, articleType, selectedProperty?._id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          Featured Image <span className="text-red-500">*</span>
        </Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsImagePickerOpen(true)}
        >
          {images && images.length > 0 ? "Replace Image" : "Add Image"}
        </Button>
      </div>

      {images && images.length > 0 ? (
        <div className="relative w-full max-w-sm rounded-lg overflow-hidden border bg-muted/30 group">
          <img
            src={getImageUrl(images[0].url) ?? undefined}
            alt={images[0].alt || "Featured"}
            className="w-full h-auto"
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setMetadataAlt(images[0].alt || "");
                setMetadataCaption(images[0].caption || "");
                setIsMetadataOpen(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setImages([]);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {images[0].caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 px-2 truncate">
              {images[0].caption}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => setIsImagePickerOpen(true)}
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground text-sm cursor-pointer hover:bg-muted/20 hover:border-primary/50 transition-colors"
        >
          <ImagePlus className="w-8 h-8 mb-2 opacity-50" />
          <span>Click to add a featured image</span>
        </div>
      )}

      {/* Lazy-render dialogs only when open — avoids mounting heavy Radix portals */}
      {isImagePickerOpen && (
        <ImagePickerDialog
          open={isImagePickerOpen}
          onOpenChange={setIsImagePickerOpen}
          onImageSelected={handleImageSelected}
          defaultAspectRatio={aspectLabel as "16:9" | "9:16"}
          galleryAspectRatio={aspectRatio}
          cropConstraint={{ aspect: aspectRatio, minWidth: 1200 }}
          allowedTypes="image"
          orientation={isPortrait ? "portrait" : "landscape"}
        />
      )}

      {isMetadataOpen && (
        <Dialog open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Image Metadata</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Alt Text</Label>
                <Input
                  value={metadataAlt}
                  onChange={(e) => setMetadataAlt(e.target.value)}
                  placeholder="Describe the image for accessibility"
                />
              </div>
              <div className="space-y-2">
                <Label>Caption</Label>
                <Input
                  value={metadataCaption}
                  onChange={(e) => setMetadataCaption(e.target.value)}
                  placeholder="Optional caption displayed below the image"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMetadataOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                setImages([{ ...images[0], alt: metadataAlt, caption: metadataCaption }]);
                setIsMetadataOpen(false);
                toast.success("Image metadata updated");
              }}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});

const FeaturedVideoSection = React.memo(function FeaturedVideoSection() {
  const featuredVideo = useEditorStore((s) => s.featuredVideo);
  const setFeaturedVideo = useEditorStore((s) => s.setFeaturedVideo);
  const articleType = useEditorStore((s) => s.articleType);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState(featuredVideo?.url || "");
  const [duration, setDuration] = useState(featuredVideo?.duration || "");

  // Sync internal state with store
  useEffect(() => {
    setVideoUrl(featuredVideo?.url || "");
    setDuration(featuredVideo?.duration || "");
  }, [featuredVideo]);

  const handleVideoSelected = useCallback((selected: { url: string; id: string; path: string; duration?: string | number }[]) => {
    if (selected.length > 0) {
      const video = selected[0];
      setFeaturedVideo({
        url: video.url,
        id: video.id,
        path: video.path,
        duration: video.duration ? String(video.duration) : undefined,
      });
      toast.success("Featured video updated");
    }
  }, [setFeaturedVideo]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setVideoUrl(url);
    if (!url) {
      setFeaturedVideo(null);
    } else {
      setFeaturedVideo({
        url,
        id: featuredVideo?.id || "",
        path: featuredVideo?.path || "",
        duration: duration || undefined,
      });
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDuration(val);
    if (featuredVideo) {
      setFeaturedVideo({
        ...featuredVideo,
        duration: val || undefined,
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          Featured Video <span className="text-red-500">*</span>
        </Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsImagePickerOpen(true)}
        >
          {featuredVideo ? "Replace Video" : "Add Video"}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Video URL</Label>
          <Input
            placeholder="Paste video URL (mp4, youtube, etc.)"
            value={videoUrl}
            onChange={handleUrlChange}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Video Duration <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="MM:SS or HH:MM:SS"
            required
            value={duration}
            onChange={handleDurationChange}
            className="w-full"
          />
        </div>
      </div>

      {featuredVideo?.url && (
        <div className="relative w-full max-w-sm aspect-video rounded-lg overflow-hidden border bg-black group">
          {featuredVideo.url.includes("youtube.com") || featuredVideo.url.includes("youtu.be") ? (
            (() => {
              const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]{11}).*/;
              const match = featuredVideo.url.trim().match(regExp);
              const videoId = (match && match[1]) ? match[1] : null;

              if (videoId) {
                return (
                  <iframe
                    className="w-full h-full object-contain"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                );
              }
              return <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">Invalid YouTube URL</div>;
            })()
          ) : (
            <video
              src={getImageUrl(featuredVideo.url) ?? undefined}
              className="w-full h-full object-contain"
              controls
            />
          )}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="destructive"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setFeaturedVideo(null);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {isImagePickerOpen && (
        <ImagePickerDialog
          open={isImagePickerOpen}
          onOpenChange={setIsImagePickerOpen}
          onImageSelected={handleVideoSelected}
          allowedTypes={articleType === "shorts" ? "shorts" : "video"}
          orientation={articleType === "shorts" ? "portrait" : "landscape"}
          multiSelect={false}
        />
      )}
    </div>
  );
});

// Helper component to select primary category from selected categories
const PrimaryCategoryFromSelected = React.memo(function PrimaryCategoryFromSelected({
  categories,
  primaryCategory,
  setPrimaryCategory,
  setPrimaryCategorySlug
}: {
  categories: string[];
  primaryCategory: string | null;
  setPrimaryCategory: (id: string | null) => void;
  setPrimaryCategorySlug: (slug: string | null) => void;
}) {
  const [categoryOptions, setCategoryOptions] = useState<{ value: string, label: string, slug: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch category details to show labels
  useEffect(() => {
    const fetchCategoryDetails = async () => {
      if (!categories || categories.length === 0) return;

      try {
        setLoading(true);
        // Fetch each selected category to get their details
        const categoryPromises = categories.map(id => getCategoryById(id));
        const fetchedCategories = await Promise.all(categoryPromises);

        const options = fetchedCategories
          .filter(cat => cat != null)
          .map((cat: any) => ({
            value: cat._id || cat.id,
            label: cat.title,
            slug: cat.fullSlug || cat.slug || ''
          }));

        setCategoryOptions(options);
      } catch (error) {
        console.error('Failed to fetch category details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryDetails();
  }, [categories]);

  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-dashed">
      <Label className="text-sm font-medium">
        Primary Category <span className="text-red-500">*</span>
      </Label>
      <p className="text-xs text-muted-foreground mb-2">
        Select which category should be the primary one from your selected categories
      </p>
      <Combobox
        options={categoryOptions}
        value={primaryCategory || undefined}
        onChange={(val: string | null) => {
          setPrimaryCategory(val);
          // Update slug when primary category changes
          const selectedCat = categoryOptions.find(opt => opt.value === val);
          if (selectedCat) {
            setPrimaryCategorySlug(selectedCat.slug);
          }
        }}
        placeholder={loading ? "Loading..." : "Select primary category..."}
        className="w-full"
      />
    </div>
  );
});

const RecipeMetadataSection = React.memo(function RecipeMetadataSection() {
  const recipeData = useEditorStore((s) => s.recipeData);
  const setRecipeData = useEditorStore((s) => s.setRecipeData);

  const updateField = (field: string, value: string) => {
    setRecipeData({
      ...(recipeData || {}),
      [field]: value
    });
  };

  return (
    <div className="space-y-4 pt-6 border-t mt-6">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
          <Utensils className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-sm">Recipe Schema</h4>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Structured Recipe Information</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5 h-5">
            <Clock size={12} className="text-muted-foreground" />
            Prep Time
          </Label>
          <Input 
            value={recipeData?.prepTime || ""} 
            onChange={(e) => updateField("prepTime", e.target.value)} 
            placeholder="00:15:00"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5 h-5">
            <Clock size={12} className="text-muted-foreground" />
            Cook Time
          </Label>
          <Input 
            value={recipeData?.cookTime || ""} 
            onChange={(e) => updateField("cookTime", e.target.value)} 
            placeholder="00:45:00"
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs h-5 flex items-center">Total Time</Label>
          <Input 
            value={recipeData?.totalTime || ""} 
            onChange={(e) => updateField("totalTime", e.target.value)} 
            placeholder="01:00:00"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs h-5 flex items-center">Category</Label>
          <Input 
            value={recipeData?.recipeCategory || ""} 
            onChange={(e) => updateField("recipeCategory", e.target.value)} 
            placeholder="Dessert"
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs h-5 flex items-center">Cuisine</Label>
          <Input 
            value={recipeData?.recipeCuisine || ""} 
            onChange={(e) => updateField("recipeCuisine", e.target.value)} 
            placeholder="Indian"
            className="h-9"
          />
        </div>
        <div className="col-span-1 space-y-1.5">
          <Label className="text-xs flex items-center gap-1 h-5">
            <Star size={10} className="text-yellow-500 fill-yellow-500" />
            Rating
          </Label>
          <Input 
            value={recipeData?.ratingValue || ""} 
            onChange={(e) => updateField("ratingValue", e.target.value)} 
            placeholder="5"
            className="h-9 px-2"
          />
        </div>
        <div className="col-span-1 space-y-1.5">
          <Label className="text-xs h-5 flex items-center">Count</Label>
          <Input 
            value={recipeData?.ratingCount || ""} 
            onChange={(e) => updateField("ratingCount", e.target.value)} 
            placeholder="1"
            className="h-9 px-2"
          />
        </div>
      </div>
    </div>
  );
});

const MovieReviewMetadataSection = React.memo(function MovieReviewMetadataSection() {
  const movieReviewData = useEditorStore((s) => s.movieReviewData);
  const setMovieReviewData = useEditorStore((s) => s.setMovieReviewData);

  const updateField = (field: string, value: string) => {
    setMovieReviewData({
      ...(movieReviewData || {}),
      [field]: value
    });
  };

  return (
    <div className="space-y-4 pt-6 border-t mt-6">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
          <Clapperboard className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-sm">Movie Review Schema</h4>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Structured Movie Information</p>
        </div>
      </div>
      
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5 h-5 text-muted-foreground uppercase tracking-wider font-semibold">
          Movie Name
        </Label>
        <Input 
          value={movieReviewData?.movieName || ""} 
          onChange={(e) => updateField("movieName", e.target.value)} 
          placeholder="e.g. Inception"
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5 h-5 text-muted-foreground uppercase tracking-wider font-semibold">
            Director
          </Label>
          <Input 
            value={movieReviewData?.director || ""} 
            onChange={(e) => updateField("director", e.target.value)} 
            placeholder="e.g. Christopher Nolan"
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5 h-5 text-muted-foreground uppercase tracking-wider font-semibold">
          Actors
        </Label>
        <Textarea 
          value={movieReviewData?.actors || ""} 
          onChange={(e) => updateField("actors", e.target.value)} 
          placeholder="e.g. Leonardo DiCaprio, Joseph Gordon-Levitt"
          className="min-h-[80px] resize-none"
        />
        <p className="text-[10px] text-muted-foreground">Separate multiple actors using commas or enter.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1 space-y-1.5">
          <Label className="text-xs flex items-center gap-1 h-5 text-muted-foreground uppercase tracking-wider font-semibold">
            <Star size={10} className="text-yellow-500 fill-yellow-500" />
            Rating
          </Label>
          <Input 
            value={movieReviewData?.ratingValue || ""} 
            onChange={(e) => updateField("ratingValue", e.target.value)} 
            placeholder="8.5"
            className="h-9 px-2"
          />
        </div>
        <div className="col-span-1 space-y-1.5">
          <Label className="text-xs h-5 flex items-center text-muted-foreground uppercase tracking-wider font-semibold">Max</Label>
          <Input 
            value={movieReviewData?.bestRating || ""} 
            onChange={(e) => updateField("bestRating", e.target.value)} 
            placeholder="10"
            className="h-9 px-2"
          />
        </div>
        <div className="col-span-1 space-y-1.5">
          <Label className="text-xs h-5 flex items-center text-muted-foreground uppercase tracking-wider font-semibold">R-Count</Label>
          <Input 
            value={movieReviewData?.ratingCount || ""} 
            onChange={(e) => updateField("ratingCount", e.target.value)} 
            placeholder="200"
            className="h-9 px-2"
          />
        </div>
        <div className="col-span-1 space-y-1.5">
          <Label className="text-xs h-5 flex items-center text-muted-foreground uppercase tracking-wider font-semibold">Count</Label>
          <Input 
            value={movieReviewData?.reviewCount || ""} 
            onChange={(e) => updateField("reviewCount", e.target.value)} 
            placeholder="50"
            className="h-9 px-2"
          />
        </div>
      </div>
    </div>
  );
});

export function SeoTab() {
  const { editor } = useEditorContext();
  const {
    seoData: storedSeoData, setSeoData: setStoredSeoData, tags, categories,
    primaryCategory, primaryCategorySlug, authors, slug, status,
    setTags, setCategories, setPrimaryCategory, setPrimaryCategorySlug,
    setAuthors, setSlug, setStatus, englishHeadline, setEnglishHeadline,
    currentArticleId, isManualSlug, setIsManualSlug, slugStatus, setSlugStatus,
    articleType, featuredVideo, setFeaturedVideo
  } = useEditorStore(useShallow((s) => ({
    seoData: s.seoData, setSeoData: s.setSeoData, tags: s.tags, categories: s.categories,
    primaryCategory: s.primaryCategory, primaryCategorySlug: s.primaryCategorySlug,
    authors: s.authors, slug: s.slug, status: s.status,
    setTags: s.setTags, setCategories: s.setCategories, setPrimaryCategory: s.setPrimaryCategory,
    setPrimaryCategorySlug: s.setPrimaryCategorySlug, setAuthors: s.setAuthors, setSlug: s.setSlug,
    setStatus: s.setStatus, englishHeadline: s.englishHeadline, setEnglishHeadline: s.setEnglishHeadline,
    currentArticleId: s.currentArticleId, isManualSlug: s.isManualSlug, setIsManualSlug: s.setIsManualSlug,
    slugStatus: s.slugStatus, setSlugStatus: s.setSlugStatus,
    articleType: s.articleType, featuredVideo: s.featuredVideo, setFeaturedVideo: s.setFeaturedVideo
  })));
  const articleStats = useEditorStore((s) => s.articleStats);
  const { selectedProperty } = usePropertyStore();
  const [generatingFields, setGeneratingFields] = useState<Record<string, boolean>>({
    all: false,
    title: false,
    description: false,
    tags: false,
    headline: false,
  });

  const [seoData, setSeoData] = useState<SeoMetadata>({
    title: "",
    description: "",
  });

  const titleLength = seoData.title.length;
  const descriptionLength = seoData.description.length;

  // Type for target generation
  type TargetField = "all" | "title" | "description" | "tags" | "headline";

  // State for adding new tags
  const [newTag, setNewTag] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // Slug availability state
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);

  // Auto-populate SEO fields from store when available
  useEffect(() => {
    if (storedSeoData) {
      setSeoData(storedSeoData);
    } else {
      setSeoData({ title: "", description: "" });
    }
  }, [storedSeoData]);

  const lastCheckedSlug = useRef("");
  const prevEnglishHeadline = useRef(englishHeadline || "");

  // 🔥 Store original slug once (for edit mode)
  const originalSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (!originalSlugRef.current && slug) {
      originalSlugRef.current = slug.toLowerCase().trim();
    }
  }, [slug]);

  // Auto-generate slug from English Headline
  useEffect(() => {
    // Skip if headline hasn't changed to avoid loops
    if (englishHeadline === prevEnglishHeadline.current) return;

    const oldSlugified = slugify(prevEnglishHeadline.current || "");
    const newSlugified = slugify(englishHeadline || "");

    // Only auto-sync if user hasn't manually edited the slug
    if (!isManualSlug) {
      // Additional check: only sync if slug is empty OR matches the old auto-generated value
      if (!slug || slug === oldSlugified) {
        if (englishHeadline) {
          setSlug(newSlugified);
        } else {
          setSlug(""); // Clear slug if headline is cleared
        }
      }
    }

    prevEnglishHeadline.current = englishHeadline || "";
  }, [englishHeadline, slug, setSlug, isManualSlug]);

  // Check slug availability
  useEffect(() => {
    const trimmedSlug = (slug || "").trim().toLowerCase();

    if (!trimmedSlug || trimmedSlug.length < 3) {
      setSlugStatus(null);
      return;
    }
    // 🔁 same slug already checked
    if (trimmedSlug === lastCheckedSlug.current) return;

    // 🔒 Published or Scheduled → no check
    const s = status?.toLowerCase();
    if (s === "published" || s === "scheduled") {
      setSlugStatus(null);
      return;
    }

    // 🔥 Edit mode: same original slug → skip check
    if (
      currentArticleId &&
      originalSlugRef.current &&
      trimmedSlug === originalSlugRef.current
    ) {
      setSlugStatus(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingSlug(true);

        const { selectedProperty } = usePropertyStore.getState();
        const { user } = useAuthStore.getState();
        const propertyId = selectedProperty?._id || user?.propertyId;

        const response: any = await getSlugs({
          slug: trimmedSlug,
          propertyId: propertyId || undefined,
        });

        const dataArray = response?.data?.slugs || response?.data || [];

        const otherSlugExists = dataArray.some((item: any) => {
          const esSlug = (item.slug || "").trim().toLowerCase();
          return esSlug === trimmedSlug;
        });

        setSlugStatus(otherSlugExists ? "taken" : "available");
        lastCheckedSlug.current = trimmedSlug;
      } catch (error) {
        console.error("Failed to check slug availability:", error);
        setSlugStatus(null);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [slug, currentArticleId, status]);

  const handleGenerateSeo = async (targetField: TargetField = "all") => {
    if (!editor) {
      toast.error("Editor not initialized");
      return;
    }

    // Get markdown content from editor
    const blocks = editor.document;
    if (!blocks || blocks.length === 0) {
      toast.error("No content to analyze. Please add some content first.");
      return;
    }

    // Convert blocks to markdown
    let markdown = "";
    for (const block of blocks) {
      markdown += await editor.blocksToMarkdownLossy([block]);
    }

    if (!markdown.trim()) {
      toast.error("No content to analyze. Please add some content first.");
      return;
    }

    // Extract current title (first H1 heading)
    const lines = markdown.split('\n');
    const firstH1 = lines.find(line => line.startsWith('# '));
    const currentTitle = firstH1 ? firstH1.replace('# ', '').trim() : undefined;

    setGeneratingFields(prev => ({ ...prev, [targetField]: true }));

    // Resolve article language so the backend can keep englishHeadline/tags
    // in English even when the article itself is in another language.
    const propertyLanguage = selectedProperty?.lang;
    const storedLanguage = typeof window !== "undefined"
      ? localStorage.getItem("odin_language")
      : null;
    const articleLanguage = propertyLanguage || storedLanguage || "hi";

    try {
      const response: any = await generateSeoMetadata(markdown, currentTitle, articleLanguage);

      // Handle potential nested structures
      const result = response.data?.seo || response.seo || response.data || response;

      // Update Meta Title
      if (targetField === "all" || targetField === "title") {
        const newTitle = result.title || result.metaTitle;
        if (newTitle) {
          const updatedSeo = { ...seoData, title: newTitle };
          setSeoData(updatedSeo);
          setStoredSeoData(updatedSeo);
        }
      }

      // Update Meta Description
      if (targetField === "all" || targetField === "description") {
        const newDesc = result.description || result.metaDescription;
        if (newDesc) {
          const updatedSeo = { ...seoData, description: newDesc };
          setSeoData(updatedSeo);
          setStoredSeoData(updatedSeo);
        }
      }

      // Update English Headline
      if (targetField === "all" || targetField === "headline") {
        const newHeadline = result.englishHeadline || result.english_headline || result.title;
        if (newHeadline) {
          setEnglishHeadline(newHeadline);
        }
      }

      // Update Tags
      if (targetField === "all" || targetField === "tags") {
        if (result.tags && result.tags.length > 0) {
          setTags(result.tags);
        }
      }

      // Update Categories (only for "all")
      if (targetField === "all") {
        if (result.categories && result.categories.length > 0) {
          setCategories(result.categories);
        }
      }

      toast.success(`${targetField === 'all' ? 'SEO metadata' : targetField.charAt(0).toUpperCase() + targetField.slice(1)} regenerated successfully!`);
    } catch (error) {
      console.error(`Error generating ${targetField}:`, error);
      toast.error(`Failed to generate ${targetField}. Please try again.`);
    } finally {
      setGeneratingFields(prev => ({ ...prev, [targetField]: false }));
    }
  };

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const updatedSeoData = { ...seoData, title: value };
    setSeoData(updatedSeoData);
    setStoredSeoData(updatedSeoData);
  }, [seoData, setStoredSeoData]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const updatedSeoData = { ...seoData, description: value };
    setSeoData(updatedSeoData);
    setStoredSeoData(updatedSeoData);
  }, [seoData, setStoredSeoData]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  const handleAddTag = useCallback(() => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
      toast.success("Tag added");
    } else if (tags.includes(newTag.trim())) {
      toast.error("Tag already exists");
    }
  }, [newTag, tags, setTags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
    toast.success("Tag removed");
  }, [tags, setTags]);

  const handleAddCategory = useCallback(() => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory("");
      toast.success("Category added");
    } else if (categories.includes(newCategory.trim())) {
      toast.error("Category already exists");
    }
  }, [newCategory, categories, setCategories]);

  const handleRemoveCategory = useCallback((categoryToRemove: string) => {
    setCategories(categories.filter(cat => cat !== categoryToRemove));
    toast.success("Category removed");
  }, [categories, setCategories]);

  const titleStatus = useMemo(() => {
    if (titleLength === 0) return { color: "text-muted-foreground", message: "No title yet" };
    if (titleLength < 50) return { color: "text-yellow-600", message: "Too short (50-60 ideal)" };
    if (titleLength > 60) return { color: "text-orange-600", message: "Too long (50-60 ideal)" };
    return { color: "text-green-600", message: "Perfect length!" };
  }, [titleLength]);

  const descriptionStatus = useMemo(() => {
    if (descriptionLength === 0) return { color: "text-muted-foreground", message: "No description yet" };
    if (descriptionLength < 120) return { color: "text-yellow-600", message: "Too short (150-160 ideal)" };
    if (descriptionLength > 160) return { color: "text-orange-600", message: "Too long (max 160)" };
    return { color: "text-green-600", message: "Perfect length!" };
  }, [descriptionLength]);

  const isInputLocked = status === "published" || status === "scheduled";
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SEO Metadata</h3>
          <p className="text-sm text-muted-foreground">
            Optimize your article for search engines
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/80">
            <span>
              <span className="font-medium text-foreground">{articleStats.words.toLocaleString()}</span> {articleStats.words === 1 ? "word" : "words"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-medium text-foreground">{articleStats.readingMinutes}</span> min read
            </span>
          </div>
        </div>
        <Button
          onClick={() => handleGenerateSeo("all")}
          disabled={generatingFields.all}
          className="gap-2"
        >
          {generatingFields.all ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : seoData.title || seoData.description ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Regenerate SEO
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate SEO
            </>
          )}
        </Button>
      </div>

      {(articleType?.toLowerCase() === "video" || articleType?.toLowerCase() === "shorts") && <FeaturedVideoSection />}

      <FeaturedImageSection defaultAlt={seoData.title || ""} />

      {articleType === "recipe" && <RecipeMetadataSection />}
      {articleType === "movie_review" && <MovieReviewMetadataSection />}

      {/* Tags and Categories Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Configure</h4>
          <Label className="text-base font-semibold">Tags & Categories</Label>
        </div>

        {/* Categories (now shows secondary categories first) */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Categories {status === 'published' && <span className="text-red-500">*</span>}
          </Label>
          <CategoryNameSelector
            selected={categories || []}
            onChange={async (selectedCategories) => {
              setCategories(selectedCategories);

              // Auto-set primary category based on selection
              if (selectedCategories.length === 0) {
                // No categories selected, clear primary
                setPrimaryCategory(null);
                setPrimaryCategorySlug(null);
              } else if (selectedCategories.length === 1) {
                // Only one category selected, auto-set as primary
                const categoryId = selectedCategories[0];
                setPrimaryCategory(categoryId);

                // Fetch category to get slug
                try {
                  const categoryDetails = await getCategoryById(categoryId);
                  if (categoryDetails) {
                    setPrimaryCategorySlug(categoryDetails.fullSlug || categoryDetails.slug || null);
                  }
                } catch (error) {
                  console.error('Failed to fetch category for slug:', error);
                }
              } else if (selectedCategories.length > 1) {
                // Multiple categories selected
                if (!primaryCategory || !selectedCategories.includes(primaryCategory)) {
                  // If no primary set, or current primary is not in selection,
                  // set first selected as primary
                  const categoryId = selectedCategories[0];
                  setPrimaryCategory(categoryId);

                  // Fetch category to get slug
                  try {
                    const categoryDetails = await getCategoryById(categoryId);
                    if (categoryDetails) {
                      setPrimaryCategorySlug(categoryDetails.fullSlug || categoryDetails.slug || null);
                    }
                  } catch (error) {
                    console.error('Failed to fetch category for slug:', error);
                  }
                }
                // Otherwise, keep the existing primary if it's still in the selection
              }
            }}
            placeholder="Select categories..."
            className="w-full"
          />
        </div>

        {/* Show primary category selector when categories are selected */}
        {categories && categories.length > 0 && (
          <PrimaryCategoryFromSelected
            categories={categories}
            primaryCategory={primaryCategory}
            setPrimaryCategory={setPrimaryCategory}
            setPrimaryCategorySlug={setPrimaryCategorySlug}
          />
        )}
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">
            Tags {status === 'published' && <span className="text-red-500">*</span>}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleGenerateSeo("tags")}
            disabled={generatingFields.tags}
            className="h-7 gap-1 text-xs text-primary hover:text-primary"
            title="Regenerate Tags"
          >
            {generatingFields.tags ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Regenerate Tags
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag (e.g., AI, Machine Learning)"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleAddTag}
            size="sm"
            disabled={!newTag.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-xs pr-1"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:bg-secondary/80 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Author */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">
          Author {status === 'published' && <span className="text-red-500">*</span>}
        </Label>
        <AuthorSelector
          selected={authors || []}
          onChange={setAuthors}
          placeholder="Select author..."
          className="w-full"
        />
      </div>

      {/* English Headline Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="english-headline" className="text-base font-semibold">
            English Headline
          </Label>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleGenerateSeo("headline")}
              disabled={generatingFields.headline}
              className="h-8 w-8 p-0"
              title="Regenerate Headline"
            >
              {generatingFields.headline ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              {(englishHeadline || "").length} characters
            </span>
          </div>
        </div>
        <Textarea
          id="english-headline"
          placeholder="Enter English headline for URL generation..."
          disabled={isInputLocked}
          value={englishHeadline || ""}
          onChange={(e) => setEnglishHeadline(e.target.value)}
          className="font-medium min-h-[80px] resize-none"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Used to automatically generate the English URL/Slug below.
        </p>
      </div>

      {/* Slug Field */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="slug" className="text-base font-semibold">
            Permalink
          </Label>
          <div className="flex items-center gap-2">
            {slug && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(
                  `${process.env.BRAND_URL}/${primaryCategorySlug ? `${primaryCategorySlug}/` : ''}${slug}`,
                  "Slug URL"
                )}
                className="h-7 w-7 p-0"
                title="Copy URL"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <Input
              id="slug"
              placeholder="article-slug"
              value={slug || ""}
              onChange={(e) => {
                const newValue = e.target.value;
                setSlug(newValue);
                // If user clears the slug, they likely want to reset to auto-sync
                if (newValue.trim() === "") {
                  setIsManualSlug(false);
                } else {
                  // User is typing, enable manual mode
                  setIsManualSlug(true);
                }
              }}
              disabled={isInputLocked}
              className={`font-medium pr-10 transition-all ${slugStatus === 'taken' ? 'border-destructive focus-visible:ring-destructive' : slugStatus === 'available' ? 'border-green-500 focus-visible:ring-green-500' : ''
                }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isCheckingSlug && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!isCheckingSlug && slugStatus === 'available' && <Check className="h-4 w-4 text-green-600" />}
              {!isCheckingSlug && slugStatus === 'taken' && <XCircle className="h-4 w-4 text-destructive" />}
            </div>
          </div>

          {/* Prominent Availability Status */}
          {(isCheckingSlug || !!slugStatus) && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border shadow-sm transition-all animate-in fade-in slide-in-from-top-1 ${isCheckingSlug
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : slugStatus === 'available'
                ? 'bg-green-50 text-green-700 border-green-200 ring-1 ring-green-100'
                : 'bg-destructive/10 text-destructive border-destructive/20 ring-1 ring-destructive/10'
              }`}>
              {isCheckingSlug ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-semibold italic">Verifying URL availability...</span>
                </>
              ) : slugStatus === 'available' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="flex flex-col">
                    <span className="font-bold text-base">URL is available!</span>
                    <span className="text-xs opacity-80">This link is safe to use for your article.</span>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  <div className="flex flex-col">
                    <span className="font-bold text-base">URL is already taken</span>
                    <span className="text-xs opacity-80">Please modify the English Headline or URL to make it unique.</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Meta Title Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="meta-title" className="text-base font-semibold">
            Meta Title
          </Label>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleGenerateSeo("title")}
              disabled={generatingFields.title}
              className="h-8 w-8 p-0"
              title="Regenerate Meta Title"
            >
              {generatingFields.title ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
            </Button>
            <span className={`text-sm font-medium ${titleStatus.color}`}>
              {titleLength}/60
            </span>
            {seoData.title && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(seoData.title, "Meta title")}
                className="h-7 gap-1"
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <Textarea
          id="meta-title"
          placeholder="Enter or generate a meta title..."
          value={seoData.title}
          onChange={handleTitleChange}
          maxLength={70}
          className="font-medium min-h-[60px] resize-none"
          rows={2}
        />
        <div className="flex items-center gap-1.5">
          {titleLength > 0 && (
            titleStatus.color === "text-green-600" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
            )
          )}
          <p className={`text-xs ${titleStatus.color}`}>
            {titleStatus.message}
          </p>
        </div>
      </div>

      {/* Meta Description Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="meta-description" className="text-base font-semibold">
            Meta Description
          </Label>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleGenerateSeo("description")}
              disabled={generatingFields.description}
              className="h-8 w-8 p-0"
              title="Regenerate Meta Description"
            >
              {generatingFields.description ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
            </Button>
            <span className={`text-sm font-medium ${descriptionStatus.color}`}>
              {descriptionLength}/160
            </span>
            {seoData.description && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(seoData.description, "Meta description")}
                className="h-7 gap-1"
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <Textarea
          id="meta-description"
          placeholder="Enter or generate a meta description..."
          value={seoData.description}
          onChange={handleDescriptionChange}
          maxLength={170}
          rows={4}
          className="resize-none"
        />
        <div className="flex items-center gap-1.5">
          {descriptionLength > 0 && (
            descriptionStatus.color === "text-green-600" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
            )
          )}
          <p className={`text-xs ${descriptionStatus.color}`}>
            {descriptionStatus.message}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-base font-semibold">Search Preview</Label>
        {(() => {
          const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
          const base = selectedProperty?.domain || process.env.BRAND_URL || "";
          let absoluteBase = base.startsWith("http") ? base : `${protocol}//${base}`;
          if (absoluteBase.endsWith("/")) absoluteBase = absoluteBase.slice(0, -1);
          const currentUrl = slug
            ? `${absoluteBase}${primaryCategorySlug ? `/${primaryCategorySlug}` : ""}/${slug}`
            : `${absoluteBase}${primaryCategorySlug ? `/${primaryCategorySlug}` : ""}/article`;

          return (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="space-y-1">
                  <div className="text-xs text-green-700 dark:text-green-400">
                    {currentUrl}
                  </div>
                  <div className="text-blue-700 dark:text-blue-400 font-medium text-lg hover:underline">
                    {seoData.title}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {seoData.description}
                  </div>
                </div>
              </Card>
            </a>
          );
        })()}
      </div>
    </div >
  );
}
