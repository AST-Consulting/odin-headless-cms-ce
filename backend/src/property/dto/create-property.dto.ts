import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  ValidateNested,
  IsOptional,
  IsBoolean,
  IsArray,
  Validate,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ARTICLE_TYPE, PUBLISH_TYPE, STATUS } from 'src/core/constants/enums.constants';
import { IsTimeZoneConstraint } from '../schema/property.schema';

class CredentialDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class TargetAudienceDto {
  @IsString()
  @IsOptional()
  demographics: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  countries: string[];

  @IsString()
  @IsOptional()
  summary: string;
}

class PostignEmailDto {
  @IsString()
  email: string;

  @IsBoolean()
  @IsOptional()
  verified: boolean;
}

class UrlPatternsDto {
  @IsString()
  @IsOptional()
  tag?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  page?: string;
}

class ContactDetailsDto {
  @IsString()
  @IsOptional()
  primary_phone?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

class SocialLinksDto {
  @IsString()
  @IsOptional()
  facebook?: string;

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  youtube?: string;

  @IsString()
  @IsOptional()
  wikipedia?: string;

  @IsString()
  @IsOptional()
  linkedin?: string;
}

class SeoDataDto {
  @IsString()
  @IsOptional()
  meta_title?: string;

  @IsString()
  @IsOptional()
  meta_description?: string;
}

export class PropertyDto {
  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostignEmailDto)
  @IsOptional()
  postignEmail?: PostignEmailDto[];

  @IsString()
  @IsNotEmpty()
  industry: string;

  @IsString()
  @IsOptional()
  @IsEnum(STATUS)
  status: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(ARTICLE_TYPE)
  articleType?: string;

  @IsString()
  @IsOptional()
  about?: string;

  @IsString()
  @IsOptional()
  websiteType?: string;

  @IsString()
  @IsOptional()
  @IsEnum(PUBLISH_TYPE)
  publish_type?: string;

  // Google Search Console Configuration
  @IsString()
  @IsOptional()
  googleSearchConsoleUrl?: string;

  @IsBoolean()
  @IsOptional()
  isGoogleSearchConsoleActive?: boolean;

  // Google Analytics Configuration
  @IsString()
  @IsOptional()
  googleAnalyticsPropertyId?: string[];

  @IsBoolean()
  @IsOptional()
  isGoogleAnalyticsActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blogThemes?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  featuresAndBenefits?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetAudience?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  audienceChallenges?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  productUses?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  internalLinks?: { heading?: string; url?: string }[];

  @IsString()
  @IsOptional()
  specialInstruction?: string;

  @IsNumber()
  @IsOptional()
  imageWidth?: number;

  @IsNumber()
  @IsOptional()
  imageHeight?: number;

  @IsOptional()
  @IsString()
  @Validate(IsTimeZoneConstraint)
  timeZone?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UrlPatternsDto)
  urlPatterns?: UrlPatternsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ContactDetailsDto)
  contact_details?: ContactDetailsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  social_links?: SocialLinksDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SeoDataDto)
  seo_data?: SeoDataDto;
}
