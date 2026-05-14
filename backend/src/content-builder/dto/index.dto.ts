import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { INDEX_TYPES } from '../schemas/content-type-index.schema';

export class IndexFieldSpecDto {
  @IsString() path: string;
  @IsOptional() @IsNumber() order?: number;
}

export class ContentTypeIndexDto {
  @IsString() name: string;

  @IsOptional() @IsIn([...INDEX_TYPES])
  type?: (typeof INDEX_TYPES)[number];

  @IsArray() @ValidateNested({ each: true }) @Type(() => IndexFieldSpecDto)
  fields: IndexFieldSpecDto[];

  @IsOptional() @IsBoolean() unique?: boolean;
  @IsOptional() @IsBoolean() sparse?: boolean;
  @IsOptional() @IsObject() partialFilter?: Record<string, any>;
  @IsOptional() @IsObject() collation?: Record<string, any>;
}
