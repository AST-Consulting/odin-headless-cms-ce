"use client";

import dynamic from "next/dynamic";

const CommandPalette = dynamic(
    () => import("@/components/layout/CommandPalette").then((m) => m.CommandPalette),
    {
        ssr: false,
        loading: () => null // Prevent layout shift
    }
);

const Toaster = dynamic(
    () => import("@/components/ui/toaster").then((m) => m.Toaster),
    {
        ssr: false,
        loading: () => null // Prevent layout shift
    }
);

import { SecurityContextSync } from "@/components/auth/SecurityContextSync";
import { ForcedPasswordChange } from "@/components/auth/ForcedPasswordChange";

export function ClientProviders() {
    return (
        <>
            <SecurityContextSync />
            <ForcedPasswordChange />
            <CommandPalette />
            <Toaster />
        </>
    );
}
