"use client";

import { User, Mail, Phone, MapPin, Camera, Lock, Pencil, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserData } from "@/lib/types";

interface UserProfileSidebarCardProps {
    userData: UserData | null;
    phoneString?: string;
    className?: string;
    onEditAvatar?: () => void;
    onChangePassword?: () => void;
    canEdit?: boolean;
}

export function UserProfileSidebarCard({
    userData,
    phoneString,
    className,
    onEditAvatar,
    onChangePassword,
    canEdit = true,
}: UserProfileSidebarCardProps) {

    const getPhoneDisplay = () => {
        if (phoneString) return phoneString;
        if (!userData?.phone) return "No phone";
        if (typeof userData.phone === "object") {
            return (userData.phone as any).fullNumber || (userData.phone as any).number || "No phone";
        }
        return userData.phone;
    };

    // ─── Scroll + focus + highlight a form field by its id ───────────────────
    const scrollToField = (fieldId: string) => {
        const el = document.getElementById(fieldId);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
        el.classList.add("ring-2", "ring-primary", "ring-offset-2", "transition-shadow");
        setTimeout(() => {
            el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, 2000);
    };

    // ─── Profile completion score (out of 6 fields) ──────────────────────────
    const fieldChecklist = [
        { value: userData?.name, label: "Name" },
        { value: userData?.designation, label: "Designation" },
        { value: userData?.phone, label: "Phone" },
        { value: userData?.description, label: "Bio" },
        { value: userData?.profilePicture?.url, label: "Avatar" },
        {
            value: userData?.socialLinks?.linkedin ||
                userData?.socialLinks?.twitter ||
                userData?.socialLinks?.facebook ||
                userData?.socialLinks?.instagram,
            label: "Social Link"
        },
        { value: userData?.seo?.title, label: "SEO Title" },
        { value: userData?.seo?.metaDescription, label: "SEO Description" },
    ];

    const missingFields = fieldChecklist.filter(f => !f.value).map(f => f.label);
    const completionPct = Math.round(
        ((fieldChecklist.length - missingFields.length) / fieldChecklist.length) * 100
    );

    console.log(userData)

    const completionColor =
        completionPct === 100
            ? "bg-emerald-500"
            : completionPct >= 60
            ? "bg-primary"
            : "bg-amber-400";

    return (
        <Card className={`overflow-hidden border-none shadow-xl bg-card ${className || ""}`}>
            {/* Banner */}
            <div className="h-24 bg-gradient-to-br from-indigo-500 via-primary to-purple-600 shadow-inner" />

            {/* Avatar */}
            <CardHeader className="text-center pb-2 -mt-12">
                <div className="mx-auto w-24 h-24 mb-4 relative group">
                    <div className="w-full h-full rounded-full bg-white p-1 shadow-lg overflow-hidden border-2 border-white transition-all">
                        {userData?.profilePicture?.url ? (
                            <img
                                src={userData.profilePicture.url}
                                alt={userData.name}
                                className="w-full h-full object-cover rounded-full"
                            />
                        ) : (
                            <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary rounded-full">
                                <User className="h-10 w-10 shrink-0" />
                            </div>
                        )}
                    </div>

                    {onEditAvatar && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEditAvatar(); }}
                            className="absolute bottom-0 right-0 h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded-full border-2 border-white dark:border-slate-900 shadow-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-primary hover:text-white transition-all hover:scale-110 z-10 cursor-pointer"
                            title="Change profile picture"
                        >
                            <Camera className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Name */}
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {userData?.name || "User Name"}
                </CardTitle>

                {/* Designation */}
                {userData?.designation && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {userData.designation}
                    </p>
                )}

                {/* Status badges */}
                {/* <div className="flex items-center justify-center flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 text-[10px] uppercase font-bold tracking-tighter border-slate-200 dark:border-slate-700">
                        {userData?.roles?.[0]?.name || userData?.rolesName?.[0] || userData?.userType || "User"}
                    </Badge>
                    {userData?.status && (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] items-center gap-1 font-bold uppercase">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            {userData.status}
                        </Badge>
                    )}
                </div> */}
            </CardHeader>

            {/* Info rows with pencil anchors */}
            <CardContent className="space-y-4 pt-4 border-t border-slate-50">
                <div className="space-y-2">

                    {/* Email — not editable, no pencil */}
                    <div className="flex items-center gap-3 text-xs px-1 py-1">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 truncate font-semibold flex-1">
                            {userData?.email || "No email"}
                        </span>
                    </div>

                    {/* Phone — pencil → scrolls to #phone */}
                    <EditableRow
                        icon={<Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                        label={getPhoneDisplay()}
                        fieldId="phone"
                        onEdit={scrollToField}
                        canEdit={canEdit}
                    />

                    {/* Location */}
                    {(userData?.timezone?.name || userData?.timezone?.country_or_territory) && (
                        <div className="flex items-center gap-3 text-xs px-1 py-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300 font-semibold flex-1">
                                {userData?.timezone?.name || userData?.timezone?.country_or_territory}
                            </span>
                        </div>
                    )}

                    {/* Designation — pencil → scrolls to #designation */}
                    {userData?.designation && (
                        <EditableRow
                            icon={<Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                            label={userData.designation}
                            fieldId="designation"
                            onEdit={scrollToField}
                            canEdit={canEdit}
                        />
                    )}
                </div>

                {/* ── Profile completion bar ─────────────────────────── */}
                <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Profile Completion
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {completionPct}%
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${completionColor}`}
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>
                    {completionPct < 100 && (
                        <div className="flex flex-wrap gap-x-1 gap-y-0.5 pt-0.5">
                            <span className="text-[10px] font-bold text-rose-400 uppercase">Missing:</span>
                            <p className="text-[10px] text-slate-400 font-medium">
                                {missingFields.join(", ")}
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Change Password quick-jump button ─────────────── */}
                {onChangePassword && (
                    <button
                        type="button"
                        onClick={onChangePassword}
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-blue-600 border border-blue-200 dark:border-blue-900/50 rounded-xl py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-[0.98] transition-all mt-1"
                    >
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        Change Password
                    </button>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Small reusable row with hover pencil ────────────────────────────────────
function EditableRow({
    icon,
    label,
    fieldId,
    onEdit,
    canEdit = true,
}: {
    icon: React.ReactNode;
    label: string;
    fieldId: string;
    onEdit: (id: string) => void;
    canEdit?: boolean;
}) {
    return (
        <div className="group flex items-center gap-3 text-xs px-1 py-1 rounded-lg">
            {icon}
            <span className="text-slate-600 dark:text-slate-300 font-semibold flex-1 truncate">{label}</span>
            {canEdit && (
                <button
                    type="button"
                    onClick={() => onEdit(fieldId)}
                    title={`Edit ${fieldId}`}
                    className="transition-opacity p-1 rounded-md hover:bg-primary/10 text-slate-400 hover:text-primary"
                >
                    <Pencil className="h-3 w-3 shrink-0" />
                </button>
            )}
        </div>
    );
}