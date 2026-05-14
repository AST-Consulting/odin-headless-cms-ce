import { IsString, IsArray, IsOptional, ValidateNested, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

class ChangesDto {
  @IsString()
  fieldName: string;

  oldValue: any;

  newValue: any;
}

class UserDto {
  @IsString()
  userId: string;

  @IsString()
  userName: string;
}

export class AuditTrailDto {
  @IsString()
  readonly action: string;

  @IsString()
  readonly collectionName: string;

  @IsString()
  readonly objectId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangesDto)
  readonly changes: ChangesDto[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDate()
  deletionDate?: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserDto)
  readonly updatedBy?: UserDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserDto)
  readonly createdBy?: UserDto;
}
