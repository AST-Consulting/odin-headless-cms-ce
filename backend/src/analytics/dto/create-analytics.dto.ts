import { IsString, IsNumber, IsDateString, IsOptional } from 'class-validator';

export class CreateAnalyticsDto {
  @IsString()
  id: string;

  @IsString()
  content_id: string;

  @IsString()
  published_url: string;

  @IsDateString()
  date: string;

  @IsString()
  content_type: string;

  @IsNumber()
  @IsOptional()
  impression?: number;

  @IsNumber()
  @IsOptional()
  views?: number;

  @IsString()
  category_id: string;

  @IsString()
  author_id: string;

  @IsString()
  organization_id: string;

  @IsString()
  property_id: string;
}
