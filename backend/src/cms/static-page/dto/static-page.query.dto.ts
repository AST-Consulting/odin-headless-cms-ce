import { PaginationQueryDto } from '@core/dto/general.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryStaticPageDto extends PaginationQueryDto {
  @ApiProperty({
    required: false,
    description: 'The unique identifier of the static page.',
    example: '60c72b2f9b1e8a001c8e4e4f',
  })
  @IsOptional()
  @IsString()
  _id: string;

  @ApiProperty({
    required: false,
    description: 'The title of the static page.',
    example: 'About Us',
  })
  @IsOptional()
  @IsString()
  title: string;

  @ApiProperty({
    required: false,
    description: 'The slug for the static page, used in the URL.',
    example: 'about-us',
  })
  @IsOptional()
  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiProperty({
    required: false,
    description: 'Indicates whether the static page is published.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({
    required: false,
    description: 'The status of the static page.',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    required: false,
    description: 'The ID of the tag associated with the static page.',
    example: '60c72b2f9b1e8a001c8e4e4a',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'tags.id'?: string;

  @ApiProperty({
    required: false,
    description: 'The ID of the category associated with the static page.',
    example: '60c72b2f9b1e8a001c8e4e4b',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'categories.id'?: string;

  @ApiProperty({
    required: false,
    description: 'The start date for createdAt filter in ISO format.',
    example: '2022-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gte'?: string;

  @ApiProperty({
    required: false,
    description: 'The end date for createdAt filter in ISO format.',
    example: '2022-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lte'?: string;

  @ApiProperty({
    required: false,
    description: 'The greater than filter for createdAt date in ISO format.',
    example: '2022-06-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gt'?: string;

  @ApiProperty({
    required: false,
    description: 'The less than filter for createdAt date in ISO format.',
    example: '2022-06-30T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lt'?: string;
}
