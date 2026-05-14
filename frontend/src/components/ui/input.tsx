import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          // Dark mode enhancements
          "dark:bg-[hsl(230_25%_8%)]",
          "dark:border-[hsl(230_20%_18%)]",
          "dark:focus-visible:border-primary",
          "dark:focus-visible:ring-0 dark:focus-visible:ring-offset-0",
          "dark:focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.1),0_0_20px_-5px_hsl(var(--primary)/0.3)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

