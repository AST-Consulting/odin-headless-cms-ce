"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { createPoll, updatePoll } from "@/lib/api";
import { Poll, CreatePollDto, ImageDto, OptionDto } from "@/lib/types";
import { usePropertyStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Image as ImageIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MediaPicker } from "@/components/media-gallery/MediaPicker";
import { getImageUrl } from "@/lib/utils";

interface CreatePollDialogProps {
  onSuccess?: (poll: Poll) => void;
  onCancel?: () => void;
  type?: "create" | "edit";
  pollToEdit?: Poll | null;
  hideHeader?: boolean;
  hideFooter?: boolean;
  formId?: string;
  onLoadingChange?: (loading: boolean) => void;
  className?: string;
}

/**
 * Dialog component for creating or editing a Poll.
 * Implements strict type safety and a premium UI experience.
 */
export function CreatePollDialog({
  onSuccess,
  onCancel,
  type = "create",
  pollToEdit,
  hideHeader = false,
  hideFooter = false,
  formId,
  onLoadingChange,
  className
}: CreatePollDialogProps) {
  const { toast } = useToast();
  const selectedProperty = usePropertyStore((state) => state.selectedProperty);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<CreatePollDto>>({
    question: "",
    title: "",
    hint: "",
    options: [
      { text: "" },
      { text: "" }
    ],
    image: [],
    status: "active",
  });

  const [activeMediaPicker, setActiveMediaPicker] = useState<"poll" | number | null>(null);

  useEffect(() => {
    if (pollToEdit) {
      setFormData({
        question: pollToEdit.question,
        title: pollToEdit.title || "",
        hint: pollToEdit.hint || "",
        options: (pollToEdit.options && pollToEdit.options.length > 0) ? pollToEdit.options : [{ text: "" }, { text: "" }],
        image: Array.isArray(pollToEdit.image) ? pollToEdit.image : (pollToEdit.image ? [pollToEdit.image as ImageDto] : []),
        status: pollToEdit.status || "active",
      });
    } else {
      setFormData({
        question: "",
        title: "",
        hint: "",
        options: [{ text: "" }, { text: "" }],
        image: [],
        status: "active",
      });
    }
  }, [pollToEdit]);

  const handleAddOption = () => {
    if (formData.options && formData.options.length < 10) {
      setFormData({
        ...formData,
        options: [...formData.options, { text: "" }]
      });
    }
  };

  const handleRemoveOption = (index: number) => {
    if (formData.options && formData.options.length > 2) {
      const newOptions = [...formData.options];
      newOptions.splice(index, 1);
      setFormData({ ...formData, options: newOptions });
    }
  };

  const handleOptionChange = (index: number, text: string) => {
    if (formData.options) {
      const newOptions = [...formData.options];
      newOptions[index] = { ...newOptions[index], text };
      setFormData({ ...formData, options: newOptions });
    }
  };

  const handleOptionIconSelect = (index: number, media: any[]) => {
    if (formData.options && media.length > 0) {
      const newOptions = [...formData.options];
      const icon: ImageDto = {
        id: media[0]._id,
        filename: media[0].fileName,
        url: media[0].url,
        path: media[0].path
      };
      newOptions[index] = { ...newOptions[index], icon };
      setFormData({ ...formData, options: newOptions });
      setActiveMediaPicker(null);
    }
  };

  const handlePollImageSelect = (media: any[]) => {
    if (media.length > 0) {
      const newImages: ImageDto[] = media.map(m => ({
        id: m._id,
        filename: m.fileName,
        url: m.url,
        path: m.path
      }));
      setFormData({ ...formData, image: newImages });
      setActiveMediaPicker(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (onLoadingChange) onLoadingChange(true);

    try {
      if (!formData.question || !formData.options || formData.options.some(opt => !opt.text)) {
        toast({
          title: "Validation Error",
          description: "Please fill in the question and all options",
          variant: "destructive",
        });
        return;
      }

      const payload: CreatePollDto = {
        question: formData.question,
        title: formData.title,
        hint: formData.hint,
        options: formData.options as OptionDto[],
        image: formData.image,
        status: formData.status,
      } as CreatePollDto;

      let savedPoll: Poll;
      if (pollToEdit) {
        savedPoll = await updatePoll(pollToEdit._id, payload);
        toast({ title: "Success", description: "Poll updated successfully" });
      } else {
        savedPoll = await createPoll(payload);
        toast({ title: "Success", description: "Poll created successfully" });
      }

      if (onSuccess) onSuccess(savedPoll);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error",
        description: `Failed to ${pollToEdit ? "update" : "create"} Poll: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      if (onLoadingChange) onLoadingChange(false);
    }
  };


  return (
    <div className={className || "md:p-4 lg:p-8 p-2"}>
      {!hideHeader && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{type === "create" ? "Create Poll" : "Update Poll"}</h1>
          <p className="text-muted-foreground">
            {type === "create" ? "Add a new interactive poll" : "Update poll details"}
          </p>
        </div>
      )}

      <form id={formId} onSubmit={handleSubmit} className="md:space-y-6 space-y-4">
        <Card className="border-none shadow-md bg-white dark:bg-gray-900">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="question" className="text-base font-semibold">
                  Question <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="question"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="What is your question?"
                  className="h-12 text-lg"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-gray-500">Subtitle (Optional)</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter subtitle"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hint" className="text-sm font-medium text-gray-500">Hint (Optional)</Label>
                  <Input
                    id="hint"
                    value={formData.hint}
                    onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                    placeholder="Enter tip or hint"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center justify-between">
                  Poll Options
                  <span className="text-xs font-normal text-muted-foreground">Min 2, Max 10</span>
                </Label>
                <div className="space-y-3">
                  {formData.options?.map((option, index) => (
                    <div key={index} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="flex-1 relative group">
                        <Input
                          value={option.text}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          className="pr-10 h-10"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveMediaPicker(index)}
                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${option.icon ? 'text-primary' : 'text-gray-400'}`}
                            title="Add Icon"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                        disabled={formData.options!.length <= 2}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {formData.options!.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddOption}
                      className="w-full border-dashed border-2 py-6 text-gray-500 hover:text-primary hover:border-primary transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Option
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Poll Image (Optional)</Label>
                  <div 
                    onClick={() => setActiveMediaPicker("poll")}
                    className="border-2 border-dashed rounded-lg aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all border-gray-200 group overflow-hidden"
                  >
                    {(() => {
                      const imageUrl = getImageUrl(formData.image && formData.image.length > 0 ? formData.image[0].url : null);
                      return imageUrl ? (
                        <div className="relative w-full h-full">
                          <img 
                            src={imageUrl} 
                            alt="Poll cover" 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-white text-sm font-medium">Change Image</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8 text-gray-400 mb-2 group-hover:text-primary transition-colors" />
                          <span className="text-sm text-gray-500 group-hover:text-primary transition-colors">Select cover image</span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active (Voting Open)</SelectItem>
                        <SelectItem value="inactive">Inactive (Results Only)</SelectItem>
                        <SelectItem value="closed">Closed (Hidden)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!hideFooter && (
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
                type="submit" 
                disabled={loading}
                className="bg-primary hover:bg-primary/90 px-8"
            >
              {loading ? "Saving..." : (pollToEdit ? "Update Poll" : "Create Poll")}
            </Button>
          </div>
        )}
      </form>

      {/* Media Picker Dialog */}
      <Dialog 
        open={activeMediaPicker !== null} 
        onOpenChange={(open) => !open && setActiveMediaPicker(null)}
      >
        <DialogContent className="sm:max-w-[1000px] h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle>Select {activeMediaPicker === 'poll' ? 'Poll Cover' : 'Option Icon'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            <MediaPicker 
              multiSelect={false}
              onSelect={(files) => {
                if (activeMediaPicker === "poll") {
                  handlePollImageSelect(files);
                } else if (typeof activeMediaPicker === "number") {
                  handleOptionIconSelect(activeMediaPicker, files);
                }
              }}
              allowedTypes="image"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
