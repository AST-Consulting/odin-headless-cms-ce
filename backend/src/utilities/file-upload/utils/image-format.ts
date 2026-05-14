import type { Sharp } from 'sharp';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif';

const MIME_TO_FORMAT: Record<string, ImageFormat> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/pjpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const FORMAT_TO_MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const FORMAT_TO_EXT: Record<ImageFormat, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  gif: '.gif',
};

export function getImageFormat(mimeType: string | undefined | null): ImageFormat | null {
  if (!mimeType) return null;
  return MIME_TO_FORMAT[mimeType.toLowerCase()] ?? null;
}

export function getMimeForFormat(format: ImageFormat): string {
  return FORMAT_TO_MIME[format];
}

export function getExtForFormat(format: ImageFormat): string {
  return FORMAT_TO_EXT[format];
}

/**
 * True for formats that carry multiple frames (animation). Callers use this to
 * skip operations that would destroy or bloat animated content — specifically
 * resize-based steps like aspect-fit and size variants. Watermarking itself
 * IS supported for animated formats via Sharp's animated mode.
 */
export function isAnimatedFormat(format: ImageFormat): boolean {
  return format === 'gif';
}

export interface EncodeOptions {
  quality?: number;
}

/**
 * Apply the format-matching encoder to a Sharp pipeline. Keeps the source
 * format intact end-to-end instead of silently transcoding to JPEG — which
 * drops GIF animation, WebP alpha, and PNG transparency.
 */
export function encodeWithFormat(
  pipeline: Sharp,
  format: ImageFormat,
  options: EncodeOptions = {}
): Sharp {
  const quality = options.quality ?? 90;
  switch (format) {
    case 'jpeg':
      return pipeline.jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: '4:4:4',
      });
    case 'png':
      return pipeline.png({ compressionLevel: 9 });
    case 'webp':
      return pipeline.webp({ quality });
    case 'gif':
      return pipeline.gif();
  }
}
