"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoFileTxtEditor } from "@/components/seo/SeoFileTxtEditor";
import { SeoFileHistory } from "@/components/seo/SeoFileHistory";
import { getSeoFileHistory, rollbackSeoFileVersion, deleteSeoFileVersion, SeoFileType } from "@/lib/api";
import { usePropertyStore } from "@/lib/store";

const SEO_FILE_TYPES: SeoFileType[] = ['robots', 'ads', 'llms'];

interface HistoryEntry {
    _id: string;
    version: string;
    createdBy: { id: string; name: string; email: string; userType: string };
    content: string;
    createdAt: string;
}

function SeoFileTab({ fileType }: { fileType: SeoFileType }) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const propertyId = usePropertyStore((state) => state.selectedProperty?._id);

    const fetchHistory = async () => {
        if (!propertyId) { setHistory([]); return; }
        setIsLoading(true);
        try {
            const data = await getSeoFileHistory(propertyId, fileType);
            setHistory(Array.isArray(data) ? data : []);
        } catch {
            toast.error(`Failed to fetch ${fileType}.txt history`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchHistory(); }, [propertyId, fileType]);

    const handleRevert = async (version: string) => {
        if (!propertyId) { toast.error('No property selected'); return; }
        try {
            await rollbackSeoFileVersion(propertyId, fileType, version);
            toast.success(`Reverted to ${version} successfully`);
            await fetchHistory();
            window.dispatchEvent(new CustomEvent(`seo-file-updated-${fileType}`));
        } catch {
            toast.error(`Failed to revert to ${version}`);
        }
    };

    const handleDelete = async (version: string) => {
        if (!propertyId) { toast.error('No property selected'); return; }
        try {
            await deleteSeoFileVersion(propertyId, fileType, version);
            toast.success(`Version ${version} deleted`);
            await fetchHistory();
        } catch {
            toast.error(`Failed to delete version ${version}`);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SeoFileTxtEditor fileType={fileType} onSaved={fetchHistory} />
            <SeoFileHistory
                fileType={fileType}
                history={history}
                onRevert={handleRevert}
                onDelete={handleDelete}
            />
        </div>
    );
}

export default function SeoSettingsPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">SEO Settings</h1>

            <Tabs defaultValue="robots">
                <TabsList>
                    {SEO_FILE_TYPES.map((type) => (
                        <TabsTrigger key={type} value={type}>
                            {type}.txt
                        </TabsTrigger>
                    ))}
                </TabsList>

                {SEO_FILE_TYPES.map((type) => (
                    <TabsContent key={type} value={type} className="mt-6">
                        <SeoFileTab fileType={type} />
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
