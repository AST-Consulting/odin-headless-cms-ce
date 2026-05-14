"use client";

import { Fragment, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Sparkles,
    Loader2,
    Upload,
    Image as ImageIcon,
    Globe,
    Pencil,
    ArrowLeft,
    Check,
    BarChart3,
    GitCompare,
    Calendar,
    TrendingUp,
    AlertCircle,
    FileSearch,
    Wand2,
    X,
    Trash2,
    Plus,
} from "lucide-react";
import {
    generateImage,
    AspectRatio,
    getInfographicPromptTemplates,
    prepareInfographicPrompt,
    extractInfographicScreenshotInsights,
    InfographicPromptTemplate,
} from "@/lib/api";
import { usePropertyStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InfographicBuilderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: (image: { url: string; id: string; path: string; mimeType?: string; title?: string; caption?: string }) => void;
    initialTopic?: string;
}

const TEMPLATE_ICONS = {
    "ranking-board": BarChart3,
    "comparison-cards": GitCompare,
    "timeline": Calendar,
    "stat-highlight": TrendingUp,
};

const TEMPLATE_EXAMPLES = {
    "ranking-board": [
        "Top 10 highest-grossing movies of 2025",
        "IPL 2026 leading run scorers",
        "Best-selling smartphones in India Q1 2026",
        "Forbes richest tech CEOs 2026",
        "Most-streamed artists on Spotify 2025"
    ],
    "comparison-cards": [
        "iPhone 16 vs Samsung Galaxy S26 specs",
        "Remote work vs Office work pros and cons",
        "React vs Vue.js framework comparison",
        "Electric cars vs Hybrid cars cost analysis",
        "Delhi vs Mumbai cost of living comparison"
    ],
    "timeline": [
        "Evolution of artificial intelligence 2020-2026",
        "Major milestones in Tesla's history",
        "India's space program achievements timeline",
        "COVID-19 vaccine development timeline",
        "Key events in cryptocurrency regulation"
    ],
    "stat-highlight": [
        "Global EV sales reached 15 million in 2025",
        "India's GDP growth rate: 7.2% in Q4 2025",
        "Instagram users hit 2 billion worldwide",
        "Netflix added 25M subscribers in 2025",
        "ChatGPT reached 200M weekly users"
    ],
};

// Miniature schematic of each template's rendered output. Uses currentColor so
// it picks up the container's text color — muted when unselected, primary when
// selected. More informative than another single icon.
const TEMPLATE_PREVIEWS: Record<string, React.ReactNode> = {
    "ranking-board": (
        <svg viewBox="0 0 120 60" className="w-full h-full" aria-hidden>
            <rect x="6" y="8" width="96" height="7" rx="1.5" fill="currentColor" opacity="0.95" />
            <rect x="6" y="20" width="78" height="7" rx="1.5" fill="currentColor" opacity="0.65" />
            <rect x="6" y="32" width="58" height="7" rx="1.5" fill="currentColor" opacity="0.42" />
            <rect x="6" y="44" width="40" height="7" rx="1.5" fill="currentColor" opacity="0.26" />
        </svg>
    ),
    "comparison-cards": (
        <svg viewBox="0 0 120 60" className="w-full h-full" aria-hidden>
            <rect x="4" y="6" width="52" height="48" rx="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <rect x="64" y="6" width="52" height="48" rx="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <line x1="10" y1="22" x2="50" y2="22" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
            <line x1="10" y1="32" x2="42" y2="32" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
            <line x1="10" y1="42" x2="48" y2="42" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
            <line x1="70" y1="22" x2="110" y2="22" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
            <line x1="70" y1="32" x2="102" y2="32" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
            <line x1="70" y1="42" x2="108" y2="42" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
        </svg>
    ),
    "timeline": (
        <svg viewBox="0 0 120 60" className="w-full h-full" aria-hidden>
            <line x1="14" y1="30" x2="106" y2="30" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="24" cy="30" r="4" fill="currentColor" />
            <circle cx="50" cy="30" r="4" fill="currentColor" opacity="0.75" />
            <circle cx="76" cy="30" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="102" cy="30" r="4" fill="currentColor" opacity="0.3" />
            <line x1="24" y1="14" x2="24" y2="22" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <line x1="50" y1="38" x2="50" y2="48" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <line x1="76" y1="14" x2="76" y2="22" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <line x1="102" y1="38" x2="102" y2="48" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        </svg>
    ),
    "stat-highlight": (
        <svg viewBox="0 0 120 60" className="w-full h-full" aria-hidden>
            <text x="60" y="36" textAnchor="middle" fontSize="24" fontWeight="700" fill="currentColor" style={{ letterSpacing: "-0.04em" }}>2.1B</text>
            <line x1="44" y1="46" x2="76" y2="46" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <text x="60" y="54" textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.65" style={{ letterSpacing: "0.22em" }}>WORLDWIDE USERS</text>
        </svg>
    ),
};

