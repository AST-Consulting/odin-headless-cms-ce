import { IsNotEmpty, IsString, IsOptional, IsIn, IsBoolean, IsArray, ArrayMaxSize } from 'class-validator';
import { TEMPLATE_KEYS } from '../templates/image-templates';

export class GenerateImageDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsOptional()
  @IsIn(['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'])
  aspectRatio?: string;

  @IsString()
  @IsOptional()
  @IsIn(TEMPLATE_KEYS)
  template?: string;

  @IsBoolean()
  @IsOptional()
  isInfographic?: boolean;

  @IsString()
  @IsOptional()
  propertyId?: string;

  // Optional context used to make the stored media record searchable in the
  // library. The article's English headline usually works best as title; tags
  // get appended to the caption so topic searches surface the image.
  @IsString()
  @IsOptional()
  title?: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}
