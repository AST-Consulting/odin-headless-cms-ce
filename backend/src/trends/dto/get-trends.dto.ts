import { IsString, IsOptional, IsEnum, IsBooleanString } from 'class-validator';

export enum TrendsDataType {
  TIMESERIES = 'TIMESERIES',
  GEO_MAP = 'GEO_MAP',
  RELATED_TOPICS = 'RELATED_TOPICS',
  RELATED_QUERIES = 'RELATED_QUERIES',
}

export class GetTrendsDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsEnum(TrendsDataType)
  data_type?: TrendsDataType;

  @IsOptional()
  @IsString()
  geo?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  hl?: string;

  @IsOptional()
  @IsBooleanString()
  refresh?: string;
}

export class GetTrendingSearchesDto {
  @IsOptional()
  @IsString()
  geo?: string; // Country code (US, IN, GB, etc.)

  @IsOptional()
  @IsString()
  hl?: string; // Language (en, hi, es, etc.)

  @IsOptional()
  @IsBooleanString()
  refresh?: string;

  @IsOptional()
  @IsString()
  source?: string; // 'live' (RSS) or 'today' (SerpAPI)
}