interface ParsedRow {
    marker: string;
    label: string;
    value: string;
}

interface ParsedResearch {
    topic: string;
    rows: ParsedRow[];
    notes: string[];
}

function parseResearchedData(summary: string): ParsedResearch {
    if (!summary) return { topic: "", rows: [], notes: [] };

    const lines = summary.split(/\r?\n/);
    let topic = "";
    const rows: ParsedRow[] = [];
    const notes: string[] = [];

    let inDataSection = false;
    let inNoiseSection = false;
    // For comparison-card style output where Gemini returns "Entity\nLabel: Value\nLabel: Value",
    // we track the currently-active entity and use it as the marker for
    // subsequent key:value rows until a new entity header appears.
    let currentGroup = "";

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            // Blank line inside data resets the group so stray metrics below
            // don't accidentally inherit a stale entity header.
            if (inDataSection) currentGroup = "";
            continue;
        }

        const topicMatch = line.match(/^Topic:\s*(.+)$/i);
        if (topicMatch) {
            topic = topicMatch[1];
            continue;
        }

        if (/^Researched Data:/i.test(line)) {
            inDataSection = true;
            inNoiseSection = false;
            currentGroup = "";
            continue;
        }

        if (/^(Additional Context|CSV Data|Screenshot Insights):/i.test(line)) {
            inDataSection = false;
            inNoiseSection = true;
            continue;
        }

        if (inDataSection) {
            // Numbered row: "1. Entity — value" (ranking templates)
            const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
            if (numberedMatch) {
                const [, marker, rest] = numberedMatch;
                const splitMatch = rest.match(/^(.+?)\s+[—–:\-]\s+(.+)$/);
                if (splitMatch) {
                    rows.push({ marker, label: splitMatch[1].trim(), value: splitMatch[2].trim() });
                } else {
                    rows.push({ marker, label: rest.trim(), value: "" });
                }
                currentGroup = "";
                continue;
            }

            // Date-prefixed row: "2024 — Event" or "2024-03-12: Event" (timelines)
            const dateMatch = line.match(/^(\d{4}(?:-\d{2}){0,2})\s*[—–:\-]\s+(.+)$/);
            if (dateMatch) {
                const [, marker, rest] = dateMatch;
                const splitMatch = rest.match(/^(.+?)\s+[—–:\-]\s+(.+)$/);
                if (splitMatch) {
                    rows.push({ marker, label: splitMatch[1].trim(), value: splitMatch[2].trim() });
                } else {
                    rows.push({ marker, label: rest.trim(), value: "" });
                }
                currentGroup = "";
                continue;
            }

            // Strip optional bullet marker ("- ", "* ", "• ") before further matching.
            const unbulleted = line.replace(/^[-*•]\s+/, "");

            // Key:Value metric row inside a comparison group: "Label: Value".
            // Only consumed when we have an active entity header above it.
            const kvMatch = unbulleted.match(/^(.+?)\s*[:—–]\s+(.+)$/);
            if (kvMatch && currentGroup) {
                rows.push({
                    marker: currentGroup,
                    label: kvMatch[1].trim(),
                    value: kvMatch[2].trim(),
                });
                continue;
            }

            // Entity/section header (short standalone text like "Delhi" or
            // "iPhone 16"). Treat as a group heading for subsequent rows.
            if (!/[:—–]\s/.test(unbulleted) && unbulleted.length <= 80) {
                currentGroup = unbulleted.replace(/:$/, "").trim();
                continue;
            }

            notes.push(line);
        } else if (!inNoiseSection) {
            notes.push(line);
        }
    }

    return { topic, rows, notes };
}

