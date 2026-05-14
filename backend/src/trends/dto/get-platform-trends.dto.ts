import { IsOptional, IsString, IsInt, Min, Max, IsBooleanString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetPlatformTrendsDto {
  @IsOptional()
  @IsString()
  geo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  hl?: string;

  @IsOptional()
  @IsBooleanString()
  refresh?: string;
}
