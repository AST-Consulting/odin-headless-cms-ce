import sharp = require('sharp');
import { ImageFormat, encodeWithFormat } from './image-format';

export interface FitResult {
  buffer: Buffer;
  wasModified: boolean;
  width: number;
  height: number;
}

// Accept ±2% (relative) of target aspect as "already correct".
const ASPECT_TOLERANCE = 0.02;

// Blur radius in pixels for the background copy. Empirical — 40px hides details
// without reducing the background to a flat color at typical article widths.
const BLUR_SIGMA = 40;

// Dark overlay on top of the blurred background — helps the centered subject pop.
const DARKEN_OVERLAY_ALPHA = 0.15;

export function parseAspectRatio(input: string): number {
  const [w, h] = input.split(':').map((n) => Number(n));
  if (!w || !h || !isFinite(w) || !isFinite(h)) {
    throw new Error(`Invalid aspect ratio: "${input}" — expected "W:H"`);
  }
  return w / h;
}

export function aspectMatches(srcAspect: number, targetAspect: number): boolean {
  return Math.abs(srcAspect / targetAspect - 1) <= ASPECT_TOLERANCE;
}

/**
 * Fit an image buffer to the target aspect ratio by padding with a blurred,
 * scaled-to-cover copy of itself. Original image is centered on top using
 * "contain" fit. Output preserves the larger of the two original dimensions
 * to avoid upscaling a small source.
 *
 * If the image already matches target aspect (within tolerance), returns the
 * original buffer with wasModified=false. When modified, the output is encoded
 * in `sourceFormat` so PNG/WebP sources keep their format (and alpha).
 */
export async function fitBufferToAspectWithBlur(
  buffer: Buffer,
  targetAspect: number,
  sourceFormat: ImageFormat
): Promise<FitResult> {
  const meta = await sharp(buffer).metadata();
  const srcW = meta.width;
  const srcH = meta.height;
  if (!srcW || !srcH) {
    return { buffer, wasModified: false, width: 0, height: 0 };
  }

  const srcAspect = srcW / srcH;
  if (aspectMatches(srcAspect, targetAspect)) {
    return { buffer, wasModified: false, width: srcW, height: srcH };
  }

  // Preserve resolution: pad the shorter side to reach target aspect
  let outW: number;
  let outH: number;
  if (srcAspect > targetAspect) {
    // Source is too wide — pad height
    outW = srcW;
    outH = Math.round(srcW / targetAspect);
  } else {
    // Source is too tall — pad width
    outH = srcH;
    outW = Math.round(srcH * targetAspect);
  }

  // 1) Blurred "cover" background with a subtle dark overlay
  const overlaySvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}">` +
      `<rect width="${outW}" height="${outH}" fill="rgb(0,0,0)" fill-opacity="${DARKEN_OVERLAY_ALPHA}"/>` +
      `</svg>`
  );

  const background = await sharp(buffer)
    .resize(outW, outH, { fit: 'cover' })
    .blur(BLUR_SIGMA)
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .toBuffer();

  // 2) Original image scaled "contain" and centered
  const containScale = Math.min(outW / srcW, outH / srcH);
  const containedW = Math.max(1, Math.round(srcW * containScale));
  const containedH = Math.max(1, Math.round(srcH * containScale));
  const containedLeft = Math.round((outW - containedW) / 2);
  const containedTop = Math.round((outH - containedH) / 2);

  const contained = await sharp(buffer)
    .resize(containedW, containedH, { fit: 'inside' })
    .toBuffer();

  const result = await encodeWithFormat(
    sharp(background).composite([{ input: contained, top: containedTop, left: containedLeft }]),
    sourceFormat,
    { quality: 92 }
  ).toBuffer();

  return { buffer: result, wasModified: true, width: outW, height: outH };
}
