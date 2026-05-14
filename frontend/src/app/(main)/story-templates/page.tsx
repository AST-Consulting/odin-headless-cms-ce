"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Trash2, Pencil, User, Code, FileCode, Eye, Tag, ExternalLink, CalendarDays, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getWebStoryTemplates, deleteWebStoryTemplate } from "@/lib/api";
import { WebStoryTemplate } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthStore, havePermission } from "@/lib/auth";

export default function StoryTemplatesPage() {
    const [templates, setTemplates] = useState<WebStoryTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState<WebStoryTemplate | null>(null);
    const router = useRouter();
    const { user: authUser } = useAuthStore();

    const canCreate = havePermission(authUser, "webstory-template", "write");
    const canEdit = havePermission(authUser, "webstory-template", "edit");
    const canDelete = havePermission(authUser, "webstory-template", "delete");
    // console.log(authUser);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getWebStoryTemplates();
            setTemplates(res.data);
        } catch (error) {
            console.error("Failed to fetch templates", error);
            toast.error("Failed to load templates");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;
        try {
            await deleteWebStoryTemplate(id);
            toast.success("Template deleted successfully");
            if (selectedTemplate?._id === id) setSelectedTemplate(null);
            fetchTemplates();
        } catch (error) {
            toast.error("Failed to delete template");
        }
    };

    const filteredTemplates = templates.filter(t => {
        const nameMatch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
        const authorMatch = t.authors && t.authors.length > 0
            ? t.authors[0].name.toLowerCase().includes(searchTerm.toLowerCase())
            : (t as any).author?.toLowerCase().includes(searchTerm.toLowerCase());

        return nameMatch || authorMatch;
    });

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <FileCode className="h-6 w-6 text-primary" />
                        STORY TEMPLATES
                        <span className="text-muted-foreground font-normal ml-2">({templates.length})</span>
                    </h1>
                </div>
                <Button 
                    onClick={() => router.push("/story-templates/create")} 
                    className={`gap-2 rounded-xl h-10 px-5 shadow-sm font-semibold ${!canCreate ? 'hidden' : ''}`}
                >
                    <Plus className="h-5 w-5" />
                    Create Layout
                </Button>
            </div>

            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors" />
                <Input
                    placeholder="Search layouts..."
                    className="pl-10 h-10 rounded-xl bg-card border font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {loading ? (
                    Array(10).fill(0).map((_, i) => (
                        <div key={i} className="aspect-[9/16] bg-muted animate-pulse rounded-2xl border" />
                    ))
                ) : filteredTemplates.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-muted flex flex-col items-center justify-center gap-2">
                        <Code className="h-12 w-12 text-muted-foreground/30" />
                        <h3 className="text-lg font-semibold text-muted-foreground">No templates found</h3>
                    </div>
                ) : (
                    filteredTemplates.map((template) => (
                        <TemplateCard
                            key={template._id}
                            template={template}
                            onClick={() => setSelectedTemplate(template)}
                        />
                    ))
                )}
            </div>

            <TemplateDetailDialog
                template={selectedTemplate}
                open={!!selectedTemplate}
                onOpenChange={(open: boolean) => !open && setSelectedTemplate(null)}
                onDelete={handleDelete}
                onEdit={(id: string) => router.push(`/story-templates/edit/${id}`)}
                canEdit={canEdit}
                canDelete={canDelete}
            />
        </div>
    );
}

