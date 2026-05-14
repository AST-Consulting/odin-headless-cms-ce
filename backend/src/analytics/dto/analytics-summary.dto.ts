import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class AnalyticsSummaryQueryDto {
  @IsOptional()
  @IsString()
  property_id?: string;

  @IsOptional()
  @IsString()
  author_id?: string;

  // Single day filter (UTC date string). If provided, start/end range will be ignored.
  @IsOptional()
  @IsDateString()
  date?: string;

  // Date range (UTC date strings). Inclusive of both ends at day granularity.
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // Optional breakdown grouping
  @IsOptional()
  @IsIn(['date', 'property_id', 'author_id'])
  groupBy?: 'date' | 'property_id' | 'author_id';
}
