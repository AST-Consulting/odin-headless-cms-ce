/* eslint-disable @typescript-eslint/naming-convention */
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/core/dto/general.dto';
import { Transform } from 'class-transformer';

export class TagQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Name of the tag to filter by',
    required: false,
    example: 'Health',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Slug of the tag to filter by',
    required: false,
    example: 'health',
  })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Slug of the tag to filter by',
    required: false,
    example: 'health',
  })
  @IsString()
  @IsOptional()
  description?: string;

  // add tag status filter
  @ApiPropertyOptional({
    description: 'Status of the tag to filter by',
    required: false,
    example: 'active',
  })
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Rank of the tag to filter by',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  rank?: number;

  @ApiPropertyOptional({
    description: 'ID of the tag to filter by',
    required: false,
    example: 'tagId1',
  })
  @IsString()
  @IsOptional()
  _id?: string;

  @ApiPropertyOptional({
    description: 'Filter departments created on or after this date',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gte'?: string;

  @ApiPropertyOptional({
    description: 'Filter departments created on or before this date',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lte'?: string;

  @ApiPropertyOptional({
    description: 'Filter departments created after this date',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gt'?: string;

  @ApiPropertyOptional({
    description: 'Filter departments created before this date',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lt'?: string;

  @ApiPropertyOptional({
    description: 'Filter departments updated on or after this date',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'updatedAt.gte'?: string;

  @ApiPropertyOptional({
    description: 'Filter departments updated on or before this date',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'updatedAt.lte'?: string;

  @ApiPropertyOptional({
    description: 'Filter departments updated after this date',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'updatedAt.gt'?: string;

  @ApiPropertyOptional({
    description: 'Filter departments updated before this date',
    required: false,
    example: '2023-12-31T23:59:59Z',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'updatedAt.lt'?: string;
}
