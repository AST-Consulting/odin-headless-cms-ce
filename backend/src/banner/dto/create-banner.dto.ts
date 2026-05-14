import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  IsDate,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BannerOpenIn, BannerRunsOn, STATUS } from '@core/constants/enums.constants';
import { FileSubDto } from '@utilities/file-upload/dto/file-sub.dto';
import { BannerTypeSub } from '../banner-type/entities/sub/banner-type-sub.schema';

export class NestedBannersDto {
  @ApiPropertyOptional({ example: 'Slug of the banner' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({
    enum: STATUS,
    default: STATUS.ACTIVE,
    example: STATUS.ACTIVE,
  })
  @IsEnum(STATUS)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'Description of the banner' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Title of the banner' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ctaText?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  apiLink?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  appLink?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  webLink?: string;

  @ApiPropertyOptional({ example: 'Rank of the banner Item' })
  @IsNumber()
  @IsOptional()
  rank?: number;

  @ApiPropertyOptional({
    enum: BannerOpenIn,
    default: BannerOpenIn.SAME,
    example: BannerOpenIn.SAME,
  })
  @IsString()
  @IsEnum(BannerOpenIn)
  @IsOptional()
  openIn?: string;

  @ApiPropertyOptional({
    enum: BannerRunsOn,
    default: BannerRunsOn.BOTH,
    example: BannerRunsOn.BOTH,
  })
  @IsString()
  @IsEnum(BannerRunsOn)
  @IsOptional()
  runsOn?: string;

  @ApiProperty({ example: '2023-06-01T00:00:00Z', required: false })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate: Date;

  @ApiPropertyOptional({ example: '2023-06-30T23:59:59Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({
    type: () => FileSubDto,
    description: 'Image file details',
  })
  @ValidateNested()
  @Type(() => FileSubDto)
  @IsNotEmpty()
  image: FileSubDto;
}

export class CreateBannerDto {
  @ApiProperty({
    example: 'Summer Sale Banner',
    description: 'Title of the banner',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    type: () => BannerTypeSub,
    example: { id: '123', name: 'Promotional' },
    description: 'Type of banner',
  })
  @IsString()
  @IsNotEmpty()
  bannerType: string;

  @ApiProperty({
    type: [NestedBannersDto],
    description: 'Details of images in the banner',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NestedBannersDto)
  @IsNotEmpty()
  banners: NestedBannersDto[];

  @ApiProperty({
    example: 'Exciting summer sale with discounts up to 50% off!',
    description: 'Description of the banner',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Rank of the banner for sorting or priority',
  })
  @IsNumber()
  @IsOptional()
  rank?: number;

  @ApiProperty({
    example: '2023-06-01T00:00:00Z',
    description: 'Start date of the banner',
  })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({
    example: '2023-08-31T23:59:59Z',
    description: 'End date of the banner',
  })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endDate: Date;

  @ApiPropertyOptional({
    enum: STATUS,
    default: STATUS.ACTIVE,
    example: STATUS.ACTIVE,
    description: 'Status of the banner',
  })
  @IsEnum(STATUS)
  @IsOptional()
  status?: string;

  @IsOptional()
  propertyId?: string;

  @ApiProperty({
    description: 'Array of tag IDs',
    type: [String],
    required: false,
    example: ['tag1', 'tag2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'Array of category IDs',
    type: [String],
    required: false,
    example: ['category1', 'category2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}
