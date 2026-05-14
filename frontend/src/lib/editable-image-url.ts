import { getImageUrl } from "./utils";

/**
 * Convert any stored image URL into one safe to load into a canvas for editing.
 * The ImageEditor draws the image into a canvas with `crossOrigin="anonymous"`,
 * which triggers a CORS preflight. Our S3 / CDN hosts don't send CORS headers,
 * so we proxy the URL through the Next.js `/media-proxy` route which *does*.
 */
export function resolveEditableUrl(url?: string): string {
  if (!url) return "";
  const fullUrl = getImageUrl(url);
  return `/media-proxy?url=${encodeURIComponent(fullUrl || "")}`;
}
