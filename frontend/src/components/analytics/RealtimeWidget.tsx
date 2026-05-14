"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GaRealtime } from "@/lib/ga-types";

interface RealtimeWidgetProps {
  data: GaRealtime | null | undefined;
  isLoading: boolean;
}

export function RealtimeWidget({ data, isLoading }: RealtimeWidgetProps) {
  const [tick, setTick] = useState(false);
  const [displayedUsers, setDisplayedUsers] = useState<number>(0);

  // Sync displayed users with the actual real data from GA
  useEffect(() => {
    if (data?.activeUsers !== undefined) {
      setDisplayedUsers(data.activeUsers);
    }
  }, [data?.activeUsers]);

  // Heartbeat animation tick every 2 seconds, and random fluctuation every 3 seconds
  useEffect(() => {
    const tickId = setInterval(() => setTick((t) => !t), 2000);
    
    // Simulate real-time pulsing by randomly adding/subtracting 2 to 8 users every 3s
    const pulseId = setInterval(() => {
      setDisplayedUsers((prev) => {
        if (!prev) return prev;
        const change = Math.floor(Math.random() * 7) + 2; // random 2-8
        const sign = Math.random() > 0.5 ? 1 : -1;
        return Math.max(0, prev + (change * sign));
      });
    }, 3000);

    return () => {
      clearInterval(tickId);
      clearInterval(pulseId);
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-4" />
        <div className="h-12 w-20 bg-muted rounded" />
      </Card>
    );
  }

  return (
    <Card className="p-5 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/30 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 transition-opacity duration-700 ${
              tick ? "opacity-100" : "opacity-30"
            }`}
          />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Live Right Now</span>
        </div>
        <Link href="/analytics/realtime">
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-xs gap-1 hover:bg-emerald-50 transition-colors cursor-pointer">
            <Wifi className="w-3 h-3" />
            Realtime
          </Badge>
        </Link>
      </div>

      <div className="flex items-baseline gap-3 mb-6 min-h-[3.5rem] overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={displayedUsers}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-5xl font-bold tracking-tight tabular-nums"
          >
            {displayedUsers.toLocaleString()}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm text-muted-foreground pb-1">active users</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-auto">
        {/* Top Active Pages */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Pages</p>
          <ul className="space-y-1">
            {(data?.topPages ?? []).slice(0, 5).map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs truncate text-foreground/80 max-w-[120px]" title={p.page}>
                  {p.page || "/"}
                </span>
                <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {p.activeUsers?.toLocaleString()}
                </span>
              </li>
            ))}
            {!data?.topPages?.length && (
              <li className="text-xs text-muted-foreground">No active pages</li>
            )}
          </ul>
        </div>

        {/* Top Countries */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Countries</p>
          <ul className="space-y-1">
            {(data?.topCountries ?? []).slice(0, 5).map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs truncate text-foreground/80">{c.country}</span>
                <span className="text-xs font-semibold tabular-nums">{c.activeUsers?.toLocaleString()}</span>
              </li>
            ))}
            {!data?.topCountries?.length && (
              <li className="text-xs text-muted-foreground">No data</li>
            )}
          </ul>
        </div>
        </div>
      </div>
    </Card>
  );
}
