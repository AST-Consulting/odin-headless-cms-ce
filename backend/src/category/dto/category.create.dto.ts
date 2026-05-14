import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { STATUS } from 'src/core/constants/enums.constants';
import { SeoDto } from 'src/core/dto/seo.dto';
import { FileSubDto } from '@utilities/file-upload/dto/file-sub.dto';
import { IsObject } from 'class-validator';

export class CreateCategoryDTO {
  @ApiProperty({
    description: 'Title of the category',
    required: true,
    example: 'Health',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'public nature of category',
    required: false,
    example: 'false',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublic: boolean;

  @ApiPropertyOptional({
    description: 'Title of the category in Hindi',
    example: 'स्वास्थ्य',
  })
  @IsOptional()
  @IsString()
  titleHn?: string;

  @ApiPropertyOptional({
    description: 'Description of the category (HTML)',
    example: '<p>Category related to <strong>health</strong> topics.</p>',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Parent ID of the category, if any',
    example: '1234567890abcdef',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({
    description: 'Status of the category',
    required: true,
    enum: STATUS,
    example: STATUS.ACTIVE,
  })
  @IsEnum(STATUS)
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional({
    description: 'Whether the category is featured',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'External link related to the category',
    example: 'https://example.com',
  })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({
    description: 'Rank of the category for sorting purposes',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  rank?: number;

  @ApiProperty({
    description: 'SEO metadata for the category',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto) // Important for transforming and validating the nested object
  seo?: SeoDto;

  @ApiPropertyOptional({
    description: 'WordPress category ID for imported categories',
    example: 1048,
  })
  @IsOptional()
  @IsNumber()
  wpCategoryId?: number;

  @ApiPropertyOptional({
    description: 'WordPress category count for imported categories',
    example: 1048,
  })
  @IsOptional()
  @IsNumber()
  count?: number;

  @ApiPropertyOptional({
    description: 'Slug of the category',
    example: 'health',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Full slug of the category',
    example: 'health',
  })
  @IsOptional()
  @IsString()
  fullSlug?: string;

  @ApiPropertyOptional({
    description: 'Icon image for the category',
    type: FileSubDto,
  })
  @IsOptional()
  @IsObject()
  icon?: FileSubDto;
}
