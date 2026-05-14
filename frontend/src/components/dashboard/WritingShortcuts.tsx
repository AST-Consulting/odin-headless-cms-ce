import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bot, ArrowRight, PenSquare, Search, Lightbulb, Activity } from "lucide-react";
import Link from "next/link";

export function WritingShortcuts() {
  const shortcuts = [
    {
      title: "Continue writing my draft",
      icon: <PenSquare className="w-4 h-4 text-muted-foreground mr-3" />,
      href: "/editor",
    },
    {
      title: "Run SEO check on my latest post",
      icon: <Search className="w-4 h-4 text-muted-foreground mr-3" />,
      href: "/dashboard",
    },
    {
      title: "Suggest 5 new content ideas",
      icon: <Lightbulb className="w-4 h-4 text-muted-foreground mr-3" />,
      href: "/dashboard",
    },
    {
      title: "Check readability of my draft",
      icon: <Activity className="w-4 h-4 text-muted-foreground mr-3" />,
      href: "/editor",
    },
  ];

  return (
    <Card className="col-span-1 border-border/10 bg-zinc-950 text-zinc-50 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 pointer-events-none" />
      
      <CardHeader className="relative z-10 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
            <Bot className="w-3 h-3" />
            AI Agent
          </div>
        </div>
        <CardTitle className="text-xl font-bold text-white tracking-tight">Writing Shortcuts</CardTitle>
        <p className="text-sm font-mono text-zinc-400">Pick a task to get started</p>
      </CardHeader>

      <CardContent className="relative z-10 space-y-3">
        {shortcuts.map((shortcut, i) => (
          <Link
            key={i}
            href={shortcut.href}
            className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-800 transition-colors group cursor-pointer"
          >
            <div className="flex items-center">
              {shortcut.icon}
              <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                {shortcut.title}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
