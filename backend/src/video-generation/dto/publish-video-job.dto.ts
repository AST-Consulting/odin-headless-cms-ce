import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class PublishedVideoDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  path: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsString()
  duration?: string;
}

export class PublishVideoJobDto {
  @IsString()
  @IsNotEmpty()
  articleId: string;

  @IsOptional()
  @IsString()
  articleSlug?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PublishedVideoDto)
  uploadedVideo?: PublishedVideoDto;
}
