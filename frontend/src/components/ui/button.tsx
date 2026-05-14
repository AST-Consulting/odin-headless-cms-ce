import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] active:transition-transform active:duration-100",
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)]",
          "dark:hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)]",
          "dark:hover:translate-y-[-1px]",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          "dark:hover:shadow-[0_0_20px_-5px_hsl(var(--destructive)/0.4)]",
        ].join(" "),
        outline: [
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
          "dark:border-[hsl(230_20%_22%)]",
          "dark:hover:border-[hsl(var(--primary)/0.5)]",
          "dark:hover:shadow-[0_0_15px_-5px_hsl(var(--primary)/0.3)]",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          "dark:hover:shadow-[0_0_15px_-5px_hsl(230_20%_40%/0.3)]",
        ].join(" "),
        ghost: [
          "hover:bg-accent hover:text-accent-foreground",
          "dark:hover:bg-[hsl(230_20%_14%)]",
        ].join(" "),
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

