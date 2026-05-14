import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PRINT_MIGRATION_QUEUE = 'print-article-migration';

export class PrintArticleAuthorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  slug?: string;
}

export class PrintArticleSeoDto {
  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsArray()
  @IsOptional()
  metaKeywords?: string[];
}

export class CreatePrintArticleDto {
  @IsString()
  @IsNotEmpty()
  id: string; // Source print story ID — used for tracing/dedup

  @IsString()
  @IsNotEmpty()
  headline: string;

  @IsString()
  @IsOptional()
  subHeadline?: string;

  @IsString()
  @IsNotEmpty()
  content: string; // Raw HTML — converted to rich blocks in the processor

  @IsString()
  @IsOptional()
  slug?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[]; // Category names — resolved to IDs in processor

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[]; // Tag names — found or created in processor

  @IsDateString()
  pubDate: string;

  @IsString()
  @IsOptional()
  heroImageUrl?: string;

  @IsString()
  @IsOptional()
  heroImageId?: string;

  @IsString()
  @IsOptional()
  heroImageCaption?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintArticleAuthorDto)
  @IsOptional()
  authors?: PrintArticleAuthorDto[];

  @ValidateNested()
  @Type(() => PrintArticleSeoDto)
  @IsOptional()
  seo?: PrintArticleSeoDto;

  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  @IsOptional()
  lang?: string;
}
