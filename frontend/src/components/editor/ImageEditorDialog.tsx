"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, type PixelCrop, makeAspectCrop, centerCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Save, X, RotateCw, FlipHorizontal, FlipVertical, Crop as CropIcon,
    SunMedium, Contrast, Loader2, Undo2, Type, Paintbrush, Maximize,
    Droplets, Shapes,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
type EditorMode = "crop" | "adjust" | "text" | "draw" | "shapes" | "resize" | "filters" | null;
type ShapeType = "rect" | "circle" | "arrow" | "line";

interface Adjustments { brightness: number; contrast: number; saturate: number }
interface TextOverlay { text: string; x: number; y: number; fontSize: number; color: string }
interface DrawPoint { x: number; y: number }

const DEFAULT_ADJ: Adjustments = { brightness: 100, contrast: 100, saturate: 100 };
const CROP_PRESETS = [
    { label: "16:9", value: 16 / 9 },
    { label: "9:16", value: 9 / 16 },
    { label: "3:2", value: 3 / 2 },
    { label: "2:3", value: 2 / 3 },
];
const FILTERS = [
    { label: "None", css: "" },
    { label: "Grayscale", css: "grayscale(100%)" },
    { label: "Sepia", css: "sepia(100%)" },
    { label: "Invert", css: "invert(100%)" },
    { label: "Blur", css: "blur(2px)" },
    { label: "Warm", css: "sepia(30%) saturate(140%) brightness(105%)" },
    { label: "Cool", css: "saturate(80%) hue-rotate(15deg) brightness(105%)" },
    { label: "High Contrast", css: "contrast(150%) brightness(105%)" },
    { label: "Vintage", css: "sepia(40%) contrast(90%) brightness(90%)" },
];

// ─── Props ───────────────────────────────────────────────────────────
interface CropConstraint {
    aspect: number;
    minWidth: number;
}

interface ImageEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageUrl: string;
    onSave: (blob: Blob) => void;
    isSaving?: boolean;
    cropConstraint?: CropConstraint;
}

