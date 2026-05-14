"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Monitor, Smartphone, Tablet, Tv, MoreHorizontal } from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend
} from "recharts";

interface YtDeviceTrafficProps {
  data: any[] | null | undefined;
  isLoading: boolean;
}

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const DEVICE_ICONS: Record<string, any> = {
  "MOBILE": Smartphone,
  "DESKTOP": Monitor,
  "TABLET": Tablet,
  "TV": Tv,
  "OTHER": MoreHorizontal
};

export function YtDeviceTraffic({ data: rawData, isLoading }: YtDeviceTrafficProps) {
  // Peeling logic for nested API data
  let data = rawData;
  if ((data as any)?.data) {
    data = (data as any).data;
  }

  const formattedData = (data ?? []).map(item => ({
    name: (item.label || item.deviceType || "Other").toUpperCase(),
    value: Number(item.views || 0),
  })).sort((a, b) => b.value - a.value);

  const totalViews = formattedData.reduce((acc, curr) => acc + Number(curr.value), 0);

  return (
    <Card className="border-none shadow-md bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
           Device Traffic
           <Smartphone className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[250px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : formattedData.length === 0 ? (
          <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground text-center">
             <Monitor className="w-8 h-8 mb-2 opacity-20" />
             <p className="text-xs">No device data available</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formattedData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {formattedData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#fff'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 w-full px-2">
               {formattedData.map((item, i) => {
                 const percentage = totalViews > 0 ? (item.value / totalViews) * 100 : 0;
                 const Icon = DEVICE_ICONS[item.name as keyof typeof DEVICE_ICONS] || Smartphone;
                 return (
                   <div key={i} className="flex items-center justify-between gap-3 group cursor-default">
                     <div className="flex items-center gap-2">
                        <Icon className="w-3 h-3 text-muted-foreground dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                        <span className="text-[10px] font-bold text-muted-foreground dark:text-zinc-400 truncate max-w-[60px] group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{item.name}</span>
                     </div>
                     <span className="text-[10px] font-black text-zinc-900 dark:text-white">{percentage.toFixed(0)}%</span>
                   </div>
                 );
               })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
