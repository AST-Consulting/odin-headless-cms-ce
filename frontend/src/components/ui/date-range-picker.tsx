"use client";

import * as React from "react";
import {
    format,
    subMonths,
    startOfMonth,
    endOfMonth,
    subDays,
    startOfToday,
    startOfYesterday,
    startOfWeek,
} from "date-fns";
import { X, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { DateRange as RDRDateRange, Range, RangeKeyDict } from "react-date-range";

import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DateRangePickerProps {
    onRangeChange: (range: { start: string; end: string } | null, presetKey: string | null) => void;
    initialRange?: { start: string; end: string };
    initialPreset?: string | null;
    className?: string;
    placeholder?: string;
    align?: "left" | "right";
}

export interface DateRangePickerHandle {
    clear: () => void;
}

const PRESETS = [
    { key: "today", label: "Today", range: () => ({ from: startOfToday(), to: startOfToday() }) },
    { key: "yesterday", label: "Yesterday", range: () => ({ from: startOfYesterday(), to: startOfYesterday() }) },
    { key: "thisWeek", label: "This week (Mon)", range: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date() }) },
    { key: "last7", label: "Last 7 days", range: () => ({ from: subDays(startOfToday(), 6), to: startOfToday() }) },
    { key: "last30", label: "Last 30 days", range: () => ({ from: subDays(startOfToday(), 29), to: startOfToday() }) },
    { key: "thisMonth", label: "This month", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
    { key: "lastMonth", label: "Last month", range: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
    { key: "custom", label: "Custom Range" },
];

export const DateRangePicker = React.forwardRef<DateRangePickerHandle, DateRangePickerProps>(({
    onRangeChange,
    initialRange,
    initialPreset,
    className,
    placeholder = "Select date",
    align = "left",
}, ref) => {
    const [open, setOpen] = React.useState(false);
    const [showCalendar, setShowCalendar] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const [state, setState] = React.useState<Range[]>([
        {
            startDate: initialRange?.start ? new Date(initialRange.start) : new Date(),
            endDate: initialRange?.end ? new Date(initialRange.end) : new Date(),
            key: "selection",
        },
    ]);

    const [activePreset, setActivePreset] = React.useState<string | null>(initialPreset || null);
    const [hasSelected, setHasSelected] = React.useState(!!initialRange);

    React.useImperativeHandle(ref, () => ({
        clear: () => {
            setHasSelected(false);
            setActivePreset(null);
            setState([{
                startDate: new Date(),
                endDate: new Date(),
                key: "selection",
            }]);
            onRangeChange(null, null);
            setOpen(false);
            setTimeout(() => setShowCalendar(false), 200);
        }
    }));

    // Close on click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
                setTimeout(() => setShowCalendar(false), 200);
            }
        };
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const handleSelectPreset = (preset: typeof PRESETS[0]) => {
        if (preset.key === "custom") {
            setShowCalendar(true);
            return;
        }

        const range = preset.range?.();
        if (range) {
            const startDate = range.from;
            const endDate = range.to;

            setState([{ startDate, endDate, key: "selection" }]);
            setHasSelected(true);
            setActivePreset(preset.key);

            const now = new Date();
            let endStr = format(endDate, "yyyy-MM-dd'T'23:59:59");
            if (preset.key === 'today') {
                endStr = format(now, "yyyy-MM-dd'T'HH:mm:ss");
            }

            onRangeChange(
                { start: format(startDate, "yyyy-MM-dd'T'00:00:00"), end: endStr },
                preset.key
            );
            setOpen(false);
        }
    };

    const handleCalendarSelect = (ranges: RangeKeyDict) => {
        const selection = ranges.selection;
        setState([selection]);
        setHasSelected(true);
        setActivePreset("custom");

        if (selection.startDate && selection.endDate) {
            onRangeChange(
                {
                    start: format(selection.startDate, "yyyy-MM-dd"),
                    end: format(selection.endDate, "yyyy-MM-dd"),
                },
                "custom"
            );
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHasSelected(false);
        setActivePreset(null);
        setState([{ startDate: new Date(), endDate: new Date(), key: "selection" }]);
        onRangeChange(null, null);
        setOpen(false);
        setTimeout(() => setShowCalendar(false), 200);
    };

    const getLabel = () => {
        if (activePreset && activePreset !== "custom") {
            return PRESETS.find(p => p.key === activePreset)?.label || placeholder;
        }
        if (!hasSelected || !state[0].startDate || !state[0].endDate) return placeholder;
        return `${format(state[0].startDate, "MMM d, yyyy")} – ${format(state[0].endDate, "MMM d, yyyy")}`;
    };

    return (
        <div className={cn("relative inline-block w-full max-w-[280px]", className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm transition-all hover:border-slate-400 dark:hover:border-slate-600 focus:outline-none",
                    open && "border-blue-500 ring-1 ring-blue-500 shadow-sm"
                )}
            >
                <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
                    <CalendarIcon className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate text-slate-700 dark:text-slate-200 font-medium">{getLabel()}</span>
                </div>
                <div className="flex items-center gap-1">
                    {hasSelected && (
                        <X
                            className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            onClick={handleClear}
                        />
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 scale-x-125 ml-1 leading-none">▼</span>
                </div>
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 bg-black/10 z-[90] sm:hidden" onClick={() => setOpen(false)} />
                    <div className={cn(
                        "z-[100] bg-white dark:bg-slate-900 shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                        "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(calc(100vw-32px),340px)]",
                        "sm:absolute sm:top-[calc(100%+8px)] sm:left-auto sm:right-auto sm:translate-x-0 sm:translate-y-0 sm:w-auto sm:min-w-[340px]",
                        align === "left" ? "sm:left-0" : "sm:right-0"
                    )}>
                        {!showCalendar ? (
                            <div className="w-full py-2 bg-white dark:bg-slate-900 flex flex-col">
                                <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800 mb-1">
                                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Select Range</span>
                                </div>
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.key}
                                        onClick={() => handleSelectPreset(preset)}
                                        className={cn(
                                            "flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors",
                                            activePreset === preset.key
                                                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                                        )}
                                    >
                                        <span>{preset.label}</span>
                                        {preset.key === "custom" ? (
                                            <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                                        ) : activePreset === preset.key && (
                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-500" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col bg-white dark:bg-slate-900">
                                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowCalendar(false)}
                                            className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-shadow hover:shadow-sm"
                                        >
                                            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400 rotate-180" />
                                        </button>
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Custom Range</span>
                                    </div>
                                    <button
                                        onClick={() => setOpen(false)}
                                        className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-shadow hover:shadow-sm"
                                    >
                                        <X className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                    </button>
                                </div>
                                <div className="p-1">
                                    <RDRDateRange
                                        ranges={state}
                                        onChange={handleCalendarSelect}
                                        moveRangeOnFirstSelection={false}
                                        months={1}
                                        direction="horizontal"
                                        rangeColors={["#3b82f6"]}
                                        maxDate={new Date()}
                                        showDateDisplay={false}
                                        color={hasSelected ? "#3b82f6" : "transparent"}
                                    />
                                </div>
                                <div className="flex items-center justify-end px-4 py-3 gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                    <Button variant="ghost" size="sm" onClick={() => setShowCalendar(false)} className="text-xs h-8">
                                        Back
                                    </Button>
                                    <Button size="sm" onClick={() => setOpen(false)} className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">
                                        Apply
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            <style jsx global>{`
                .rdrCalendarWrapper { color: #1e293b !important; font-family: inherit !important; background: transparent !important; }
                .rdrMonthName { text-align: center !important; font-weight: 700 !important; color: #0f172a !important; padding: 15px 0 !important; font-size: 14px !important; }
                .rdrDayNumber span { font-weight: 500 !important; font-size: 13px !important; }
                .rdrDayToday .rdrDayNumber span:after { background: #3b82f6 !important; bottom: 4px !important; }
                .rdrDaySelected, .rdrDayInRange { background: transparent !important; }
                .rdrSelected, .rdrInRange, .rdrStartEdge, .rdrEndEdge { top: 4px !important; bottom: 4px !important; }
                .rdrStartEdge { border-top-left-radius: 20px !important; border-bottom-left-radius: 20px !important; }
                .rdrEndEdge { border-top-right-radius: 20px !important; border-bottom-right-radius: 20px !important; }
                .rdrDayInPreview { top: 4px !important; bottom: 4px !important; border: 1px dashed #94a3b8 !important; background: rgba(239, 246, 255, 0.5) !important; }
                .rdrNextPrevButton { background: #f1f5f9 !important; }
                .rdrNextPrevButton:hover { background: #e2e8f0 !important; }

                /* Dark Mode Overrides */
                .dark .rdrCalendarWrapper { color: #cbd5e1 !important; }
                .dark .rdrMonthName { color: #f1f5f9 !important; }
                .dark .rdrDayNumber span { color: #cbd5e1 !important; }
                .dark .rdrDayDisabled { background-color: transparent !important; }
                .dark .rdrDayDisabled .rdrDayNumber span { color: #475569 !important; }
                .dark .rdrDayPassive .rdrDayNumber span { color: #475569 !important; }
                .dark .rdrNextPrevButton { background: #1e293b !important; }
                .dark .rdrNextPrevButton:hover { background: #334155 !important; }
                .dark .rdrPprevButton i { border-color: transparent #94a3b8 transparent transparent !important; }
                .dark .rdrNextButton i { border-color: transparent transparent transparent #94a3b8 !important; }
                .dark .rdrDayInPreview { background: rgba(30, 41, 59, 0.5) !important; border-color: #475569 !important; }
            `}</style>
        </div>
    );
});

DateRangePicker.displayName = "DateRangePicker";