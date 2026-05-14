"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Rocket,
  TrendingUp,
  Type,
  Newspaper,
  Workflow,
  LineChart,
  Settings,
  FileText,
  Search,
  Layers,
  Youtube,
} from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: externalOpen, onOpenChange }: CommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Use external control if provided, otherwise use internal state
  const isControlled = externalOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only set up keyboard listener if not externally controlled
  useEffect(() => {
    if (!mounted || isControlled) return;

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setInternalOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [mounted, isControlled]);

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  // Don't render until mounted on client
  if (!mounted) {
    return null;
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/")}>
            <Rocket className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/ideas")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>Ideas & Trends</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/editor")}>
            <Type className="mr-2 h-4 w-4" />
            <span>Editor</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/seo")}>
            <Newspaper className="mr-2 h-4 w-4" />
            <span>SEO & Discover</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/sections")}>
            <Layers className="mr-2 h-4 w-4" />
            <span>Sections</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/workflow")}>
            <Workflow className="mr-2 h-4 w-4" />
            <span>Workflow</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/analytics")}>
            <LineChart className="mr-2 h-4 w-4" />
            <span>Analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/youtube-analytics")}>
            <Youtube className="mr-2 h-4 w-4" />
            <span>YouTube Analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/account")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Account</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => navigate("/editor")}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Create New Article</span>
          </CommandItem>
          <CommandItem>
            <Search className="mr-2 h-4 w-4" />
            <span>Search Articles</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

