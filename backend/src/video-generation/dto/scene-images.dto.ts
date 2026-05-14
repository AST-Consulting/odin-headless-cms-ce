import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class SceneImagesDto {
  @IsString()
  @MaxLength(300)
  query: string;

  @IsOptional()
  @IsArray()
  fallbackQueries?: string[];

  @IsOptional()
  @IsIn(['landscape', 'portrait', 'square'])
  orientation?: 'landscape' | 'portrait' | 'square';

  @IsOptional()
  @IsNumber()
  perPage?: number;

  @IsOptional()
  @IsBoolean()
  returnAll?: boolean;

  @IsOptional()
  @IsIn(['auto', 'pexels', 'google', 'media-gallery'])
  imageProvider?: 'auto' | 'pexels' | 'google' | 'media-gallery';

  @IsOptional()
  @IsBoolean()
  includeVideos?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  propertyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  contextTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contextCategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @IsNumber()
  page?: number;
}
