"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Share2,
  Twitter,
  Facebook,
  Linkedin,
  Instagram,
  Youtube,
  Globe,
  Mail,
  Phone,
  Search,
  ChevronDown,
  Info,
  Building2,
  Activity,
  ArrowLeft
} from "lucide-react";
import { getProperties, updateProperty } from "@/lib/api";
import { toast } from "sonner";
import { PropertyDto, Property } from "@/lib/types";
import { INDUSTRY } from "@/lib/constants";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const propertySchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  industry: z.string().min(1, "Industry is required"),
  status: z.string().optional(),
  articleType: z.string().min(1, "Article Type is required"),
  about: z.string().optional(),
  targetAudience: z.string().optional(),
  specialInstruction: z.string().optional(),
  imageWidth: z.coerce.number().optional(),
  imageHeight: z.coerce.number().optional(),
  timeZone: z.string().optional(),
  urlPatternTag: z.string().optional(),
  urlPatternCategory: z.string().optional(),
  urlPatternAuthor: z.string().optional(),
  urlPatternPage: z.string().optional(),
  contact_details: z.object({
    primary_phone: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  social_links: z.object({
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    wikipedia: z.string().optional(),
    linkedin: z.string().optional(),
  }).optional(),
  seo_data: z.object({
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
  }).optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params?.id as string;

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [property, setProperty] = useState<Property | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      status: "active",
      articleType: "blog",
      timeZone: "UTC",
    },
  });

  // Load property data on mount
  useEffect(() => {
    loadPropertyData();
  }, [propertyId]);

  const loadPropertyData = async () => {
    if (!propertyId) {
      toast.error("Property ID not found");
      router.push("/account/property");
      return;
    }

    setFetchingData(true);
    try {
      // Fetch all properties and find the one we need
      const properties = await getProperties();
      const foundProperty = properties.find((p) => p._id === propertyId);

      if (foundProperty) {
        setProperty(foundProperty);
        setValue("domain", foundProperty.domain);
        setValue("industry", foundProperty.industry);
        setValue("status", foundProperty.status);
        setValue("articleType", foundProperty.articleType);
        setValue("about", foundProperty.about || "");
        setValue(
          "targetAudience",
          foundProperty.targetAudience ? foundProperty.targetAudience.join(", ") : ""
        );
        setValue("specialInstruction", foundProperty.specialInstruction || "");
        setValue("imageWidth", foundProperty.imageWidth);
        setValue("imageHeight", foundProperty.imageHeight);
        setValue("timeZone", foundProperty.timeZone || "UTC");
        setValue("urlPatternTag", foundProperty.urlPatterns?.tag || "");
        setValue("urlPatternCategory", foundProperty.urlPatterns?.category || "");
        setValue("urlPatternAuthor", foundProperty.urlPatterns?.author || "");
        setValue("urlPatternPage", foundProperty.urlPatterns?.page || "");

        // Set additional fields
        setValue("contact_details.primary_phone", foundProperty.contact_details?.primary_phone || "");
        setValue("contact_details.email", foundProperty.contact_details?.email || "");
        
        setValue("social_links.facebook", foundProperty.social_links?.facebook || "");
        setValue("social_links.twitter", foundProperty.social_links?.twitter || "");
        setValue("social_links.instagram", foundProperty.social_links?.instagram || "");
        setValue("social_links.youtube", foundProperty.social_links?.youtube || "");
        setValue("social_links.wikipedia", foundProperty.social_links?.wikipedia || "");
        setValue("social_links.linkedin", foundProperty.social_links?.linkedin || "");
        
        setValue("seo_data.meta_title", foundProperty.seo_data?.meta_title || "");
        setValue("seo_data.meta_description", foundProperty.seo_data?.meta_description || "");
      } else {
        toast.error("Property not found");
        router.push("/account/property");
      }
    } catch (error: any) {
      // console.error("Failed to fetch property data:", error);
      toast.error(error.message || "Failed to fetch property data");
      router.push("/account/property");
    } finally {
      setFetchingData(false);
    }
  };

  const onSubmit = async (data: PropertyFormValues) => {
    setLoading(true);
    try {
      const payload: PropertyDto = {
        ...data,
        targetAudience: data.targetAudience
          ? data.targetAudience.split(",").map((s) => s.trim())
          : [],
        urlPatterns: {
          tag: data.urlPatternTag || undefined,
          category: data.urlPatternCategory || undefined,
          author: data.urlPatternAuthor || undefined,
          page: data.urlPatternPage || undefined,
        },
      };

      await updateProperty(propertyId, payload);
      toast.success("Property Updated", {
        description: `Property ${data.domain} has been updated successfully.`,
      });
      router.push("/property");
    } catch (error: any) {
      toast.error("Failed to Update Property", {
        description: error.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="w-full max-w-full space-y-4 sm:space-y-6">
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-muted-foreground">Loading property data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/property")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">
            Edit Property
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        {/* Basic Details */}
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CardTitle className="text-lg sm:text-xl">Basic Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain <span className="text-red-500">*</span></Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  disabled={loading}
                  {...register("domain")}
                />
                {errors.domain && (
                  <p className="text-sm text-red-500">{errors.domain.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry <span className="text-red-500">*</span></Label>
                <Select
                  onValueChange={(value) => setValue("industry", value)}
                  disabled={loading}
                  defaultValue={property?.industry}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(INDUSTRY).map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.industry && (
                  <p className="text-sm text-red-500">{errors.industry.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  onValueChange={(value) => setValue("status", value)}
                  disabled={loading}
                  defaultValue={property?.status || "active"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="articleType">Article Type <span className="text-red-500">*</span></Label>
                <Select
                  onValueChange={(value) => setValue("articleType", value)}
                  disabled={loading}
                  defaultValue={property?.articleType || "blog"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog">Blog</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.articleType && (
                  <p className="text-sm text-red-500">{errors.articleType.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Details */}
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CardTitle className="text-lg sm:text-xl">Content Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="about">About</Label>
              <Textarea
                id="about"
                placeholder="Description of the property"
                disabled={loading}
                {...register("about")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target Audience (comma separated)</Label>
              <Input
                id="targetAudience"
                placeholder="Teens, Adults, Techies"
                disabled={loading}
                {...register("targetAudience")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialInstruction">Special Instruction</Label>
              <Textarea
                id="specialInstruction"
                placeholder="Any special instructions..."
                disabled={loading}
                {...register("specialInstruction")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Image & Configuration */}
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CardTitle className="text-lg sm:text-xl">
              Image & Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imageWidth">Image Width</Label>
                <Input
                  type="number"
                  id="imageWidth"
                  placeholder="1200"
                  disabled={loading}
                  {...register("imageWidth")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageHeight">Image Height</Label>
                <Input
                  type="number"
                  id="imageHeight"
                  placeholder="630"
                  disabled={loading}
                  {...register("imageHeight")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeZone">Time Zone</Label>
                <Select
                  onValueChange={(value) => setValue("timeZone", value)}
                  disabled={loading}
                  defaultValue={property?.timeZone || "UTC"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Time Zone" />
                  </SelectTrigger>
                  <SelectContent className="h-60">
                    {Intl.supportedValuesOf("timeZone").map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* URL Structure */}
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CardTitle className="text-lg sm:text-xl">URL Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="urlPatternTag">Tag Prefix</Label>
                <Input
                  id="urlPatternTag"
                  placeholder="topic"
                  disabled={loading}
                  {...register("urlPatternTag")}
                />
                <p className="text-[10px] text-muted-foreground">Default: topic</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urlPatternCategory">Category Prefix</Label>
                <Input
                  id="urlPatternCategory"
                  placeholder="none"
                  disabled={loading}
                  {...register("urlPatternCategory")}
                />
                <p className="text-[10px] text-muted-foreground">Empty for clean URLs</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urlPatternAuthor">Author Prefix</Label>
                <Input
                  id="urlPatternAuthor"
                  placeholder="author"
                  disabled={loading}
                  {...register("urlPatternAuthor")}
                />
                <p className="text-[10px] text-muted-foreground">Default: author</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urlPatternPage">Page Prefix</Label>
                <Input
                  id="urlPatternPage"
                  placeholder="none"
                  disabled={loading}
                  {...register("urlPatternPage")}
                />
                <p className="text-[10px] text-muted-foreground">Empty for clean URLs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Details */}
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CardTitle className="text-lg sm:text-xl">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Primary Phone</Label>
                <Input
                  id="contact_phone"
                  placeholder="+91-000-000-0000"
                  disabled={loading}
                  {...register("contact_details.primary_phone")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Email Address</Label>
                <Input
                  id="contact_email"
                  placeholder="contact@example.com"
                  disabled={loading}
                  {...register("contact_details.email")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Connections */}
        <Collapsible defaultOpen={false}>
          <Card className="border-none shadow-lg">
            <CollapsibleTrigger className="w-full text-left group">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-slate-50 pb-4">
                <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                  <Share2 className="h-5 w-5 shrink-0" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Social Connections</CardTitle>
                  <CardDescription>Link your verified professional social media handles.</CardDescription>
                </div>
                <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <Twitter className="h-3.5 w-3.5 text-sky-500 shrink-0" /> X / Twitter
                  </Label>
                  <Input id="twitter" {...register("social_links.twitter")} placeholder="https://twitter.com/profile" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <Facebook className="h-3.5 w-3.5 text-blue-600 shrink-0" /> Facebook
                  </Label>
                  <Input id="facebook" {...register("social_links.facebook")} placeholder="https://facebook.com/profile" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <Linkedin className="h-3.5 w-3.5 text-indigo-700 shrink-0" /> LinkedIn
                  </Label>
                  <Input id="linkedin" {...register("social_links.linkedin")} placeholder="https://linkedin.com/in/profile" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <Instagram className="h-3.5 w-3.5 text-rose-500 shrink-0" /> Instagram
                  </Label>
                  <Input id="instagram" {...register("social_links.instagram")} placeholder="https://instagram.com/profile" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <Youtube className="h-3.5 w-3.5 text-rose-600 shrink-0" /> YouTube
                  </Label>
                  <Input id="youtube" {...register("social_links.youtube")} placeholder="https://youtube.com/@channel" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wikipedia" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-slate-500 shrink-0" /> Wikipedia
                  </Label>
                  <Input id="wikipedia" {...register("social_links.wikipedia")} placeholder="https://en.wikipedia.org/wiki/Page" className="h-11" />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* SEO Details */}
        <Card>
          <CardHeader className="space-y-1 sm:space-y-1.5">
            <CardTitle className="text-lg sm:text-xl">Search Engine Optimization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta_title">Meta Title</Label>
              <Input
                id="meta_title"
                placeholder="Title for search results"
                disabled={loading}
                {...register("seo_data.meta_title")}
              />
              <p className="text-[10px] text-muted-foreground">Optimal length: 50-60 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_description">Meta Description</Label>
              <Textarea
                id="meta_description"
                placeholder="Brief summary for search result snippets"
                disabled={loading}
                {...register("seo_data.meta_description")}
              />
              <p className="text-[10px] text-muted-foreground">Optimal length: 120-160 characters</p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-4 sm:pb-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/property")}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Saving..." : "Update Property"}
          </Button>
        </div>
      </form>
    </div>
  );
}
