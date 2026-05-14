import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/core/dto/general.dto';

export class FileUploadQueryDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @Transform(({ value }) => (value === 'true' ? true : false))
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  // Set to true when re-uploading an already-watermarked image (e.g. after crop,
  // AI generation) to prevent a second watermark being stamped on top.
  @Transform(({ value }) => (value === 'true' ? true : false))
  @IsBoolean()
  @IsOptional()
  skipWatermark?: boolean;

  // Target aspect ratio (e.g. "16:9", "9:16"). When set, the server pads the
  // image to this ratio with a blurred copy of itself before watermarking.
  @IsString()
  @IsOptional()
  fitAspect?: string;

  @IsString()
  @IsOptional()
  strategy?: string;

  @IsString()
  @IsOptional()
  service?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  caption?: string;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  'createdAt.gte'?: string;

  @IsString()
  @IsOptional()
  'createdAt.lte'?: string;
  @IsString()
  @IsOptional()
  orientation?: 'landscape' | 'portrait';
}
