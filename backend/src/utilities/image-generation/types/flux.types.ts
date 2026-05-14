export interface FluxImageResponse {
  image: string; // base64 encoded image
}

export interface FluxDimensions {
  width: number;
  height: number;
}

export interface FluxAspectRatioMap {
  [key: string]: FluxDimensions;
}

export interface FluxApiResponse {
  data: Array<{
    b64_json: string;
  }>;
}

export interface ImageUploadData {
  _id: string;
  path: string;
  url: string;
  [key: string]: unknown;
}

export interface ImageGenerationResult {
  data: ImageUploadData;
  message: string;
  statusCode?: number;
  success?: boolean;
}

export const FLUX_ASPECT_RATIO_MAP: FluxAspectRatioMap = {
  '16:9': { width: 1536, height: 864 },
  '9:16': { width: 864, height: 1536 },
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1536, height: 1152 },
  '3:4': { width: 1152, height: 1536 },
};

export const FLUX_API_ENDPOINT =
  'https://d2cbot.services.ai.azure.com/providers/blackforestlabs/v1/flux-2-pro?api-version=preview';

export const FLUX_MODEL = 'flux.2-pro';
