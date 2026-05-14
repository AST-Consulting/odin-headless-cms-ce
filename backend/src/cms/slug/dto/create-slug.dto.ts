import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SeoDto } from '@core/dto/seo.dto';
import { Type } from 'class-transformer';
import { IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { STATUS } from '@core/constants/enums.constants';

export class CreateSlugDto {
  @ApiProperty({
    description: 'Slug for the URL',
    example: 'my-page-slug',
  })
  @IsString()
  slug: string;

  @ApiProperty({
    description: 'Type of the slug (e.g., page, article)',
    example: 'page',
  })
  @IsString()
  type: string;

  @IsString()
  propertyId: string;

  @ApiPropertyOptional({
    description: 'SEO data for the slug',
    type: SeoDto,
  })
  @ValidateNested()
  @Type(() => SeoDto)
  @IsObject()
  @IsOptional()
  seo?: SeoDto;

  @ApiPropertyOptional({
    description: 'Full slug path if needed',
    example: '/parent/my-page-slug',
  })
  @IsString()
  @IsOptional()
  fullSlug?: string;

  @ApiPropertyOptional({
    description: 'Status of the slug (e.g., active, inactive)',
    example: 'active',
  })
  @IsEnum(STATUS)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'URL to redirect to if this slug is used',
    example: 'https://example.com/redirect',
  })
  @IsOptional()
  @IsString()
  redirectTo?: string;

  @ApiPropertyOptional({
    description: 'HTTP status code for the redirect',
    example: '301',
  })
  @IsOptional()
  @IsString()
  redirectCode?: string;

  @ApiPropertyOptional({
    description: 'Canonical URL for SEO purposes',
    example: 'https://example.com/original-page',
  })
  @IsOptional()
  @IsString()
  canonicalUrl?: string;
}
