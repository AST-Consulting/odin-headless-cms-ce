"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  TrendingUp,
  FileEdit,
  Newspaper,
  Layers,
  Workflow,
  X,
  Search,
  Film,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const navigationItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: TrendingUp, label: "Ideas & Trends", href: "/ideas" },
  { icon: FileEdit, label: "Editor", href: "/editor" },
  { icon: Film, label: "Video Generator", href: "/video-generator" },
  { icon: Newspaper, label: "SEO & Discover", href: "/seo" },
  { icon: Layers, label: "Sections", href: "/sections" },
  // { icon: Workflow, label: "Workflow", href: "/workflow" },
];

export function CommandPaletteSheet({
  open: externalOpen,
  onOpenChange,
}: CommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const router = useRouter();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // Swipe to dismiss state (for mobile)
  const touchStartY = React.useRef<number>(0);
  const touchCurrentY = React.useRef<number>(0);

  // Use external control if provided, otherwise use internal state
  const isControlled = externalOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  React.useEffect(() => {
    setMounted(true);
    // Check if mobile on mount
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard shortcut is handled by Header.tsx when controlled externally
  // React.useEffect(() => {
  //   if (!mounted || isControlled) return;
  //
  //   const down = (e: KeyboardEvent) => {
  //     if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
  //       e.preventDefault();
  //       setInternalOpen((prev) => !prev);
  //     }
  //   };
  //
  //   document.addEventListener("keydown", down);
  //   return () => document.removeEventListener("keydown", down);
  // }, [mounted, isControlled]);

  // Focus search input when opened (for mobile sheet)
  React.useEffect(() => {
    if (open && isMobile && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open, isMobile]);

  // Swipe handlers (for mobile)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
    const deltaY = touchCurrentY.current - touchStartY.current;

    // Only allow downward swipe and apply transform
    if (deltaY > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    const deltaY = touchCurrentY.current - touchStartY.current;

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s ease-out';

      // If swiped down more than 100px, close the sheet
      if (deltaY > 100) {
        setOpen(false);
      } else {
        // Reset position
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
  }, [setOpen]);

  const navigate = (path: string) => {
    setSearchQuery("");
    setOpen(false);
    // Wait for animation to complete before navigating
    // setTimeout(() => {
      router.push(path);
    // }, 200);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  // Filter navigation items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return navigationItems;

    const query = searchQuery.toLowerCase();
    return navigationItems.filter((item) =>
      item.label.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  if (!mounted) {
    return null;
  }

  // Desktop: Use CommandDialog (centered modal)
  if (!isMobile) {
    return (
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem 
                  key={item.href} 
                  onSelect={() => navigate(item.href)}
                  onClick={() => navigate(item.href)}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    );
  }

  // Mobile: Use Sheet (bottom drawer)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        hideCloseButton
        className="h-[85vh] flex flex-col p-0"
        ref={sheetRef}
      >
        {/* Drag Handle - Swipeable area */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Search Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <SheetHeader className="p-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type a command or search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-muted/50 border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </SheetHeader>
        </div>

        {/* Navigation Items */}
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Navigation
          </h3>
          <nav className="space-y-1">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                      "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-ring"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No results found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            )}
          </nav>
        </div>

        {/* Keyboard Shortcut Hint */}
        {!isControlled && (
          <div className="p-4 border-t bg-background">
            <p className="text-xs text-muted-foreground text-center">
              Press{" "}
              <kbd className="px-2 py-1 bg-muted rounded text-muted-foreground font-mono text-xs">
                {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}
              </kbd>{" "}
              +{" "}
              <kbd className="px-2 py-1 bg-muted rounded text-muted-foreground font-mono text-xs">
                K
              </kbd>{" "}
              to open
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}