"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Newspaper, Rocket, Type, LineChart, Workflow, TrendingUp, MessageSquareQuote, FileText, Link2, BookOpen, Menu, Layers, Image as LucideImage, Tag, HelpCircle, TagIcon, ChevronDown, PanelLeftClose, PanelLeft, List, Star, ImageIcon, X, User, ShieldPlus, UserCircle, Building2, LayoutDashboard, Wrench, LogOut, Blocks, FileCode, BarChart2, BarChart3, Wifi, Sparkles, Database, Hammer, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import UnifiedSelector from "@/components/ui/unified-selector";
import { useAuthStore, havePermission } from "@/lib/auth";
import { usePropertyStore, useOrganizationStore, useLayoutStore } from "@/lib/store";
const items = [
  { href: "/", label: "Dashboard", icon: Rocket },
  { href: "/pages", label: "Pages", icon: FileText },
  { href: "/media-gallery", label: "Media Gallery", icon: ImageIcon },
  { href: "/testimonials", label: "Testimonials", icon: MessageSquareQuote },
  // { href: "/seo", label: "SEO", icon: Newspaper },
  // { href: "/workflow", label: "Workflow", icon: Workflow },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/integration", label: "Integration", icon: Blocks },
];

const articleItems = [
  { href: "/editor", label: "Editor", icon: Type },
  { href: "/blogs", label: "Articles", icon: BookOpen },
  { href: "/repurpose", label: "Repurpose", icon: Sparkles, perm: { module: "repurpose", action: "read" } },
];

const attributeItems = [
  { href: "/categories", label: "Categories", icon: Layers },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/polls", label: "Polls", icon: BarChart2 },
  { href: "/story-templates", label: "Story Templates", icon: FileCode },
];

const bannerItems = [
  { href: "/banner-types", label: "Banner Type", icon: LucideImage },
  { href: "/banners", label: "Banners", icon: LucideImage },
];

const menuItems = [
  { href: "/menu", label: "View Menu", icon: List },
  { href: "/menu/priority", label: "Menu Priority", icon: Star },
];

