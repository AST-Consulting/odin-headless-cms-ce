import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { STATUS } from 'src/core/constants/enums.constants';
import { PaginationQueryDto } from 'src/core/dto/general.dto';

export class RoleQueryDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  @Type(() => String)
  name?: string;

  @IsString()
  @IsOptional()
  @Type(() => String)
  organizationId?: string;

  @IsString()
  @IsOptional()
  @Type(() => String)
  propertyId?: string;

  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdBy.userName'?: string;

  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'updatedBy.userName'?: string;

  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gte'?: string;

  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lte'?: string;

  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gt'?: string;

  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lt'?: string;

  @ApiPropertyOptional({
    name: 'Status',
    description: 'Status of the role',
    example: STATUS.ACTIVE,
    enum: STATUS,
  })
  @IsOptional()
  @IsEnum(STATUS)
  status?: string;
}
