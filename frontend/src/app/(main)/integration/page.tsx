"use client";

import { useState, useEffect, useCallback } from "react";
import { usePropertyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";
import { Loader2 } from "lucide-react";

import type { IntegrationRecord } from "@/lib/types";
import { fetchIntegrations } from "@/lib/api";
import { GoogleAnalyticsCard } from "@/components/integration/google-analytics";
import { GoogleSearchConsoleCard } from "@/components/integration/google-search-console";
import { YouTubeCard } from "@/components/integration/youtube";
import { FacebookCard } from "@/components/integration/facebook";
import { InstagramCard } from "@/components/integration/instagram";
import { TwitterCard } from "@/components/integration/twitter";
import { LinkedInCard } from "@/components/integration/linkedin";

export default function IntegrationPage() {
    const { selectedProperty } = usePropertyStore();
    const { token } = useAuthStore();

    const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const propertyId = selectedProperty?._id ?? "";

    const loadIntegrations = useCallback(async () => {
        if (!propertyId || !token) return;
        try {
            setIsLoading(true);
            const data = await fetchIntegrations(propertyId);
            setIntegrations(data);
        } catch (err) {
            console.error("Failed to fetch integrations", err);
        } finally {
            setIsLoading(false);
        }
    }, [propertyId, token]);

    useEffect(() => {
        loadIntegrations();
    }, [loadIntegrations]);

    const gaRecord =
        integrations.find((i) => i.provider === "google_analytics") ?? null;
    const gscRecord =
        integrations.find((i) => i.provider === "search_console") ?? null;
    const youtubeRecord =
        integrations.find((i) => i.provider === "youtube") ?? null;
    const facebookRecord =
        integrations.find((i) => i.provider === "facebook") ?? null;
    const instagramRecord =
        integrations.find((i) => i.provider === "instagram") ?? null;
    const twitterRecord =
        integrations.find((i) => i.provider === "twitter") ?? null;
    const linkedinRecord =
        integrations.find((i) => i.provider === "linkedin") ?? null;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Integration Settings
                </h1>
                <p className="text-muted-foreground">
                    Connect and manage third-party services to enhance your workflow
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <GoogleAnalyticsCard
                    integration={gaRecord}
                    propertyId={propertyId}
                    onRefresh={loadIntegrations}
                />
                <GoogleSearchConsoleCard
                    integration={gscRecord}
                    propertyId={propertyId}
                    onRefresh={loadIntegrations}
                />
                <YouTubeCard
                    integration={youtubeRecord}
                    propertyId={propertyId}
                    onRefresh={loadIntegrations}
                />
                <FacebookCard
                    integration={facebookRecord}
                    propertyId={propertyId}
                    onRefresh={loadIntegrations}
                />
                <InstagramCard
                    integration={instagramRecord}
                    propertyId={propertyId}
                    onRefresh={loadIntegrations}
                />
                <TwitterCard
                    integration={twitterRecord}
                    propertyId={propertyId}
                    onRefresh={loadIntegrations}
                />
                <LinkedInCard
                    integration={linkedinRecord}
                    propertyId={propertyId}
                    onRefresh={loadIntegrations}
                />
            </div>
        </div>
    );
}
