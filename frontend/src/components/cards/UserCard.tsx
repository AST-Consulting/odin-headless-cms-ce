"use client";

import { useState } from "react";
import { Edit, Globe, History, Trash2, Phone, ChevronDown, ChevronUp, Twitter, Facebook, Linkedin, Instagram, Mail, CheckCircle2, AlertCircle, RotateCcw, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserData } from "@/lib/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useAuthStore, havePermission } from "@/lib/auth";
import { toast } from "sonner";
import { usePropertyStore } from "@/lib/store";
import { getUserPropertyContext, isUserSuperAdmin, formatPhoneNumber } from "@/lib/user-utils";

/**
 * Props for the UserCard component
 */
interface UserCardProps {
    user: UserData;
    handleDeactivateUser: (id: string, name: string) => void;
    handleReactivateUser: (user: UserData) => void;
    handleResendInvite: (id: string, name: string) => void;
    router: any;
    isAdminOrSuperAdmin?: boolean;
}

/**
 * Style mappings for different user roles
 * Includes both light and dark mode Tailwind classes
 */
const roleStyles = {
    Author: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    Intern: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    Contributor: "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    Editor: "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
    Admin: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
    Superadmin: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800",
};

/**
 * UserCard Component
 * Displays a summary of user information in a responsive card layout
 * Supports expand/collapse for additional details and dark mode
 */
