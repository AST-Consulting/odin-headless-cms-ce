"use client";

import React, { useState, useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Image as ImageIcon, Sparkles, Save, MousePointer2, Copy, Play, Layout, Code, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ImagePickerDialog } from "@/components/editor/ImagePickerDialog";
import { toast } from "sonner";
import { StoryCanvas } from "./StoryCanvas";
import { TemplatePicker } from "./TemplatePicker";
import { StoryElement, StorySlide } from "@/lib/web-story.types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WebStoryEditorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
  onSave: (status?: string) => Promise<void>;
  onImagePick: () => void;
}

export function WebStoryEditor({ editor, onSave, onImagePick }: WebStoryEditorProps) {
  const {
    webStoryData,
    activeSlideId,
    setActiveSlideId,
    addSlide,
    deleteSlide,
    duplicateSlide,
    reorderSlides,
    updateSlide,
    webStoryTemplates,
    images: storeImages
  } = useEditorStore() as any;

  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [currentFieldTarget, setCurrentFieldTarget] = useState<string | null>(null);


  // Auto-advance logic for Preview mode
  useEffect(() => {
    let timer: any;
    if (isPreviewMode && activeSlideId && webStoryData) {
      const currentIndex = webStoryData.slides.findIndex((s: any) => s.id === activeSlideId);
      const currentSlide = webStoryData.slides[currentIndex];

      if (currentSlide && currentIndex < webStoryData.slides.length - 1) {
        timer = setTimeout(() => {
          setActiveSlideId(webStoryData.slides[currentIndex + 1].id);
        }, (currentSlide.duration || 7) * 1000);
      }
    }
    return () => clearTimeout(timer);
  }, [isPreviewMode, activeSlideId, webStoryData, setActiveSlideId]);

  // Initial dummy data initialization if empty
  React.useEffect(() => {
    if (!webStoryData) {
      const initialSlideId = crypto.randomUUID();
      useEditorStore.getState().setWebStoryData({
        slides: [
          {
            id: initialSlideId,
            background: { type: "color", content: "#1a1a1a" },
            duration: 7,
            elements: []
          }
        ]
      });
      setActiveSlideId(initialSlideId);
    }
  }, [webStoryData, setActiveSlideId]);

  const handleAddSlide = () => {
    const newId = crypto.randomUUID();
    addSlide({
      id: newId,
      background: { type: "color", content: "#000000" },
      duration: 7,
      elements: []
    });
    setActiveSlideId(newId);
    toast.success("New slide added");
  };

  const handleDuplicateSlide = (id: string) => {
    duplicateSlide(id);
    toast.success("Slide duplicated");
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDraggingId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDraggingId(null);
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = webStoryData.slides.findIndex((s: any) => s.id === active.id);
      const newIndex = webStoryData.slides.findIndex((s: any) => s.id === over?.id);
      reorderSlides(oldIndex, newIndex);
    }
  };

  const activeSlide = webStoryData?.slides.find((s: any) => s.id === activeSlideId);

  return (
    <div className="flex h-full w-full bg-background overflow-hidden border rounded-xl shadow-sm">
      {/* Left Sidebar: Slide Navigation */}
      {!isPreviewMode && (
        <div className="w-48 border-r flex flex-col bg-muted/20">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Slides</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddSlide}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={webStoryData?.slides.map((s: any) => s.id) || []}
                strategy={verticalListSortingStrategy}
              >
                <div className="p-3 space-y-3">
                  {webStoryData?.slides.map((slide: any, index: number) => (
                    <SortableSlide
                      key={slide.id}
                      slide={slide}
                      index={index}
                      activeSlideId={activeSlideId}
                      setActiveSlideId={setActiveSlideId}
                      handleDuplicateSlide={handleDuplicateSlide}
                      deleteSlide={deleteSlide}
                      slideCount={webStoryData.slides.length}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay adjustScale={true}>
                {activeDraggingId ? (() => {
                  const slide = webStoryData.slides.find((s: any) => s.id === activeDraggingId);
                  const template = webStoryTemplates.find((t: any) => t._id === slide?.templateId);
                  const processedHtml = template ? template.html.replace(/{{\s*(\w+)\s*}}/g, (_: string, key: string) => {
                    const lowerKey = key.toLowerCase();
                    const value = Object.entries(slide.templateData || {}).find(([k]) => k.toLowerCase() === lowerKey)?.[1] || "";
                    return value;
                  }) : "";

                  const backgroundField = template?.allowedFields?.find((f: string) => {
                    const l = f.toLowerCase();
                    return (l.includes('image') || l.includes('media') || l.includes('background')) && !l.includes('credit');
                  });

                  const backgroundUrl = backgroundField ? (Object.entries(slide.templateData || {}).find(([k]) => k.toLowerCase() === backgroundField.toLowerCase())?.[1] || (template.previewImage as any)?.url) : "";

                  return (
                    <div className="flex items-start gap-2 opacity-80 cursor-grabbing pointer-events-none">
                      <div className="flex flex-col items-center pt-4 select-none">
                        <GripVertical className="h-4 w-4 text-primary" />
                      </div>
                      <div
                        className="relative aspect-[9/16] w-28 rounded-xl border-4 border-primary shadow-2xl overflow-hidden"
                        style={{
                          backgroundColor: '#171717',
                          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        {template && <style dangerouslySetInnerHTML={{ __html: template.css }} />}
                        <div className="absolute inset-0 scale-[0.25] origin-top-left" style={{ width: '400%', height: '400%' }}>
                          {template ? (
                            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: processedHtml }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-white/20 text-[20px]">EMPTY</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          </ScrollArea>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-900/50 relative">
        {/* Canvas Toolbar */}
        <div className="h-14 border-b bg-background flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
            Story Preview
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isPreviewMode ? "default" : "outline"}
              size="sm"
              className="gap-2 h-9 px-4 rounded-full shadow-lg"
              onClick={() => {
                if (!isPreviewMode && webStoryData?.slides.length > 0) {
                  setActiveSlideId(webStoryData.slides[0].id);
                }
                setIsPreviewMode(!isPreviewMode);
              }}
            >
              {isPreviewMode ? <MousePointer2 className="h-4 w-4" /> : <Play className="h-4 w-4 fill-primary" />}
              {isPreviewMode ? "Back to Edit" : "Preview Result"}
            </Button>
          </div>
        </div>

        {/* The Viewport */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          {activeSlide && (
            <div className="h-full">
              <StoryCanvas slide={activeSlide} isPreviewMode={isPreviewMode} />
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-background/80 backdrop-blur border rounded-full px-6 py-2 shadow-xl">
          <span className="text-xs font-medium text-muted-foreground">{webStoryData?.slides.findIndex((s: any) => s.id === activeSlideId) + 1} / {webStoryData?.slides.length}</span>
        </div>
      </div>

      {/* Right Sidebar: Properties */}
      {!isPreviewMode && (
        <div className="w-80 border-l flex flex-col bg-background p-4">
          <ScrollArea className="flex-1">
            {activeSlide ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* TEMPLATE PICKER */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <Layout className="h-3 w-3" /> Slide Template
                  </label>
                  <TemplatePicker onSelect={(template) => {
                    const initialData: Record<string, string> = {};
                    template.allowedFields.forEach(field => {
                      const lowerField = field.toLowerCase();
                      const isImageField = lowerField.includes('image') || lowerField.includes('background') || lowerField.includes('media');
                      const isCreditField = lowerField.includes('credit');
                      
                      if (isImageField && !isCreditField) {
                        initialData[field] = (template.previewImage as any)?.url || "";
                      } else if (isCreditField) {
                        initialData[field] = "";
                      } else {
                        initialData[field] = field.replace(/_/g, ' ');
                      }
                    });

                    updateSlide(activeSlide.id, {
                      templateId: template._id,
                      templateData: initialData
                    });
                  }}>
                    <Button variant="outline" className="w-full justify-start gap-3 h-14 rounded-2xl border-2 hover:border-primary/50 transition-all group overflow-hidden relative">
                      {activeSlide.templateId ? (
                        <>
                          <div className="flex-1 text-left">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Active Layout</span>
                            <span className="font-bold text-sm truncate block">
                              {webStoryTemplates.find((t: any) => t._id === activeSlide.templateId)?.name || "Custom Template"}
                            </span>
                          </div>
                          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                        </>
                      ) : (
                        <>
                          <Layout className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          <div className="text-left">
                            <span className="font-bold text-sm block">Select Template</span>
                            <span className="text-[10px] text-muted-foreground block">Apply professional AMP layout</span>
                          </div>
                        </>
                      )}
                    </Button>
                  </TemplatePicker>
                </div>

                <div className="h-px bg-border/50" />

                {/* DYNAMIC FIELDS (If template exists) */}
                {activeSlide.templateId && (
                  <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <Code className="h-3 w-3" /> Template Variables
                    </label>
                    <div className="space-y-5">
                      {[...(webStoryTemplates.find((t: any) => t._id === activeSlide.templateId)?.allowedFields || [])].sort((a, b) => {
                        const getPriority = (f: string) => {
                          const l = f.toLowerCase();
                          if (l.includes('headline')) return 1;
                          if (l.includes('description')) return 2;
                          if ((l.includes('image') || l.includes('media') || l.includes('background')) && !l.includes('credit')) return 3;
                          if (l.includes('credit')) return 4;
                          return 10;
                        };
                        return getPriority(a) - getPriority(b);
                      }).map((field: string) => {
                        const lowerField = field.toLowerCase();
                        const isImageField = (lowerField.includes('image') || lowerField.includes('media') || lowerField.includes('background')) && !lowerField.includes('credit');
                        const value = activeSlide.templateData?.[field] || "";
                        const displayImage = value; // Default will be template.previewImage if set by TemplatePicker

                        return (
                          <div key={field} className="space-y-2 px-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">{field.replace('_', ' ')}</label>
                            </div>

                            {isImageField ? (
                              <div className="space-y-2">
                                <div className="relative aspect-[9/16] w-full rounded-2xl bg-muted/30 border shadow-inner overflow-hidden group mx-auto max-w-[160px]">
                                  {displayImage ? (
                                    <img src={displayImage} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={field} />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-2">
                                      <ImageIcon className="h-6 w-6" />
                                      <span className="text-[8px] font-bold uppercase tracking-widest">No Image Set</span>
                                    </div>
                                  )}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      className="w-full bg-white/20 hover:bg-white/40 backdrop-blur-md text-white text-[10px] font-bold py-1.5 rounded-lg transition-all"
                                      onClick={() => {
                                        setCurrentFieldTarget(field);
                                        setIsImagePickerOpen(true);
                                      }}
                                    >
                                      Change Media
                                    </button>
                                  </div>
                                </div>
                                {(!value || value === field) && storeImages?.[0] && (
                                  <div className="flex items-center gap-1 text-[8px] text-primary font-bold bg-primary/5 rounded-md px-2 py-1 italic animate-in fade-in zoom-in duration-300">
                                    <Sparkles className="h-2 w-2" /> Linked to Story Main Image
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Input
                                className="h-10 rounded-xl bg-muted/20 border-2 focus-visible:border-primary transition-all font-medium"
                                value={value === field ? "" : value}
                                onChange={(e) => {
                                  const newData = { ...(activeSlide.templateData || {}), [field]: e.target.value };
                                  updateSlide(activeSlide.id, { templateData: newData });
                                }}
                                placeholder={`Enter ${field}...`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground italic">Select a slide to edit settings</div>
            )}
          </ScrollArea>
        </div>
      )}
      <ImagePickerDialog
        open={isImagePickerOpen}
        onOpenChange={setIsImagePickerOpen}
        onImageSelected={(images) => {
          if (currentFieldTarget && activeSlide) {
            const imageUrl = images[0].url;
            const newData = { ...(activeSlide.templateData || {}), [currentFieldTarget]: imageUrl };
            updateSlide(activeSlide.id, { templateData: newData });
          }
        }}
        defaultAspectRatio="9:16"
        orientation="portrait"
      />
    </div>
  );
}

function SortableSlide({
  slide,
  index,
  activeSlideId,
  setActiveSlideId,
  handleDuplicateSlide,
  deleteSlide,
  slideCount
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex items-start gap-2"
    >
      {/* Slide Index Handle */}
      <div className="flex flex-col items-center pt-4 select-none" {...attributes} {...listeners}>
        <span className="text-[10px] font-bold text-muted-foreground/50 mb-1">{index + 1}</span>
        <GripVertical className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground transition-colors cursor-grab" />
      </div>

      <div
        className={`relative aspect-[9/16] w-28 cursor-pointer rounded-xl border-2 transition-all overflow-hidden shadow-sm ${activeSlideId === slide.id ? "border-primary ring-2 ring-primary/20 shadow-primary/20" : "border-border hover:border-primary/50"
          }`}
        onClick={() => setActiveSlideId(slide.id)}
        style={{
          backgroundColor: '#000000',
        }}
      >
        {/* WYSIWYG Mini Preview */}
        {(() => {
          const { webStoryTemplates, images: storeImages } = useEditorStore() as any;
          const template = webStoryTemplates.find((t: any) => t._id === slide.templateId);
          const processedHtml = template ? template.html.replace(/{{\s*(\w+)\s*}}/g, (_: string, key: string) => {
            const lowerKey = key.toLowerCase();
            const value = Object.entries(slide.templateData || {}).find(([k]) => k.toLowerCase() === lowerKey)?.[1] || "";
            return value;
          }) : "";

          const backgroundField = template?.allowedFields?.find((f: string) => {
            const l = f.toLowerCase();
            return (l.includes('image') || l.includes('media') || l.includes('background')) && !l.includes('credit');
          });

          const backgroundUrl = backgroundField ? (Object.entries(slide.templateData || {}).find(([k]) => k.toLowerCase() === backgroundField.toLowerCase())?.[1] || template.previewImage) : "";

          return (
            <div className="absolute inset-0 scale-[0.25] origin-top-left pointer-events-none" style={{ width: '400%', height: '400%' }}>
              <div 
                className="absolute inset-0 z-[-1]" 
                style={{ 
                  backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }} 
              />
              {template && <style dangerouslySetInnerHTML={{ __html: template.css }} />}
              {template ? (
                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: processedHtml }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-white/20 text-[20px]">EMPTY</div>
              )}
            </div>
          );
        })()}

        {/* Actions Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all opacity-0 group-hover:opacity-100">
          <div className="absolute top-1 right-1 flex flex-col gap-1.5">
            {slideCount > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:text-red-400 hover:bg-white/20 rounded-lg transition-colors p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSlide(slide.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20 rounded-lg transition-colors p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicateSlide(slide.id);
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
