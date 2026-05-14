/**
 * Fetches an image from a URL and triggers a browser download with a
 * meaningful filename. Works cross-origin because we go through fetch +
 * blob URL instead of relying on the anchor tag's `download` attribute,
 * which browsers ignore for cross-origin sources.
 */
export async function downloadImage(
  url: string,
  filename: string
): Promise<void> {
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = sanitizeFilename(filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Wait one tick before revoking so Safari finishes the download dialog.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

export async function downloadImagesSequential(
  items: Array<{ url: string; filename: string }>,
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    try {
      await downloadImage(items[i].url, items[i].filename);
      succeeded += 1;
    } catch {
      failed += 1;
    }
    onProgress?.(i + 1, items.length);
    // Brief pause so the browser doesn't dedupe / suppress rapid downloads.
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return { succeeded, failed };
}

export function inferImageExtension(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const dot = path.lastIndexOf(".");
    if (dot > 0 && dot > path.lastIndexOf("/")) {
      return path.slice(dot).toLowerCase();
    }
  } catch {
    // ignore
  }
  return ".jpg";
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}
