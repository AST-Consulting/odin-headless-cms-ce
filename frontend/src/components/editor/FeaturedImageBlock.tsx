"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { Camera, Pencil, Replace } from "lucide-react";
import React from "react";
import { resolveEditableUrl } from "@/lib/editable-image-url";
import { getImageUrl } from "@/lib/utils";

// Event listener for opening the featured image picker from the block
type FeaturedImagePickerListener = () => void;
let pickerListener: FeaturedImagePickerListener | null = null;
let editorListener: ((url: string) => void) | null = null;

export const setFeaturedImagePickerListener = (listener: FeaturedImagePickerListener | null) => {
    pickerListener = listener;
};

export const setFeaturedImageEditorListener = (listener: ((url: string) => void) | null) => {
    editorListener = listener;
};



interface FeaturedImageRenderProps {
    url: string;
    alt: string;
    caption: string;
}

function FeaturedImageRender({ url, alt, caption }: FeaturedImageRenderProps) {
    const displayUrl = url ? getImageUrl(url) : null;
    const editableUrl = url ? resolveEditableUrl(url) : null;


    if (!displayUrl) {
        return (
            <div
                onClick={() => pickerListener?.()}
                contentEditable={false}
                className="flex flex-col items-center justify-center w-full py-10 border-2 border-dashed rounded-xl bg-muted/10 text-muted-foreground cursor-pointer hover:bg-muted/20 hover:border-primary/40 transition-colors select-none"
            >
                <Camera className="w-8 h-8 mb-2 opacity-40" />
                <span className="text-sm font-medium">Click to add featured image</span>
                <span className="text-xs opacity-60 mt-0.5">This will be the main image for the article</span>
            </div>
        );
    }

    return (
        <div
            contentEditable={false}
            className="group relative w-full rounded-xl overflow-hidden select-none"
        >
            <img
                src={displayUrl}
                alt={alt || "Featured"}
                className="w-full h-auto"
            />
            {caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 px-3 truncate">
                    {caption}
                </div>
            )}
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); editorListener?.(editableUrl || displayUrl); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-black/70 text-white text-xs font-medium hover:bg-black/90 backdrop-blur-sm"
                >
                    <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pickerListener?.(); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-black/70 text-white text-xs font-medium hover:bg-black/90 backdrop-blur-sm"
                >
                    <Replace className="w-3 h-3" /> Replace
                </button>
            </div>
        </div>
    );
}

export const FeaturedImageBlock = createReactBlockSpec(
    {
        type: "featuredImage" as const,
        propSchema: {
            url: { default: "" },
            alt: { default: "" },
            caption: { default: "" },
        },
        content: "none",
    },
    {
        render: (props) => {
            const { url, alt, caption } = props.block.props;
            return <FeaturedImageRender url={url} alt={alt} caption={caption} />;
        },
    }
);