// ─── Component ───────────────────────────────────────────────────────
export function ImageEditorDialog({ open, onOpenChange, imageUrl, onSave, isSaving = false, cropConstraint }: ImageEditorDialogProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);

    const [mode, setMode] = useState<EditorMode>(null);
    const [dataUrl, setDataUrl] = useState("");
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [cropAspect, setCropAspect] = useState<number | undefined>(undefined);
    const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJ);
    const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
    const [activeText, setActiveText] = useState<TextOverlay | null>(null);
    const [textColor, setTextColor] = useState("#ffffff");
    const [textSize, setTextSize] = useState(48);
    const [history, setHistory] = useState<string[]>([]);
    const [selectedFilter, setSelectedFilter] = useState("");
    const [resizeW, setResizeW] = useState(0);
    const [resizeH, setResizeH] = useState(0);
    const [resizeLock, setResizeLock] = useState(true);
    const [resizeRatio, setResizeRatio] = useState(1);
    const [drawColor, setDrawColor] = useState("#ff0000");
    const [drawSize, setDrawSize] = useState(4);
    const [isDrawing, setIsDrawing] = useState(false);
    const drawPathRef = useRef<DrawPoint[]>([]);

    // Shapes state
    const shapeCanvasRef = useRef<HTMLCanvasElement>(null);
    const [shapeType, setShapeType] = useState<ShapeType>("rect");
    const [shapeColor, setShapeColor] = useState("#ff0000");
    const [shapeSize, setShapeSize] = useState(3);
    const [shapeFill, setShapeFill] = useState(false);
    const [isShaping, setIsShaping] = useState(false);
    const shapeStartRef = useRef<DrawPoint>({ x: 0, y: 0 });
    const shapeCommittedRef = useRef<HTMLCanvasElement | null>(null); // offscreen buffer for accumulated shapes

    // ─── Load image ─────────────────────────────────────────────────
    useEffect(() => {
        if (!open || !imageUrl) return;
        setMode(null); setCrop(undefined); setCompletedCrop(undefined);
        setAdjustments(DEFAULT_ADJ); setTextOverlays([]); setActiveText(null);
        setHistory([]); setSelectedFilter("");
        setCanvasZoom(100); canvasOriginalRef.current = null;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext("2d")!.drawImage(img, 0, 0);
            const url = c.toDataURL("image/png");
            setDataUrl(url); setHistory([url]);
            setResizeW(img.naturalWidth); setResizeH(img.naturalHeight);
            setResizeRatio(img.naturalWidth / img.naturalHeight);
            if (cropConstraint) {
                setMode("crop");
                setCropAspect(cropConstraint.aspect);
            }
        };
        img.src = imageUrl;
    }, [open, imageUrl, cropConstraint]);

    // ─── History ────────────────────────────────────────────────────
    const pushHistory = useCallback((url: string) => {
        setHistory((p) => [...p, url]); setDataUrl(url);
    }, []);
    const handleUndo = useCallback(() => {
        if (history.length <= 1) return;
        const prev = history[history.length - 2];
        setHistory((h) => h.slice(0, -1)); setDataUrl(prev); setMode(null);
    }, [history]);

    // ─── Crop ───────────────────────────────────────────────────────
    const applyCrop = useCallback(() => {
        if (!completedCrop || !imgRef.current) return;
        const img = imgRef.current;
        const sx = img.naturalWidth / img.width, sy = img.naturalHeight / img.height;
        const outputW = Math.round(completedCrop.width * sx);
        if (cropConstraint?.minWidth && outputW < cropConstraint.minWidth) {
            alert(`Crop width must be at least ${cropConstraint.minWidth}px. Current: ${outputW}px. Select a larger area.`);
            return;
        }
        const c = document.createElement("canvas");
        c.width = outputW; c.height = Math.round(completedCrop.height * sy);
        c.getContext("2d")!.drawImage(img,
            completedCrop.x * sx, completedCrop.y * sy,
            completedCrop.width * sx, completedCrop.height * sy,
            0, 0, c.width, c.height);
        pushHistory(c.toDataURL("image/png"));
        setCrop(undefined); setCompletedCrop(undefined); setMode(null);
    }, [completedCrop, pushHistory, cropConstraint]);

    // ─── Blur Fill (fit image into aspect ratio with blurred background) ──
    const applyBlurFill = useCallback(() => {
        if (!cropAspect) { alert("Select a ratio first"); return; }
        const img = new Image();
        img.onload = () => {
            const srcW = img.width, srcH = img.height;
            const srcRatio = srcW / srcH;
            let outW: number, outH: number;

            if (srcRatio > cropAspect) {
                // Image is wider than target — height constrains
                outW = srcW;
                outH = Math.round(srcW / cropAspect);
            } else {
                // Image is taller than target — width constrains
                outH = srcH;
                outW = Math.round(srcH * cropAspect);
            }

            if (cropConstraint?.minWidth && outW < cropConstraint.minWidth) {
                outH = Math.round(cropConstraint.minWidth / cropAspect);
                outW = cropConstraint.minWidth;
            }

            const c = document.createElement("canvas");
            c.width = outW; c.height = outH;
            const ctx = c.getContext("2d")!;

            // Draw blurred background (stretched to fill)
            ctx.filter = "blur(30px) brightness(0.6)";
            ctx.drawImage(img, -20, -20, outW + 40, outH + 40);
            ctx.filter = "none";

            // Draw original image centered (fit inside)
            const fitW = srcRatio > cropAspect ? outW : Math.round(outH * srcRatio);
            const fitH = srcRatio > cropAspect ? Math.round(outW / srcRatio) : outH;
            const offsetX = Math.round((outW - fitW) / 2);
            const offsetY = Math.round((outH - fitH) / 2);
            ctx.drawImage(img, offsetX, offsetY, fitW, fitH);

            pushHistory(c.toDataURL("image/png"));
            setMode(null);
        };
        img.src = dataUrl;
    }, [dataUrl, cropAspect, cropConstraint, pushHistory]);

    // ─── Canvas Zoom (zoom out = add blur padding, zoom in = remove it) ──
    const [canvasZoom, setCanvasZoom] = useState(100);
    const canvasOriginalRef = useRef<string | null>(null);

    const applyCanvasZoom = useCallback((zoom: number) => {
        // Store original image on first zoom-out
        if (!canvasOriginalRef.current) canvasOriginalRef.current = dataUrl;
        const src = canvasOriginalRef.current;

        const img = new Image();
        img.onload = () => {
            if (zoom >= 100) {
                // Reset to original
                setDataUrl(src);
                setCanvasZoom(100);
                setCrop(undefined); setCompletedCrop(undefined);
                return;
            }

            // zoom=80 means image takes 80% of canvas, 20% is blur padding
            const scale = zoom / 100;
            const outW = Math.round(img.width / scale);
            const outH = Math.round(img.height / scale);
            const padX = Math.round((outW - img.width) / 2);
            const padY = Math.round((outH - img.height) / 2);

            const c = document.createElement("canvas");
            c.width = outW; c.height = outH;
            const ctx = c.getContext("2d")!;

            // Blurred stretched background
            ctx.filter = "blur(40px) brightness(0.6)";
            ctx.drawImage(img, -20, -20, outW + 40, outH + 40);
            ctx.filter = "none";

            // Original image centered
            ctx.drawImage(img, padX, padY);

            setDataUrl(c.toDataURL("image/png"));
            setCanvasZoom(zoom);
            setCrop(undefined); setCompletedCrop(undefined);
        };
        img.src = src;
    }, [dataUrl]);

    // ─── Rotate ─────────────────────────────────────────────────────
    const applyRotate = useCallback((deg: number) => {
        const img = new Image();
        img.onload = () => {
            const rad = (deg * Math.PI) / 180;
            const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * cos + img.height * sin);
            c.height = Math.round(img.width * sin + img.height * cos);
            const ctx = c.getContext("2d")!;
            ctx.translate(c.width / 2, c.height / 2); ctx.rotate(rad);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            pushHistory(c.toDataURL("image/png"));
        };
        img.src = dataUrl;
    }, [dataUrl, pushHistory]);

    // ─── Flip ───────────────────────────────────────────────────────
    const applyFlip = useCallback((h: boolean) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext("2d")!;
            ctx.translate(h ? img.width : 0, h ? 0 : img.height);
            ctx.scale(h ? -1 : 1, h ? 1 : -1);
            ctx.drawImage(img, 0, 0);
            pushHistory(c.toDataURL("image/png"));
        };
        img.src = dataUrl;
    }, [dataUrl, pushHistory]);

    // ─── Adjustments ────────────────────────────────────────────────
    const applyAdjustments = useCallback(() => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext("2d")!;
            ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%)`;
            ctx.drawImage(img, 0, 0);
            pushHistory(c.toDataURL("image/png"));
            setAdjustments(DEFAULT_ADJ); setMode(null);
        };
        img.src = dataUrl;
    }, [dataUrl, adjustments, pushHistory]);

    // ─── Filters ────────────────────────────────────────────────────
    const applyFilter = useCallback((css: string) => {
        if (!css) { setSelectedFilter(""); return; }
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext("2d")!;
            ctx.filter = css;
            ctx.drawImage(img, 0, 0);
            pushHistory(c.toDataURL("image/png"));
            setSelectedFilter(""); setMode(null);
        };
        img.src = dataUrl;
    }, [dataUrl, pushHistory]);

    // ─── Text ───────────────────────────────────────────────────────
    const applyText = useCallback(() => {
        const all = activeText?.text ? [...textOverlays, activeText] : textOverlays;
        if (all.length === 0) { setMode(null); return; }
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            all.forEach((t) => {
                ctx.font = `bold ${t.fontSize}px Arial`;
                ctx.fillStyle = t.color;
                ctx.strokeStyle = "rgba(0,0,0,0.5)";
                ctx.lineWidth = 2;
                ctx.strokeText(t.text, t.x, t.y);
                ctx.fillText(t.text, t.x, t.y);
            });
            pushHistory(c.toDataURL("image/png"));
            setTextOverlays([]); setActiveText(null); setMode(null);
        };
        img.src = dataUrl;
    }, [dataUrl, textOverlays, activeText, pushHistory]);

    // ─── Resize ─────────────────────────────────────────────────────
    const applyResize = useCallback(() => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = resizeW; c.height = resizeH;
            c.getContext("2d")!.drawImage(img, 0, 0, resizeW, resizeH);
            pushHistory(c.toDataURL("image/png"));
            setMode(null);
        };
        img.src = dataUrl;
    }, [dataUrl, resizeW, resizeH, pushHistory]);

    // ─── Draw ───────────────────────────────────────────────────────
    const setupDrawCanvas = useCallback(() => {
        const imgEl = imgRef.current;
        const dc = drawCanvasRef.current;
        if (!imgEl || !dc) return;
        dc.width = imgEl.width; dc.height = imgEl.height;
        dc.style.width = `${imgEl.width}px`;
        dc.style.height = `${imgEl.height}px`;
        const rect = imgEl.getBoundingClientRect();
        const parentRect = imgEl.parentElement!.getBoundingClientRect();
        dc.style.left = `${rect.left - parentRect.left}px`;
        dc.style.top = `${rect.top - parentRect.top}px`;
    }, []);

    useEffect(() => {
        if (mode === "draw") setTimeout(setupDrawCanvas, 50);
    }, [mode, setupDrawCanvas, dataUrl]);

    const getDrawPos = useCallback((e: React.MouseEvent) => {
        const dc = drawCanvasRef.current;
        if (!dc) return { x: 0, y: 0 };
        const r = dc.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }, []);

    const onDrawStart = useCallback((e: React.MouseEvent) => {
        setIsDrawing(true);
        drawPathRef.current = [getDrawPos(e)];
    }, [getDrawPos]);

    const onDrawMove = useCallback((e: React.MouseEvent) => {
        if (!isDrawing) return;
        const dc = drawCanvasRef.current;
        if (!dc) return;
        const ctx = dc.getContext("2d")!;
        const pos = getDrawPos(e);
        const prev = drawPathRef.current[drawPathRef.current.length - 1];
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = drawSize;
        ctx.lineCap = "round";
        ctx.stroke();
        drawPathRef.current.push(pos);
    }, [isDrawing, drawColor, drawSize, getDrawPos]);

    const onDrawEnd = useCallback(() => { setIsDrawing(false); }, []);

    const applyDraw = useCallback(() => {
        const imgEl = imgRef.current;
        const dc = drawCanvasRef.current;
        if (!imgEl || !dc) return;
        const scaleX = imgEl.naturalWidth / dc.width;
        const scaleY = imgEl.naturalHeight / dc.height;
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            ctx.scale(scaleX, scaleY);
            ctx.drawImage(dc, 0, 0);
            pushHistory(c.toDataURL("image/png"));
            dc.getContext("2d")!.clearRect(0, 0, dc.width, dc.height);
            setMode(null);
        };
        img.src = dataUrl;
    }, [dataUrl, pushHistory]);

    // ─── Shapes ─────────────────────────────────────────────────────
    const setupShapeCanvas = useCallback(() => {
        const imgEl = imgRef.current;
        const sc = shapeCanvasRef.current;
        if (!imgEl || !sc) return;
        sc.width = imgEl.width; sc.height = imgEl.height;
        sc.style.width = `${imgEl.width}px`;
        sc.style.height = `${imgEl.height}px`;
        const rect = imgEl.getBoundingClientRect();
        const parentRect = imgEl.parentElement!.getBoundingClientRect();
        sc.style.left = `${rect.left - parentRect.left}px`;
        sc.style.top = `${rect.top - parentRect.top}px`;
        // Init offscreen committed buffer
        if (!shapeCommittedRef.current) {
            shapeCommittedRef.current = document.createElement("canvas");
        }
        shapeCommittedRef.current.width = sc.width;
        shapeCommittedRef.current.height = sc.height;
    }, []);

    useEffect(() => {
        if (mode === "shapes") setTimeout(setupShapeCanvas, 50);
    }, [mode, setupShapeCanvas, dataUrl]);

    const getShapePos = useCallback((e: React.MouseEvent) => {
        const sc = shapeCanvasRef.current;
        if (!sc) return { x: 0, y: 0 };
        const r = sc.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }, []);

    const drawOneShape = useCallback((ctx: CanvasRenderingContext2D, start: DrawPoint, end: DrawPoint) => {
        ctx.strokeStyle = shapeColor;
        ctx.fillStyle = shapeColor;
        ctx.lineWidth = shapeSize;
        ctx.lineCap = "round";

        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);

        if (shapeType === "rect") {
            if (shapeFill) ctx.fillRect(x, y, w, h);
            else ctx.strokeRect(x, y, w, h);
        } else if (shapeType === "circle") {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            shapeFill ? ctx.fill() : ctx.stroke();
        } else if (shapeType === "line") {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        } else if (shapeType === "arrow") {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLen = 12 + shapeSize * 2;
            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        }
    }, [shapeColor, shapeSize, shapeType, shapeFill]);

    const onShapeStart = useCallback((e: React.MouseEvent) => {
        setIsShaping(true);
        shapeStartRef.current = getShapePos(e);
    }, [getShapePos]);

    const onShapeMove = useCallback((e: React.MouseEvent) => {
        if (!isShaping) return;
        const sc = shapeCanvasRef.current;
        const committed = shapeCommittedRef.current;
        if (!sc) return;
        const ctx = sc.getContext("2d")!;
        // Restore committed shapes, then draw current preview on top
        ctx.clearRect(0, 0, sc.width, sc.height);
        if (committed) ctx.drawImage(committed, 0, 0);
        drawOneShape(ctx, shapeStartRef.current, getShapePos(e));
    }, [isShaping, getShapePos, drawOneShape]);

    const onShapeEnd = useCallback((e: React.MouseEvent) => {
        if (!isShaping) return;
        setIsShaping(false);
        const sc = shapeCanvasRef.current;
        const committed = shapeCommittedRef.current;
        if (!sc) return;
        const ctx = sc.getContext("2d")!;
        // Final draw
        ctx.clearRect(0, 0, sc.width, sc.height);
        if (committed) ctx.drawImage(committed, 0, 0);
        drawOneShape(ctx, shapeStartRef.current, getShapePos(e));
        // Auto-commit this shape to the buffer so it persists
        if (committed) {
            committed.getContext("2d")!.clearRect(0, 0, committed.width, committed.height);
            committed.getContext("2d")!.drawImage(sc, 0, 0);
        }
    }, [isShaping, getShapePos, drawOneShape]);

    // ✓ Confirm: commit accumulated shapes to image history, stay in shapes mode
    const confirmShapes = useCallback(() => {
        const imgEl = imgRef.current;
        const sc = shapeCanvasRef.current;
        if (!imgEl || !sc) return;
        const scaleX = imgEl.naturalWidth / sc.width;
        const scaleY = imgEl.naturalHeight / sc.height;
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            ctx.scale(scaleX, scaleY);
            ctx.drawImage(sc, 0, 0);
            pushHistory(c.toDataURL("image/png"));
            // Clear both canvases for fresh shapes
            sc.getContext("2d")!.clearRect(0, 0, sc.width, sc.height);
            if (shapeCommittedRef.current) {
                shapeCommittedRef.current.getContext("2d")!.clearRect(0, 0, shapeCommittedRef.current.width, shapeCommittedRef.current.height);
            }
            // Stay in shapes mode
        };
        img.src = dataUrl;
    }, [dataUrl, pushHistory]);

    // Apply: same as confirm but exits mode
    const applyShapes = useCallback(() => {
        const sc = shapeCanvasRef.current;
        const hasShapes = sc && sc.getContext("2d")!.getImageData(0, 0, sc.width, sc.height).data.some((v, i) => i % 4 === 3 && v > 0);
        if (hasShapes) {
            // Commit remaining shapes first, then exit
            const imgEl = imgRef.current;
            if (!imgEl || !sc) return;
            const scaleX = imgEl.naturalWidth / sc.width;
            const scaleY = imgEl.naturalHeight / sc.height;
            const img = new Image();
            img.onload = () => {
                const c = document.createElement("canvas");
                c.width = img.width; c.height = img.height;
                const ctx = c.getContext("2d")!;
                ctx.drawImage(img, 0, 0);
                ctx.scale(scaleX, scaleY);
                ctx.drawImage(sc, 0, 0);
                pushHistory(c.toDataURL("image/png"));
                sc.getContext("2d")!.clearRect(0, 0, sc.width, sc.height);
                if (shapeCommittedRef.current) {
                    shapeCommittedRef.current.getContext("2d")!.clearRect(0, 0, shapeCommittedRef.current.width, shapeCommittedRef.current.height);
                }
                setMode(null);
            };
            img.src = dataUrl;
        } else {
            setMode(null);
        }
    }, [dataUrl, pushHistory]);

    // ─── Save ───────────────────────────────────────────────────────
    const handleSave = useCallback(() => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            c.getContext("2d")!.drawImage(img, 0, 0);
            c.toBlob((blob) => { if (blob) onSave(blob); }, "image/png", 0.92);
        };
        img.src = dataUrl;
    }, [onSave, dataUrl]);

    // ─── Preview filter ─────────────────────────────────────────────
    const previewFilter = mode === "adjust"
        ? `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%)`
        : mode === "filters" && selectedFilter ? selectedFilter : undefined;

    if (!dataUrl) return null;

    // Mode options panel adds 40px height — adjust image maxHeight
    const hasOptionsPanel = mode === "adjust" || mode === "filters" || mode === "text" || mode === "draw" || mode === "shapes" || mode === "resize";
    const imgMaxHeight = hasOptionsPanel ? "calc(92vh - 200px)" : "calc(92vh - 160px)";

    // ─── Tool bar button helper ─────────────────────────────────────
    const TB = ({ m, icon, label }: { m: EditorMode; icon: React.ReactNode; label: string }) => (
        <Button
            variant={mode === m ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs text-gray-300 shrink-0"
            onClick={() => setMode(mode === m ? null : m)}
        >{icon} {label}</Button>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[92vw] w-[92vw] h-[92vh] p-0 border-0 bg-[#111] overflow-hidden flex flex-col [&>button]:hidden"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
        >

            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-4 h-11 border-b border-gray-700 bg-[#1a1a1a] shrink-0" style={{ borderRadius: "12px 12px 0 0" }}>
                <span className="text-sm font-medium text-white">Edit Image</span>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white h-7 text-xs" onClick={handleUndo} disabled={history.length <= 1}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-700 h-7 text-xs" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                        {isSaving ? "Saving..." : "Save & Insert"}
                    </Button>
                </div>
            </div>

            {/* ─── Tools ─── */}
            <div className="flex items-center gap-1 px-4 h-9 border-b border-gray-700 bg-[#1a1a1a] shrink-0 overflow-x-auto">
                <TB m="crop" icon={<CropIcon className="h-3.5 w-3.5 mr-1" />} label="Crop" />
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-300 shrink-0" onClick={() => applyRotate(90)}><RotateCw className="h-3.5 w-3.5 mr-1" /> Rotate</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-300 shrink-0" onClick={() => applyFlip(true)}><FlipHorizontal className="h-3.5 w-3.5 mr-1" /> Flip H</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-300 shrink-0" onClick={() => applyFlip(false)}><FlipVertical className="h-3.5 w-3.5 mr-1" /> Flip V</Button>
                <TB m="adjust" icon={<SunMedium className="h-3.5 w-3.5 mr-1" />} label="Adjust" />
                <TB m="filters" icon={<Droplets className="h-3.5 w-3.5 mr-1" />} label="Filters" />
                <TB m="text" icon={<Type className="h-3.5 w-3.5 mr-1" />} label="Text" />
                <TB m="draw" icon={<Paintbrush className="h-3.5 w-3.5 mr-1" />} label="Draw" />
                <TB m="shapes" icon={<Shapes className="h-3.5 w-3.5 mr-1" />} label="Shapes" />
                <TB m="resize" icon={<Maximize className="h-3.5 w-3.5 mr-1" />} label="Resize" />

                <span className="w-px h-5 bg-gray-600 mx-1 shrink-0" />

                {/* Mode-specific sub-toolbar */}
                {mode === "crop" && !cropConstraint && CROP_PRESETS.map((p) => (
                    <Button key={p.label} variant={cropAspect === p.value ? "default" : "ghost"} size="sm" className="h-7 text-xs text-gray-300 px-2 shrink-0"
                        onClick={() => {
                            setCropAspect(p.value);
                            const img = imgRef.current;
                            if (!img) return;
                            setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 80 }, p.value, img.width, img.height), img.width, img.height));
                        }}>{p.label}</Button>
                ))}
                {mode === "crop" && cropConstraint && (
                    <span className="text-xs text-gray-400 shrink-0">Locked: {cropConstraint.aspect === 16/9 ? "16:9" : cropConstraint.aspect.toFixed(2)} · Min {cropConstraint.minWidth}px wide</span>
                )}
                {mode === "crop" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 shrink-0" onClick={applyCrop} disabled={!completedCrop}>Apply</Button>}
                {mode === "crop" && cropAspect && <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 shrink-0" onClick={applyBlurFill}>Fit to Ratio</Button>}
                {mode === "crop" && (
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700" onClick={() => applyCanvasZoom(Math.max(40, canvasZoom - 20))} title="Zoom out (extend canvas)">
                            <span className="text-sm font-bold">−</span>
                        </Button>
                        <span className="text-[10px] text-gray-400 w-8 text-center">{canvasZoom}%</span>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-300 hover:text-white hover:bg-gray-700" onClick={() => applyCanvasZoom(Math.min(100, canvasZoom + 20))} disabled={canvasZoom >= 100} title="Zoom in (reduce canvas)">
                            <span className="text-sm font-bold">+</span>
                        </Button>
                    </div>
                )}
                {mode === "adjust" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 shrink-0" onClick={applyAdjustments}>Apply</Button>}
                {mode === "filters" && selectedFilter && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 shrink-0" onClick={() => applyFilter(selectedFilter)}>Apply Filter</Button>}
                {mode === "text" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 shrink-0" onClick={applyText}>Apply Text</Button>}
                {mode === "draw" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 shrink-0" onClick={applyDraw}>Apply Draw</Button>}
                {mode === "shapes" && <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 shrink-0" onClick={confirmShapes}>✓ Apply Changes</Button>}
                {mode === "shapes" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 shrink-0" onClick={applyShapes}>Done</Button>}
                {mode === "resize" && <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 shrink-0" onClick={applyResize}>Apply Resize</Button>}
            </div>

            {/* ─── Mode options panel ─── */}
            {mode === "adjust" && (
                <div className="flex items-center gap-6 px-6 h-10 border-b border-gray-700 bg-[#222] shrink-0">
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        <SunMedium className="h-3.5 w-3.5" /> Brightness
                        <input type="range" className="w-24 accent-blue-500" min={50} max={150} value={adjustments.brightness} onChange={(e) => setAdjustments((a) => ({ ...a, brightness: +e.target.value }))} />
                        <span className="w-7 text-right">{adjustments.brightness}%</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        <Contrast className="h-3.5 w-3.5" /> Contrast
                        <input type="range" className="w-24 accent-blue-500" min={50} max={150} value={adjustments.contrast} onChange={(e) => setAdjustments((a) => ({ ...a, contrast: +e.target.value }))} />
                        <span className="w-7 text-right">{adjustments.contrast}%</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        Saturation
                        <input type="range" className="w-24 accent-blue-500" min={0} max={200} value={adjustments.saturate} onChange={(e) => setAdjustments((a) => ({ ...a, saturate: +e.target.value }))} />
                        <span className="w-7 text-right">{adjustments.saturate}%</span>
                    </label>
                </div>
            )}
            {mode === "filters" && (
                <div className="flex items-center gap-2 px-6 h-10 border-b border-gray-700 bg-[#222] shrink-0 overflow-x-auto">
                    {FILTERS.map((f) => (
                        <button key={f.label} onClick={() => setSelectedFilter(f.css)}
                            className={`px-3 py-1 rounded text-xs shrink-0 ${selectedFilter === f.css ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                        >{f.label}</button>
                    ))}
                </div>
            )}
            {mode === "text" && (
                <div className="flex items-center gap-4 px-6 h-10 border-b border-gray-700 bg-[#222] shrink-0">
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        Color <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        Size <input type="range" className="w-20 accent-blue-500" min={16} max={120} value={textSize} onChange={(e) => setTextSize(+e.target.value)} />
                        <span className="w-6">{textSize}</span>
                    </label>
                    <span className="text-xs text-gray-500">Click on image to place text. Enter to confirm.</span>
                </div>
            )}
            {mode === "draw" && (
                <div className="flex items-center gap-4 px-6 h-10 border-b border-gray-700 bg-[#222] shrink-0">
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        Color <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        Size <input type="range" className="w-20 accent-blue-500" min={1} max={20} value={drawSize} onChange={(e) => setDrawSize(+e.target.value)} />
                        <span className="w-5">{drawSize}</span>
                    </label>
                </div>
            )}
            {mode === "shapes" && (
                <div className="flex items-center gap-4 px-6 h-10 border-b border-gray-700 bg-[#222] shrink-0">
                    <div className="flex items-center gap-1">
                        {(["rect", "circle", "line", "arrow"] as ShapeType[]).map((s) => (
                            <button key={s} onClick={() => setShapeType(s)}
                                className={`px-2.5 py-1 rounded text-xs capitalize shrink-0 ${shapeType === s ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                            >{s === "rect" ? "Rectangle" : s === "circle" ? "Circle" : s === "arrow" ? "Arrow" : "Line"}</button>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        Color <input type="color" value={shapeColor} onChange={(e) => setShapeColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        Size <input type="range" className="w-16 accent-blue-500" min={1} max={12} value={shapeSize} onChange={(e) => setShapeSize(+e.target.value)} />
                        <span className="w-4">{shapeSize}</span>
                    </label>
                    {(shapeType === "rect" || shapeType === "circle") && (
                        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                            <input type="checkbox" checked={shapeFill} onChange={(e) => setShapeFill(e.target.checked)} className="accent-blue-500" />
                            Fill
                        </label>
                    )}
                    <span className="text-xs text-gray-500">Click & drag on image</span>
                </div>
            )}
            {mode === "resize" && (
                <div className="flex items-center gap-4 px-6 h-10 border-b border-gray-700 bg-[#222] shrink-0">
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        W <input type="number" className="w-24 bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={resizeW} onChange={(e) => {
                            const w = +e.target.value;
                            setResizeW(w);
                            if (resizeLock) setResizeH(Math.round(w / resizeRatio));
                        }} />
                    </label>
                    <button onClick={() => setResizeLock(!resizeLock)} className={`text-xs px-2 py-1 rounded ${resizeLock ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                        {resizeLock ? "🔗" : "🔓"}
                    </button>
                    <label className="flex items-center gap-2 text-xs text-gray-300">
                        H <input type="number" className="w-24 bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={resizeH} onChange={(e) => {
                            const h = +e.target.value;
                            setResizeH(h);
                            if (resizeLock) setResizeW(Math.round(h * resizeRatio));
                        }} />
                    </label>
                </div>
            )}

            {/* ─── Canvas (hidden) ─── */}
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* ─── Image area ─── */}
            <div
                className="flex-1 flex items-center justify-center overflow-hidden p-4 relative"
                style={{ cursor: mode === "text" ? "crosshair" : mode === "draw" ? "crosshair" : undefined, minHeight: 0 }}
                onClick={(e) => {
                    if (mode !== "text") return;
                    const imgEl = imgRef.current;
                    if (!imgEl) return;
                    const r = imgEl.getBoundingClientRect();
                    const sx = imgEl.naturalWidth / imgEl.width;
                    const sy = imgEl.naturalHeight / imgEl.height;
                    const x = (e.clientX - r.left) * sx;
                    const y = (e.clientY - r.top) * sy;
                    if (x < 0 || y < 0 || x > imgEl.naturalWidth || y > imgEl.naturalHeight) return;
                    setActiveText({ text: "", x, y, fontSize: textSize, color: textColor });
                }}
            >
                {mode === "crop" ? (
                    <ReactCrop crop={crop} onChange={setCrop} onComplete={setCompletedCrop} aspect={cropAspect}>
                        <img ref={imgRef} src={dataUrl} alt="Edit" style={{ maxHeight: imgMaxHeight, maxWidth: "calc(92vw - 32px)", display: "block" }}
                            onLoad={(e) => {
                                if (!crop && cropAspect) {
                                    const img = e.currentTarget;
                                    setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 85 }, cropAspect, img.width, img.height), img.width, img.height));
                                }
                            }}
                        />
                    </ReactCrop>
                ) : (
                    <div className="relative inline-block">
                        <img ref={imgRef} src={dataUrl} alt="Edit"
                            style={{ maxHeight: imgMaxHeight, maxWidth: "calc(92vw - 32px)", objectFit: "contain", filter: previewFilter, display: "block" }} />

                        {/* Draw canvas overlay */}
                        {mode === "draw" && (
                            <canvas ref={drawCanvasRef} className="absolute" style={{ cursor: "crosshair" }}
                                onMouseDown={onDrawStart} onMouseMove={onDrawMove} onMouseUp={onDrawEnd} onMouseLeave={onDrawEnd} />
                        )}

                        {/* Shapes canvas overlay */}
                        {mode === "shapes" && (
                            <canvas ref={shapeCanvasRef} className="absolute" style={{ cursor: "crosshair" }}
                                onMouseDown={onShapeStart} onMouseMove={onShapeMove} onMouseUp={onShapeEnd} onMouseLeave={onShapeEnd} />
                        )}

                        {/* Text input overlay */}
                        {mode === "text" && activeText && imgRef.current && (() => {
                            const r = imgRef.current!.getBoundingClientRect();
                            const pr = imgRef.current!.parentElement!.getBoundingClientRect();
                            const sx = imgRef.current!.width / imgRef.current!.naturalWidth;
                            const sy = imgRef.current!.height / imgRef.current!.naturalHeight;
                            return (
                                <input
                                    autoFocus
                                    value={activeText.text}
                                    onChange={(e) => setActiveText((t) => t ? { ...t, text: e.target.value } : null)}
                                    placeholder="Type here..."
                                    className="absolute bg-black/30 border border-dashed border-white px-1 outline-none"
                                    style={{
                                        left: (r.left - pr.left) + activeText.x * sx,
                                        top: (r.top - pr.top) + activeText.y * sy - activeText.fontSize * sy,
                                        fontSize: `${activeText.fontSize * sy}px`,
                                        color: activeText.color,
                                        minWidth: "100px",
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && activeText.text) {
                                            setTextOverlays((prev) => [...prev, activeText]);
                                            setActiveText(null);
                                        } else if (e.key === "Escape") {
                                            setActiveText(null);
                                        }
                                    }}
                                />
                            );
                        })()}
                    </div>
                )}
            </div>
        </DialogContent>
        </Dialog>
    );
}
