import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';
import { PaginationQueryDto } from 'src/core/dto/general.dto';

export class QueryArticleDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  'user.id'?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  categories?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  groupBy?: string; // 'propertyId', 'organization', etc.

  @IsOptional()
  @IsDateString()
  dateFrom?: string; // Format: YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  dateTo?: string; // Format: YYYY-MM-DD

  @ApiPropertyOptional({
    name: 'createdAt.gte',
    description: 'Created At date filter - greater than or equal to',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.gte'?: string;

  @ApiPropertyOptional({
    name: 'primaryCategory.id',
    description: 'Category ID filter',
    example: 'category123',
  })
  @IsOptional()
  @IsString()
  'primaryCategory.id'?: string;

  @ApiPropertyOptional({
    name: 'createdAt.lte',
    description: 'Created At date filter - lower than or equal to',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.lte'?: string;

  @ApiPropertyOptional({
    name: 'live_limit',
    description: 'Limit for live blog articles',
    example: '5',
  })
  @IsOptional()
  @IsString()
  live_limit?: string;

  @ApiPropertyOptional({
    name: 'live_page',
    description: 'Page number for live blog articles',
    example: '1',
  })
  @IsOptional()
  @IsString()
  live_page?: string;

  @IsOptional()
  @IsString()
  'metricsLatest.position.gte'?: string;

  @IsOptional()
  @IsString()
  'metricsLatest.position.lte'?: string;

  @IsOptional()
  @IsString()
  'metricsLatest.ctr.gte'?: string;

  @IsOptional()
  @IsString()
  'metricsLatest.ctr.lte'?: string;

  @IsOptional()
  @IsString()
  featuredVideo?: string;
}
