"use client";

import { Toaster as Sonner } from "sonner";
import { useEffect, useState } from "react";
import { useThemeStore } from "@/lib/store";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [mounted, setMounted] = useState(false);
  const { theme } = useThemeStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on server or during hydration
  if (!mounted) {
    return null;
  }

  return (
    <Sonner
      theme={theme as "light" | "dark"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            "group toast",
            "group-[.toaster]:bg-background group-[.toaster]:text-foreground",
            "group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            "dark:group-[.toaster]:bg-gradient-to-br dark:group-[.toaster]:from-[hsl(230_25%_13%)] dark:group-[.toaster]:to-[hsl(230_25%_10%)]",
            "dark:group-[.toaster]:border-[hsl(230_20%_22%)]",
            "dark:group-[.toaster]:shadow-[0_10px_40px_-10px_hsl(0_0%_0%/0.5),0_0_20px_-5px_hsl(var(--primary)/0.1)]",
          ].join(" "),
          description: "group-[.toast]:text-muted-foreground",
          actionButton: [
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            "dark:group-[.toast]:bg-gradient-to-r dark:group-[.toast]:from-primary dark:group-[.toast]:to-[hsl(217_91%_50%)]",
            "dark:group-[.toast]:hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.4)]",
          ].join(" "),
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: [
            "dark:group-[.toaster]:border-l-[3px] dark:group-[.toaster]:border-l-[hsl(var(--success))]",
            "dark:group-[.toaster]:shadow-[0_10px_40px_-10px_hsl(0_0%_0%/0.5),0_0_20px_-5px_hsl(var(--success)/0.2)]",
          ].join(" "),
          error: [
            "dark:group-[.toaster]:border-l-[3px] dark:group-[.toaster]:border-l-[hsl(var(--destructive))]",
            "dark:group-[.toaster]:shadow-[0_10px_40px_-10px_hsl(0_0%_0%/0.5),0_0_20px_-5px_hsl(var(--destructive)/0.2)]",
          ].join(" "),
          warning: [
            "dark:group-[.toaster]:border-l-[3px] dark:group-[.toaster]:border-l-[hsl(var(--warning))]",
            "dark:group-[.toaster]:shadow-[0_10px_40px_-10px_hsl(0_0%_0%/0.5),0_0_20px_-5px_hsl(var(--warning)/0.2)]",
          ].join(" "),
          info: [
            "dark:group-[.toaster]:border-l-[3px] dark:group-[.toaster]:border-l-[hsl(var(--primary))]",
            "dark:group-[.toaster]:shadow-[0_10px_40px_-10px_hsl(0_0%_0%/0.5),0_0_20px_-5px_hsl(var(--primary)/0.2)]",
          ].join(" "),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
