"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth";
import { usePropertyStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Settings, LogOut, User, Globe } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function UserDropdown({ children }: { children?: React.ReactNode }) {
    const { user, logout, hasHydrated } = useAuthStore();
    const [greeting, setGreeting] = useState("Good Morning");
    const { selectedProperty, setSelectedProperty } = usePropertyStore();

    const handleLogout = () => {
        // Clear property store
        setSelectedProperty(null);
        // Clear auth store
        logout();
    };

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Good Morning");
        else if (hour < 17) setGreeting("Good Afternoon");
        else setGreeting("Good Evening");
    }, []);

    if (!hasHydrated || !user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {children || (
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                        <Avatar className="h-10 w-10 border border-muted transition-transform hover:scale-105">
                            <AvatarImage src={user.avatar || user.profilePicture?.url || ""} alt={user.name || "User"} />
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {user.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
                            </AvatarFallback>
                        </Avatar>
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={12}
                className={cn(
                    "w-72 p-6 rounded-[24px] border-none shadow-[0_20px_50px_rgba(0,0,0,0.2)]",
                    "bg-white dark:bg-[#1A1C1E]"
                )}
            >
                <div className="space-y-1 mb-4">
                    <h2 className="text-xl font-bold text-[#1A1C1E] dark:text-white leading-tight">
                        {greeting}, {user.name?.split(" ")[0] || "User"}
                    </h2>
                    <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        {user.roles?.map(r => r.name).join(", ") || user.rolesName?.join(", ") || user.userType || "ADMIN"}
                    </p>
                </div>

                <DropdownMenuSeparator className="bg-muted/50 mb-6" />

                <div className="space-y-4">
                    <Link href="/account" className="block outline-none">
                        <DropdownMenuItem className={cn(
                            "flex items-center gap-4 py-2 px-3 rounded-xl cursor-pointer group transition-all duration-200",
                            "hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(230_20%_14%)]",
                            "focus:bg-accent focus:text-accent-foreground dark:focus:bg-[hsl(230_20%_14%)]"
                        )}>
                            <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                <Settings className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-base font-medium text-[#4B5563] dark:text-gray-300">Account Settings</span>
                        </DropdownMenuItem>
                    </Link>

                    <DropdownMenuItem
                        onClick={handleLogout}
                        className={cn(
                            "flex items-center gap-4 py-2 px-3 rounded-xl cursor-pointer group transition-all duration-200",
                            "hover:bg-red-500/5 hover:text-red-600 dark:hover:bg-red-500/10",
                            "focus:bg-red-500/5 focus:text-red-600 dark:focus:bg-red-500/10"
                        )}
                    >
                        <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center group-hover:bg-red-500/10 transition-colors">
                            <LogOut className="w-5 h-5 text-muted-foreground group-hover:text-red-500 transition-colors" />
                        </div>
                        <span className="text-base font-medium text-[#4B5563] dark:text-gray-300 group-hover:text-red-600 transition-colors">Logout</span>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
