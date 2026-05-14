import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class YtBaseQueryDto {
  @ApiProperty({ description: 'The CMS Property ID' })
  @IsString()
  propertyId: string;

  @ApiProperty({ description: 'Start date in YYYY-MM-DD format', required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ description: 'End date in YYYY-MM-DD format', required: false })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class YtTopVideosQueryDto extends YtBaseQueryDto {
  @ApiProperty({ description: 'Limit number of videos returned', required: false, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 25;
}

export class YtDimensionQueryDto extends YtBaseQueryDto {
  @ApiProperty({ description: 'The dimension to group by (e.g., country, deviceType, ageGroup)' })
  @IsString()
  dimension: string;

  @ApiProperty({ description: 'Limit number of results', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
