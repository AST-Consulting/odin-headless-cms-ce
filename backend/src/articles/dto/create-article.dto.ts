import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class AuthorStubDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;
}

class RichBlockDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  content?: any;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  order?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

class SeoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  canonical?: string;

  @IsOptional()
  schema?: any;
}

export class CreateArticleDto {
  @IsString()
  // @IsNotEmpty()
  @IsOptional()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['article', 'liveblog', 'explainer', 'photo_story', 'video', 'opinion', 'post', 'recipe', 'movie_review'])
  type: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['draft', 'review', 'scheduled', 'published', 'archived'])
  status: string;

  @IsString()
  @IsNotEmpty()
  lang: string;

  @IsString()
  @IsOptional()
  title: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  englishHeadline?: string;

  @IsOptional()
  @IsString()
  dek?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject()
  webStoryData?: any;

  @IsOptional()
  @IsObject()
  recipeData?: any;

  @IsOptional()
  @IsObject()
  movieReviewData?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichBlockDto)
  richBlocks?: RichBlockDto[];

  @IsOptional()
  @IsArray()
  images?: any[];

  @IsOptional()
  @IsArray()
  videos?: any[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuthorStubDto)
  authors?: AuthorStubDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  beats?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: any[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SeoDto)
  seo?: SeoDto;

  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  @IsOptional()
  currentArticleId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: any[];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  coverageStartTime?: string;

  @IsOptional()
  @IsDateString()
  coverageEndTime?: string;

  @IsOptional()
  @IsBoolean()
  isSponsored?: boolean;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  featuredMedia?: any;

  @IsOptional()
  featuredVideo?: any;

  @IsOptional()
  excerpt?: string;

  @IsOptional()
  primaryCategory?: any;

  @IsOptional()
  @IsBoolean()
  preserveUpdatedAt?: boolean;
}
