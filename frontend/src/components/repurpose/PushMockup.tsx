"use client";

import { Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PushNotificationVariant } from "@/lib/repurpose-api";

interface PushMockupProps {
  variants: PushNotificationVariant[];
  appName?: string;
  onUpdate?: (idx: number, data: Partial<PushNotificationVariant>) => void;
}

export function PushMockup({
  variants,
  appName = "Odin News",
  onUpdate,
}: PushMockupProps) {
  if (!variants || variants.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No content generated.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {variants.map((variant, idx) => (
        <div
          key={idx}
          className="rounded-2xl p-3 backdrop-blur-md bg-white/90 dark:bg-[hsl(230_25%_20%)]/90 border border-white/40 dark:border-[hsl(230_20%_30%)]/60 shadow-md"
        >
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-md bg-primary/15 text-primary flex items-center justify-center">
              <Bell className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
                  {appName}
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  now
                </span>
              </div>
              <Input
                value={variant.headline}
                onChange={(e) => onUpdate?.(idx, { headline: e.target.value })}
                className="h-6 text-sm font-semibold text-neutral-900 dark:text-white border-none p-0 focus-visible:ring-0 bg-transparent leading-tight mt-0.5"
              />
              <Textarea
                value={variant.body}
                onChange={(e) => onUpdate?.(idx, { body: e.target.value })}
                className="text-xs text-neutral-700 dark:text-neutral-300 border-none p-0 focus-visible:ring-0 resize-none min-h-[30px] bg-transparent leading-snug mt-0.5"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 ml-10">
            <span className="font-medium text-primary">{variant.label}</span>{" "}
            variant
          </p>
        </div>
      ))}
    </div>
  );
}
