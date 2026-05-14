"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Eye, Users, MousePointerClick, Timer, Settings } from "lucide-react";

import type { IntegrationRecord, GA4Account, GA4Data } from "@/lib/types";
import {
    initiateIntegrationConnect,
    fetchGA4Accounts,
    selectIntegrationAccount,
    disconnectIntegration,
    fetchGA4Data,
} from "@/lib/api";

interface GoogleAnalyticsCardProps {
    integration: IntegrationRecord | null;
    propertyId: string;
    onRefresh: () => void;
}

export function GoogleAnalyticsCard({
    integration,
    propertyId,
    onRefresh,
}: GoogleAnalyticsCardProps) {
    const status = integration?.status;

    const [accounts, setAccounts] = useState<GA4Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState("");
    const [ga4Data, setGa4Data] = useState<GA4Data | null>(null);

    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Fetch accounts when status is pending_selection
    useEffect(() => {
        if (status !== "pending_selection") return;
        let cancelled = false;

        async function load() {
            setIsLoadingAccounts(true);
            setError(null);
            try {
                const data = await fetchGA4Accounts(propertyId);
                if (!cancelled) setAccounts(data);
            } catch (err: any) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setIsLoadingAccounts(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [status, propertyId]);

    // Fetch analytics data when connected
    useEffect(() => {
        if (status !== "connected") return;
        let cancelled = false;

        async function load() {
            setIsLoadingData(true);
            try {
                const data = await fetchGA4Data(propertyId);
                if (!cancelled) setGa4Data(data);
            } catch (err: any) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setIsLoadingData(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [status, propertyId]);

    const handleConnect = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const url = await initiateIntegrationConnect(
                propertyId,
                "google_analytics",
                window.location.href
            );
            window.location.href = url;
        } catch (err: any) {
            setError(err.message);
            setIsProcessing(false);
        }
    };

    const handleSelectAccount = async () => {
        if (!selectedAccountId) return;
        const account = accounts.find((a) => a.accountId === selectedAccountId);
        if (!account) return;

        setIsProcessing(true);
        setError(null);
        try {
            await selectIntegrationAccount(
                propertyId,
                "google_analytics",
                account.accountId,
                account.accountLabel
            );
            onRefresh();
            setIsSettingsOpen(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDisconnect = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            await disconnectIntegration(propertyId, "google_analytics");
            onRefresh();
            setIsSettingsOpen(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleEvent = (checked: boolean) => {
        if (checked) {
            handleConnect();
        } else {
            handleDisconnect();
        }
    };

    const isConnected = status === "connected";
    const isPending = status === "pending_selection";
    const isExpiredOrError = status === "expired" || status === "error";

    const borderColor = isPending || isExpiredOrError
        ? "border-red-500"
        : isConnected
            ? "border-emerald-500"
            : "border-gray-200 hover:shadow-md";

    return (
        <>
            <Card className={`relative flex flex-col h-full transition-shadow ${borderColor}`}>
                <div className="absolute top-4 right-4 z-10">
                    {(isPending || isConnected || isExpiredOrError) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSettingsOpen(true)}
                            className={
                                isPending || isExpiredOrError
                                    ? "text-red-500 bg-red-50 animate-pulse rounded-full hover:bg-red-100"
                                    : "text-gray-400 hover:text-gray-700"
                            }
                            title="Configuration"
                        >
                            <Settings className="w-5 h-5" />
                        </Button>
                    )}
                </div>

                <CardContent className="p-5 flex flex-col flex-1 mt-1">
                    <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center p-1 border shadow-sm bg-white">
                        <img
                            src="/icons/google-analytics.png"
                            alt="Google Analytics"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    <h3 className="font-semibold text-lg mb-1">Google Analytics</h3>
                    <p className="text-sm text-muted-foreground leading-snug flex-1 mb-6">
                        Sync your metrics to get real-time insights on your audience.
                    </p>

                    <div className="flex items-center justify-between mt-auto">
                        <span
                            className={`text-sm font-medium ${isConnected
                                    ? "text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-100"
                                    : isPending || isExpiredOrError
                                        ? "text-red-600 bg-red-50 px-2.5 py-1 rounded border border-red-100"
                                        : "text-muted-foreground px-1"
                                }`}
                        >
                            {isProcessing && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />
                            )}
                            {isConnected
                                ? "Connected"
                                : isPending
                                    ? "Action Required"
                                    : isExpiredOrError
                                        ? "Error"
                                        : "Connect"}
                        </span>
                        <Switch
                            checked={isConnected || isPending || isExpiredOrError}
                            disabled={isProcessing}
                            onCheckedChange={handleToggleEvent}
                        />
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Google Analytics Configuration</DialogTitle>
                        <DialogDescription>
                            {isPending
                                ? "Select a GA4 property to sync your metrics."
                                : "View your connection details and analytics."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 p-2.5 rounded-md border border-red-100">
                                {error}
                            </p>
                        )}

                        {isExpiredOrError && (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Your connection has {status === "expired" ? "expired" : "encountered an error"}. Please reconnect.
                                </p>
                                <Button onClick={handleConnect} disabled={isProcessing} className="w-full">
                                    {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Reconnect
                                </Button>
                            </div>
                        )}

                        {isPending && (
                            <div className="space-y-4">
                                {isLoadingAccounts ? (
                                    <div className="flex items-center justify-center p-4 text-muted-foreground gap-2 text-sm">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Loading GA4 properties…
                                    </div>
                                ) : (
                                    <>
                                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a GA4 property" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map((acc) => (
                                                    <SelectItem key={acc.accountId} value={acc.accountId}>
                                                        {acc.accountLabel}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            onClick={handleSelectAccount}
                                            disabled={!selectedAccountId || isProcessing}
                                            className="w-full"
                                        >
                                            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Confirm Selection
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}

                        {isConnected && (
                            <div className="space-y-5">
                                {integration?.metadata?.label && (
                                    <div className="bg-muted/50 p-3 rounded-md border">
                                        <p className="text-xs text-muted-foreground mb-1">Connected Property</p>
                                        <p className="font-medium text-sm truncate">{integration.metadata.label}</p>
                                    </div>
                                )}

                                {isLoadingData ? (
                                    <div className="flex items-center justify-center p-4 text-muted-foreground gap-2 text-sm">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Fetching analytics logic…
                                    </div>
                                ) : ga4Data ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-muted/30 rounded-lg p-3 border space-y-1">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Eye className="w-4 h-4" />
                                                <span className="text-xs font-medium">Views</span>
                                            </div>
                                            <p className="text-xl font-semibold">{ga4Data.views.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded-lg p-3 border space-y-1">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Users className="w-4 h-4" />
                                                <span className="text-xs font-medium">Active Users</span>
                                            </div>
                                            <p className="text-xl font-semibold">{ga4Data.activeUsers.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded-lg p-3 border space-y-1">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <MousePointerClick className="w-4 h-4" />
                                                <span className="text-xs font-medium">Sessions</span>
                                            </div>
                                            <p className="text-xl font-semibold">{ga4Data.sessions.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded-lg p-3 border space-y-1">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Timer className="w-4 h-4" />
                                                <span className="text-xs font-medium">Engaged</span>
                                            </div>
                                            <p className="text-xl font-semibold">{ga4Data.engagedSessions.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
