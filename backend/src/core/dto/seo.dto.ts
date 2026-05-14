import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';

export class OgDto {
  @ApiProperty({
    description: 'Title for Open Graph metadata',
    example: 'Advanced Skin Treatment',
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiProperty({
    description: 'Description for Open Graph metadata',
    example: 'Discover our advanced skin treatment to rejuvenate your skin.',
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({
    description: 'URL for Open Graph metadata',
    example: 'https://example.com/skin-treatment',
  })
  @IsOptional()
  @IsString()
  url: string;

  @ApiPropertyOptional({
    description: 'Image URL for Open Graph metadata',
    example: 'https://example.com/images/skin-treatment.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;
}

export class SeoDto {
  @ApiProperty({
    description: 'Title for SEO',
    example: 'Best Advanced Skin Treatment - Glow Clinic',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Meta description for SEO',
    example:
      'Explore the benefits of our advanced skin treatments designed to rejuvenate and improve skin health at Glow Clinic.',
  })
  @IsString()
  @IsOptional()
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'Keywords for SEO',
    example: ['skin treatment', 'advanced skin care', 'Glow Clinic', 'rejuvenation'],
  })
  @IsOptional()
  @IsArray()
  keywords?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OgDto)
  og?: OgDto;
}
