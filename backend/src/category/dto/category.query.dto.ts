import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from 'src/core/dto/general.dto';

export class QueryCategoryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Status of the category',
    required: false,
    example: 'active',
  })
  @IsOptional()
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Title of the category',
    required: false,
    example: 'Technology',
  })
  @IsOptional()
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'public nature of category',
    required: false,
    example: 'false',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublic: boolean;

  @ApiPropertyOptional({
    description: 'Description of the category',
    required: false,
    example: 'All about technology and gadgets',
  })
  @IsOptional()
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Rank of the category for sorting purposes',
    example: 1,
  })
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  @IsOptional()
  @IsNumber()
  rank?: number;

  @ApiPropertyOptional({
    description: 'Slug of the category',
    required: false,
    example: 'technology',
  })
  @IsOptional()
  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Parent ID of the category',
    required: false,
    example: '60d21b4667d0d8992e610c85',
  })
  @IsOptional()
  @IsString()
  parentId: string;

  @ApiPropertyOptional({
    description: 'Filter categories created on or after this date',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gte'?: string;

  @ApiPropertyOptional({
    description: 'Filter categories created on or before this date',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lte'?: string;

  @ApiPropertyOptional({
    description: 'Filter categories created after this date',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gt'?: string;

  @ApiPropertyOptional({
    description: 'Filter categories created before this date',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lt'?: string;
}
