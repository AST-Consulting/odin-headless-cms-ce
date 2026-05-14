import { IsEnum, IsNotEmpty, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Valid GA4 dimensions that can be queried via the /analytics/ga/dimension endpoint.
 */
export enum GaDimension {
  CITY = 'city',
  COUNTRY = 'country',
  BROWSER = 'browser',
  DEVICE_CATEGORY = 'deviceCategory',
  OPERATING_SYSTEM = 'operatingSystem',
  SCREEN_RESOLUTION = 'screenResolution',
  USER_AGE_BRACKET = 'userAgeBracket',
  USER_GENDER = 'userGender',
  NEW_VS_RETURNING = 'newVsReturning',
  LANGUAGE = 'language',
  SESSION_DEFAULT_CHANNEL_GROUP = 'sessionDefaultChannelGroup',
}

/**
 * Base query DTO shared by all GA endpoints.
 * `propertyId` here refers to the CMS property (not GA property).
 */
export class GaBaseQueryDto {
  @IsNotEmpty()
  @IsString()
  propertyId: string;

  @IsOptional()
  @IsString()
  startDate?: string; // GA format: '30daysAgo', '7daysAgo', '2024-01-01', etc.

  @IsOptional()
  @IsString()
  endDate?: string; // GA format: 'today', 'yesterday', '2024-12-31', etc.
}

/**
 * Query DTO for dimension-based reports (city, device, browser, etc.)
 */
export class GaDimensionQueryDto extends GaBaseQueryDto {
  @IsEnum(GaDimension)
  dimension: GaDimension;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * Query DTO for top articles report.
 */
export class GaTopArticlesQueryDto extends GaBaseQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * Query DTO for traffic sources report.
 */
export class GaTrafficSourcesQueryDto extends GaBaseQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
