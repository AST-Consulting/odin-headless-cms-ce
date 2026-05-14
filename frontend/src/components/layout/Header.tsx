"use client";

import { Search, Moon, Sun, Command, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useThemeStore } from "@/lib/store";
import { useEffect, useState } from "react";
import { ArticleSearchPalette } from "@/components/common/ArticleSearchPalette";
import { cn } from "@/lib/utils";
import { CommandPaletteSheet } from "./CommandPaletteSheet";
import { UserDropdown } from "./UserDropdown";

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useThemeStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    // Use requestAnimationFrame to defer DOM updates and avoid conflicts with React
    const rafId = requestAnimationFrame(() => {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [theme]);

  // Handle ⌘K to open CommandPalette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <header className={cn(
        "border-b bg-card px-4 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-10",
        "transition-all duration-200",
        "dark:bg-[hsl(230_25%_9%)] dark:border-b-[hsl(230_20%_15%)]",
        "dark:shadow-[0_1px_3px_0_hsl(0_0%_0%/0.3)]"
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          onClick={onMobileMenuClick}
          aria-label="Open menu"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search articles, topics..."
              className="pl-10"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              readOnly
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Command palette"
            title="Command palette (⌘K)"
            onClick={() => setCommandOpen(true)}
          >
            <Command className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          <div className="pl-2 border-l ml-1">
            <UserDropdown />
          </div>
        </div>
      </header>

      {/* Article search palette - opened by clicking search box */}
      <ArticleSearchPalette open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Navigation command palette - opened by ⌘K or command icon */}
      <CommandPaletteSheet open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
