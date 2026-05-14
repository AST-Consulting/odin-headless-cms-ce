import { downloadImage, inferImageExtension } from "./download-image";

export type ImageCopyOutcome = 
  | "image-copied" 
  | "image-downloaded" 
  | "text-only-copied" 
  | "copy-failed";

const NATIVE_CLIPBOARD_IMAGE_TYPE = "image/png";

/**
 * Copies an image (and optionally text) to the system clipboard. 
 * Tries `ClipboardItem` first; falls back to a one-shot download 
 * when the browser blocks it or the source can't be fetched with CORS.
 */
export async function copyImage(
  imageUrl: string,
  filenameSeed = "repurpose",
  text?: string
): Promise<ImageCopyOutcome> {
  const canUseClipboardItem =
    typeof window !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function";

  if (canUseClipboardItem) {
    try {
      const blob = await fetchImageAsClipboardBlob(imageUrl);
      if (blob) {
        const clipboardData: Record<string, Blob> = {
          [blob.type]: blob,
        };

        if (text) {
          clipboardData["text/plain"] = new Blob([text], { type: "text/plain" });
        }

        await navigator.clipboard.write([
          new ClipboardItem(clipboardData),
        ]);
        return "image-copied";
      }
    } catch (err) {
      console.warn("Clipboard image write failed, falling back to text-only or download", err);
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          return "text-only-copied";
        } catch {
          // ignore
        }
      }
    }
  }

  try {
    await downloadImage(
      imageUrl,
      `${filenameSeed}${inferImageExtension(imageUrl)}`
    );
    return "image-downloaded";
  } catch {
    return "copy-failed";
  }
}

async function fetchImageAsClipboardBlob(url: string): Promise<Blob | null> {
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (blob.type === NATIVE_CLIPBOARD_IMAGE_TYPE) return blob;
  if (blob.type.startsWith("image/")) {
    return await transcodeToPng(blob);
  }
  return null;
}

async function transcodeToPng(blob: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
}
