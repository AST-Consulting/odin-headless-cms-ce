import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RichBlockBodyDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  content?: any;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class BulkUpsertRichBlocksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichBlockBodyDto)
  blocks: RichBlockBodyDto[];
}

export class UpsertSingleRichBlockDto {
  @ValidateNested()
  @Type(() => RichBlockBodyDto)
  block: RichBlockBodyDto;

  // When provided, the update will only succeed if the stored version matches.
  // Omit (or pass undefined) on first creation.
  @IsOptional()
  @IsNumber()
  version?: number;
}
