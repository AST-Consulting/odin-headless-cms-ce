"use client";

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Plus, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersTable } from "@/components/tables/UsersTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuthStore, havePermission } from "@/lib/auth";
import { usePropertyStore } from "@/lib/store";
import { getUsers } from "@/lib/api";

export default function UsersPage() {
    const [activeTab, setActiveTab] = useState("active");

    // Draft filter state (what user types)
    const [draftName, setDraftName] = useState("");
    const [draftEmail, setDraftEmail] = useState("");
    const [draftPhone, setDraftPhone] = useState("");
    const [draftRole, setDraftRole] = useState("");

    // Applied filter state (what the table actually uses)
    const [appliedName, setAppliedName] = useState("");
    const [appliedEmail, setAppliedEmail] = useState("");
    const [appliedPhone, setAppliedPhone] = useState("");
    const [appliedRole, setAppliedRole] = useState("");

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [sort, setSort] = useState(searchParams.get("sort") || "updatedAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get("sortOrder") as "asc" | "desc") || "desc");

    const [userPage, setUserPage] = useState(1);
    const [userLimit, setUserLimit] = useState(10);
    const [activeTotal, setActiveTotal] = useState(0);
    const [pendingTotal, setPendingTotal] = useState(0);

    // Initial load from URL
    useEffect(() => {
        const name = searchParams.get("name") || "";
        const email = searchParams.get("email") || "";
        const phone = searchParams.get("phone") || "";
        const role = searchParams.get("role") || "";

        setDraftName(name);
        setDraftEmail(email);
        setDraftPhone(phone);
        setDraftRole(role);

        setAppliedName(name);
        setAppliedEmail(email);
        setAppliedPhone(phone);
        setAppliedRole(role);
    }, []);


    const { user: authUser } = useAuthStore();
    const { selectedProperty } = usePropertyStore();
    const canCreate = havePermission(authUser, "users", "write");

    const hasActiveDraftFilters =
        draftName.length > 0 ||
        draftEmail.length > 0 ||
        draftPhone.length > 0 ||
        draftRole.length > 0;

    const hasAppliedFilters =
        appliedName.length > 0 ||
        appliedEmail.length > 0 ||
        appliedPhone.length > 0 ||
        appliedRole.length > 0;

    const handleApplyFilter = () => {
        setAppliedName(draftName);
        setAppliedEmail(draftEmail);
        setAppliedPhone(draftPhone);
        setAppliedRole(draftRole);
        setUserPage(1);
    };

    const handleClearAll = () => {
        setDraftName("");
        setDraftEmail("");
        setDraftPhone("");
        setDraftRole("");
        setAppliedName("");
        setAppliedEmail("");
        setAppliedPhone("");
        setAppliedRole("");
        setUserPage(1);
    };

    // Reset page when switching tabs
    useEffect(() => {
        setUserPage(1);
    }, [activeTab]);

    // Explicitly fetch BOTH totals whenever filters change to keep tabs updated
    const fetchTotals = async () => {
        try {
            const [activeRes, pendingRes] = await Promise.all([
                getUsers({ status: "active", name: appliedName, email: appliedEmail, phone: appliedPhone, role: appliedRole, limit: 1, propertyId: selectedProperty?._id }),
                getUsers({ status: ["inactive", "pending"], name: appliedName, email: appliedEmail, phone: appliedPhone, role: appliedRole, limit: 1, propertyId: selectedProperty?._id })
            ]);
            setActiveTotal(activeRes.total);
            setPendingTotal(pendingRes.total);
        } catch (e) {
            console.error("Failed to sync status totals:", e);
        }
    };

    useEffect(() => {
        fetchTotals();
    }, [appliedName, appliedEmail, appliedPhone, appliedRole, selectedProperty?._id]);

    // Sync sorting and filters to URL
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        
        // Sorting
        if (sort === "updatedAt") params.delete("sort"); else params.set("sort", sort);
        if (sortOrder === "desc") params.delete("sortOrder"); else params.set("sortOrder", sortOrder);

        // Filters
        if (appliedName) params.set("name", appliedName); else params.delete("name");
        if (appliedEmail) params.set("email", appliedEmail); else params.delete("email");
        if (appliedPhone) params.set("phone", appliedPhone); else params.delete("phone");
        if (appliedRole) params.set("role", appliedRole); else params.delete("role");

        const queryString = params.toString();
        const newPath = queryString ? `${pathname}?${queryString}` : pathname;

        // Only replace if the path has actually changed to avoid unnecessary re-renders
        if (window.location.search !== (queryString ? `?${queryString}` : '')) {
            router.replace(newPath, { scroll: false });
        }
    }, [sort, sortOrder, appliedName, appliedEmail, appliedPhone, appliedRole, pathname, router]);


    return (
        <div>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>User Management </CardTitle>
                        {canCreate && (
                            <Button
                                size="sm"
                                className="h-8 w-8 rounded-full p-0"
                                onClick={() => router.push("/users/create")}
                                title="Create new user"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Tabs for Active vs Invited */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full max-w-md grid-cols-2 h-11 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl">
                            <TabsTrigger
                                value="active"
                                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800"
                            >
                                Active Users {`(${new Intl.NumberFormat('en-IN').format(activeTotal)})`}
                            </TabsTrigger>
                            <TabsTrigger
                                value="invited"
                                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800"
                            >
                                Inactive / Pending {`(${new Intl.NumberFormat('en-IN').format(pendingTotal)})`}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Filter Bar */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-3 items-center">
                            {/* Name filter */}
                            <div className="relative w-full sm:w-auto sm:max-w-xs">
                                <Input
                                    placeholder="Search by name..."
                                    value={draftName}
                                    onChange={(e) => setDraftName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                                    className="w-full pr-8"
                                />
                                {draftName && (
                                    <button
                                        type="button"
                                        onClick={() => { setDraftName(""); setAppliedName(""); setUserPage(1); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="Clear name filter"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Email filter */}
                            <div className="relative w-full sm:w-auto sm:max-w-xs">
                                <Input
                                    placeholder="Search by email..."
                                    value={draftEmail}
                                    onChange={(e) => setDraftEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                                    className="w-full pr-8"
                                />
                                {draftEmail && (
                                    <button
                                        type="button"
                                        onClick={() => { setDraftEmail(""); setAppliedEmail(""); setUserPage(1); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="Clear email filter"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Phone filter */}
                            <div className="relative w-full sm:w-auto sm:max-w-xs">
                                <Input
                                    placeholder="Search by phone..."
                                    value={draftPhone}
                                    onChange={(e) => setDraftPhone(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                                    className="w-full pr-8"
                                />
                                {draftPhone && (
                                    <button
                                        type="button"
                                        onClick={() => { setDraftPhone(""); setAppliedPhone(""); setUserPage(1); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="Clear phone filter"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Role filter */}
                            <div className="relative w-full sm:w-auto sm:max-w-xs">
                                <Input
                                    placeholder="Search by role..."
                                    value={draftRole}
                                    onChange={(e) => setDraftRole(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                                    className="w-full pr-8"
                                />
                                {draftRole && (
                                    <button
                                        type="button"
                                        onClick={() => { setDraftRole(""); setAppliedRole(""); setUserPage(1); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="Clear role filter"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Apply Filter button */}
                            <Button
                                onClick={handleApplyFilter}
                                size="sm"
                                className="h-10 px-4 gap-2"
                                disabled={!hasActiveDraftFilters && !hasAppliedFilters}
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                Apply Filter
                            </Button>

                            {/* Clear All button — only shown when filters are applied */}
                            {hasAppliedFilters && (
                                <Button
                                    variant="ghost"
                                    onClick={handleClearAll}
                                    size="sm"
                                    className="h-10 text-muted-foreground hover:text-foreground gap-1"
                                >
                                    <X className="h-4 w-4" />
                                    Clear All
                                </Button>
                            )}
                        </div>
                    </div>

                    <UsersTable
                        propertyId={selectedProperty?._id}
                        name={appliedName}
                        email={appliedEmail}
                        phone={appliedPhone}
                        role={appliedRole}
                        status={activeTab === "active" ? "active" : ["inactive", "pending"]}
                        // verified={activeTab === "active" ? true : undefined} 
                        page={userPage}
                        limit={userLimit}
                        onPageChange={setUserPage}
                        onLimitChange={setUserLimit}
                        onTotalChange={(total) => {
                            if (activeTab === "active") setActiveTotal(total);
                            else setPendingTotal(total);
                        }}
                        sort={sort}
                        sortOrder={sortOrder}
                        onSort={(newSort, newOrder) => {
                            setSort(newSort);
                            setSortOrder(newOrder);
                        }}
                    />
                </CardContent>
            </Card>
        </div>
    );
}