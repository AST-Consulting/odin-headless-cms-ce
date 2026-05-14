"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Layout } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getWebStoryTemplates } from "@/lib/api";
import { WebStoryTemplate } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore } from "@/lib/store";
import { toast } from "sonner";

interface TemplatePickerProps {
    onSelect?: (template: WebStoryTemplate) => void;
    children?: React.ReactNode;
}

export function TemplatePicker({ onSelect, children }: TemplatePickerProps) {
    const [open, setOpen] = useState(false);
    const [templates, setTemplates] = useState<WebStoryTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const {
        setWebStoryTemplates,
        activeSlideId,
        updateSlide
    } = useEditorStore();

    useEffect(() => {
        if (open) {
            loadTemplates();
        }
    }, [open]);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const res = await getWebStoryTemplates();
            setWebStoryTemplates(res.data);
            setTemplates(res.data);
        } catch (error) {
            toast.error("Failed to load templates");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (template: WebStoryTemplate) => {
        if (onSelect) {
            onSelect(template);
        } else if (activeSlideId) {
            const initialData: Record<string, string> = {};
            template.allowedFields.forEach(field => {
                const lowerField = field.toLowerCase();
                const isMedia = lowerField.includes('image') || lowerField.includes('background') || lowerField.includes('media');
                if (isMedia) {
                    initialData[field] = (template.previewImage as any)?.url || "";
                } else {
                    initialData[field] = field.replace(/_/g, ' ');
                }
            });

            updateSlide(activeSlideId, {
                templateId: template._id,
                templateData: initialData
            });
            toast.success(`Template "${template.name}" applied`);
        }
        setOpen(false);
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.authors || []).some(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="outline" className="gap-2 rounded-xl h-11 border-2 hover:border-primary/50 transition-all">
                        <Layout className="h-4 w-4" />
                        Pick Template
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden border-2 rounded-3xl shadow-2xl">
                <DialogHeader className="p-6 border-b bg-muted/30">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                        <Layout className="h-7 w-7 text-primary" />
                        Select Story Template
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium">
                        Choose a professionally designed AMP layout for your slide.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            className="pl-10 h-12 rounded-2xl bg-muted/20 border-2 focus:border-primary transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="h-[500px] w-full pr-4">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
                            {loading ? (
                                Array(4).fill(0).map((_, i) => (
                                    <div key={i} className="aspect-[9/16] bg-muted animate-pulse rounded-2xl border" />
                                ))
                            ) : filteredTemplates.length === 0 ? (
                                <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl">
                                    <h3 className="text-lg font-medium text-muted-foreground">No templates found</h3>
                                </div>
                            ) : (
                                filteredTemplates.map((template) => (
                                    <TemplateItem
                                        key={template._id}
                                        template={template}
                                        onSelect={handleSelect}
                                    />
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function TemplateItem({
    template,
    onSelect
}: {
    template: WebStoryTemplate,
    onSelect: (t: WebStoryTemplate) => void
}) {
    const [hoverKey, setHoverKey] = useState(0);

    return (
        <div
            className="group relative aspect-[9/16] cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden border-2 hover:border-primary shadow-sm hover:shadow-xl bg-black"
            onClick={() => onSelect(template)}
            onMouseEnter={() => setHoverKey(prev => prev + 1)}
        >
            <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${(template.previewImage as any)?.url || ""})` }}>
                <div className="w-full h-full relative">
                    <div className="absolute inset-0 scale-[0.5] origin-top-left" style={{ width: '200%', height: '200%' }}>
                        <iframe
                            key={hoverKey}
                            srcDoc={renderTemplateHtml(template)}
                            className="w-full h-full border-none pointer-events-none"
                            title="Picker Preview"
                            loading="lazy"
                        />
                    </div>
                </div>
            </div>
            <div className="absolute inset-0 bg-transparent z-10" />
        </div>
    );
}

function renderTemplateHtml(template: WebStoryTemplate) {
    const backgroundUrl = (template.previewImage as any)?.url || "";
    const mockData: Record<string, string> = {
        headline: "Layout Preview Headline",
        title: "Template Demo",
        description: "Cinematic layout description placeholder text.",
        main_image: backgroundUrl,
        background_image: backgroundUrl,
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
                    body { margin: 0; padding: 0; background-color: #1a1a1a; color: #fff; font-family: sans-serif; overflow: hidden; }
                    .preview-page { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
                    amp-story-grid-layer { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
                    amp-story-grid-layer[template="fill"] { z-index: 1; justify-content: center; align-items: center; }
                    amp-story-grid-layer[template="vertical"] { z-index: 10; justify-content: flex-end; }
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
