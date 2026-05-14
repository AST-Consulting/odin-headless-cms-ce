"use client";

import { useState, useEffect } from "react";
import { Edit, Trash2, Building2, Globe, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getOrganizations, deleteOrganization, updateOrganization } from "@/lib/api";
import { Organization } from "@/lib/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useOrganizationStore } from "@/lib/store";
import { getImageUrl, cn } from "@/lib/utils";

export function OrganizationTable() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { setSelectedOrganization } = useOrganizationStore();

    const loadOrganizations = async () => {
        setLoading(true);
        try {
            const res = await getOrganizations();
            setOrganizations(res.data || []);
        } catch (error) {
            console.error("Failed to load organizations:", error);
            toast.error("Failed to load organizations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrganizations();
    }, []);

    const handleDeleteOrganization = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete organization "${name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteOrganization(id);
            toast.success("Organization deleted successfully");
            loadOrganizations();
        } catch (error: any) {
            console.error("Failed to delete organization:", error);
            toast.error(error.message || "Failed to delete organization");
        }
    };

    const handleStatusChange = async (org: Organization, checked: boolean) => {
        const newStatus = checked ? 'active' : 'inactive';
        
        // Optimistic update
        setOrganizations(organizations.map(o => o._id === org._id ? { ...o, status: newStatus } : o));

        try {
            await updateOrganization(org._id, { status: newStatus });
            toast.success(`Organization ${checked ? 'activated' : 'deactivated'}`);
        } catch (error: any) {
            console.error("Failed to update organization status:", error);
            toast.error(error.message || "Failed to update status");
            loadOrganizations(); // Revert
        }
    };

    if (loading) {
        return <div className="text-center py-10">
            <Building2 className="w-10 h-10 animate-pulse text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading organizations...</p>
        </div>;
    }

    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-black/20">
            <Table>
                <TableHeader className="bg-slate-50 dark:bg-white/[0.02]">
                    <TableRow>
                        <TableHead className="font-bold py-4">NAME</TableHead>
                        <TableHead className="font-bold">DOMAIN</TableHead>
                        <TableHead className="font-bold">STATUS</TableHead>
                        <TableHead className="font-bold">VERIFIED</TableHead>
                        <TableHead className="text-right font-bold pr-6">ACTIONS</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {organizations.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                No organizations found. Establish your first entity to get started.
                            </TableCell>
                        </TableRow>
                    ) : (
                        organizations.map((org) => (
                            <TableRow key={org._id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                                <TableCell className="font-bold">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/10 overflow-hidden">
                                             {org.logos?.square?.url ? (
                                                <img src={getImageUrl(org.logos.square.url) || undefined} alt={org.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-slate-900 dark:text-slate-100">{org.name || org.legal_name}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-tight">{org.org_type || 'Commercial'}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Globe className="w-3.5 h-3.5" />
                                        {org.domain}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={org.status === 'active'}
                                            onCheckedChange={(checked) => handleStatusChange(org, checked)}
                                        />
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase",
                                            org.status === 'active' ? "text-emerald-500" : "text-amber-500"
                                        )}>
                                            {org.status}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {org.isVerified ? (
                                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 gap-1 border-emerald-500/20">
                                            <ShieldCheck className="w-3 h-3" /> Verified
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="opacity-50 gap-1">
                                            <ShieldAlert className="w-3 h-3" /> Pending
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <div className="flex justify-end gap-1">
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
                                            onClick={() => {
                                                setSelectedOrganization(org);
                                                router.push(`/organization/profile?id=${org._id}`);
                                            }}
                                            title="Edit profile"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
                                            onClick={() => handleDeleteOrganization(org._id, org.name)}
                                            title="Delete organization"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
