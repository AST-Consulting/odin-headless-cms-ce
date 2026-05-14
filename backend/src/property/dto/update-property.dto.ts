import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyDto } from './create-property.dto';

export class UpdatePropertyDto extends PartialType(PropertyDto) {}
