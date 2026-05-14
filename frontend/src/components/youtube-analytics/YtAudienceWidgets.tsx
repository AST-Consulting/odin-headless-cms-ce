"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users2, MoreVertical, Info } from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";
import { cn } from "@/lib/utils";

interface YtAudienceWidgetsProps {
  data: any | null | undefined;
  isLoading: boolean;
}

const GENDER_COLORS = ["#3b82f6", "#ec4899", "#64748b"];

export function YtAudienceWidgets({ data: rawData, isLoading }: YtAudienceWidgetsProps) {
  // Peeling logic for nested API data
  let data = rawData;
  if ((data as any)?.data) {
    data = (data as any).data;
  }

  // Mocking data if missing, but usually provided by backend
  const ageData = data?.ageData || [
    { range: "18-24", percentage: 35 },
    { range: "25-34", percentage: 48 },
    { range: "35-44", percentage: 12 },
    { range: "45+", percentage: 5 },
  ];

  const genderData = data?.genderData || [
    { name: "Male", value: 65 },
    { name: "Female", value: 25 },
    { name: "Other", value: 10 },
  ];

  return (
    <Card className="border-none shadow-md bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/50 h-full transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
          Audience Insights
          <Users2 className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </CardTitle>
        <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
          <MoreVertical className="w-4 h-4 text-muted-foreground dark:text-zinc-500" />
        </button>
      </CardHeader>
      <CardContent className="space-y-8">
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
             <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <>
            {/* Age Range */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground dark:text-zinc-500 uppercase tracking-widest">
                <span>Age Distribution</span>
                <Info className="w-3 h-3" />
              </div>
              <div className="space-y-5">
                {ageData.map((age: any, i: number) => (
                  <div key={i} className="group space-y-2 cursor-default">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{age.range}</span>
                      <span className="text-blue-600 dark:text-blue-400">{age.percentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full group-hover:bg-blue-500 transition-all duration-500 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                        style={{ width: `${age.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gender Distribution */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-muted-foreground dark:text-zinc-500 uppercase tracking-widest">Gender Distribution</p>
              <div className="flex items-center gap-6">
                <div className="h-[130px] w-[130px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        innerRadius={42}
                        outerRadius={58}
                        paddingAngle={4}
                        dataKey="value"
                        animationDuration={1000}
                        stroke="none"
                      >
                        {genderData.map((_: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={GENDER_COLORS[index % GENDER_COLORS.length]}
                            className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#18181b', 
                          border: '1px solid #27272a',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
                        }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        cursor={{ fill: 'transparent' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {genderData.map((g: any, i: number) => (
                    <div key={i} className="flex items-center justify-between group cursor-default">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: GENDER_COLORS[i], color: GENDER_COLORS[i] }} />
                        <span className="text-[11px] font-bold text-muted-foreground dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{g.name}</span>
                      </div>
                      <span className="text-[11px] font-black text-zinc-900 dark:text-white">{g.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subscription Status */}
            <div className="space-y-4 pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
              <p className="text-[10px] font-bold text-muted-foreground dark:text-zinc-500 uppercase tracking-widest">Subscription Impact</p>
              <div className="space-y-5">
                 <div className="group space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="font-bold text-muted-foreground dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">Not Subscribed</span>
                       <span className="font-black text-zinc-900 dark:text-white">82.4%</span>
                    </div>
                    <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                       <div className="h-full bg-zinc-400 dark:bg-zinc-600 rounded-full group-hover:bg-zinc-500 dark:group-hover:bg-zinc-400 transition-colors" style={{ width: '82.4%' }} />
                    </div>
                 </div>
                 <div className="group space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="font-bold text-blue-600 dark:text-blue-400">Subscribed</span>
                       <span className="font-black text-blue-600 dark:text-blue-400">17.6%</span>
                    </div>
                    <div className="h-1 w-full bg-blue-50 dark:bg-blue-900/20 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full group-hover:bg-blue-500 dark:group-hover:bg-blue-400 transition-colors shadow-[0_0_8px_rgba(59,130,246,0.3)]" style={{ width: '17.6%' }} />
                    </div>
                 </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
