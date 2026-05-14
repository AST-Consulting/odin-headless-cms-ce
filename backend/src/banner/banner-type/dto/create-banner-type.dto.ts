import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { STATUS } from '@core/constants/enums.constants';

export class CreateBannerTypeDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional() // entity is optional
  @IsString()
  entity?: string;

  @IsOptional()
  @IsEnum(STATUS)
  status?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;
}
