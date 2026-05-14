import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlayCircle, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/lib/utils";

interface YtVideoTableProps {
  data: any[] | null | undefined;
  isLoading: boolean;
  onViewAll?: () => void;
}

export function YtVideoTable({ data: rawData, isLoading, onViewAll }: YtVideoTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Peeling logic for nested API data
  let data = rawData;
  if ((data as any)?.data) {
    data = (data as any).data;
  }

  const totalItems = data?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = (data ?? []).slice(startIndex, startIndex + itemsPerPage);

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Card className="border-none shadow-md bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/50 overflow-hidden transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
          Top Performing Content
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-muted-foreground hover:text-zinc-900 dark:hover:text-white">
            View All Reports
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30">
                  <tr>
                    <th className="px-6 py-4 font-bold">Video Details</th>
                    <th className="px-6 py-4 font-bold text-right">Views</th>
                    <th className="px-6 py-4 font-bold text-right">Avg. Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {paginatedData.map((video, i) => (
                    <tr 
                      key={i} 
                      className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank')}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 group-hover:ring-2 ring-blue-500/50 transition-all shrink-0">
                            {video.thumbnail ? (
                              <img 
                                src={getImageUrl(video.thumbnail) || undefined} 
                                alt={video.title}
                                className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                                <PlayCircle className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
                              </div>
                            )}
                            <div className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-bold text-white px-1 rounded">
                               {formatDuration(video.avgDuration)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-[200px]">
                            <p className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {video.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground dark:text-zinc-500 mt-1">
                              {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'recent'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-black text-zinc-900 dark:text-white">{formatNumber(video.views)}</span>
                        <p className="text-[10px] text-muted-foreground dark:text-zinc-500">views</p>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-medium text-muted-foreground dark:text-zinc-400">
                        {formatDuration(video.avgDuration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-zinc-900/30">
               <p className="text-xs text-muted-foreground dark:text-zinc-500">
                 Showing <span className="font-semibold">{startIndex + 1}</span> to <span className="font-semibold">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of <span className="font-semibold">{totalItems}</span> videos
               </p>
               <div className="flex items-center gap-2">
                 <Button
                   variant="outline"
                   size="sm"
                   disabled={currentPage === 1}
                   onClick={(e) => {
                     e.stopPropagation();
                     setCurrentPage(p => p - 1);
                   }}
                   className="h-8 px-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                 >
                   <ChevronLeft className="w-4 h-4" />
                 </Button>
                 <span className="text-xs font-medium text-muted-foreground dark:text-zinc-500">Page {currentPage} of {totalPages}</span>
                 <Button
                   variant="outline"
                   size="sm"
                   disabled={currentPage === totalPages}
                   onClick={(e) => {
                     e.stopPropagation();
                     setCurrentPage(p => p + 1);
                   }}
                   className="h-8 px-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                 >
                   <ChevronRight className="w-4 h-4" />
                 </Button>
               </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
