"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Clock } from "lucide-react";
import { formatTimestamp } from "./TimestampBlock";

interface DateTimePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTimestampSelected: (date: Date) => void;
  initialDate?: Date;
  isEditing?: boolean;
}

export function DateTimePickerDialog({
  open,
  onOpenChange,
  onTimestampSelected,
  initialDate,
  isEditing = false,
}: DateTimePickerDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [hours, setHours] = useState("12");
  const [minutes, setMinutes] = useState("00");
  const [period, setPeriod] = useState<"AM" | "PM">("AM");

  // Initialize with provided date or current time when dialog opens
  useEffect(() => {
    if (open) {
      const dateToUse = initialDate || new Date();
      setSelectedDate(dateToUse);
      const dateHours = dateToUse.getHours();
      const isPM = dateHours >= 12;
      const displayHours = dateHours % 12 || 12;
      setHours(displayHours.toString());
      setMinutes(dateToUse.getMinutes().toString().padStart(2, "0"));
      setPeriod(isPM ? "PM" : "AM");
    }
  }, [open, initialDate]);

  const getFullDateTime = (): Date => {
    const date = selectedDate || new Date();
    const result = new Date(date);

    let hour = parseInt(hours) || 12;
    if (period === "PM" && hour !== 12) {
      hour += 12;
    } else if (period === "AM" && hour === 12) {
      hour = 0;
    }

    result.setHours(hour, parseInt(minutes) || 0, 0, 0);
    return result;
  };

  const handleInsert = () => {
    const dateTime = getFullDateTime();
    onTimestampSelected(dateTime);
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleHoursChange = (value: string) => {
    // Only allow numbers 1-12
    const num = parseInt(value);
    if (value === "" || (num >= 1 && num <= 12)) {
      setHours(value);
    }
  };

  const handleMinutesChange = (value: string) => {
    // Allow empty or valid minute values (0-59)
    if (value === "") {
      setMinutes("");
      return;
    }
    const num = parseInt(value);
    if (!Number.isNaN(num) && num >= 0 && num <= 59) {
      // Don't pad single digits while typing to allow smooth input (e.g., "5" -> "55")
      setMinutes(value.length === 1 ? value : value.padStart(2, "0"));
    }
  };

  const handleMinutesBlur = () => {
    // Pad with leading zero when focus leaves the input
    if (minutes && minutes.length === 1) {
      setMinutes(minutes.padStart(2, "0"));
    } else if (minutes === "") {
      setMinutes("00");
    }
  };

  const previewTimestamp = formatTimestamp(getFullDateTime());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {isEditing ? "Edit Timestamp" : "Insert Timestamp"}
          </DialogTitle>
          <DialogDescription>
            Select a date and time for your live blog update
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Calendar */}
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label>Time</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={12}
                value={hours}
                onChange={(e) => handleHoursChange(e.target.value)}
                className="w-16 text-center"
                placeholder="12"
              />
              <span className="text-xl font-bold">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => handleMinutesChange(e.target.value)}
                onBlur={handleMinutesBlur}
                className="w-16 text-center"
                placeholder="00"
              />
              <Select value={period} onValueChange={(v) => setPeriod(v as "AM" | "PM")}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm font-bold text-blue-600">{previewTimestamp}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert}>
            {isEditing ? "Update Timestamp" : "Insert Timestamp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