function renderTemplateHtml(template: WebStoryTemplate) {
    const backgroundUrl = (template.previewImage as any)?.url || "";
    const mockData: Record<string, string> = {
        headline: "World's Most Innovative Sustainable Projects 2024",
        title: "Global Innovation Report",
        description: "A deep dive into how green energy is reshaping our future one layout at a time.",
        main_image: backgroundUrl,
        background_image: backgroundUrl,
        image_credit: "Photo by Pexels / Environmental Agency",
    };

    let processedHtml = template.html.replace(/{{\s*(\w+)\s*}}/g, (_: string, key: string) => {
        const lowerKey = key.toLowerCase();
        let value = mockData[lowerKey];

        if (!value) {
            if (lowerKey.includes('image') || lowerKey.includes('media') || lowerKey.includes('background')) {
                value = backgroundUrl;
            } else {
                value = key.replace(/_/g, ' ');
            }
        }
        return value;
    });

    processedHtml = processedHtml
        .replace(/<amp-img/gi, '<img style="object-fit: cover; width: 100%; height: 100%;"')
        .replace(/<\/amp-img>/gi, '');

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <style>
                    body { 
                        margin: 0; padding: 0; 
                        background-color: #000; 
                        background-image: url(${backgroundUrl});
                        background-size: cover;
                        background-position: center;
                        color: #fff; 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                        overflow: hidden; 
                    }
                    .preview-page { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
                    amp-story-grid-layer { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
                    amp-story-grid-layer[template="fill"] { z-index: 1; justify-content: center; align-items: center; }
                    amp-story-grid-layer[template="vertical"] { z-index: 10; justify-content: flex-end; }
                    amp-story-grid-layer[template="thirds"] { z-index: 10; display: grid; grid-template-rows: 1fr 1fr 1fr; }
                    ${template.css}
                </style>
            </head>
            <body>
                <div class="preview-page">
                    ${processedHtml}
                </div>
            </body>
        </html>
    `;
}

function TemplateCard({ template, onClick }: { template: WebStoryTemplate, onClick: () => void }) {
    const [hoverKey, setHoverKey] = useState(0);

    const handleMouseEnter = () => {
        setHoverKey(prev => prev + 1);
    };

    return (
        <Card
            className="group relative aspect-[9/16] overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:border-primary/50 bg-black"
            onMouseEnter={handleMouseEnter}
            onClick={onClick}
        >
            <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${template.previewImage})` }}>
                <div className="w-full h-full relative">
                    <div className="absolute inset-0 scale-[0.5] origin-top-left" style={{ width: '200%', height: '200%' }}>
                        <iframe
                            key={hoverKey}
                            srcDoc={renderTemplateHtml(template)}
                            className="w-full h-full border-none pointer-events-none"
                            title="Card Preview"
                            loading="lazy"
                        />
                    </div>
                </div>
            </div>

            <div className="absolute inset-0 bg-transparent z-10" />
        </Card>
    );
}

function TemplateDetailDialog({
    template,
    open,
    onOpenChange,
    onDelete,
    onEdit,
    canEdit,
    canDelete
}: {
    template: WebStoryTemplate | null,
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onDelete: (id: string) => void,
    onEdit: (id: string) => void,
    canEdit: boolean,
    canDelete: boolean
}) {
    if (!template) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1000px] w-[95vw] h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                <div className="flex flex-col md:flex-row h-full sm:h-auto overflow-hidden">
                    {/* Visual Preview Section (Larger viewport) */}
                    <div className="w-full h-[50vh] md:h-auto md:flex-1 bg-[#0a0a0a] flex items-center justify-center p-4 md:p-12 relative overflow-hidden shrink-0">
                        <div className="w-full h-full max-w-[400px] aspect-[9/16] relative rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10">
                            <iframe
                                srcDoc={renderTemplateHtml(template)}
                                className="w-full h-full border-none pointer-events-none"
                                title="Modal Preview"
                            />
                        </div>
                    </div>

                    <div className="w-full md:w-[350px] bg-background border-t md:border-t-0 md:border-l flex flex-col min-h-0 flex-1 md:flex-none">
                        <DialogHeader className="p-6 border-b shrink-0">
                            <DialogTitle className="truncate font-bold text-xl tracking-tight uppercase">{template.name}</DialogTitle>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 uppercase font-semibold">
                                <User className="h-3 w-3" /> {template.authors && template.authors.length > 0 ? template.authors[0].name : (template as any).author || "System"}
                            </p>
                        </DialogHeader>

                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Meta Information</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center group">
                                            <span className="text-sm text-muted-foreground font-medium">Created</span>
                                            <span className="text-sm font-bold">{new Date(template.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground font-medium">Type</span>
                                            <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 uppercase text-[10px] px-2 font-bold">Web Story</Badge>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground font-medium">Visibility</span>
                                            <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 uppercase text-[10px] px-2 font-bold">Public</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Variables</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {template.allowedFields.map((field: string) => (
                                            <Badge key={field} variant="secondary" className="px-3 py-1 rounded-lg font-bold text-[10px] bg-muted/50 border uppercase tracking-tight">
                                                {field.replace(/_/g, ' ')}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex items-center justify-end gap-1 pt-4">
                                    {canEdit && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEdit(template._id)}
                                            className="h-8 w-8 p-0"
                                            title="Edit Layout"
                                        >
                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDelete(template._id)}
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            title="Delete Layout"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