export function UserCard({ user, handleDeactivateUser, handleReactivateUser, handleResendInvite, router }: UserCardProps) {
    const { user: currentUser } = useAuthStore();
    const { selectedProperty } = usePropertyStore();
    // State to manage the expansion of the details section
    const [isExpanded, setIsExpanded] = useState(false);

    const canEdit = havePermission(currentUser, 'users', 'edit');
    const canDelete = havePermission(currentUser, 'users', 'delete');
    
    const { status: displayStatus, roles: displayRoles } = getUserPropertyContext(user, selectedProperty);

    /**
     * Generate initials for the avatar if no image is provided
     */
    const avatar = user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    /**
     * Determine if the user has administrative privileges
     */
    const isTargetAdmin = isUserSuperAdmin(user, displayRoles);

    const isCurrentUserSuperAdmin = currentUser?.roles?.some((role: { name: string }) => (role.name || '').toUpperCase() === 'SUPERADMIN');

    /**
     * Utility to format database dates into a human-readable format
     */
    const formatDate = (date: any) => {
        if (!date) return '-';
        // Handle potential Mongo EJSON format { $date: "..." } or standard string
        const dateVal = (date as any).$date || date;
        try {
            return new Date(dateVal).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '-';
        }
    };

    /**
     * Curated palette for avatar backgrounds
     */
    const avatarBgColors = [
        "bg-indigo-500",
        "bg-sky-500",
        "bg-emerald-500",
        "bg-amber-500",
        "bg-red-500",
        "bg-violet-500",
    ];

    /**
     * Consistent color selection based on user name hash
     */
    function getAvatarBg(name: string) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return avatarBgColors[Math.abs(hash) % avatarBgColors.length];
    }

    /**
     * Logic to determine the style class for the role badge
     */
    const getRoleClass = (type: string) => {
        const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        return (roleStyles as any)[normalizedType] || "bg-slate-100 text-slate-700 border border-slate-200";
    };

    const roleClass = getRoleClass(user.userType);

    const getSafeId = (id: any): string => {
        if (typeof id === 'string') return id;
        if (id && typeof id === 'object' && id.$oid) return id.$oid;
        return String(id || '');
    };

    /**
     * Configuration for action buttons in the card footer
     */
    let buttons = [
        {
            key: "history",
            variant: "ghost" as const,
            size: "icon" as const,
            disabled: false,
            className: "w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors",
            icon: <History size={18} strokeWidth={2} />,
            onClick: () => router.push(`/audit-trail/${getSafeId(user._id)}`),
        },
        {
            key: "view",
            variant: "ghost" as const,
            size: "icon" as const,
            disabled: false,
            className: "w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors",
            icon: <Globe size={18} strokeWidth={2} />,
            onClick: () => {
                const domain = selectedProperty?.domain || user.organization?.domain || (user as any).companyName || "";
                if (domain && user.slug) {
                    const url = domain.startsWith('http') ? `${domain}/author/${user.slug}` : `https://${domain}/author/${user.slug}`;
                    window.open(url, '_blank');
                } else {
                    toast.error("User slug or domain not found");
                }
            },
        },
    ];

    // Only add Edit and Deactivate if the user is active in this property
    if (displayStatus === 'active') {
        buttons.push(
            {
                key: "edit",
                variant: "ghost" as const,
                size: "icon" as const,
                disabled: !canEdit,
                className: `w-8 h-8 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${!canEdit ? 'opacity-50 grayscale cursor-not-allowed' : ''}`,
                icon: <Edit size={18} strokeWidth={2} />,
                onClick: () => router.push(`/users/edit/${user.id}`),
            },
            {
                key: "deactivate",
                variant: "ghost" as const,
                size: "icon" as const,
                disabled: !canDelete,
                className: `w-8 h-8 bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400 rounded-lg flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors ${!canDelete ? 'opacity-50 grayscale cursor-not-allowed' : ''}`,
                icon: <Trash2 size={18} strokeWidth={2} />,
                onClick: () => handleDeactivateUser(user.id, user.name),
            }
        );
    } else {
        // If inactive, add Reactivate button
        if (displayStatus === 'inactive') {
            buttons.push({
                key: "reactivate",
                variant: "ghost" as const,
                size: "icon" as const,
                disabled: !canEdit,
                className: `w-8 h-8 bg-emerald-100 text-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-lg flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors ${!canEdit ? 'opacity-50 grayscale cursor-not-allowed' : ''}`,
                icon: <RotateCcw size={18} strokeWidth={2} />,
                onClick: () => handleReactivateUser(user),
            });
        }

        // If expired/pending, add Resend button
        if (displayStatus === 'expired' || displayStatus === 'pending') {
            buttons.push({
                key: "resend",
                variant: "ghost" as const,
                size: "icon" as const,
                disabled: !canEdit,
                className: `w-8 h-8 bg-blue-100 text-blue-500 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors ${!canEdit ? 'opacity-50 grayscale cursor-not-allowed' : ''}`,
                icon: <RefreshCw size={18} strokeWidth={2} />,
                onClick: () => handleResendInvite(user.id, user.name),
            });
        }
    }

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full">
            <Card className="bg-white dark:bg-slate-900/50 rounded-[22px] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                {/* Main Content Section */}
                <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                        {/* Avatar Component */}
                        <Avatar className="w-11 h-11 flex-shrink-0">
                            <AvatarImage src={user.profilePicture?.url} alt={user.name} />
                            <AvatarFallback className={`${getAvatarBg(user.name)} text-white font-semibold text-md tracking-tight`}>
                                {avatar}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 mb-1">
                                <button
                                    onClick={() => router.push(`/users/edit/${user.id}`)}
                                    className="text-[15px] font-bold text-primary leading-tight truncate hover:underline text-left"
                                >
                                    {user.name}
                                </button>
                                <Badge className={`text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-md flex-shrink-0 ${displayStatus === "active"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                    }`}>
                                    {displayStatus.toUpperCase()}
                                </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="text-[13px] text-gray-500 dark:text-slate-400 font-medium">{user.email}</p>
                                {user.emailVerified ? (
                                    <span className="text-[9px] flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-1 rounded uppercase tracking-tighter whitespace-nowrap">
                                        <CheckCircle2 size={10} /> Verified
                                    </span>
                                ) : (
                                    <span className="text-[9px] flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 px-1 rounded uppercase tracking-tighter whitespace-nowrap">
                                        <AlertCircle size={10} /> Not Verified
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {displayRoles.length === 0 ? (
                                    <span className="text-[10px] text-slate-400">No roles</span>
                                ) : (
                                    <Badge className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md ${roleClass}`}>
                                        {displayRoles.map((role) => role.name).join(", ")}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="flex items-center gap-2.5 text-gray-500 dark:text-slate-400 mb-6 px-1">
                        <Phone size={14} className="text-gray-500 dark:text-slate-400 -rotate-[10deg]" />
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{formatPhoneNumber(user.phone)}</span>
                        {user.phoneVerified ? (
                            <span className="text-[9px] flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-1 rounded uppercase tracking-tighter shadow-sm">
                                <CheckCircle2 size={10} /> Verified
                            </span>
                        ) : (
                            <span className="text-[9px] flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 px-1 rounded uppercase tracking-tighter shadow-sm">
                                <AlertCircle size={10} /> Not Verified
                            </span>
                        )}
                    </div>

                    {/* Social Media Links - Only show provided ones */}
                    {((user as any).socialLinks?.twitter || (user as any).socialLinks?.facebook || (user as any).socialLinks?.linkedin || (user as any).socialLinks?.instagram) && (
                        <div className="flex items-center gap-3.5 px-1 mt-4">
                            <div className="flex gap-2">
                                {[
                                    { Icon: Twitter, link: (user as any).socialLinks?.twitter, color: "hover:text-sky-500" },
                                    { Icon: Facebook, link: (user as any).socialLinks?.facebook, color: "hover:text-blue-600" },
                                    { Icon: Linkedin, link: (user as any).socialLinks?.linkedin, color: "hover:text-indigo-600" },
                                    { Icon: Instagram, link: (user as any).socialLinks?.instagram, color: "hover:text-rose-500" }
                                ].filter(s => !!s.link).map(({ Icon, link, color }, i) => (
                                    <a
                                        key={i}
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`w-9 h-9 border border-gray-100 dark:border-slate-800 rounded-xl flex items-center justify-center transition-all bg-white dark:bg-slate-900 shadow-sm cursor-pointer ${color}`}
                                    >
                                        <Icon size={16} strokeWidth={2} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>

                {/* Collapsible Details Section (Metadata) */}
                <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4 px-6 py-5 bg-[#f8fafc] dark:bg-slate-800/50 border-t border-gray-50 dark:border-slate-800">
                        {[
                            { label: "Created By", value: user.createdBy?.name || 'system' },
                            { label: "Created At", value: formatDate(user.createdAt) },
                            { label: "Updated By", value: user.updatedBy?.name || 'system' },
                            { label: "Updated At", value: formatDate(user.updatedAt) },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-[10px] font-extrabold text-[#94a3b8] dark:text-slate-500 uppercase tracking-[0.1em] mb-1.5">{label}</p>
                                <p className="text-[10px] font-bold text-[#334155] dark:text-slate-300">{value}</p>
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>

                {/* Card Footer with Expand Trigger and Actions */}
                <CardFooter className="px-6 py-4 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                        <button
                            className="text-gray-600 dark:text-gray-400 text-sm font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                        >
                            {isExpanded ? 'Hide details' : 'View details'}
                            {isExpanded ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                        </button>
                    </CollapsibleTrigger>

                    {/* Action Button Group */}
                    <div className="flex gap-2">
                        {buttons.map((btn) => (
                            <Button
                                key={btn.key}
                                variant={btn.variant}
                                size={btn.size}
                                onClick={btn.onClick}
                                disabled={(btn as any).disabled}
                                className={btn.className}
                            >
                                {btn.icon}
                            </Button>
                        ))}
                    </div>
                </CardFooter>
            </Card>
        </Collapsible>
    );
}
