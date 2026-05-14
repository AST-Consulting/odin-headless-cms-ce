"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { getArticles } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { Article } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RelatedArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (article: Article) => void;
}

export function RelatedArticleModal({ isOpen, onClose, onSelect }: RelatedArticleModalProps) {
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchArticles = async (query: string = "") => {
    if (!selectedProperty?._id) return;
    
    try {
      setLoading(true);
      const res = await getArticles({
        propertyId: selectedProperty._id,
        status: "published",
        search: query,
        limit: 10,
        sort: "createdAt",
        sortOrder: "desc"
      });
      
      setArticles(res.data || []);
    } catch (error) {
      console.error("Failed to fetch articles for Related Article Modal", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Reset state and fetch initial articles when opened
      setSearchTerm("");
      fetchArticles("");
    }
  }, [isOpen, selectedProperty?._id]);

  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchArticles(searchTerm);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  const handleSelect = (article: Article) => {
    onSelect(article);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Related Article</DialogTitle>
        </DialogHeader>
        
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by headline or slug..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <ScrollArea className="h-[300px] mt-4 pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : articles.length > 0 ? (
            <div className="space-y-2">
              {articles.map((article) => (
                <button
                  key={article._id}
                  onClick={() => handleSelect(article)}
                  className="w-full text-left p-3 rounded-md hover:bg-accent border border-transparent hover:border-border transition-colors group cursor-pointer"
                >
                  <p className="font-medium text-sm line-clamp-2 leading-relaxed">
                    {article.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    /{article.fullSlug || article.slug}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
              <p>No articles found.</p>
              {searchTerm && <p className="mt-1">Try refining your search.</p>}
            </div>
          )}
        </ScrollArea>
        
        <div className="flex justify-end pt-4 gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
