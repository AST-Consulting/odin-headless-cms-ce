import { IsString, IsDateString, IsNumber, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/core/dto/general.dto';

export class QueryAnalyticsDto extends PaginationQueryDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  'user.id'?: string;

  @IsOptional()
  @IsString()
  content_id: string;

  @IsOptional()
  @IsString()
  published_url: string;

  @IsOptional()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  content_type: string;

  @IsNumber()
  @IsOptional()
  impression?: number;

  @IsNumber()
  @IsOptional()
  views?: number;

  @IsOptional()
  @IsString()
  category_id: string;

  @IsOptional()
  @IsString()
  author_id: string;

  @IsOptional()
  @IsString()
  organization_id: string;

  @IsOptional()
  @IsString()
  property_id: string;

  @IsOptional()
  @IsString()
  propertyName: string;
}
