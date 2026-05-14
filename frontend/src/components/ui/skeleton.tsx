import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        // Premium dark mode shimmer
        "dark:bg-shimmer dark:bg-[length:200%_100%] dark:animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };

