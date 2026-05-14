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
import { Loader2, Settings, Linkedin } from "lucide-react";
import { toast } from "sonner";

interface LinkedInCardProps {
    integration: any;
    propertyId: string;
    onRefresh: () => void;
}

export function LinkedInCard({
    integration,
    propertyId,
    onRefresh,
}: LinkedInCardProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    // For demo/mock purposes
    const [mockStatus, setMockStatus] = useState(integration?.status || "disconnected");

    const handleConnect = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setMockStatus("connected");
            setIsProcessing(false);
            toast.success("Successfully connected to LinkedIn");
            onRefresh();
        }, 1200);
    };

    const handleDisconnect = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setMockStatus("disconnected");
            setIsProcessing(false);
            toast.success("Disconnected from LinkedIn");
            onRefresh();
        }, 800);
    };

    const isConnected = mockStatus === "connected";

    return (
        <>
            <Card className={`relative flex flex-col h-full transition-shadow border-2 ${isConnected ? 'border-indigo-500' : 'border-gray-200 hover:shadow-md'}`}>
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
                    <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center p-1 border shadow-sm bg-white">
                        <Linkedin className="w-full h-full text-[#0A66C2] p-1.5" />
                    </div>

                    <h3 className="font-semibold text-lg mb-1">LinkedIn</h3>
                    <p className="text-sm text-muted-foreground leading-snug flex-1 mb-6">
                        Share insightful articles and opinions directly to your LinkedIn professional network.
                    </p>

                    <div className="flex items-center justify-between mt-auto">
                        <span className={`text-sm font-medium ${isConnected ? "text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100" : "text-muted-foreground px-1"}`}>
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
                        <DialogTitle>LinkedIn Integration Settings</DialogTitle>
                        <DialogDescription>
                            Configure how your articles are shared to LinkedIn.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-muted/50 p-3 rounded-md border">
                            <p className="text-xs text-muted-foreground mb-1">Primary Network</p>
                            <p className="font-medium text-sm">LinkedIn Professional Profile</p>
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
