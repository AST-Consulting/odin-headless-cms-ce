/* eslint-disable @typescript-eslint/naming-convention */
import { STATUS } from '@core/constants/enums.constants';
import { PaginationQueryDto } from '@core/dto/general.dto';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class QueryBannerDto extends PartialType(PaginationQueryDto) {
  @ApiPropertyOptional({
    name: 'id',
    description: 'Unique identifier of the banner',
    example: '60c72b2f5f1b2c0012345678',
  })
  @IsOptional()
  @IsString()
  _id: string;

  @ApiPropertyOptional({
    name: 'banners.status',
    description: 'Status of the banner',
    example: STATUS.ACTIVE,
    enum: STATUS,
  })
  @IsOptional()
  @IsString()
  'banners.status'?: string;

  @ApiPropertyOptional({
    name: 'rank',
    description: 'Rank of the banner',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  rank: number;

  @ApiPropertyOptional({
    name: 'createdAt.gte',
    description: 'Created At date filter - greater than or equal to',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.gte'?: string;

  @ApiPropertyOptional({
    name: 'createdAt.lte',
    description: 'Created At date filter - lower than or equal to',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.lte'?: string;

  @ApiPropertyOptional({
    name: 'createdAt.gt',
    description: 'Created At date filter - greater than',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.gt'?: string;

  @ApiPropertyOptional({
    name: 'createdAt.lt',
    description: 'Created At date filter - lower than',
    example: '2022-01-01',
  })
  @IsOptional()
  @IsString()
  'createdAt.lt'?: string;

  @ApiPropertyOptional({
    name: 'status',
    description: 'Status of the banner',
    example: STATUS.ACTIVE,
    enum: STATUS,
  })
  @IsOptional()
  @IsEnum(STATUS)
  status?: string;

  @ApiPropertyOptional({
    name: 'title',
    description: 'Title of the banner',
    example: 'Summer Sale',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    name: 'slug',
    description: 'Slug of the banner',
    example: 'summer-sale',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    name: 'Banner Type Id',
    description: 'Id of banner Type of the banner',
    example: '60c72b2f5f1b2c0012345678',
  })
  @IsOptional()
  @IsString()
  'bannerType.id'?: string;

  @ApiPropertyOptional({
    name: 'banner.type.name',
    description: 'Name of banner Type of the banner',
    example: 'Promotion banner',
  })
  @IsOptional()
  @IsString()
  'bannerType.name'?: string;

  @ApiPropertyOptional({
    name: 'Tag Id',
    description: 'Id of tags of the banner',
    example: '60c72b2f5f1b2c0012345678',
  })
  @IsOptional()
  @IsString()
  'tags.id'?: string;

  @ApiPropertyOptional({
    name: 'Category Id',
    description: 'Id of banner category of the banner',
    example: '60c72b2f5f1b2c0012345678',
  })
  @IsOptional()
  @IsString()
  'categories.id'?: string;
}
