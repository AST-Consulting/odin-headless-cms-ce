"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Check, Loader2, BarChart2 } from "lucide-react";
import { getPolls } from "@/lib/api";
import { Poll } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { CreatePollDialog } from "@/components/polls/CreatePollDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getImageUrl } from "@/lib/utils";

interface PollPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (poll: Poll) => void;
}

/**
 * Dialog for picking an existing poll or creating a new one.
 * Adheres to the high UI standards and strict typing of the project.
 */
export function PollPickerDialog({ isOpen, onClose, onSelect }: PollPickerDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [polls, setPolls] = useState<Poll[]>([]);
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
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchPolls = useCallback(async (search = "", pageNum = 1, append = false) => {
    if (!selectedProperty?._id) return;
    
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const queryParams = {
        propertyId: selectedProperty._id,
        search: search || undefined,
        limit,
        page: pageNum,
        status: "active",
        sort: "updatedAt",
        sortOrder: "desc" as "asc" | "desc",
      };

      const res = (await getPolls(queryParams)) as any;

      // Handle both { data: [], total: 0 } and direct array responses
      let newPolls: Poll[] = [];
      let totalCount = 0;

      if (Array.isArray(res)) {
        newPolls = res;
        totalCount = res.length;
      } else if (res && res.data && Array.isArray(res.data.data)) {
        // Handle double-nested { data: { data: [] } }
        newPolls = res.data.data;
        totalCount = res.data.total || res.data.data.length;
      } else if (res && Array.isArray(res.data)) {
        // Handle standard { data: [] }
        newPolls = res.data;
        totalCount = res.total || res.data.length;
      }

      if (append) {
        setPolls(prev => {
          const updated = [...prev, ...newPolls];
          setHasMore(updated.length < totalCount);
          return updated;
        });
      } else {
        setPolls(newPolls);
        setHasMore(newPolls.length < totalCount);
      }

      setTotal(totalCount);
    } catch (error) {
      console.error("Failed to fetch polls:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedProperty]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPolls(debouncedSearchTerm, nextPage, true);
  };

  useEffect(() => {
    if (isOpen && !isCreating) {
      setSearchTerm("");
      setPolls([]);
      setTotal(0);
      setHasMore(false);
      setPage(1);
      fetchPolls("", 1, false);
    }
  }, [isOpen, isCreating, fetchPolls]);

  useEffect(() => {
    if (isOpen && !isCreating && debouncedSearchTerm !== "") {
      setPage(1);
      fetchPolls(debouncedSearchTerm, 1, false);
    } else if (isOpen && !isCreating && debouncedSearchTerm === "" && total > 0) {
      // User cleared the search - refetch original set if we already had results
      setPage(1);
      fetchPolls("", 1, false);
    }
  }, [debouncedSearchTerm, isOpen, isCreating, fetchPolls]);

  const handleSelect = (poll: Poll) => {
    onSelect(poll);
    onClose();
  };

  const handleCreated = (poll: Poll) => {
    setIsCreating(false);
    handleSelect(poll);
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[92vh] sm:max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 pb-2 pr-14">
          <DialogTitle className="flex items-center justify-between text-xl font-bold">
            <span className="flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-primary" />
              {isCreating ? "Create New Poll" : `Select Poll ${total > 0 ? `(${total})` : ""}`}
            </span>
            {!isCreating && (
              <Button size="sm" onClick={() => setIsCreating(true)} className="gap-2 bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4" />
                New Poll
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {isCreating ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 bg-gray-50/50 dark:bg-gray-800/20">
              <CreatePollDialog
                onSuccess={handleCreated}
                onCancel={() => setIsCreating(false)}
                hideHeader={true}
                hideFooter={true}
                formId="create-poll-form"
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
                form="create-poll-form"
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? "Creating..." : "Create and Insert"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search polls by question..."
                  className="pl-10 h-11 border-gray-200 focus:ring-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 px-6 relative overflow-y-auto min-h-0 custom-scrollbar">
              <div className="py-6">
                {loading && polls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                    <p className="font-medium">Loading polls...</p>
                  </div>
                ) : polls.length > 0 ? (
                  <div className={`grid grid-cols-1 gap-4 pb-6 transition-opacity duration-200 ${(loading || loadingMore) ? 'opacity-50' : 'opacity-100'}`}>
                    {polls.map((poll) => (
                      <Card
                        key={poll._id}
                        className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group overflow-hidden border-gray-100"
                        onClick={() => handleSelect(poll)}
                      >
                        <CardContent className="p-0">
                          <div className="flex h-24">
                            <div className="w-32 bg-gray-100 dark:bg-gray-800 shrink-0">
                              {poll.image ? (
                                <img 
                                  src={getImageUrl(Array.isArray(poll.image) ? poll.image[0]?.url : (poll.image as any)?.url) ?? undefined} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <BarChart2 className="w-8 h-8" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 p-4 flex flex-col justify-between overflow-hidden">
                              <div>
                                <h4 className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                                  {poll.question}
                                </h4>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px] h-4 font-normal">
                                    {poll.options.length} options
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px] h-4 font-normal capitalize">
                                    {poll.status || "active"}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                Created {poll.createdAt ? new Date(poll.createdAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div className="w-12 flex items-center justify-center border-l bg-gray-50 dark:bg-gray-800/50 group-hover:bg-primary/5 transition-colors">
                              <Plus className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
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
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <BarChart2 className="h-10 w-10 opacity-20" />
                    </div>
                    <p className="font-bold text-lg text-foreground">No Polls Found</p>
                    <p className="max-w-[280px] mx-auto mt-1">We couldn't find any polls matching your search. Create one to get started!</p>
                    <Button onClick={() => setIsCreating(true)} variant="outline" className="mt-6">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Poll
                    </Button>
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
