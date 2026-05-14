"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Check, Loader2, HelpCircle } from "lucide-react";
import { getFAQs } from "@/lib/api";
import { FAQ } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { CreateFAQDialog } from "@/components/faqs/CreateFAQDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FaqPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (faq: FAQ) => void;
}

export function FaqPickerDialog({ isOpen, onClose, onSelect }: FaqPickerDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const limit = 10;
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchFAQs = useCallback(async (search = "", pageNum = 1, append = false) => {
    if (!selectedProperty?._id) return;
    
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await getFAQs({
        propertyId: selectedProperty._id,
        search: search || undefined,
        limit,
        page: pageNum,
        status: "active",
        sort: "updatedAt",
        sortOrder: "desc",
      });

      const newFaqs = res.data || [];
      const totalCount = res.total || 0;

      if (append) {
        setFaqs(prev => {
          const updated = [...prev, ...newFaqs];
          setHasMore(updated.length < totalCount);
          return updated;
        });
      } else {
        setFaqs(newFaqs);
        setHasMore(newFaqs.length < totalCount);
      }

      setTotal(totalCount);
    } catch (error) {
      console.error("Failed to fetch FAQs:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedProperty]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFAQs(debouncedSearchTerm, nextPage, true);
  };

  useEffect(() => {
    if (isOpen && !isCreating) {
      // Clear state and reset to page 1 cleanly
      setSearchTerm("");
      setFaqs([]);
      setTotal(0);
      setHasMore(false);
      setPage(1);
      fetchFAQs("", 1, false);
    }
  }, [isOpen]); // Only trigger on dialog open

  const handleSelect = (faq: FAQ) => {
    onSelect(faq);
    onClose();
  };

  const handleCreated = (faq: FAQ) => {
    setIsCreating(false);
    handleSelect(faq);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[92vh] sm:max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 pr-14">
          <DialogTitle className="flex items-center justify-between">
            <span>
              {isCreating ? "Create New FAQ" : `Select FAQ ${total > 0 ? `(${total})` : ""}`}
            </span>
            {!isCreating && (
              <Button size="sm" onClick={() => setIsCreating(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create FAQ
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {isCreating ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              <CreateFAQDialog
                onSuccess={handleCreated}
                onCancel={() => setIsCreating(false)}
                hideHeader={true}
                hideFooter={true}
                formId="create-faq-form"
                onLoadingChange={setIsSubmitting}
                className="p-0"
              />
            </div>
            <DialogFooter className="p-6 pt-2 border-t mt-auto">
              <Button
                variant="outline"
                onClick={() => setIsCreating(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                form="create-faq-form"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create FAQ"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search FAQs..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 px-6 relative overflow-y-auto min-h-0 custom-scrollbar">
              <div className="py-4">
                {loading && faqs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>Loading FAQs...</p>
                  </div>
                ) : faqs.length > 0 ? (
                  <div className={`space-y-3 pb-4 transition-opacity duration-200 ${(loading || loadingMore) ? 'opacity-50' : 'opacity-100'}`}>
                    {faqs.map((faq) => (
                      <Card
                        key={faq._id}
                        className="cursor-pointer hover:border-primary/50 transition-colors group"
                        onClick={() => handleSelect(faq)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                                {faq.question}
                              </h4>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {faq.answer}
                              </p>
                            </div>
                            <div className="shrink-0 mt-1">
                              <Badge variant="outline" className="text-[10px] h-5">
                                {faq.entityType || "general"}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {hasMore && (
                      <div className="pt-4 pb-8 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadMore();
                          }}
                          disabled={loadingMore}
                          className="w-full sm:w-auto"
                        >
                          {loadingMore ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            "Load More"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : !loading && (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
                    <HelpCircle className="h-12 w-12 mb-2 opacity-20" />
                    <p className="font-medium">No FAQs found</p>
                    <p className="text-sm">Try a different search or create a new one.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
