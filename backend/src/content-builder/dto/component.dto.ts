import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { FieldDto } from './field.dto';

export class CreateComponentDto {
  @IsString() displayName: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  fields?: FieldDto[];
}

export class UpdateComponentDto extends PartialType(CreateComponentDto) {}
