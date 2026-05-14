import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileSubDto } from 'src/utilities/file-upload/dto/file-sub.dto';
import { GENDER, UserType } from 'src/core/constants/enums.constants';
import { PERMISSION_MODULES } from 'src/core/constants/permissions.config';
import { OrganizationSub } from 'src/organization/entities/organization-sub.schema';

class ActionsDTO {
  @ApiProperty({
    description: 'Permission to read from the module',
    example: true,
  })
  @IsBoolean()
  read: boolean;

  @ApiProperty({
    description: 'Permission to write to the module',
    example: true,
  })
  @IsBoolean()
  write: boolean;

  @ApiProperty({
    description: 'Permission to edit in the module',
    example: false,
  })
  @IsBoolean()
  edit: boolean;

  @ApiProperty({
    description: 'Permission to delete from the module',
    example: false,
  })
  @IsBoolean()
  delete: boolean;
}

export class PermissionDTO {
  @ApiProperty({
    description: 'The module to which the permissions apply',
    example: 'users',
    enum: PERMISSION_MODULES,
  })
  @IsIn(PERMISSION_MODULES)
  module: string;

  @ApiProperty({
    description: 'Actions permitted in the module',
    type: ActionsDTO,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ActionsDTO)
  actions: ActionsDTO;
}

export class CreateAdminDto {
  @ApiPropertyOptional({
    description: 'The ID of the user associated with the admin',
    example: '60f1e3f4e79b1b2b5c8d1a77',
  })
  @IsOptional()
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: 'Profile picture of the admin',
    type: FileSubDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FileSubDto)
  profilePicture: FileSubDto;

  @ApiProperty({
    description: 'The name of the admin',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'The current status of the admin',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Roles assigned to the admin',
    example: ['SUPER_ADMIN', 'ADMIN'],
    isArray: true,
    type: String,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles: string[];

  @ApiPropertyOptional({
    description: 'Permissions associated with the admin',
    isArray: true,
    type: PermissionDTO,
  })
  @IsOptional()
  @IsArray()
  permissions?: PermissionDTO[];

  @ApiProperty({
    description: 'Type of the user (User, Admin)',
    example: UserType.USER,
  })
  @IsEnum(UserType)
  userType: string;

  @ApiPropertyOptional({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number of the user',
    example: '+919876543210',
  })
  @IsOptional()
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'Password for the user account',
    example: 'StrongPassword123!',
  })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description: 'Gender of the user',
    example: GENDER.MALE,
  })
  @IsEnum(GENDER)
  gender?: string;

  @ApiPropertyOptional({
    description: 'Date of birth of the user',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    description: 'Indicates if the user is an admin',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'Organization of the admin',
    type: OrganizationSub,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrganizationSub)
  organization: OrganizationSub;
}

export class UpdateAdminDto extends PartialType(CreateAdminDto) {}
