import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import {
  IMAGE_SIZE_CONFIGS,
  ISizeConfig,
  ISizeVariantMetadata,
} from '../config/image-sizes.config';
import { ensureDirectoryPath } from './fileProcessing';
import { ImageFormat, encodeWithFormat, getExtForFormat } from './image-format';

/**
 * Checks if a variant should be generated based on original image dimensions
 * Prevents upscaling - only generates variants smaller than or equal to original
 */
export function shouldGenerateVariant(
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
  targetHeight: number
): boolean {
  // Allow generation if target is smaller or equal in both dimensions
  return targetWidth <= originalWidth && targetHeight <= originalHeight;
}

/**
 * Generates a single image variant
 * Note: Watermark is NOT applied here as the original image is already watermarked
 * The resized variants will naturally include the watermark from the source.
 * Output is encoded in `sourceFormat` so PNG/WebP variants match the original.
 */
export async function generateSingleVariant(
  originalImagePath: string,
  outputPath: string,
  config: ISizeConfig,
  baseName: string,
  sourceFormat: ImageFormat
): Promise<ISizeVariantMetadata | null> {
  try {
    // Get original image metadata
    const originalMetadata = await sharp(originalImagePath).metadata();
    const originalWidth = originalMetadata.width || 0;
    const originalHeight = originalMetadata.height || 0;

    // Check if we should generate this variant (no upscaling)
    if (!shouldGenerateVariant(originalWidth, originalHeight, config.width, config.height)) {
      console.log(
        `Skipping variant ${config.name}: target size (${config.width}x${config.height}) exceeds original (${originalWidth}x${originalHeight})`
      );
      return null;
    }

    // Generate the resized image (watermark already present in source)
    const fileName = `${baseName}-${config.name}${getExtForFormat(sourceFormat)}`;
    const fullOutputPath = path.join(outputPath, fileName);

    await encodeWithFormat(
      sharp(originalImagePath).resize(config.width, config.height, {
        fit: config.fit,
        withoutEnlargement: true,
        position: 'center',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      }),
      sourceFormat,
      { quality: config.quality }
    ).toFile(fullOutputPath);

    // Get the generated file stats
    const fileStats = fs.statSync(fullOutputPath);
    const variantMetadata = await sharp(fullOutputPath).metadata();

    return {
      name: config.name,
      file: fileName,
      path: fullOutputPath,
      width: variantMetadata.width || config.width,
      height: variantMetadata.height || config.height,
      filesize: fileStats.size,
      source_url: '', // Will be populated by the calling service
    };
  } catch (error) {
    console.error(`Error generating variant ${config.name}:`, error.message);
    return null;
  }
}

export interface IVariantBuffer {
  name: string;
  fileName: string;
  buffer: Buffer;
  width: number;
  height: number;
  filesize: number;
}

/**
 * Generates all predefined image variants as in-memory buffers (no disk I/O).
 * Used for S3 uploads where files don't need to be written locally first.
 * Variants are encoded in `sourceFormat` to match the original.
 */
export async function generateImageVariantBuffers(
  imageBuffer: Buffer,
  baseName: string,
  sourceFormat: ImageFormat
): Promise<IVariantBuffer[]> {
  const originalMetadata = await sharp(imageBuffer).metadata();
  const originalWidth = originalMetadata.width || 0;
  const originalHeight = originalMetadata.height || 0;
  const ext = getExtForFormat(sourceFormat);

  const results = await Promise.allSettled(
    IMAGE_SIZE_CONFIGS.map(async (config) => {
      if (!shouldGenerateVariant(originalWidth, originalHeight, config.width, config.height)) {
        return null;
      }

      const buffer = await encodeWithFormat(
        sharp(imageBuffer).resize(config.width, config.height, {
          fit: config.fit,
          withoutEnlargement: true,
          position: 'center',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        }),
        sourceFormat,
        { quality: config.quality }
      ).toBuffer();

      const variantMetadata = await sharp(buffer).metadata();

      return {
        name: config.name,
        fileName: `${baseName}-${config.name}${ext}`,
        buffer,
        width: variantMetadata.width || config.width,
        height: variantMetadata.height || config.height,
        filesize: buffer.length,
      };
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<IVariantBuffer> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value);
}

/**
 * Generates all predefined image variants from an already-watermarked source
 * @param originalImagePath - Path to the original uploaded image (already watermarked)
 * @param sizesOutputDir - Directory where size variants will be stored
 * @param sourceFormat - Format to encode variants in (matches original)
 * @returns Array of successfully generated variant metadata
 */
export async function generateImageVariants(
  originalImagePath: string,
  sizesOutputDir: string,
  baseName: string,
  sourceFormat: ImageFormat
): Promise<ISizeVariantMetadata[]> {
  try {
    // Ensure the sizes directory exists
    ensureDirectoryPath(sizesOutputDir);

    // Get original image metadata for validation
    const originalMetadata = await sharp(originalImagePath).metadata();
    console.log(
      `Generating variants for image: ${path.basename(originalImagePath)} (${originalMetadata.width}x${originalMetadata.height})`
    );

    // Generate all variants in parallel (watermark already in source)
    const variantPromises = IMAGE_SIZE_CONFIGS.map((config) =>
      generateSingleVariant(originalImagePath, sizesOutputDir, config, baseName, sourceFormat)
    );

    const results = await Promise.allSettled(variantPromises);

    // Filter out null values and rejected promises
    const successfulVariants = results
      .filter(
        (result): result is PromiseFulfilledResult<ISizeVariantMetadata> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map((result) => result.value);

    console.log(
      `Successfully generated ${successfulVariants.length}/${IMAGE_SIZE_CONFIGS.length} variants`
    );

    return successfulVariants;
  } catch (error) {
    console.error('Error generating image variants:', error.message);
    throw error;
  }
}
