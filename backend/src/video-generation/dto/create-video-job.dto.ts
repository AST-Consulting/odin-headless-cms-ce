import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

class VideoJobMediaAssetDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsIn(['image', 'video'])
  assetType?: 'image' | 'video';

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  durationSec?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsNumber()
  duration?: number;
}

export class CreateVideoJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30000)
  content: string;

  @IsOptional()
  @IsString()
  articleId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoJobMediaAssetDto)
  mediaAssets?: VideoJobMediaAssetDto[];

  @IsOptional()
  @IsString()
  uploadedVideoUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  durationSec?: number;
}
