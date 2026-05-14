import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ShareRawTwitterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;

  @IsString()
  @IsNotEmpty()
  propertyId: string;
}

const FORMAT_KEYS = [
  'webStory',
  'instagramCarousel',
  'whatsappCard',
  'pushNotifications',
  'newsletter',
  'twitterThread',
];

const IMAGE_FORMAT_KEYS = [
  'webStory',
  'instagramCarousel',
  'whatsapp',
  'twitterHero',
];

export class RepurposeConfigDto {
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  instaSlideCount?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  webStorySlideCount?: number;

  @IsOptional()
  @IsBoolean()
  mirrorInstaToWebstory?: boolean;
}

export class RepurposeArticleDto {
  @IsString()
  @IsOptional()
  language?: string;

  @IsArray()
  @IsOptional()
  @IsIn(FORMAT_KEYS, { each: true })
  formats?: string[];

  @IsBoolean()
  @IsOptional()
  forceRegenerate?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RepurposeConfigDto)
  config?: RepurposeConfigDto;
}

export class RegenerateRepurposeDto {
  @IsString()
  @IsIn(FORMAT_KEYS)
  format: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RepurposeConfigDto)
  config?: RepurposeConfigDto;
}

export class GenerateSlotImageDto {
  @IsString()
  @IsIn(IMAGE_FORMAT_KEYS)
  format: 'webStory' | 'instagramCarousel' | 'whatsapp' | 'twitterHero';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  index: number;

  @IsOptional()
  @IsString()
  @IsIn(['generated', 'featured'])
  source?: 'generated' | 'featured';
}

export class ListRepurposeJobsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class UpdateRepurposeOutputsDto {
  @IsNotEmpty()
  @IsObject()
  outputs: any;
}
