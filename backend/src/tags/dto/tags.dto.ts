import { STATUS } from '@core/constants/enums.constants';
import { PartialType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SeoDto } from '@core/dto/seo.dto';
import { Type } from 'class-transformer';

export class TagDto {
  @ApiProperty({
    description: 'Name of the tag',
    required: true,
    example: 'Health',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Rank of the tag',
    required: true,
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  rank: number;

  @ApiProperty({
    description: 'SEO metadata for the department',
    type: () => SeoDto,
    required: false,
    example: {
      title: 'Laser Cutter 5000 - Industrial Grade',
      metaDescription: 'High precision laser cutter for industrial use.',
      keywords: ['laser', 'cutter', 'industrial', 'equipment'],
      og: {
        title: 'Laser Cutter 5000 - Industrial Grade',
        description: 'High precision laser cutter for industrial use.',
        url: 'https://example.com/laser-cutter-5000',
        image: 'https://example.com/laser-cutter-5000.jpg',
      },
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto)
  @IsObject()
  seo: SeoDto;

  @ApiPropertyOptional({
    description: 'Status of the tag',
    enum: STATUS,
    example: STATUS.ACTIVE,
  })
  @IsOptional()
  @IsEnum(STATUS)
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Meta description for the tag',
    required: true,
    example: 'This tag is related to health topics.',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Property ID associated with the tag',
    required: true,
    example: 'propertyId1',
  })
  @IsNotEmpty()
  @IsString()
  propertyId: string;

  @ApiPropertyOptional({
    description: 'Link of the tag',
    required: false,
    example: 'https://example.com/health',
  })
  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsNumber()
  count: number;

  @IsOptional()
  @IsNumber()
  wpTagId: number;
}

export class UpdateTagDto extends PartialType(TagDto) {}

export class UpdateTagRank {
  @ApiProperty({
    description: 'ID of the tag',
    required: true,
    example: 'tagId1',
  })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({
    description: 'New rank of the tag',
    required: true,
    example: 2,
  })
  @IsNotEmpty()
  @IsNumber()
  rank: number;
}
