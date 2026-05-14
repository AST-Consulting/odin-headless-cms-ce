import { STATUS } from '@core/constants/enums.constants';
import { PaginationQueryDto } from '@core/dto/general.dto';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
export class QueryBannerTypeDto extends PartialType(PaginationQueryDto) {
  @ApiPropertyOptional({
    name: 'id',
    description: 'Unique identifier of the banner',
    example: '60c72b2f5f1b2c0012345678',
  })
  @IsOptional()
  @IsString()
  _id: string;

  @ApiPropertyOptional({
    name: 'name',
    description: 'Name of the banner type',
    example: 'Promotion banner',
  })
  @IsOptional()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    name: 'created At gte',
    description: 'Created At date filter - greater than or equal to',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gte'?: string;

  @ApiPropertyOptional({
    name: 'created At lte',
    description: 'Created At date filter - lower than or equal to',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lte'?: string;

  @ApiPropertyOptional({
    name: 'created At gt',
    description: 'Created At date filter - greater than',
    example: '2022-01-01',
  })
  @IsString()
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.gt'?: string;

  @ApiPropertyOptional({
    name: 'created At lt',
    description: 'Created At date filter - lower than',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdAt.lt'?: string;

  @ApiPropertyOptional({
    name: 'Status',
    description: 'Status of the banner Type',
    example: STATUS.ACTIVE,
    enum: STATUS,
  })
  @IsOptional()
  @IsEnum(STATUS)
  status?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;
}
