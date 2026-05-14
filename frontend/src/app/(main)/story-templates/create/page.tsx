"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Code, FileVideo, Plus, X, User, ExternalLink, Info, Monitor, ImageIcon, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createWebStoryTemplate } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImagePickerDialog } from "@/components/editor/ImagePickerDialog";
import { AuthorSelector } from "@/components/common/AuthorSelector";
import { AuthorStub, FileSub } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";

export default function CreateTemplatePage() {
    const router = useRouter();
    const selectedProperty = usePropertyStore(state => state.selectedProperty);
    const { user, hasHydrated } = useAuthStore();
    
    // Permission check
    useEffect(() => {
        if (hasHydrated) {
            const { havePermission } = require("@/lib/auth");
            if (!havePermission(user, "webstory-template", "write")) {
                toast.error("You do not have permission to create templates");
                router.push("/story-templates");
            }
        }
    }, [user, hasHydrated, router]);

    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [isSlugAuto, setIsSlugAuto] = useState(true);
    const [authors, setAuthors] = useState<AuthorStub[]>(() => {
        const u = useAuthStore.getState().user;
        if (u) return [{ id: u.id, name: u.alt_name || u.name, slug: u.slug || "" }];
        return [];
    });
    const [propertyId, setPropertyId] = useState<string | undefined>("");
    const [organizationId, setOrganizationId] = useState<string | undefined>("");
    const [html, setHtml] = useState(`<div class="story-container">
  <amp-img src="{{main_image}}" width="720" height="1280" layout="responsive"></amp-img>
  <div class="content-overlay">
    <h1>{{headline}}</h1>
  </div>
</div>`);
    const [css, setCss] = useState(`.story-container { position: relative; width: 100%; height: 100%; }
.content-overlay { position: absolute; bottom: 40px; left: 20px; color: white; }`);
    const [previewImage, setPreviewImage] = useState<FileSub | null>(null);
    const [allowedFields, setAllowedFields] = useState<string[]>(["headline", "main_image"]);
    const [newField, setNewField] = useState("");
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // Auto-generate slug from name
    useEffect(() => {
        if (isSlugAuto) {
            setSlug(name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
        }
    }, [name, isSlugAuto]);

    // Default to logged in user as author if not already set (for hydration case)
    useEffect(() => {
        if (user && authors.length === 0) {
            setAuthors([{
                id: user.id,
                name: user.alt_name || user.name,
                slug: user.slug || ""
            }]);
        }
    }, [user, authors.length]);

    const addField = () => {
        if (!newField.trim()) return;
        if (allowedFields.includes(newField.trim())) return;
        setAllowedFields([...allowedFields, newField.trim()]);
        setNewField("");
    };

    const [previewKey, setPreviewKey] = useState(0);

    const removeField = (field: string) => {
        setAllowedFields(allowedFields.filter(f => f !== field));
    };

    const renderPreview = () => {
        let processedHtml = html;
        // Basic variable replacement for preview with watermarks
        const mockData: Record<string, string> = {
            headline: "Layout Headline Text",
            title: "Template Title",
            description: "Cinematic layout description placeholder text.",
            main_image: (previewImage as any)?.url || "https://placehold.co/720x1280/1a1a1a/ffffff?text=TEMPLATE+MEDIA",
            background_image: (previewImage as any)?.url || "https://placehold.co/720x1280/121212/333333?text=BG+MEDIA",
            image_credit: "Source: Placehold.co",
            cta_text: "Call To Action",
            cta_link: "#"
        };

        allowedFields.forEach(field => {
            const isImage = field.toLowerCase().includes('image') || field.toLowerCase().includes('media');
            let placeholder = mockData[field];

            if (!placeholder) {
                if (isImage && previewImage) {
                    placeholder = (previewImage as any).url;
                } else if (isImage) {
                    placeholder = `https://placehold.co/720x1280/1a1a1a/ffffff?text=${field.toUpperCase()}`;
                } else {
                    placeholder = `[${field.toUpperCase()}]`;
                }
            }
            processedHtml = processedHtml.replace(new RegExp(`{{${field}}}`, 'g'), placeholder);
        });

        // Mock AMP elements for Live Preview rendering without AMP scripts
        processedHtml = processedHtml
            .replace(/<amp-img/gi, '<img style="object-fit: cover; width: 100%; height: 100%;"')
            .replace(/<\/amp-img>/gi, '');

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { margin: 0; padding: 0; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                        .preview-page { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
                        
                        /* AMP Mock Styles for Preview */
                        amp-story-grid-layer { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
                        amp-story-grid-layer[template="fill"] { z-index: 1; justify-content: center; align-items: center; }
                        amp-story-grid-layer[template="vertical"] { z-index: 10; justify-content: flex-end; }
                        amp-story-grid-layer[template="thirds"] { z-index: 10; display: grid; grid-template-rows: 1fr 1fr 1fr; }
                        
                        ${css}
                        
                        /* Animation Reset Support */
                        .animate-running {
                          animation-play-state: running !important;
                        }
                    </style>
                </head>
                <body>
                    <div class="preview-page">
                        ${processedHtml}
                    </div>
                </body>
            </html>
        `;
    };

    const handleReplay = () => {
        setPreviewKey(prev => prev + 1);
    };

    const handleSave = async () => {
        if (!name || authors.length === 0 || !html || !css) {
            toast.error("Please fill all required fields");
            return;
        }
        setLoading(true);
        try {
            await createWebStoryTemplate({
                name,
                slug,
                authors,
                html,
                css,
                previewImage: previewImage || undefined,
                allowedFields,
                propertyId: selectedProperty?._id,
                organizationId: user?.organizationId
            });
            toast.success("Template created successfully");
            router.push("/story-templates");
        } catch (error) {
            console.error("Failed to create template", error);
            toast.error("Failed to create template");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 py-4 border-b">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Create AMP Story Template</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Define your custom HTML/CSS and dynamic variables.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => router.back()} className="h-11 px-6 rounded-xl">Cancel</Button>
                    <Button onClick={handleSave} disabled={loading} className="gap-2 h-11 px-6 rounded-xl shadow-lg shadow-primary/20">
                        <Save className="h-5 w-5" />
                        Save Template
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* PRIMARY METADATA */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-2xl border-2 shadow-sm bg-card">
                        <CardHeader className="border-b bg-muted/30 pb-4">
                            <CardTitle className="text-sm uppercase font-bold tracking-wider text-primary flex items-center gap-2">
                                <Info className="h-4 w-4" /> Layout Metadata
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Template Name</label>
                                    <Input
                                        placeholder="e.g. Hero Image Overlay"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-12 rounded-xl bg-background border-2 focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Creator / Author</label>
                                    <AuthorSelector
                                        selected={authors}
                                        onChange={setAuthors}
                                        className="h-12 rounded-xl bg-background border-2 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 shadow-sm bg-card overflow-hidden">
                        <Tabs defaultValue="html" className="w-full">
                            <CardHeader className="border-b bg-muted/30 flex flex-row items-center justify-between p-0 px-4">
                                <TabsList className="bg-transparent h-14 p-0 gap-6">
                                    <TabsTrigger value="html" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-bold uppercase text-[11px] tracking-widest gap-2">
                                        <Code className="h-4 w-4" /> HTML Output (AMP)
                                    </TabsTrigger>
                                    <TabsTrigger value="css" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-bold uppercase text-[11px] tracking-widest gap-2">
                                        <FileVideo className="h-4 w-4" /> Layout Styles (CSS)
                                    </TabsTrigger>
                                </TabsList>
                            </CardHeader>
                            <TabsContent value="html" className="p-0 m-0">
                                <Textarea
                                    value={html}
                                    onChange={(e) => setHtml(e.target.value)}
                                    className="min-h-[400px] border-none rounded-none font-mono text-sm p-6 focus:ring-0 leading-relaxed bg-muted/10 selection:bg-primary/20"
                                    placeholder="<!-- Valid AMP Story HTML here -->"
                                />
                            </TabsContent>
                            <TabsContent value="css" className="p-0 m-0">
                                <Textarea
                                    value={css}
                                    onChange={(e) => setCss(e.target.value)}
                                    className="min-h-[400px] border-none rounded-none font-mono text-sm p-6 focus:ring-0 leading-relaxed bg-muted/10 selection:bg-primary/20"
                                    placeholder="/* Layout-specific styles */"
                                />
                            </TabsContent>
                        </Tabs>
                        <div className="p-4 bg-muted/20 border-t flex items-center gap-3">
                            <Info className="h-4 w-4 text-primary shrink-0" />
                            <p className="text-[11px] font-medium text-muted-foreground leading-snug">
                                Tips: Use double brackets like <span className="text-primary">{"{{headline}}"}</span> for variables. These will become editable fields with the story editor.
                            </p>
                        </div>
                    </Card>
                </div>

                {/* SIDEBAR: PREVIEW & VARIABLES */}
                <div className="space-y-6">
                    <Card className="rounded-2xl border-2 shadow-sm bg-card overflow-hidden">
                        <Tabs defaultValue="live" className="w-full">
                            <CardHeader className="border-b bg-muted/30 p-0 px-4">
                                <TabsList className="bg-transparent h-14 p-0 gap-6">
                                    <TabsTrigger value="live" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-bold uppercase text-[11px] tracking-widest gap-2">
                                        <Monitor className="h-4 w-4" /> Live Preview
                                    </TabsTrigger>
                                    <TabsTrigger value="thumb" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-bold uppercase text-[11px] tracking-widest gap-2">
                                        <ImageIcon className="h-4 w-4" /> Static Thumb
                                    </TabsTrigger>
                                </TabsList>
                            </CardHeader>
                            <CardContent className="p-0">
                                <TabsContent value="live" className="m-0 p-0 relative group">
                                    <div className="aspect-[9/16] bg-black relative overflow-hidden">
                                        <iframe
                                            key={previewKey}
                                            srcDoc={renderPreview()}
                                            className="w-full h-full border-none pointer-events-none"
                                            title="Template Preview"
                                        />
                                    </div>

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="secondary"
                                            size="lg"
                                            className="h-16 w-16 rounded-full shadow-2xl scale-90 hover:scale-100 transition-transform bg-white/10 backdrop-blur-md border border-white/20"
                                            onClick={handleReplay}
                                        >
                                            <Play className="h-8 w-8 text-white fill-white ml-1" />
                                        </Button>
                                    </div>

                                    <div className="absolute top-4 right-4 z-20">
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-8 w-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black"
                                            onClick={handleReplay}
                                        >
                                            <RotateCcw className="h-4 w-4 text-white" />
                                        </Button>
                                    </div>
                                </TabsContent>
                                <TabsContent value="thumb" className="m-0 p-6">
                                    <div className="aspect-[9/16] rounded-xl border-2 border-dashed flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/10 transition-colors cursor-pointer group relative overflow-hidden"
                                        onClick={() => setIsPickerOpen(true)}>
                                        {previewImage?.url ? (
                                            <img src={previewImage.url} className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <Plus className="h-10 w-10 text-muted-foreground/30 mb-2 group-hover:scale-110 transition-transform" />
                                                <p className="text-xs text-muted-foreground text-center px-4 font-medium uppercase tracking-tight">Select Preview Image</p>
                                            </>
                                        )}
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <Button
                                                size="sm"
                                                className="w-full h-9 rounded-lg shadow-lg"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsPickerOpen(true);
                                                }}
                                            >
                                                Upload / Select
                                            </Button>
                                        </div>
                                    </div>
                                    <ImagePickerDialog
                                        open={isPickerOpen}
                                        onOpenChange={setIsPickerOpen}
                                        onImageSelected={(images) => setPreviewImage(images[0])}
                                    />
                                    {previewImage?.url && (
                                        <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-primary/10">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Active Preview URL</label>
                                            <p className="text-[10px] font-mono break-all text-primary truncate">{previewImage.url}</p>
                                        </div>
                                    )}
                                </TabsContent>
                            </CardContent>
                        </Tabs>
                    </Card>

                    <Card className="rounded-2xl border-2 shadow-sm bg-card overflow-hidden">
                        <CardHeader className="border-b bg-muted/30 pb-4">
                            <CardTitle className="text-sm uppercase font-bold tracking-wider text-primary flex items-center gap-2">
                                <Plus className="h-4 w-4" /> Allowed Fields
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="field_key"
                                    value={newField}
                                    onChange={(e) => setNewField(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addField()}
                                    className="h-11 rounded-xl bg-background"
                                />
                                <Button size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={addField}>
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {allowedFields.map(field => (
                                    <div key={field} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group">
                                        <span className="text-sm font-semibold tracking-tight">{field}</span>
                                        <button onClick={() => removeField(field)} className="text-primary/40 hover:text-primary transition-colors">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {allowedFields.length === 0 && (
                                    <p className="text-xs text-muted-foreground pt-4 text-center w-full italic">No dynamic fields registered yet.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
