"use client";

import React, { useMemo } from "react";
import { useEditorStore, useThemeStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Video, Clock, Image as ImageIcon, FileText, Info } from "lucide-react";
import { toast } from "sonner";

export function ValidationTab() {
    const { blocks, articleType, articleTitle, tags, categories, primaryCategory, authors, englishHeadline, slugStatus, featuredVideo, images } = useEditorStore(
        useShallow((s) => ({
            blocks: s.blocks, articleType: s.articleType, articleTitle: s.articleTitle,
            tags: s.tags, categories: s.categories, primaryCategory: s.primaryCategory,
            authors: s.authors, englishHeadline: s.englishHeadline, slugStatus: s.slugStatus,
            featuredVideo: s.featuredVideo,
            images: s.images,
        }))
    );

    const charCount = useMemo(() => {
        let total = 0;
        blocks.forEach((block: any) => {
            if (block.content && Array.isArray(block.content)) {
                block.content.forEach((item: any) => {
                    if (item.text) total += item.text.length;
                });
            }
        });
        return total;
    }, [blocks]);

    const hasVideo = useMemo(() => {
        return blocks.some((block: any) =>
            block.type === "video" ||
            block.type === "youtubeEmbed" ||
            block.type === "twitterEmbed" ||
            block.type === "instagramEmbed" ||
            block.type === "snapchatEmbed"
        );
    }, [blocks]);

    const imageCount = useMemo(() => {
        return blocks.filter((block: any) => block.type === "image").length;
    }, [blocks]);

    const hasImage = imageCount > 0;

    const hasTimestamp = useMemo(() => {
        return blocks.some((block: any) => block.type === "timestamp");
    }, [blocks]);

    const validationItems = useMemo(() => {
        const items = [
            {
                label: "Title",
                satisfied: articleTitle.trim().length > 0,
                message: "Article must have a title",
            },
            {
                label: "Primary Category",
                satisfied: !!primaryCategory,
                message: "Primary Category is required for publication",
            },
            {
                label: "Tags",
                satisfied: tags.length > 0,
                message: "At least one tag is required for publication",
            },
            {
                label: "Author",
                satisfied: authors.length > 0,
                message: "At least one author is required",
            },
            {
                label: "English Headline",
                satisfied: !!englishHeadline && englishHeadline.trim().length > 0,
                message: "English Headline is required for URL generation",
            },
            {
                label: "URL Availability",
                satisfied: slugStatus === 'available',
                message: slugStatus === 'taken' ? "This URL is already taken by another article" : "URL must be unique and available",
            },
            {
                label: "Featured Image",
                satisfied: images && images.length > 0,
                message: "Featured image is mandatory",
            },
        ];
        if (articleType === "liveblog") {
            items.push({
                label: "Timestamp",
                satisfied: hasTimestamp,
                message: "At least one timestamp block is required",
            });
        } else if (articleType === "video" || articleType === "shorts") {
            items.push({
                label: "Video Block",
                satisfied: hasVideo,
                message: "At least one video or social media embed (YouTube, X, Instagram) is required",
            });
            items.push({
                label: "Featured Video",
                satisfied: !!featuredVideo && !!featuredVideo.url,
                message: `A featured video is required for ${articleType === 'shorts' ? 'shorts' : 'video'} articles`,
            });
        } else if (articleType === "photo_story") {
            items.push({
                label: "Image Blocks",
                satisfied: imageCount >= 2,
                message: `Current: ${imageCount} / 2 images required`,
            });
        }

        return items;
    }, [articleType, articleTitle, tags, categories, primaryCategory, authors, charCount, hasVideo, hasImage, hasTimestamp]);

    const allSatisfied = validationItems.every(item => item.satisfied);

    const getIcon = (type: string) => {
        switch (type) {
            case "video": return <Video className="h-4 w-4" />;
            case "liveblog": return <Clock className="h-4 w-4" />;
            case "photo_story": return <ImageIcon className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        Content Validator
                        <span className="text-xs font-normal bg-muted px-2 py-0.5 rounded-full capitalize">
                            {articleType.replace("_", " ")}
                        </span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Validation for publication readiness
                    </p>
                </div>
            </div>

            <Card className={`p-4 border-2 ${allSatisfied ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900" : "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900"}`}>
                <div className="flex gap-3">
                    {allSatisfied ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                        <p className={`font-semibold text-sm ${allSatisfied ? "text-green-900 dark:text-green-100" : "text-orange-900 dark:text-orange-100"}`}>
                            {allSatisfied ? "Ready to Publish" : "Publication Issues Found"}
                        </p>
                        <p className={`text-xs ${allSatisfied ? "text-green-800 dark:text-green-200" : "text-orange-800 dark:text-orange-200"}`}>
                            {allSatisfied
                                ? "This content meets all requirements for its type."
                                : "Please resolve the following issues before publishing."}
                        </p>
                    </div>
                </div>
            </Card>

            <div className="space-y-3">
                {validationItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
                        {item.satisfied ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium leading-none">{item.label}</p>
                            <p className={`text-xs ${item.satisfied ? "text-muted-foreground" : "text-destructive"}`}>
                                {item.message}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    <span>Requirements vary based on content type.</span>
                </div>
            </div>
        </div>
    );
}
