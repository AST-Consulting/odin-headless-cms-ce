/**
 * Image Size Configuration
 * Defines all predefined size variants to be generated during image upload
 */

export interface ISizeConfig {
  name: string;
  width: number;
  height: number;
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality: number;
}

export interface ISizeVariantMetadata {
  name: string;
  file: string;
  path: string;
  width: number;
  height: number;
  filesize: number;
  source_url: string;
}

export const IMAGE_SIZE_CONFIGS: ISizeConfig[] = [
  // Logo banner (600x400 — 3:2)
  { name: 'logo', width: 600, height: 400, fit: 'contain', quality: 95 },

  // Thumbnail (192x128 — 3:2)
  { name: 'thumbnail', width: 192, height: 128, fit: 'contain', quality: 92 },

  // Medium (512x341 — 3:2)
  { name: 'medium', width: 512, height: 341, fit: 'contain', quality: 92 },

  // Large (1200x800 — 3:2)
  { name: 'large', width: 1200, height: 800, fit: 'contain', quality: 90 },
];
