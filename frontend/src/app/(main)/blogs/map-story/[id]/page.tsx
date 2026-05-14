"use client";

import { useEffect, useState } from "react";
import MapStoryToSectionPage from "@/components/articles/MapStoryToSectionPage";
import { getArticleById } from "@/lib/api";
import { Article } from "@/lib/types";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams();
  const articleId = params.id;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!articleId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getArticleById(articleId as string);
        // Handle both response formats: direct Article object or { data: Article }
        const articleData = (response as any).data || response;
        setArticle(articleData);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch article:", err);
        setError("Failed to load article");
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [articleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading article...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!articleId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No article selected</p>
      </div>
    );
  }

  return <MapStoryToSectionPage article={article} />;
}