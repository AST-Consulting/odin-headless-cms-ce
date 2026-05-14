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
import { Loader2, Eye, Users, Settings, Facebook, MousePointerClick } from "lucide-react";

import type { IntegrationRecord, FacebookAccount, FacebookData } from "@/lib/types";
import {
    initiateIntegrationConnect,
    fetchFacebookAccounts,
    selectIntegrationAccount,
    disconnectIntegration,
    fetchFacebookData,
} from "@/lib/api";

interface FacebookCardProps {
    integration: IntegrationRecord | null;
    propertyId: string;
    onRefresh: () => void;
}

export function FacebookCard({
    integration,
    propertyId,
    onRefresh,
}: FacebookCardProps) {
    const status = integration?.status;

    const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState("");
    const [facebookData, setFacebookData] = useState<FacebookData | null>(null);

    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Fetch accounts when pending_selection
    useEffect(() => {
        if (status !== "pending_selection") return;
        let cancelled = false;

        async function load() {
            setIsLoadingAccounts(true);
            setError(null);
            try {
                const data = await fetchFacebookAccounts(propertyId);
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

    // Fetch Facebook data when connected
    useEffect(() => {
        if (status !== "connected") return;
        let cancelled = false;

        async function load() {
            setIsLoadingData(true);
            try {
                const data = await fetchFacebookData(propertyId);
                if (!cancelled) setFacebookData(data);
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
                "facebook",
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
                "facebook",
                account.accountId,
                account.accountLabel,
                account.pageAccessToken
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
            await disconnectIntegration(propertyId, "facebook");
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
                        <Facebook className="w-full h-full text-[#1877F2] p-1" />
                    </div>

                    <h3 className="font-semibold text-lg mb-1">Facebook Insights</h3>
                    <p className="text-sm text-muted-foreground leading-snug flex-1 mb-6">
                        Track your Facebook Page impressions and engaged users.
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
                        <DialogTitle>Facebook Insights Configuration</DialogTitle>
                        <DialogDescription>
                            {isPending
                                ? "Select a Facebook Page to sync your metrics."
                                : "View your connection details and page performance."}
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
                                        Loading Facebook Pages…
                                    </div>
                                ) : (
                                    <>
                                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a Facebook Page" />
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
                                        <p className="text-xs text-muted-foreground mb-1">Connected Page</p>
                                        <p className="font-medium text-sm truncate">{integration.metadata.label}</p>
                                    </div>
                                )}

                                {isLoadingData ? (
                                    <div className="flex items-center justify-center p-4 text-muted-foreground gap-2 text-sm">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Fetching page data…
                                    </div>
                                ) : facebookData ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-muted/30 rounded-lg p-3 border space-y-1">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Eye className="w-4 h-4" />
                                                <span className="text-xs font-medium">Impressions</span>
                                            </div>
                                            <p className="text-xl font-semibold">{facebookData.impressions.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded-lg p-3 border space-y-1">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Users className="w-4 h-4" />
                                                <span className="text-xs font-medium">Engaged Users</span>
                                            </div>
                                            <p className="text-xl font-semibold">{facebookData.engagedUsers.toLocaleString()}</p>
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