export function InfographicBuilderDialog({
    open,
    onOpenChange,
    onComplete,
    initialTopic = "",
}: InfographicBuilderDialogProps) {
    const { selectedProperty } = usePropertyStore();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [templates, setTemplates] = useState<InfographicPromptTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("ranking-board");
    const [topic, setTopic] = useState(initialTopic);
    const [dataSourceTab, setDataSourceTab] = useState<"csv" | "screenshot" | "manual">("csv");
    const [csvText, setCsvText] = useState("");
    const [csvFileName, setCsvFileName] = useState("");
    const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
    const [screenshotMimeType, setScreenshotMimeType] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
    const [screenshotBase64, setScreenshotBase64] = useState("");
    const [screenshotInsights, setScreenshotInsights] = useState("");
    const [isExtractingScreenshot, setIsExtractingScreenshot] = useState(false);
    const [manualData, setManualData] = useState("");
    const [additionalContext, setAdditionalContext] = useState("");
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPreparingPrompt, setIsPreparingPrompt] = useState(false);
    const [showRawData, setShowRawData] = useState(false);
    // When the grounded research returns sources (topic-only path), we pause
    // on a review screen so the editor can inspect the data before we burn
    // credits rendering it into an image.
    const [researchedData, setResearchedData] = useState<{
        prompt: string;
        dataSummary: string;
        sources: string[];
    } | null>(null);
    const [researchReturnedEmpty, setResearchReturnedEmpty] = useState(false);
    // Editable copy of the parsed rows — the review step lets the editor
    // fix/delete/add rows before rendering, and we rebuild the prompt
    // server-side from these when they hit generate.
    const [editableRows, setEditableRows] = useState<ParsedRow[]>([]);
    const [editableNotes, setEditableNotes] = useState<string[]>([]);
    const [rowsDirty, setRowsDirty] = useState(false);
    // Raw-view edit path. When the parser can't extract structured rows
    // (e.g., weird comparison shapes from Gemini) the editor can still fix
    // the text directly and that becomes the authoritative override.
    const [rawDraft, setRawDraft] = useState<string>("");
    const [rawDirty, setRawDirty] = useState(false);

    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const data = await getInfographicPromptTemplates();
                if (data.length > 0) {
                    setTemplates(data);
                    setSelectedTemplate(data[0].key);
                }
            } catch (error) {
                console.error("Failed to load templates:", error);
            }
        };
        if (open) {
            loadTemplates();
        }
    }, [open]);

    useEffect(() => {
        setTopic(initialTopic);
    }, [initialTopic]);

    useEffect(() => {
        return () => {
            if (screenshotPreviewUrl) {
                URL.revokeObjectURL(screenshotPreviewUrl);
            }
        };
    }, [screenshotPreviewUrl]);

    // Seed the editable rows whenever new research arrives. Reseeding also
    // resets the dirty flags since a fresh research round is the new baseline.
    // If the parser finds zero rows we auto-flip to raw view so the editor
    // always has something useful to work with instead of an empty table.
    useEffect(() => {
        if (researchedData) {
            const parsed = parseResearchedData(researchedData.dataSummary);
            setEditableRows(parsed.rows);
            setEditableNotes(parsed.notes);
            setRawDraft(researchedData.dataSummary);
            setRowsDirty(false);
            setRawDirty(false);
            setShowRawData(parsed.rows.length === 0 && researchedData.dataSummary.trim().length > 0);
        } else {
            setEditableRows([]);
            setEditableNotes([]);
            setRawDraft("");
            setRowsDirty(false);
            setRawDirty(false);
            setShowRawData(false);
        }
    }, [researchedData]);

    const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
            toast.error("Please upload a valid CSV file");
            event.target.value = "";
            return;
        }

        try {
            const content = await file.text();
            setCsvText(content);
            setCsvFileName(file.name);
            toast.success("CSV loaded successfully");
        } catch (error) {
            console.error("Failed to read CSV file:", error);
            toast.error("Failed to read CSV file");
        } finally {
            event.target.value = "";
        }
    };

    const handleScreenshotPaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
        if (!imageItem) return;

        event.preventDefault();

        const file = imageItem.getAsFile();
        if (!file) return;

        const supportedMimeTypes: Array<"image/png" | "image/jpeg" | "image/webp"> = ["image/png", "image/jpeg", "image/webp"];
        const detectedMime = supportedMimeTypes.includes(file.type as "image/png" | "image/jpeg" | "image/webp")
            ? (file.type as "image/png" | "image/jpeg" | "image/webp")
            : "image/png";

        const objectUrl = URL.createObjectURL(file);
        if (screenshotPreviewUrl) {
            URL.revokeObjectURL(screenshotPreviewUrl);
        }
        setScreenshotPreviewUrl(objectUrl);
        setScreenshotMimeType(detectedMime);

        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string) || "");
                reader.onerror = () => reject(new Error("Failed to read screenshot data"));
                reader.readAsDataURL(file);
            });

            const base64 = dataUrl.split(",")[1] || "";
            setScreenshotBase64(base64);
            toast.success("Screenshot pasted. Click Extract Insights to analyze.");
        } catch (error) {
            console.error("Failed to process pasted screenshot:", error);
            toast.error("Could not process pasted screenshot");
        }
    };

    const handleExtractScreenshotInsights = async () => {
        if (!screenshotBase64) {
            toast.error("Paste a screenshot first");
            return;
        }

        setIsExtractingScreenshot(true);
        try {
            const result = await extractInfographicScreenshotInsights(screenshotBase64, screenshotMimeType);
            setScreenshotInsights(result.insights);
            toast.success("Screenshot insights extracted");
        } catch (error) {
            console.error("Failed to extract screenshot insights:", error);
            toast.error("Failed to extract screenshot insights");
        } finally {
            setIsExtractingScreenshot(false);
        }
    };

    const hasUserProvidedData = Boolean(
        (dataSourceTab === "csv" && csvText) ||
        (dataSourceTab === "screenshot" && screenshotInsights) ||
        (dataSourceTab === "manual" && manualData)
    );

    const runImageGeneration = async (prompt: string) => {
        setIsGenerating(true);
        try {
            const image = await generateImage(prompt, aspectRatio, undefined, true, selectedProperty?._id);
            const mappedImage = {
                url: image.url,
                id: image._id,
                path: image.path,
                mimeType: image.mimeType || "image/webp",
                title: topic.slice(0, 50),
                caption: "AI Infographic"
            };

            toast.success("Infographic generated successfully!");
            onComplete(mappedImage);
            handleClose();
        } catch (error) {
            console.error("Failed to generate infographic:", error);
            toast.error("Failed to generate infographic. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerate = async () => {
        if (!topic.trim()) {
            toast.error("Please enter a topic");
            return;
        }

        setIsPreparingPrompt(true);
        setResearchReturnedEmpty(false);

        try {
            const prepared = await prepareInfographicPrompt({
                templateKey: selectedTemplate,
                topic: topic,
                csvText: dataSourceTab === "csv" ? csvText : undefined,
                screenshotInsights: dataSourceTab === "screenshot" ? screenshotInsights : undefined,
                additionalContext: additionalContext || undefined,
            });

            setIsPreparingPrompt(false);

            // Topic-only paths come back with sources from the grounded
            // research step — pause so the editor can verify the data before
            // it becomes uncorrectable pixels. User-provided data paths
            // (CSV/screenshot/manual) skip the review entirely.
            if (!hasUserProvidedData) {
                if (prepared.sources.length > 0) {
                    setResearchedData(prepared);
                    return;
                }
                // Grounded research couldn't find anything verifiable.
                // Surface that instead of silently rendering a hallucinated image.
                setResearchReturnedEmpty(true);
                return;
            }

            await runImageGeneration(prepared.prompt);
        } catch (error) {
            console.error("Failed to generate infographic:", error);
            toast.error("Failed to generate infographic. Please try again.");
        } finally {
            setIsPreparingPrompt(false);
        }
    };

    const rebuildDataSummary = (): string => {
        const parsed = researchedData ? parseResearchedData(researchedData.dataSummary) : null;
        const parts: string[] = [];
        if (parsed?.topic) parts.push(`Topic: ${parsed.topic}`);

        const cleanRows = editableRows.filter((r) => r.label.trim());
        if (cleanRows.length > 0) {
            const allNumeric = cleanRows.every((r) => /^\d+$/.test(r.marker.trim()));
            let rowLines: string[];

            if (allNumeric) {
                // Ranking-style flat list: "1. Label — Value"
                rowLines = cleanRows.map((r, i) => {
                    const body = r.value.trim() ? `${r.label.trim()} — ${r.value.trim()}` : r.label.trim();
                    return `${i + 1}. ${body}`;
                });
            } else {
                // Grouped (comparison) or date-marker (timeline) shape.
                // Group consecutive rows by marker so the rebuilt summary
                // mirrors the "Entity\n- Label: Value" shape the image model
                // saw originally.
                rowLines = [];
                let lastMarker: string | null = null;
                for (const r of cleanRows) {
                    const marker = r.marker.trim();
                    if (marker && marker !== lastMarker) {
                        if (lastMarker !== null) rowLines.push("");
                        rowLines.push(marker);
                        lastMarker = marker;
                    }
                    const body = r.value.trim() ? `${r.label.trim()}: ${r.value.trim()}` : r.label.trim();
                    rowLines.push(`- ${body}`);
                }
            }
            parts.push(`Researched Data:\n${rowLines.join("\n")}`);
        }

        if (editableNotes.length > 0) {
            parts.push(editableNotes.join("\n"));
        }

        return parts.join("\n\n");
    };

    const handleConfirmGenerate = async () => {
        if (!researchedData) return;

        const isDirty = rowsDirty || rawDirty;

        // Clean path: user didn't touch the data — reuse the server prompt as-is.
        if (!isDirty) {
            void runImageGeneration(researchedData.prompt);
            return;
        }

        // Raw edits win over row edits (user's most direct expression). Else
        // rebuild from the structured rows they edited.
        const override = rawDirty ? rawDraft : rebuildDataSummary();

        // Edits pending: rebuild the prompt server-side from the edited summary
        // so the image model sees the exact data the editor just approved.
        setIsGenerating(true);
        try {
            const rebuilt = await prepareInfographicPrompt({
                templateKey: selectedTemplate,
                topic,
                additionalContext: additionalContext || undefined,
                overrideDataSummary: override,
            });
            const image = await generateImage(rebuilt.prompt, aspectRatio, undefined, true, selectedProperty?._id);
            toast.success("Infographic generated successfully!");
            onComplete({
                url: image.url,
                id: image._id,
                path: image.path,
                mimeType: image.mimeType || "image/webp",
                title: topic.slice(0, 50),
                caption: "AI Infographic",
            });
            handleClose();
        } catch (error) {
            console.error("Failed to generate infographic:", error);
            toast.error("Failed to generate infographic. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const updateRow = (idx: number, patch: Partial<ParsedRow>) => {
        setEditableRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
        setRowsDirty(true);
    };

    const deleteRow = (idx: number) => {
        setEditableRows((rs) => rs.filter((_, i) => i !== idx));
        setRowsDirty(true);
    };

    const addRow = () => {
        setEditableRows((rs) => [
            ...rs,
            { marker: String(rs.length + 1), label: "", value: "" },
        ]);
        setRowsDirty(true);
    };

    const handleBackFromReview = () => {
        setResearchedData(null);
        setResearchReturnedEmpty(false);
        setShowRawData(false);
        setRawDraft("");
        setRawDirty(false);
    };

    const handleClose = () => {
        setStep(1);
        setTopic("");
        setDataSourceTab("csv");
        setCsvText("");
        setCsvFileName("");
        setScreenshotBase64("");
        setScreenshotInsights("");
        if (screenshotPreviewUrl) {
            URL.revokeObjectURL(screenshotPreviewUrl);
        }
        setScreenshotPreviewUrl(null);
        setManualData("");
        setAdditionalContext("");
        setAspectRatio("16:9");
        setResearchedData(null);
        setResearchReturnedEmpty(false);
        setShowRawData(false);
        setRawDraft("");
        setRawDirty(false);
        onOpenChange(false);
    };

    const canProceedToStep2 = selectedTemplate !== "";
    const canProceedToStep3 = topic.trim() !== "";
    const canGenerate = topic.trim() !== "";

    const selectedTemplateData = templates.find((t) => t.key === selectedTemplate);
    const parsedResearch = researchedData ? parseResearchedData(researchedData.dataSummary) : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                        Infographic Builder
                    </DialogTitle>
                </DialogHeader>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 py-4">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div
                                className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-colors",
                                    step >= s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                                )}
                            >
                                {step > s ? <Check className="h-4 w-4" /> : s}
                            </div>
                            {s < 3 && (
                                <div
                                    className={cn(
                                        "w-12 h-1 mx-2 transition-colors",
                                        step > s ? "bg-blue-600" : "bg-gray-200"
                                    )}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Choose Template */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">Step 1: Choose Template</h3>
                            <p className="text-sm text-muted-foreground">
                                Select the infographic layout that best fits your data
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {templates.map((template) => {
                                const Icon = TEMPLATE_ICONS[template.key as keyof typeof TEMPLATE_ICONS] || BarChart3;
                                const isSelected = selectedTemplate === template.key;
                                const preview = TEMPLATE_PREVIEWS[template.key];

                                return (
                                    <Card
                                        key={template.key}
                                        className={cn(
                                            "p-0 cursor-pointer transition-all overflow-hidden hover:shadow-md",
                                            isSelected ? "ring-2 ring-blue-600" : "hover:border-blue-300"
                                        )}
                                        onClick={() => setSelectedTemplate(template.key)}
                                    >
                                        {/* Preview canvas */}
                                        <div
                                            className={cn(
                                                "relative h-20 flex items-center justify-center border-b transition-colors",
                                                isSelected ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-400"
                                            )}
                                        >
                                            <div className="w-32 h-12">{preview}</div>
                                            {isSelected && (
                                                <Badge className="absolute top-2 right-2 bg-white/95 text-blue-700 hover:bg-white/95 text-[10px] shadow-sm">
                                                    Selected
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="p-4">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div
                                                    className={cn(
                                                        "p-1.5 rounded-md",
                                                        isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                </div>
                                                <h4 className="font-semibold text-sm">{template.label}</h4>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                {template.description}
                                            </p>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Template Examples — now clickable chips that jump to step 2 */}
                        {selectedTemplate && TEMPLATE_EXAMPLES[selectedTemplate as keyof typeof TEMPLATE_EXAMPLES] && (
                            <Card className="p-4 bg-gray-50">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                    <FileSearch className="h-3.5 w-3.5 text-gray-500" />
                                    Try one of these topics
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {TEMPLATE_EXAMPLES[selectedTemplate as keyof typeof TEMPLATE_EXAMPLES].map((example, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setTopic(example);
                                                setStep(2);
                                            }}
                                            className="text-xs bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors px-2.5 py-1 rounded-md text-gray-700"
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            </Card>
                        )}

                        <div className="flex justify-end pt-4 border-t">
                            <Button
                                onClick={() => setStep(2)}
                                disabled={!canProceedToStep2}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Next: Add Data
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Add Data Source */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">Step 2: Add Data Source</h3>
                            <p className="text-sm text-muted-foreground">
                                Provide the topic and optionally upload data
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="topic" className="flex items-center gap-2">
                                    Topic / Headline
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="topic"
                                    placeholder={
                                        TEMPLATE_EXAMPLES[selectedTemplate as keyof typeof TEMPLATE_EXAMPLES]?.[0] ||
                                        "e.g., IPL 2026 Top Run Scorers"
                                    }
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    className="text-base"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    Data Source (Optional)
                                    <Badge variant="secondary" className="text-xs">
                                        <Globe className="h-3 w-3 mr-1" />
                                        AI will search web if no data provided
                                    </Badge>
                                </Label>

                                <Tabs value={dataSourceTab} onValueChange={(v) => setDataSourceTab(v as "csv" | "screenshot" | "manual")} className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="csv">
                                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                                            CSV
                                        </TabsTrigger>
                                        <TabsTrigger value="screenshot">
                                            <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                                            Screenshot
                                        </TabsTrigger>
                                        <TabsTrigger value="manual">
                                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                            Manual
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="csv" className="space-y-2 mt-4">
                                        <Input
                                            type="file"
                                            accept=".csv,text/csv"
                                            onChange={handleCsvUpload}
                                            className="cursor-pointer"
                                        />
                                        {csvFileName && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Check className="h-3 w-3 text-green-600" />
                                                Loaded: {csvFileName}
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            Upload a CSV file with your data. First row should be headers.
                                        </p>
                                    </TabsContent>

                                    <TabsContent value="screenshot" className="space-y-3 mt-4">
                                        {!screenshotPreviewUrl && (
                                            <Textarea
                                                placeholder="Click here and paste (Ctrl/Cmd + V) a screenshot of your chart or table..."
                                                onPaste={handleScreenshotPaste}
                                                disabled={isExtractingScreenshot}
                                                rows={3}
                                                className="resize-none"
                                            />
                                        )}

                                        {screenshotPreviewUrl && (
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <img
                                                        src={screenshotPreviewUrl}
                                                        alt="Pasted screenshot preview"
                                                        className="w-full max-h-48 object-contain rounded-md border"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            URL.revokeObjectURL(screenshotPreviewUrl);
                                                            setScreenshotPreviewUrl(null);
                                                            setScreenshotBase64("");
                                                            setScreenshotInsights("");
                                                        }}
                                                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/95 hover:bg-white border shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900"
                                                        aria-label="Remove screenshot"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleExtractScreenshotInsights}
                                                    disabled={!screenshotBase64 || isExtractingScreenshot}
                                                    className="w-full"
                                                >
                                                    {isExtractingScreenshot ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Extracting Data...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Wand2 className="mr-2 h-4 w-4" />
                                                            Extract Data from Screenshot
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}

                                        {screenshotInsights && (
                                            <div className="space-y-2">
                                                <Label className="text-xs">Extracted Data (editable)</Label>
                                                <Textarea
                                                    value={screenshotInsights}
                                                    onChange={(e) => setScreenshotInsights(e.target.value)}
                                                    rows={5}
                                                    className="text-xs font-mono"
                                                />
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="manual" className="space-y-2 mt-4">
                                        <Textarea
                                            placeholder="Enter your data manually (names, values, dates, etc.)"
                                            value={manualData}
                                            onChange={(e) => setManualData(e.target.value)}
                                            rows={6}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Type your data in any format. AI will structure it for the infographic.
                                        </p>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>

                        <div className="flex justify-between pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={() => setStep(1)}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                            <Button
                                onClick={() => setStep(3)}
                                disabled={!canProceedToStep3}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Next: Customize
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3 (review): Grounded research returned — let the editor
                    verify the data before we burn credits rendering the image. */}
                {step === 3 && researchedData && parsedResearch && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">Review Researched Data</h3>
                            <p className="text-sm text-muted-foreground">
                                We pulled this data from the web. Check it now — once rendered, the numbers are baked into the image.
                            </p>
                        </div>

                        {parsedResearch.topic && (
                            <Card className="p-3 bg-blue-50/50 border-blue-200">
                                <div className="flex items-start gap-2 text-sm">
                                    <span className="text-xs font-semibold text-blue-900 min-w-14">Topic</span>
                                    <span className="text-blue-800 italic">&ldquo;{parsedResearch.topic}&rdquo;</span>
                                </div>
                            </Card>
                        )}

                        {/* Findings */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                    <Globe className="h-3.5 w-3.5 text-blue-600" />
                                    Findings
                                    <Badge variant="secondary" className="text-[10px] ml-1 h-5">
                                        {editableRows.length} {editableRows.length === 1 ? "row" : "rows"}
                                    </Badge>
                                    {(rowsDirty || rawDirty) && (
                                        <Badge className="text-[10px] h-5 bg-amber-100 text-amber-900 hover:bg-amber-100 border border-amber-200">
                                            Edited
                                        </Badge>
                                    )}
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setShowRawData((v) => !v)}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showRawData ? "Hide raw" : "Show raw"}
                                </button>
                            </div>

                            {showRawData ? (
                                <div className="space-y-1.5">
                                    <Textarea
                                        value={rawDraft}
                                        onChange={(e) => {
                                            setRawDraft(e.target.value);
                                            setRawDirty(true);
                                        }}
                                        rows={12}
                                        className="text-xs font-mono leading-relaxed resize-y min-h-[180px] max-h-[360px]"
                                        aria-label="Raw researched data, editable"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Edit the data freely. Your changes override the AI research on generate.
                                    </p>
                                </div>
                            ) : editableRows.length > 0 ? (
                                <Card className="p-0 overflow-hidden">
                                    <ul>
                                        {editableRows.map((row, idx) => {
                                            const prevMarker = idx > 0 ? editableRows[idx - 1].marker.trim() : "";
                                            const currentMarker = row.marker.trim();
                                            const isNumeric = /^\d+$/.test(currentMarker);
                                            // Show a group header when the marker changes between consecutive rows
                                            // AND the marker is non-numeric (comparison/stat shape, not ranking).
                                            const showGroupHeader = !isNumeric && currentMarker && currentMarker !== prevMarker;
                                            return (
                                                <Fragment key={idx}>
                                                    {showGroupHeader && (
                                                        <li
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 border-y first:border-t-0",
                                                                "animate-in fade-in duration-300"
                                                            )}
                                                            style={{
                                                                animationDelay: `${Math.min(idx * 30, 300)}ms`,
                                                                animationFillMode: "both",
                                                            }}
                                                        >
                                                            <Input
                                                                value={row.marker}
                                                                onChange={(e) => {
                                                                    const newMarker = e.target.value;
                                                                    // Propagate marker edit to all rows in this group so the
                                                                    // editor can rename an entity in one place.
                                                                    setEditableRows((rs) =>
                                                                        rs.map((r) =>
                                                                            r.marker.trim() === currentMarker
                                                                                ? { ...r, marker: newMarker }
                                                                                : r
                                                                        )
                                                                    );
                                                                    setRowsDirty(true);
                                                                }}
                                                                className="h-7 text-xs font-semibold text-blue-900 border-transparent bg-transparent hover:bg-white hover:border-input focus-visible:bg-white focus-visible:border-input px-2 w-full"
                                                                aria-label={`Group ${currentMarker}`}
                                                            />
                                                        </li>
                                                    )}
                                                    <li
                                                        className={cn(
                                                            "group flex items-center gap-2 px-3 py-1.5 transition-colors border-b last:border-b-0",
                                                            "animate-in fade-in slide-in-from-bottom-1 duration-300",
                                                            idx % 2 === 1 && "bg-gray-50/60"
                                                        )}
                                                        style={{
                                                            animationDelay: `${Math.min(idx * 30, 300)}ms`,
                                                            animationFillMode: "both",
                                                        }}
                                                    >
                                                        {isNumeric ? (
                                                            <Input
                                                                value={row.marker}
                                                                onChange={(e) => updateRow(idx, { marker: e.target.value })}
                                                                className="w-12 h-8 font-mono text-xs tabular-nums text-muted-foreground border-transparent bg-transparent hover:bg-white hover:border-input focus-visible:bg-white focus-visible:border-input px-2 shrink-0"
                                                                aria-label={`Row ${idx + 1} marker`}
                                                            />
                                                        ) : (
                                                            <span className="w-4 shrink-0 text-muted-foreground text-xs">•</span>
                                                        )}
                                                        <Input
                                                            value={row.label}
                                                            onChange={(e) => updateRow(idx, { label: e.target.value })}
                                                            placeholder="Label"
                                                            className="flex-1 min-w-0 h-8 text-sm font-medium border-transparent bg-transparent hover:bg-white hover:border-input focus-visible:bg-white focus-visible:border-input px-2"
                                                            aria-label={`Row ${idx + 1} label`}
                                                        />
                                                        <Input
                                                            value={row.value}
                                                            onChange={(e) => updateRow(idx, { value: e.target.value })}
                                                            placeholder="Value"
                                                            className="w-40 shrink-0 h-8 font-mono tabular-nums text-sm font-semibold text-blue-700 text-right border-transparent bg-transparent hover:bg-white hover:border-input focus-visible:bg-white focus-visible:border-input px-2 placeholder:font-normal placeholder:text-muted-foreground placeholder:text-right"
                                                            aria-label={`Row ${idx + 1} value`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteRow(idx)}
                                                            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                                            aria-label={`Delete row ${idx + 1}`}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </li>
                                                </Fragment>
                                            );
                                        })}
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={addRow}
                                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-blue-700 hover:bg-blue-50/50 border-t transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add row
                                    </button>
                                </Card>
                            ) : (
                                <Card className="p-4 text-center text-sm text-muted-foreground">
                                    <p>No structured rows parsed.</p>
                                    <button
                                        type="button"
                                        onClick={addRow}
                                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-700 hover:underline"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add the first row manually
                                    </button>
                                </Card>
                            )}
                        </div>

                        {parsedResearch.notes.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground">Caveats from the research</h4>
                                <div className="space-y-1.5">
                                    {parsedResearch.notes.map((note, idx) => (
                                        <p key={idx} className="text-xs text-gray-600 leading-relaxed border-l-2 border-gray-300 pl-3 italic">
                                            {note}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Card className="p-3 bg-amber-50 border-amber-200">
                            <div className="flex items-start gap-2 text-sm">
                                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-amber-900">
                                    If anything looks wrong or thin, go back and provide your own data via CSV, screenshot, or manual entry.
                                </p>
                            </div>
                        </Card>

                        <div className="flex justify-between pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={handleBackFromReview}
                                disabled={isGenerating}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back (provide my own data)
                            </Button>
                            <Button
                                onClick={handleConfirmGenerate}
                                disabled={isGenerating}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Rendering image...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        {(rowsDirty || rawDirty) ? "Generate with my edits" : "Looks good — generate image"}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Customize & Generate */}
                {step === 3 && !researchedData && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">Step 3: Customize & Generate</h3>
                            <p className="text-sm text-muted-foreground">
                                Fine-tune your infographic before generation
                            </p>
                        </div>

                        <div className="space-y-4">
                            {/* Summary */}
                            <Card className="p-4 bg-blue-50/50 border-blue-200">
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                        <strong className="text-blue-900 min-w-20">Template:</strong>
                                        <span className="text-blue-800">{selectedTemplateData?.label}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <strong className="text-blue-900 min-w-20">Topic:</strong>
                                        <span className="text-blue-800">{topic}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <strong className="text-blue-900 min-w-20">Data Source:</strong>
                                        <span className="text-blue-800">
                                            {dataSourceTab === "csv" && csvFileName ? `CSV: ${csvFileName}` : ""}
                                            {dataSourceTab === "screenshot" && screenshotInsights ? "Screenshot (extracted)" : ""}
                                            {dataSourceTab === "manual" && manualData ? "Manual entry" : ""}
                                            {!csvFileName && !screenshotInsights && !manualData ? (
                                                <Badge variant="secondary" className="ml-1">
                                                    <Globe className="h-3 w-3 mr-1" />
                                                    AI Web Search
                                                </Badge>
                                            ) : null}
                                        </span>
                                    </div>
                                </div>
                            </Card>

                            <div className="space-y-2">
                                <Label htmlFor="additional-context">Additional Context (Optional)</Label>
                                <Textarea
                                    id="additional-context"
                                    placeholder="Add style preferences, target audience, or specific requirements..."
                                    value={additionalContext}
                                    onChange={(e) => setAdditionalContext(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
                                <Select
                                    value={aspectRatio}
                                    onValueChange={(value) => setAspectRatio(value as AspectRatio)}
                                >
                                    <SelectTrigger id="aspect-ratio">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                                        <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                                        <SelectItem value="1:1">Square (1:1)</SelectItem>
                                        <SelectItem value="4:5">Social Portrait (4:5)</SelectItem>
                                        <SelectItem value="5:4">Social Landscape (5:4)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {researchReturnedEmpty ? (
                                <Card className="p-3 bg-red-50 border-red-200">
                                    <div className="flex items-start gap-2 text-sm">
                                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-red-900">
                                            AI couldn&apos;t find verified data for this topic. Please switch to <strong>CSV</strong>, <strong>Screenshot</strong>, or <strong>Manual</strong> and provide the data yourself — or try a more specific topic.
                                        </p>
                                    </div>
                                </Card>
                            ) : hasUserProvidedData ? (
                                <Card className="p-3 bg-green-50 border-green-200">
                                    <div className="flex items-start gap-2 text-sm">
                                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                        <p className="text-green-900">
                                            Using <strong>your data</strong>. AI will render it directly into the infographic — no web search.
                                        </p>
                                    </div>
                                </Card>
                            ) : (
                                <Card className="p-3 bg-amber-50 border-amber-200">
                                    <div className="flex items-start gap-2 text-sm">
                                        <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                        <p className="text-amber-900">
                                            AI will <strong>research current data</strong> from the web. You&apos;ll review the findings before the image is rendered.
                                        </p>
                                    </div>
                                </Card>
                            )}
                        </div>

                        <div className="flex justify-between pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={() => setStep(2)}
                                disabled={isGenerating || isPreparingPrompt}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={!canGenerate || isGenerating || isPreparingPrompt}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isGenerating || isPreparingPrompt ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        {isPreparingPrompt
                                            ? hasUserProvidedData ? "Preparing..." : "Researching data..."
                                            : "Generating..."}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        {hasUserProvidedData ? "Generate Infographic" : "Research & Review"}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
