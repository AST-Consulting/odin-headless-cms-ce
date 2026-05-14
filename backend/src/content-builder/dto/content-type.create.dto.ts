import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { FieldDto } from './field.dto';
import { ContentTypeIndexDto } from './index.dto';

export class CreateContentTypeDto {
  @IsString() displayName: string;
  @IsString() singularName: string;
  @IsString() pluralName: string;

  @IsOptional() @IsString() collectionName?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  fields?: FieldDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentTypeIndexDto)
  indexes?: ContentTypeIndexDto[];
}
