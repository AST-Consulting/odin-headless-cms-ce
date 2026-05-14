"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Globe2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface YtDeviceGeographyProps {
  deviceData: any[] | null | undefined;
  geoData: any[] | null | undefined;
  isLoading: boolean;
}

export function YtDeviceGeography({ deviceData: rawDeviceData, geoData: rawGeoData, isLoading }: YtDeviceGeographyProps) {
  console.log("YtDeviceGeography rawGeoData:", rawGeoData);
  // Enhanced peeling logic for nested API data
  let geoData = [];
  if (Array.isArray(rawGeoData)) {
    geoData = rawGeoData;
  } else if (rawGeoData && typeof rawGeoData === 'object') {
    if (Array.isArray((rawGeoData as any).data)) {
      geoData = (rawGeoData as any).data;
    } else if (Array.isArray((rawGeoData as any).items)) {
      geoData = (rawGeoData as any).items;
    }
  }

  const formattedGeo = geoData.slice(0, 5).map((d: any) => ({
    name: d.label || d.country || d.name || "Unknown",
    value: Number(d.views || d.value || 0)
  })).sort((a: any, b: any) => b.value - a.value);

  const totalGeoViews = formattedGeo.reduce((acc: number, curr: any) => acc + Number(curr.value), 0);

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="border-none shadow-md bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/50 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
             Geographic Insights
             <Globe2 className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </CardTitle>
          <button className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center hover:underline">
             View all regions
          </button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[250px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : formattedGeo.length === 0 ? (
            <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground dark:text-zinc-500">
               <Globe2 className="w-8 h-8 mb-2 opacity-20" />
               <p className="text-xs">No location data available</p>
            </div>
          ) : (
            <div className="space-y-6">
               <p className="text-[10px] font-bold text-muted-foreground dark:text-zinc-500 uppercase tracking-wider">Top Locations</p>
               <div className="space-y-5">
                  {formattedGeo.map((loc: any, i: number) => {
                    const percentage = totalGeoViews > 0 ? (loc.value / totalGeoViews) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-4 group">
                        <div className="w-24 text-xs font-bold text-zinc-600 dark:text-zinc-400 truncate group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                          {loc.name}
                        </div>
                        <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-600 rounded-full group-hover:bg-emerald-500 transition-colors"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-10 text-right text-xs font-black text-zinc-900 dark:text-white">
                          {percentage.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
