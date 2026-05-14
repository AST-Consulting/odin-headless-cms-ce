"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date | undefined>(undefined);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value) : undefined;

  // Set the default month when opening the calendar
  React.useEffect(() => {
    if (open) {
      // If there's a selected date, show that month; otherwise show current month
      const dateToShow = value ? new Date(value) : new Date();
      setMonth(dateToShow);
    }
  }, [open, value]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Format as YYYY-MM-DD for input type="date" compatibility
      const formattedDate = format(date, "yyyy-MM-dd");
      onChange(formattedDate);
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Button
        id={id}
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal",
          !selectedDate && "text-muted-foreground"
        )}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        type="button"
      >
        <CalendarDays className="mr-2 h-4 w-4" />
        {selectedDate ? format(selectedDate, "PPP") : <span>{placeholder}</span>}
      </Button>
      {open && (
        <div className="absolute top-full z-[100] mt-2 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            initialFocus
            showOutsideDays={true}
          />
        </div>
      )}
    </div>
  );
}

