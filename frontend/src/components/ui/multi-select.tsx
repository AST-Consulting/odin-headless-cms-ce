"use client";

import * as React from "react";
import { X, ChevronDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
    onSearch?: (query: string) => void;
    compact?: boolean;
    maxDisplayed?: number;
    footer?: React.ReactNode;
}

export function MultiSelect({ options, selected, onChange, placeholder = "Select items...", className, onSearch, compact = false, maxDisplayed, footer }: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const debouncedSearch = useDebounce(search, 500);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (onSearch) {
            onSearch(debouncedSearch);
        }
    }, [debouncedSearch, onSearch]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((item) => item !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const handleRemove = (value: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(selected.filter((item) => item !== value));
    };

    const filteredOptions = onSearch
        ? options
        : options.filter((option) =>
            option.label.toLowerCase().includes(search.toLowerCase())
        );

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                className={cn(
                    "flex w-full rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-pointer",
                    compact ? "min-h-9 px-2 py-1.5 gap-1 flex-nowrap items-center" : "min-h-10 px-3 py-2 gap-2 flex-wrap",
                    className
                )}
                onClick={() => setOpen(!open)}
            >
                <div className="flex flex-wrap gap-1.5 flex-1 items-center">
                    {selected.length > 0 ? (() => {
                        const limit = compact ? 1 : (maxDisplayed ?? selected.length);
                        const displayed = selected.slice(0, limit);
                        const remaining = selected.length - limit;
                        return (
                            <>
                                {displayed.map((value) => {
                                    const option = options.find((opt) => opt.value === value);
                                    return (
                                        <Badge
                                            key={value}
                                            variant="secondary"
                                            className={cn("flex items-center gap-1 pr-1", compact && "text-xs py-0.5 px-1.5 max-w-[120px]")}
                                        >
                                            <span className={cn(compact && "truncate")}>{option?.label}</span>
                                            <button
                                                type="button"
                                                className="ml-0.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                onClick={(e) => handleRemove(value, e)}
                                            >
                                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                            </button>
                                        </Badge>
                                    );
                                })}
                                {remaining > 0 && (
                                    <Badge variant="outline" className="text-xs py-0.5 px-1.5 font-medium">
                                        +{remaining}
                                    </Badge>
                                )}
                            </>
                        );
                    })() : (
                        <span className="text-muted-foreground text-sm">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "transform rotate-180")} />
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border-b mb-1 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="max-h-64 overflow-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                No items found.
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = selected.includes(option.value);
                                return (
                                    <div
                                        key={option.value}
                                        className="flex items-center space-x-2 px-3 py-2 cursor-pointer hover:bg-accent rounded-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelect(option.value);
                                        }}
                                    >
                                        <div
                                            className={cn(
                                                "flex h-4 w-4 items-center justify-center rounded-sm border",
                                                isSelected
                                                    ? "bg-primary border-primary"
                                                    : "border-input"
                                            )}
                                        >
                                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                        </div>
                                        <span className="text-sm">{option.label}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {footer && (
                        <div className="p-2 border-t mt-1">
                            {footer}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
