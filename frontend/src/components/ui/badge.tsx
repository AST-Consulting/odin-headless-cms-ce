import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: [
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
          "dark:shadow-[0_0_10px_-3px_hsl(var(--primary)/0.3)]",
        ].join(" "),
        secondary: [
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ].join(" "),
        destructive: [
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
          "dark:bg-[hsl(var(--destructive)/0.15)] dark:text-[hsl(0_72%_60%)] dark:border-[hsl(var(--destructive)/0.3)]",
        ].join(" "),
        outline: "text-foreground",
        success: [
          "border-transparent bg-success text-success-foreground",
          "dark:bg-[hsl(var(--success)/0.15)] dark:text-[hsl(142_71%_55%)] dark:border-[hsl(var(--success)/0.3)]",
        ].join(" "),
        warning: [
          "border-transparent bg-warning text-warning-foreground",
          "dark:bg-[hsl(var(--warning)/0.15)] dark:text-[hsl(38_92%_60%)] dark:border-[hsl(var(--warning)/0.3)]",
        ].join(" "),
        info: [
          "border-transparent bg-primary/10 text-primary",
          "dark:bg-[hsl(var(--primary)/0.15)] dark:text-[hsl(217_91%_70%)] dark:border-[hsl(var(--primary)/0.3)]",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

