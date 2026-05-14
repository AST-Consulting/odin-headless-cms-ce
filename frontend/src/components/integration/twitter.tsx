"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Loader2, Settings, Twitter } from "lucide-react";
import { toast } from "sonner";
import { initiateIntegrationConnect, disconnectIntegration } from "@/lib/api";

interface TwitterCardProps {
    integration: any;
    propertyId: string;
    onRefresh: () => void;
}

export function TwitterCard({
    integration,
    propertyId,
    onRefresh,
}: TwitterCardProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const isConnected = integration?.status === "connected";

    const handleConnect = async () => {
        if (!propertyId) return;
        try {
            setIsProcessing(true);
            const redirectUrl = `${window.location.origin}/integration`;
            const authUrl = await initiateIntegrationConnect(propertyId, "twitter", redirectUrl);
            window.location.href = authUrl;
        } catch (error: any) {
            toast.error("Failed to initiate X connection: " + error.message);
            setIsProcessing(false);
        }
    };

    const handleDisconnect = async () => {
        if (!propertyId) return;
        try {
            setIsProcessing(true);
            await disconnectIntegration(propertyId, "twitter");
            toast.success("Disconnected from X (Twitter)");
            onRefresh();
        } catch (error: any) {
            toast.error("Failed to disconnect: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
            <Card className={`relative flex flex-col h-full transition-shadow border-2 ${isConnected ? 'border-emerald-500' : 'border-gray-200 hover:shadow-md'}`}>
                <div className="absolute top-4 right-4 z-10">
                    {isConnected && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSettingsOpen(true)}
                            className="text-gray-400 hover:text-gray-700"
                        >
                            <Settings className="w-5 h-5" />
                        </Button>
                    )}
                </div>

                <CardContent className="p-5 flex flex-col flex-1 mt-1">
                    <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center p-1 border shadow-sm bg-black">
                        <Twitter className="w-full h-full text-white p-2" />
                    </div>

                    <h3 className="font-semibold text-lg mb-1">X (Twitter)</h3>
                    <p className="text-sm text-muted-foreground leading-snug flex-1 mb-6">
                        Post updates and threads directly to your X profile.
                    </p>

                    <div className="flex items-center justify-between mt-auto">
                        <span className={`text-sm font-medium ${isConnected ? "text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-100" : "text-muted-foreground px-1"}`}>
                            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />}
                            {isConnected ? "Connected" : "Connect"}
                        </span>
                        <Switch
                            checked={isConnected}
                            disabled={isProcessing}
                            onCheckedChange={(checked) => checked ? handleConnect() : handleDisconnect()}
                        />
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>X Integration Settings</DialogTitle>
                        <DialogDescription>
                            Manage your X (Twitter) connection and automated posting preferences.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-muted/50 p-3 rounded-md border flex items-center gap-3">
                            {integration?.metadata?.profileImageUrl && (
                                <img src={integration.metadata.profileImageUrl} alt={integration.metadata.username} className="w-10 h-10 rounded-full border" />
                            )}
                            <div>
                                <p className="text-xs text-muted-foreground mb-0.5">Connected Account</p>
                                <p className="font-medium text-sm">@{integration?.metadata?.username || "Connected"}</p>
                            </div>
                        </div>
                        <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={handleDisconnect}>
                            Disconnect Account
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
