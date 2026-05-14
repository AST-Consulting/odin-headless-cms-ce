import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FIELD_TYPES, RELATION_TYPES } from '../schemas/field.schema';

export class EnumOptionDto {
  @IsString() label: string;
  @IsString() value: string;
}

export class FieldValidationDto {
  @IsOptional() @IsNumber() min?: number;
  @IsOptional() @IsNumber() max?: number;
  @IsOptional() @IsNumber() minLength?: number;
  @IsOptional() @IsNumber() maxLength?: number;
  @IsOptional() @IsString() regex?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) enumValues?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EnumOptionDto)
  enumOptions?: EnumOptionDto[];
}

export class FieldDto {
  @IsString() name: string;

  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() description?: string;

  @IsIn([...FIELD_TYPES])
  type: (typeof FIELD_TYPES)[number];

  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() unique?: boolean;
  @IsOptional() @IsBoolean() private?: boolean;
  @IsOptional() @IsBoolean() searchable?: boolean;
  @IsOptional() @IsBoolean() indexed?: boolean;
  @IsOptional() @IsBoolean() listable?: boolean;
  @IsOptional() @IsBoolean() filterable?: boolean;
  @IsOptional() @IsBoolean() sparse?: boolean;

  @IsOptional() default?: any;

  @IsOptional() @ValidateNested() @Type(() => FieldValidationDto)
  validation?: FieldValidationDto;

  @IsOptional() @IsString() relationTarget?: string;
  @IsOptional() @IsIn([...RELATION_TYPES]) relationType?: (typeof RELATION_TYPES)[number];
  @IsOptional() @IsString() relationInverse?: string;

  @IsOptional() @IsString() componentRef?: string;
  @IsOptional() @IsBoolean() repeatable?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedComponents?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  zoneFields?: FieldDto[];

  @IsOptional() @IsBoolean() mediaMultiple?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) mediaAllowedTypes?: string[];

  @IsOptional() @IsNumber() order?: number;
}
