"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Replace } from "lucide-react";

interface ImageBlockInfo {
  blockId: string;
  el: HTMLElement;
  url: string;
}

interface ImageBlockOverlayProps {
  editorContainerRef: React.RefObject<HTMLElement | null>;
  onEdit: (blockId: string, url: string) => void;
  onReplace: (blockId: string) => void;
}

export function ImageBlockOverlay({ editorContainerRef, onEdit, onReplace }: ImageBlockOverlayProps) {
  const [blocks, setBlocks] = useState<ImageBlockInfo[]>([]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const scan = () => {
      const imageBlocks: ImageBlockInfo[] = [];
      const nodes = container.querySelectorAll<HTMLElement>('[data-content-type="image"]');
      nodes.forEach((node) => {
        const img = node.querySelector("img");
        if (!img?.src) return;
        const blockEl = node.closest<HTMLElement>("[data-id]") || node;
        const blockId = blockEl.getAttribute("data-id") || "";
        if (!blockId) return;
        imageBlocks.push({ blockId, el: node, url: img.src });
      });
      setBlocks(imageBlocks);
    };

    scan();

    const observer = new MutationObserver(() => scan());
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "data-id"],
    });

    return () => observer.disconnect();
  }, [editorContainerRef]);

  return (
    <>
      {blocks.map(({ blockId, el, url }) => (
        <ImageBlockButtons
          key={blockId}
          targetEl={el}
          onEdit={() => onEdit(blockId, url)}
          onReplace={() => onReplace(blockId)}
        />
      ))}
    </>
  );
}

function ImageBlockButtons({
  targetEl,
  onEdit,
  onReplace,
}: {
  targetEl: HTMLElement;
  onEdit: () => void;
  onReplace: () => void;
}) {
  useEffect(() => {
    if (getComputedStyle(targetEl).position === "static") {
      targetEl.style.position = "relative";
    }
    targetEl.classList.add("group/image-block");
  }, [targetEl]);

  return createPortal(
    <div
      contentEditable={false}
      suppressContentEditableWarning
      className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/image-block:opacity-100 transition-opacity z-10 pointer-events-auto"
    >
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit();
        }}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-black/70 text-white text-xs font-medium hover:bg-black/90 backdrop-blur-sm"
      >
        <Pencil className="w-3 h-3" /> Edit
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onReplace();
        }}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-black/70 text-white text-xs font-medium hover:bg-black/90 backdrop-blur-sm"
      >
        <Replace className="w-3 h-3" /> Replace
      </button>
    </div>,
    targetEl,
  );
}
