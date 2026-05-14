import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface FilterBarProps {
    children: ReactNode;
    onClear?: () => void;
    showClear?: boolean;
    className?: string;
}

export function FilterBar({
    children,
    onClear,
    showClear = false,
    className = ""
}: FilterBarProps) {
    return (
        <div className={`flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 sm:items-center ${className}`}>
            {children}

            {showClear && onClear && (
                <Button
                    variant="ghost"
                    onClick={onClear}
                    size="sm"
                    className="h-10 px-6 gap-2 bg-secondary"
                >
                    <X className="mr-2 h-4 w-4" /> Clear
                </Button>
            )}
        </div>
    );
}
