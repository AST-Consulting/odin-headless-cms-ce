import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray } from 'class-validator';

export class CreateTopicDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  seedQuery: string;

  @IsString()
  @IsNotEmpty()
  lang: string;

  @IsOptional()
  @IsNumber()
  trendScore?: number;

  @IsOptional()
  @IsDateString()
  freshnessWindowStart?: Date;

  @IsOptional()
  @IsDateString()
  freshnessWindowEnd?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedAngles?: string[];
}
