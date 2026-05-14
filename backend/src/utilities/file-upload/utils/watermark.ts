import * as path from 'path';
import sharp = require('sharp');
import { ImageFormat, encodeWithFormat, isAnimatedFormat } from './image-format';

const WATERMARK_PATH = path.join(process.cwd(), 'src/utilities/file-upload/watermark.png');

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const WATERMARK_PADDING = 20;
const DEFAULT_WATERMARK_SCALE = 0.2;

/**
 * Apply the brand watermark to an image buffer.
 * Watermark is sized to `scale` (fraction of image width, default 0.2) and placed
 * 20px from the chosen corner. Defaults to 'top-right'.
 * Output is encoded in `sourceFormat` so PNG/WebP inputs keep their format
 * (preserving alpha and avoiding a silent JPEG transcode).
 * For animated formats (GIF): Sharp loads all frames as a vertical strip;
 * we build a frame-sized transparent overlay with the watermark stamped at
 * the target corner and composite it with `tile: true` so every frame gets
 * the watermark at the same position — animation is preserved.
 * Returns a new buffer with watermark applied. On failure, returns the original buffer.
 */
export async function applyWatermarkToBuffer(
  imageBuffer: Buffer,
  sourceFormat: ImageFormat,
  position: WatermarkPosition = 'top-right',
  scale: number = DEFAULT_WATERMARK_SCALE
): Promise<Buffer> {
  try {
    const animated = isAnimatedFormat(sourceFormat);
    const readOptions = animated ? { animated: true } : {};
    const metadata = await sharp(imageBuffer, readOptions).metadata();
    const imageWidth = metadata.width || 1000;
    // pageHeight = single-frame height for animated input; falls back to height
    // for non-animated (or when pageHeight is absent, e.g. static GIF).
    const frameHeight = (animated ? metadata.pageHeight : metadata.height) || 1000;
    const watermarkWidth = Math.max(1, Math.floor(imageWidth * scale));

    const resizedWatermark = await sharp(WATERMARK_PATH)
      .resize(watermarkWidth, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    const wmMeta = await sharp(resizedWatermark).metadata();
    const wmW = wmMeta.width || watermarkWidth;
    const wmH = wmMeta.height || 0;

    let top: number;
    let left: number;
    switch (position) {
      case 'top-right':
        top = WATERMARK_PADDING;
        left = Math.max(0, imageWidth - wmW - WATERMARK_PADDING);
        break;
      case 'bottom-left':
        top = Math.max(0, frameHeight - wmH - WATERMARK_PADDING);
        left = WATERMARK_PADDING;
        break;
      case 'bottom-right':
        top = Math.max(0, frameHeight - wmH - WATERMARK_PADDING);
        left = Math.max(0, imageWidth - wmW - WATERMARK_PADDING);
        break;
      case 'top-left':
      default:
        top = WATERMARK_PADDING;
        left = WATERMARK_PADDING;
        break;
    }

    if (animated) {
      // Tile a single-frame transparent overlay down the vertical frame strip.
      // Passing the watermark directly with tile:true would repeat it across
      // the whole strip (not per-frame) — so we first stamp it onto a
      // frame-sized canvas, then tile THAT.
      const frameOverlay = await sharp({
        create: {
          width: imageWidth,
          height: frameHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: resizedWatermark, top, left }])
        .png()
        .toBuffer();

      return await encodeWithFormat(
        sharp(imageBuffer, readOptions).composite([
          { input: frameOverlay, tile: true, top: 0, left: 0 },
        ]),
        sourceFormat
      ).toBuffer();
    }

    return await encodeWithFormat(
      sharp(imageBuffer).composite([{ input: resizedWatermark, top, left }]),
      sourceFormat
    ).toBuffer();
  } catch {
    // If watermarking fails, return the original buffer so upload still succeeds
    return imageBuffer;
  }
}