const analyticsItems = [
  { href: "/analytics", label: "Overview", icon: LineChart },
  { href: "/analytics/realtime", label: "Realtime", icon: Wifi },
  { href: "/youtube-analytics", label: "YouTube", icon: BarChart3 },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { setSelectedProperty } = usePropertyStore();
  const isSidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const setIsSidebarCollapsed = useLayoutStore((s) => s.setSidebarCollapsed);
  const [isArticlesOpen, setIsArticlesOpen] = useState(false);
  const [isAttributesOpen, setIsAttributesOpen] = useState(false);
  const [isBannersOpen, setIsBannersOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(
    pathname.startsWith("/menu")
  );
  const [isSectionsOpen, setIsSectionsOpen] = useState(
    pathname.startsWith("/sections")
  );
  const [isUsersOpen, setIsUsersOpen] = useState(
    pathname.startsWith("/roles") || pathname.startsWith("/users")
  );
  const [isSeoOpen, setIsSeoOpen] = useState(
    pathname.startsWith("/seo") || pathname.startsWith("/slugs")
  );
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(
    pathname.startsWith("/organization") || pathname.startsWith("/property")
  );
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(
    pathname.startsWith("/analytics") || pathname.startsWith("/youtube-analytics")
  );
  const [isHeadlessOpen, setIsHeadlessOpen] = useState(
    pathname.startsWith("/content-builder") || pathname.startsWith("/content-manager")
  );

  const handleLogout = () => {
    setSelectedProperty(null);
    logout();
    router.push("/login");
  };

  const isArticleActive = articleItems.some(item => pathname.startsWith(item.href));

  const isAttributeActive = attributeItems.some(item => pathname.startsWith(item.href));
  const isBannerActive = bannerItems.some(item => pathname.startsWith(item.href));
  const isMenuActive = menuItems.some(item => pathname.startsWith(item.href));
  const isAnalyticsActive = pathname.startsWith("/analytics") || pathname.startsWith("/youtube-analytics");

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden",
          "transition-opacity duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <aside className={cn(
        "border-r bg-card p-4 space-y-4 flex flex-col h-screen",
        // iOS-like smooth transition
        "transition-[width,transform] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
        // Desktop: sticky sidebar with collapse functionality
        "md:sticky md:top-0",
        isSidebarCollapsed ? "md:w-16" : "md:w-64",
        // Mobile: fixed overlay sidebar with smooth slide
        "fixed top-0 left-0 z-50 w-64",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        // Dark mode premium styling
        "dark:bg-gradient-to-b dark:from-[hsl(230_25%_9%)] dark:to-[hsl(230_25%_6%)]",
        "dark:border-r-[hsl(230_20%_15%)]"
      )}>
        <div className="flex items-center justify-between mb-2">
          <Link href="/" className={cn(
            "text-xl font-bold text-primary transition-opacity hover:opacity-80",
            isSidebarCollapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : "opacity-100"
          )}>
            {PRODUCT_NAME}
          </Link>

          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onMobileClose}
            className="p-2 h-8 w-8 md:hidden"
            aria-label="Close menu"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>

          {/* Desktop collapse button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => isSidebarCollapsed ? useLayoutStore.getState().expandSidebar() : setIsSidebarCollapsed(true)}
            className="p-2 h-8 w-8 hidden md:flex"
          >
            {isSidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        {/* Selectors - Only show when not collapsed */}
        <div className={cn(
          "py-2 mb-2 space-y-3",
          isSidebarCollapsed && "md:hidden"
        )}>
          <UnifiedSelector />
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
              pathname === "/"
                ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]",
              isSidebarCollapsed && "md:justify-center"
            )}
            title="Dashboard"
          >
            <Rocket className="w-5 h-5 flex-shrink-0" />
            <span className={cn(isSidebarCollapsed && "md:hidden")}>Dashboard</span>
          </Link>

          {/* Article Section - Always show on mobile, conditionally on desktop */}
          {havePermission(user, "articles", "read") && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isArticlesOpen} onOpenChange={setIsArticlesOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      isArticleActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Newspaper className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">Article</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isArticlesOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  {articleItems
                    .filter((item) =>
                      !item.perm || havePermission(user, item.perm.module, item.perm.action)
                    )
                    .map(({ href, label, icon: Icon }) => {
                      const isActive = pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                            isActive
                              ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                              : "hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {label}
                        </Link>
                      );
                    })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Article Icon - Only show on desktop when collapsed */}
          {havePermission(user, "articles", "read") && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                isArticleActive
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="Article"
            >
              <Newspaper className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {havePermission(user, "pages", "read") && (
            <Link
              href="/pages"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                pathname.startsWith("/pages")
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]",
                isSidebarCollapsed && "md:justify-center"
              )}
              title="Pages"
            >
              <FileText className="w-5 h-5 flex-shrink-0" />
              <span className={cn(isSidebarCollapsed && "md:hidden")}>Pages</span>
            </Link>
          )}

          {havePermission(user, "files", "read") && (
            <Link
              href="/media-gallery"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                pathname.startsWith("/media-gallery")
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]",
                isSidebarCollapsed && "md:justify-center"
              )}
              title="Media Gallery"
            >
              <ImageIcon className="w-5 h-5 flex-shrink-0" />
              <span className={cn(isSidebarCollapsed && "md:hidden")}>Media Gallery</span>
            </Link>
          )}

          {havePermission(user, "testimonials", "read") && (
            <Link
              href="/testimonials"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                pathname.startsWith("/testimonials")
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]",
                isSidebarCollapsed && "md:justify-center"
              )}
              title="Testimonials"
            >
              <MessageSquareQuote className="w-5 h-5 flex-shrink-0" />
              <span className={cn(isSidebarCollapsed && "md:hidden")}>Testimonials</span>
            </Link>
          )}

          {/* Analytics Section - Always show on mobile, conditionally on desktop */}
          {havePermission(user, "analytics", "read") && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      isAnalyticsActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <LineChart className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">Analytics</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isAnalyticsOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  {analyticsItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                          isActive
                            ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Analytics Icon - Only show on desktop when collapsed */}
          {havePermission(user, "analytics", "read") && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                isAnalyticsActive
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="Analytics"
            >
              <LineChart className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {havePermission(user, "wordpress", "read") && (
            <Link
              href="/integration"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                pathname.startsWith("/integration")
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]",
                isSidebarCollapsed && "md:justify-center"
              )}
              title="Integration"
            >
              <Blocks className="w-5 h-5 flex-shrink-0" />
              <span className={cn(isSidebarCollapsed && "md:hidden")}>Integration</span>
            </Link>
          )}

          {/* Data Builder Section */}
          {(havePermission(user, "content-builder", "read") || havePermission(user, "content-manager", "read")) && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isHeadlessOpen} onOpenChange={setIsHeadlessOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname.startsWith("/content-builder") || pathname.startsWith("/content-manager")
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Database className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">Data Builder</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isHeadlessOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  {havePermission(user, "content-builder", "read") && (
                    <Link
                      href="/content-builder"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        pathname.startsWith("/content-builder")
                          ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Hammer className="w-4 h-4 flex-shrink-0" />
                      Builder
                    </Link>
                  )}
                  {havePermission(user, "content-manager", "read") && (
                    <Link
                      href="/content-manager"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        pathname.startsWith("/content-manager")
                          ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Database className="w-4 h-4 flex-shrink-0" />
                      Content
                    </Link>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Data Builder Icon - Only show on desktop when collapsed */}
          {(havePermission(user, "content-builder", "read") || havePermission(user, "content-manager", "read")) && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                pathname.startsWith("/content-builder") || pathname.startsWith("/content-manager")
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="Data Builder"
              onClick={() => setIsHeadlessOpen(!isHeadlessOpen)}
            >
              <Database className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {havePermission(user, "ai", "read") && (
            <Link
              href="/video-generator"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                pathname.startsWith("/video-generator")
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]",
                isSidebarCollapsed && "md:justify-center"
              )}
              title="Video Generator"
            >
              <Film className="w-5 h-5 flex-shrink-0" />
              <span className={cn(isSidebarCollapsed && "md:hidden")}>Video Generator</span>
            </Link>
          )}

          {/* Removed generic loop-based items and handled them above with explicit permissions */}

          {/* Menu Section - Always show on mobile, conditionally on desktop */}
          {havePermission(user, "menu", "read") && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      isMenuActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Menu className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">Menu</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isMenuOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  {menuItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                          isActive
                            ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Menu Icon - Only show on desktop when collapsed */}
          {havePermission(user, "menu", "read") && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                isMenuActive
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="Menu"
            >
              <Menu className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {/* Banners Section - Always show on mobile, conditionally on desktop */}
          {havePermission(user, "banner", "read") && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isBannersOpen} onOpenChange={setIsBannersOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      isBannerActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <LucideImage className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">Banners</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isBannersOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  {bannerItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                          isActive
                            ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Banners Icon - Only show on desktop when collapsed */}
          {havePermission(user, "banner", "read") && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                isBannerActive
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="Banners"
            >
              <LucideImage className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {/* Attributes Section - Conditional rendering of group and items */}
          {(havePermission(user, "category", "read") ||
            havePermission(user, "tags", "read") ||
            havePermission(user, "faq", "read") ||
            havePermission(user, "poll", "read") ||
            havePermission(user, "webstory-template", "read")) && (
              <div className={cn(isSidebarCollapsed && "md:hidden")}>
                <Collapsible open={isAttributesOpen} onOpenChange={setIsAttributesOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        isAttributeActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <TagIcon className="w-5 h-5 flex-shrink-0" />
                      <span className="flex-1 text-left">Attributes</span>
                      <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isAttributesOpen && "transform rotate-180")} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 ml-4 mt-1">
                    {havePermission(user, "category", "read") && (
                      <Link href="/categories" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-colors", pathname.startsWith("/categories") ? "bg-primary/15 text-primary font-medium dark:bg-primary/20" : "hover:bg-accent hover:text-accent-foreground")}>
                        <Layers className="w-4 h-4 flex-shrink-0" />
                        Categories
                      </Link>
                    )}
                    {havePermission(user, "tags", "read") && (
                      <Link href="/tags" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-colors", pathname.startsWith("/tags") ? "bg-primary/15 text-primary font-medium dark:bg-primary/20" : "hover:bg-accent hover:text-accent-foreground")}>
                        <Tag className="w-4 h-4 flex-shrink-0" />
                        Tags
                      </Link>
                    )}
                    {havePermission(user, "faq", "read") && (
                      <Link href="/faqs" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-colors", pathname.startsWith("/faqs") ? "bg-primary/15 text-primary font-medium dark:bg-primary/20" : "hover:bg-accent hover:text-accent-foreground")}>
                        <HelpCircle className="w-4 h-4 flex-shrink-0" />
                        FAQs
                      </Link>
                    )}
                    {havePermission(user, "poll", "read") && (
                      <Link href="/polls" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-colors", pathname.startsWith("/polls") ? "bg-primary/15 text-primary font-medium dark:bg-primary/20" : "hover:bg-accent hover:text-accent-foreground")}>
                        <BarChart2 className="w-4 h-4 flex-shrink-0" />
                        Polls
                      </Link>
                    )}
                    {havePermission(user, "webstory-template", "read") && (
                      <Link href="/story-templates" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-colors", pathname.startsWith("/story-templates") ? "bg-primary/15 text-primary font-medium dark:bg-primary/20" : "hover:bg-accent hover:text-accent-foreground")}>
                        <FileCode className="w-4 h-4 flex-shrink-0" />
                        Story Templates
                      </Link>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

          {/* Attributes Icon - Only show on desktop when collapsed */}
          {(havePermission(user, "category", "read") ||
            havePermission(user, "tags", "read") ||
            havePermission(user, "faq", "read") ||
            havePermission(user, "poll", "read") ||
            havePermission(user, "webstory-template", "read")) && (
              <button
                className={cn(
                  "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                  "hidden",
                  isSidebarCollapsed && "md:flex",
                  isAttributeActive
                    ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                    : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
                )}
                title="Attributes"
              >
                <TagIcon className="w-5 h-5 flex-shrink-0" />
              </button>
            )}

          {/* Sections Section - Always show on mobile, conditionally on desktop */}
          {havePermission(user, "section", "read") && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isSectionsOpen} onOpenChange={setIsSectionsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname.startsWith("/sections")
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Layers className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">Sections</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isSectionsOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  <Link
                    href="/sections"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname.startsWith("/sections") && pathname !== "/sections/content-priority"
                        ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <List className="w-4 h-4 flex-shrink-0" />
                    Sections
                  </Link>
                  <Link
                    href="/sections/content-priority"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname === "/sections/content-priority"
                        ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Star className="w-4 h-4 flex-shrink-0" />
                    Content Priority
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Sections Icon - Only show on desktop when collapsed */}
          {havePermission(user, "section", "read") && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                pathname.startsWith("/sections")
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="Sections"
            >
              <Layers className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {havePermission(user, "slugs", "read") && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isSeoOpen} onOpenChange={setIsSeoOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname.startsWith("/seo") || pathname === "/slugs"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <TrendingUp className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">SEO</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isSeoOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  <Link
                    href="/seo/dashboard"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname === "/seo/dashboard"
                        ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                    SEO Dashboard
                  </Link>
                  <Link
                    href="/seo/slugs"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname === "/seo/slugs"
                        ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Link2 className="w-4 h-4 flex-shrink-0" />
                    Slugs
                  </Link>
                  <Link
                    href="/seo/settings"
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname === "/seo/settings"
                        ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Wrench className="w-4 h-4 flex-shrink-0" />
                    SEO Settings
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* SEO Icon - Only show on desktop when collapsed */}
          {havePermission(user, "slugs", "read") && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                pathname.startsWith("/seo") || pathname === "/slugs"
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="SEO"
              onClick={() => setIsSeoOpen(!isSeoOpen)}
            >
              <TrendingUp className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {(havePermission(user, "users", "read") || havePermission(user, "role", "read")) && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isUsersOpen} onOpenChange={setIsUsersOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname === "/users" || pathname === "/roles"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <UserCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">Users</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isUsersOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  {havePermission(user, "users", "read") && (
                    <Link
                      href="/users"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        pathname === "/users"
                          ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <User className="w-4 h-4 flex-shrink-0" />
                      Users
                    </Link>
                  )}
                  {havePermission(user, "role", "read") && (
                    <Link
                      href="/roles"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        pathname === "/roles"
                          ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <ShieldPlus className="w-4 h-4 flex-shrink-0" />
                      Roles
                    </Link>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Users Icon - Only show on desktop when collapsed */}
          {(havePermission(user, "users", "read") || havePermission(user, "role", "read")) && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                pathname === "/users" || pathname === "/roles"
                  ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="Users"
              onClick={() => setIsUsersOpen(!isUsersOpen)}
            >
              <User className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {(havePermission(user, "organization", "read") || havePermission(user, "property", "read")) && (
            <div className={cn(isSidebarCollapsed && "md:hidden")}>
              <Collapsible open={isOrganizationOpen} onOpenChange={setIsOrganizationOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      pathname.startsWith("/organization") || pathname === "/property"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Building2 className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 text-left">Organization</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform flex-shrink-0", isOrganizationOpen && "transform rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  {havePermission(user, "organization", "read") && (
                    <Link
                      href="/organization"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        pathname === "/organization"
                          ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Building2 className="w-4 h-4 flex-shrink-0" />
                      Details
                    </Link>
                  )}
                  {havePermission(user, "property", "read") && (
                    <Link
                      href="/property"
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        pathname === "/property"
                          ? "bg-primary/15 text-primary font-medium dark:bg-primary/20"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                      Property
                    </Link>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Organization Icon - Only show on desktop when collapsed */}
          {(havePermission(user, "organization", "read") || havePermission(user, "property", "read")) && (
            <button
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 rounded-lg transition-colors",
                "hidden",
                isSidebarCollapsed && "md:flex",
                pathname.startsWith("/organization") || pathname === "/property"
                  ? "bg-primary text-primary-foreground font-medium dark:bg-gradient-to-r dark:from-primary dark:to-[hsl(217_91%_50%)] dark:shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)]"
                  : "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]"
              )}
              title="Organization"
              onClick={() => setIsOrganizationOpen(!isOrganizationOpen)}
            >
              <Building2 className="w-5 h-5 flex-shrink-0" />
            </button>
          )}
        </nav>
        <div className="space-y-2 border-t pt-3">
          {/* User info - clickable to go to account */}
          <button
            onClick={() => router.push("/account")}
            title="Account Settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors",
              "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]",
              isSidebarCollapsed && "md:justify-center md:px-0"
            )}
          >
            {user?.profilePicture?.url || user?.avatar ? (
              <img
                src={user.profilePicture?.url || user.avatar}
                alt={user.name || "User"}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className={cn(
                "w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0",
                "dark:bg-gradient-to-br dark:from-primary dark:to-[hsl(217_91%_50%)]"
              )}>
                {user?.name?.charAt(0) || "U"}
              </div>
            )}
            <div className={cn("min-w-0 text-left", isSidebarCollapsed && "md:hidden")}>
              <div className="text-sm font-medium truncate">{user?.name || "User"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.roles?.map(r => r.name).join(", ") || user?.rolesName?.join(", ") || user?.userType || "ADMIN"}
              </div>
            </div>
          </button>
          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full gap-3 px-3 py-2 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-lg",
              isSidebarCollapsed ? "md:justify-center" : "justify-start"
            )}
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={cn(isSidebarCollapsed && "md:hidden")}>Logout</span>
          </Button>
        </div>
      </aside>
    </>
  );
}

