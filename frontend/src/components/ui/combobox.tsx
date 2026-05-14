
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { useDebounce } from "@/hooks/use-debounce"

interface ComboboxProps {
    options: { value: string; label: string }[]
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    className?: string
    disabled?: boolean
    onSearch?: (query: string) => void
    direction?: "down" | "up"
    buttonClassName?: string
    footer?: React.ReactNode
}

export function Combobox({
    options,
    value,
    onChange,
    placeholder = "Select option...",
    searchPlaceholder = "Search...",
    className,
    disabled,
    onSearch,
    direction = "down",
    buttonClassName,
    footer
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const debouncedSearch = useDebounce(search, 500)
    const containerRef = React.useRef<HTMLDivElement>(null)

    // Deduplicate options based on value to prevent duplicate keys
    const uniqueOptions = React.useMemo(() => {
        const seen = new Set();
        return options.filter(option => {
            const key = option.value + option.label;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }, [options]);

    React.useEffect(() => {
        if (onSearch) {
            onSearch(debouncedSearch)
        }
    }, [debouncedSearch, onSearch])

    // Reset search when opening to allow fresh search if desired, or keep it.
    // Generally clearing it on open is good UX if previous search is stale.
    // But for async, keeping it might be better. Let's keep it for now.

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const selectedOption = options.find((option) => option.value === value)

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn("w-full justify-start font-normal pr-16 relative", buttonClassName)}
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
            >
                <span className="truncate flex-1 text-left">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
            {open && (
                <div className={cn(
                    "absolute z-50 w-full min-w-[200px] rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95",
                    direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
                )}>
                    <Command shouldFilter={!onSearch}>
                        <CommandInput
                            placeholder={searchPlaceholder}
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList>
                            <CommandEmpty>No item found.</CommandEmpty>
                            <CommandGroup>
                                {uniqueOptions.map((option) => (
                                    <CommandItem
                                        key={option.value + option.label}
                                        value={option.label}
                                        keywords={[option.label]}
                                        onSelect={() => {
                                            onChange(option.value)
                                            setOpen(false)
                                        }}
                                        className="cursor-pointer data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === option.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            {footer && (
                                <div className="p-2 border-t mt-1">
                                    {footer}
                                </div>
                            )}
                        </CommandList>
                    </Command>
                </div>
            )}
        </div>
    )
}
