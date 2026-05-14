import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PERMISSION_MODULES } from 'src/core/constants/permissions.config';
import { TActionType } from '../entities/role.schema';

export class PermissionDTO {
  @ApiProperty({
    description: 'Module name like property, users, articles etc.',
    example: 'articles',
    enum: PERMISSION_MODULES,
  })
  @IsNotEmpty()
  @IsIn(PERMISSION_MODULES)
  module: string;

  @ApiProperty({
    description: 'Allowed actions for this module',
    example: ['read', 'write', 'edit'],
    enum: TActionType,
    isArray: true,
  })
  @IsArray()
  @IsEnum(TActionType, { each: true })
  actions: TActionType[];
}

export class roleDTO {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The role name',
    example: 'ADMIN',
  })
  name: string;
  
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'The property ID this role belongs to',
    example: '6926b8f59a288ddf06a28884',
    required: false,
  })
  propertyId?: string;

  @IsOptional()
  @ApiProperty({
    description: 'List of module-based permissions',
    type: [PermissionDTO],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDTO)
  permissions?: PermissionDTO[];

  @ApiProperty({
    example: 'active',
    description: 'Role status (active/inactive)',
    required: false,
  })
  @IsOptional()
  @IsString()
  status: string;
}

export class updateRoleDTO extends PartialType(roleDTO) {}
