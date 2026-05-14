/* eslint-disable @typescript-eslint/naming-convention */
import { Expose, plainToClass, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FileSubDto } from '@utilities/file-upload/dto/file-sub.dto';
import { PaginationQueryDto } from '@core/dto/general.dto';
import { CONTENT_TYPE, STATUS } from '@core/constants/enums.constants';
import { SeoDto } from '@core/dto/seo.dto';
import { FileSub } from '@utilities/file-upload/entities/file-sub.schema';

/////// Everything related to content Priority below

export const contentPriorityDtoKeys = [
  'id',
  'title',
  'slug',
  'url',
  'contentType',
  'contentRank',
  'author',
  'media',
  'testimonialText',
  'headline',
  'lastPublishedAt',
  'featureImage',
  'subheadline',
  'awardName',
  'details',
  'year',
  'image',
  'images',
  'name',
  'icon',
  'user',
  'location',
  'startDate',
  'endDate',
  'eventStartDate',
  'eventEndDate',
  'revealDate',
  'videoURL',
  'treatment',
  'patient',
  'externalLink',
  'primaryCategory',
  'categories',
  'type',
  'authors',
];

export class CategoryDto {
  @ApiProperty({ example: '64fce42d5c1111efb8d4567' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'News' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'news' })
  @IsString()
  @IsOptional()
  slug?: string;
}

export class Author {
  @ApiProperty({
    description: 'ID of the author',
    example: '64fce42d5c1111efb8d4567',
    required: true,
  })
  id: string;

  @ApiProperty({
    description: 'Name of the author',
    example: 'John Doe',
    required: true,
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Slug of the author',
    example: 'john-doe',
  })
  @IsOptional()
  @IsString()
  slug?: string;
}
export class CreateContentPriorityDto {
  @ApiProperty({
    description: 'Type of the content (e.g., doctor, department, service)',
    example: 'testimonial',
    required: true, // Explicitly required
  })
  @IsString()
  // @IsNotEmpty()
  // @IsIn(Object.values(CONTENT_TYPE), {
  //   message: `contentType must be one of: ${Object.values(CONTENT_TYPE).join(', ')}`,
  // })
  contentType: string;

  @ApiProperty({
    description: 'Array of content IDs in priority order',
    example: ['64fce42d5c1111efb8d4567', '64fce42d5c1111efb8d1234'],
    required: true, // Explicitly required
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'ids must be a non-empty array' })
  @IsString({ each: true })
  ids: string[];

  @ApiPropertyOptional({
    description: 'Unique ID of the section where content is prioritized',
    example: '64fce42d5c1111efb8d7890',
    required: false, // Explicitly optional
  })
  @IsString()
  sectionId?: string; // Marked optional in the TypeScript definition


