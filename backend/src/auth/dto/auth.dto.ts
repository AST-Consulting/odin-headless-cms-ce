// signIn.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsEnum,
  IsOptional,
  IsNumber,
  IsMobilePhone,
  IsStrongPassword,
  IsDate,
  ValidateNested,
  IsArray,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GENDER, UserType } from 'src/core/constants/enums.constants';
import { CreateAdminDto } from './create-admin.dto';
export class OtpDto {
  @IsMobilePhone()
  @IsNotEmpty()
  mobileNumber: string;
}
export class FormOtpDto {
  // @IsMobilePhone()
  @IsOptional()
  mobileNumber: string;

  @IsEmail()
  @IsOptional()
  email: string;
}

export class VerifyOtpDto extends FormOtpDto {
  @IsOptional()
  @IsNumber()
  mobileOtp?: number;

  @IsOptional()
  @IsNumber()
  emailOtp?: number;
}
export class ResetPasswordDto {
  @IsNotEmpty({ message: 'Password should not be empty.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @IsString({ message: 'Password must be a string.' })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;

  @IsNotEmpty()
  @IsString()
  token: string;
}

export class ChangePasswordDto {
  @IsOptional()
  @IsString({ message: 'Current password must be a string.' })
  currentPassword?: string;

  @IsNotEmpty({ message: 'New password should not be empty.' })
  @MinLength(10, { message: 'New password must be at least 10 characters long.' })
  @IsString({ message: 'New password must be a string.' })
  @IsStrongPassword({
    minLength: 10,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 2,
  })
  newPassword: string;
}

export class QueryTokenDto {
  @IsNotEmpty()
  token: string;
}
export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsNumber()
  mobileOtp?: number;

  @IsOptional()
  @IsNumber()
  emailOtp?: number;
}

export class SignUpDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone: string;

  @IsNotEmpty({ message: 'Password should not be empty.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @IsString({ message: 'Password must be a string.' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol.',
    }
  )
  password: string;

  @IsOptional()
  @IsEnum(GENDER)
  gender?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateOfBirth?: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAdminDto)
  adminDetails?: CreateAdminDto;

  @IsOptional()
  @IsString()
  inviteCode: string;

  @IsOptional()
  @IsString()
  orgId?: string;
}
export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class InviteDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  properties?: string[];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  permissions?: any[];

  @IsOptional()
  @IsObject()
  seo?: {
    title?: string;
    metaDescription?: string;
    slug?: string;
  };

  @IsOptional()
  @IsObject()
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
    instagram?: string;
  };

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsBoolean()
  sendEmail: boolean;
}
