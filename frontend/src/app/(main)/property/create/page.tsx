"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { createProperty } from "@/lib/api";
import { toast } from "sonner";
import { PropertyDto } from "@/lib/types";
import { INDUSTRY } from "@/lib/constants";

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
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function CreatePropertyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

      await createProperty(payload);
      toast.success("Property Created", {
        description: `Property ${data.domain} has been created successfully.`,
      });

      router.push("/property");
    } catch (error: any) {
      toast.error("Failed to Create Property", {
        description: error.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

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
            Create Property
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
                  defaultValue="active"
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
                  defaultValue="blog"
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
                  defaultValue="UTC"
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
            {loading ? "Saving..." : "Create Property"}
          </Button>
        </div>
      </form>
    </div>
  );
}
