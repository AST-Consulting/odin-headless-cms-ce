import { SeoDto } from '@core/dto/seo.dto';
import { Seo } from '@core/schema/seo.schema';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';

export class CreateStaticPageDto {
  @ApiPropertyOptional({
    description: 'Title of the static page',
    type: String,
    example: 'Laser Cutter Product Page',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Rank of the static page for sorting purposes',
    type: Number,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  rank?: number;

  @ApiProperty({
    description: 'SEO information for the page',
    type: Seo,
    example: {
      title: 'Laser Cutter 5000 - Industrial Grade',
      description: 'High precision laser cutter for industrial use.',
      keywords: ['laser', 'cutter', 'industrial', 'equipment'],
      og: {
        title: 'Laser Cutter 5000 - Industrial Grade',
        description: 'High precision laser cutter for industrial use.',
        url: 'https://example.com/laser-cutter-5000',
        image: 'https://example.com/laser-cutter-5000.jpg',
      },
    },
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto)
  seo?: SeoDto;

  @ApiPropertyOptional({
    description: 'Content of the static page, can be HTML or markdown',
    type: String,
    example: '<p>High precision laser cutter for industrial use.</p>',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Content of the static page, can be HTML or markdown',
    type: String,
    example: '<p>High precision laser cutter for industrial use.</p>',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Meta description for the page',
    type: String,
    example: 'High precision laser cutter for industrial applications.',
  })
  @IsString()
  @IsOptional()
  metaDescription?: string;

  @ApiPropertyOptional({
    description: 'Meta keywords for SEO',
    type: [String],
    example: ['laser', 'industrial', 'cutter', 'equipment'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metaKeywords?: string[];

  @ApiPropertyOptional({
    description: 'Indicates if the page is published',
    type: Boolean,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Tags associated with the page',
    type: [String],
    example: ['tagId1', 'tagId2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Categories associated with the page',
    type: [String],
    example: ['categoryId1', 'categoryId2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}