  @ApiPropertyOptional({
    description: 'Property ID for backfilling section property data',
    example: '64fce42d5c1111efb8d7890',
    required: false,
  })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Organization ID for backfilling section organization data',
    example: '64fce42d5c1111efb8d7891',
    required: false,
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class ContentPriorityDto {
  // update keys array if this is updated
  @ApiProperty({
    description: 'Unique ID of the content',
    example: '64fce42d5c1111efb8d4567',
  })
  @IsNotEmpty()
  @IsString()
  @Expose()
  id: string; // Linked content's ID

  @ApiProperty({
    description: 'Title of the content',
    example: 'Cardiology Department Overview',
  })
  @Expose()
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Slug of the content',
    example: 'cardiology-department',
  })
  @IsNotEmpty()
  @IsString()
  @Expose()
  slug: string;

  @ApiPropertyOptional({
    description: 'URL to the content',
    example: 'https://hospital.com/cardiology-department',
  })
  @IsOptional()
  @IsString()
  @Expose()
  url?: string;

  @ApiPropertyOptional({
    description: 'Type of the content (e.g., department, doctor, service)',
    example: 'department',
  })
  @IsOptional()
  @IsString()
  @Expose()
  contentType?: string;

  @ApiPropertyOptional({
    description: 'Priority or rank of the content',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Expose()
  contentRank: number;

  // New fields that were missing exposure and validation

  @ApiPropertyOptional({
    description: 'Author of the content',
    example: { name: 'Dr. Smith', title: 'Cardiologist' },
  })
  @IsOptional()
  @Expose()
  author?: Author; // Assuming Author is a valid class or interface

  @ApiPropertyOptional({
    description: 'Media associated with the content',
    example: [{ fileUrl: 'https://example.com/file.jpg' }],
  })
  @IsOptional()
  @Expose()
  media?: FileSub[]; // Assuming FileSub is a valid class or interface

  @ApiPropertyOptional({
    description: 'Testimonial text, if applicable',
    example: 'This department saved my life.',
  })
  @IsOptional()
  @IsString()
  @Expose()
  testimonialText?: string;

  @ApiPropertyOptional({
    description: 'Headline associated with the content',
    example: 'Heart Surgery Saves Lives',
  })
  @IsOptional()
  @IsString()
  @Expose()
  headline?: string;

  @ApiPropertyOptional({
    description: 'external link associated with the content',
    example: 'https://example.com/external-link',
  })
  @IsOptional()
  @IsString()
  @Expose()
  externalLink?: string;

  @ApiPropertyOptional({
    description: 'Last published date of the content',
    example: '2024-12-05T10:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @Expose()
  lastPublishedAt?: Date;

  @ApiPropertyOptional({
    description: 'User associated with the content',
  })
  @IsOptional()
  @Expose()
  user?: any;

  @ApiPropertyOptional({
    description: 'Start date of the content',
  })
  @IsOptional()
  @Type(() => Date)
  @Expose()
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'End date of the content',
  })
  @IsOptional()
  @Type(() => Date)
  @Expose()
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Event start date',
  })
  @IsOptional()
  @Type(() => Date)
  @Expose()
  eventStartDate?: Date;

  @ApiPropertyOptional({
    description: 'Event end date',
  })
  @IsOptional()
  @Type(() => Date)
  @Expose()
  eventEndDate?: Date;

  @ApiPropertyOptional({
    description: 'Reveal date',
  })
  @IsOptional()
  @Type(() => Date)
  @Expose()
  revealDate?: Date;

  @ApiPropertyOptional({
    description: 'Feature image of the content',
    example: { fileUrl: 'https://example.com/feature-image.jpg' },
  })
  @IsOptional()
  @Expose()
  featureImage?: FileSub;

  @ApiPropertyOptional({
    description: 'Primary category of the content',
    type: CategoryDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryDto)
  @Expose()
  primaryCategory?: CategoryDto;

  @ApiPropertyOptional({
    description: 'List of categories for the content',
    type: [CategoryDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  @Expose()
  categories?: CategoryDto[];
}
export class CreateSectionDto {
  @ApiProperty({
    description: 'Title of the section',
    example: 'Featured Departments',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Title in Hindi (if applicable)',
    example: 'विशिष्ट विभाग',
  })
  @IsOptional()
  @IsString()
  titleHindi?: string;

  @ApiProperty({
    description: 'Unique slug for the section',
    example: 'featured-departments',
  })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    description: 'Description of the section',
    example: 'Showcasing our top medical departments and services',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Status of the section',
    enum: ['active', 'inactive'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @ApiPropertyOptional({
    description: 'External link for the section',
    example: 'https://hospital.com/featured-departments',
  })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({
    description: 'Widget code for the section',
    example: '<div class="widget">...</div>',
  })
  @IsOptional()
  @IsString()
  widgetCode?: string;

  @ApiPropertyOptional({
    description: 'Display type of the section',
    example: 'grid',
  })
  @IsOptional()
  @IsString()
  displayType?: string;


  @ApiPropertyOptional({
    description: 'Image information for the section',
    type: FileSubDto,
  })
  @IsOptional()
  @Type(() => Object)
  image?: FileSubDto;

  @ApiPropertyOptional({
    description: 'Category tags for the section',
    example: ['cardiology', 'neurology'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @ApiPropertyOptional({
    description: 'URLs for different section types',
    example: ['https://hospital.com/cardiology', 'https://hospital.com/neurology'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionUrls?: string[];

  @ApiPropertyOptional({
    description: 'Service type of the section',
    example: 'critical care',
  })
  @IsOptional()
  @IsString()
  storyType?: string;

  @ApiProperty({
    description: 'SEO information for the section',
    type: SeoDto,
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SeoDto)
  seo: SeoDto;

  @ApiProperty({
    description: 'Start date of the section',
    example: '2024-11-01T00:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate: Date;

  @ApiPropertyOptional({
    description: 'End date of the section',
    example: '2024-12-01T00:00:00Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Rank of the section',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  rank?: number;

  @ApiPropertyOptional({
    description: 'Number of items in the section',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  count?: number;

  @IsNotEmpty()
  @IsString()
  propertyId?: string;

  @ApiProperty({
    description: 'Content priority list for the section',
    type: [ContentPriorityDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ContentPriorityDto)
  contentPriority: ContentPriorityDto[];

  @ApiPropertyOptional({
    description: 'Enable periodic update of articles from categories',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enablePeriodicUpdate?: boolean;

  @ApiPropertyOptional({
    description: 'Array of article IDs that should remain fixed during periodic updates',
    example: ['64fce42d5c1111efb8d4567', '64fce42d5c1111efb8d1234'],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fixedArticleIds?: string[];
}

export class UpdateSectionDto extends PartialType(CreateSectionDto) { }

export class QuerySectionDto extends PartialType(PaginationQueryDto) {
  @ApiPropertyOptional({
    name: 'id',
    description: 'Unique identifier of the section',
    example: '',
  })
  @IsOptional()
  @IsString()
  _id: string;

  @ApiPropertyOptional({
    name: 'slug',
    description: 'Unique slug of the section',
    example: '',
  })
  @IsOptional()
  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    name: 'rank',
    description: 'Rank of the section',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  rank: number;

  @ApiPropertyOptional({
    name: 'createdAt.gte',
    description: 'Created At date filter - greater than or equal to',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.gte'?: string;

  @ApiPropertyOptional({
    name: 'createdAt.lte',
    description: 'Created At date filter - lower than or equal to',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.lte'?: string;

  @ApiPropertyOptional({
    name: 'createdAt.gt',
    description: 'Created At date filter - greater than',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.gt'?: string;

  @ApiPropertyOptional({
    name: 'createdAt.lt',
    description: 'Created At date filter - lower than',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.lt'?: string;

  @ApiPropertyOptional({
    name: 'status',
    description: 'Status of the section',
    example: STATUS.ACTIVE,
    enum: STATUS,
  })
  @IsOptional()
  @IsEnum(STATUS)
  status?: string;

  @ApiPropertyOptional({
    name: 'title',
    description: 'Title of the section',
    example: 'Featured Products',
  })
  @IsOptional()
  @IsString()
  title?: string;


  @ApiPropertyOptional({
    name: 'displayType',
    description: 'display type of the section',
    example: 'priority based',
  })
  @IsOptional()
  @IsString()
  displayType?: string;

  @ApiPropertyOptional({
    name: 'count',
    description: 'Number of items in the section',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  count?: number;
}
