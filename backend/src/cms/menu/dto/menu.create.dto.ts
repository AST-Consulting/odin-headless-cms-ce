import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
  IsObject,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { STATUS } from '@core/constants/enums.constants';
import { FileSubDto } from '@utilities/file-upload/dto/file-sub.dto';

class IconDto {
  @ApiProperty({
    description: 'Icon image representing a medical department or service',
    type: FileSubDto,
    example: { filename: 'cardiology-icon.png', path: '/uploads/icons' },
  })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => FileSubDto)
  iconImage: FileSubDto;

  @ApiProperty({
    description: 'Alternative text for the icon image, important for accessibility',
    example: 'Cardiology Department Icon',
  })
  @IsString()
  @IsNotEmpty()
  altText: string;
}

export class CreateItemDto {
  @ApiProperty({
    description:
      'Title of the item, which could represent a department, service, or a medical specialty.',
    example: 'Cardiology Department',
  })
  @IsNotEmpty()
  @IsString()
  titles: string;

  @ApiProperty({
    description: 'URL or link related to the item, leading to a specific page or resource',
    example: '/departments/cardiology',
  })
  @IsNotEmpty()
  @IsString()
  link: string;

  @ApiProperty({
    example: 'active',
    description: 'Current status of the item (e.g., active, inactive)',
    required: false,
  })
  @IsOptional()
  @IsEnum(STATUS)
  status: string;

  @ApiProperty({
    description: 'Type of the item (e.g., department, service)',
    example: 'department',
    required: false,
  })
  @IsOptional()
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Text color of the item displayed on the CMS',
    example: '#ffffff',
    required: false,
  })
  @IsOptional()
  @IsString()
  textColor: string;

  @ApiProperty({
    description: 'Background color of the item display on the CMS',
    example: '#0000ff',
    required: false,
  })
  @IsOptional()
  @IsString()
  bgColor: string;

  @ApiProperty({
    description: 'Any other additional information about the item',
    example: 'This department specializes in heart and vascular conditions.',
    required: false,
  })
  @IsOptional()
  @IsString()
  others?: string;

  @ApiProperty({
    description: 'Slug for any sub-menu related to this item',
    example: 'cardiology-submenu',
    required: false,
  })
  @IsOptional()
  @IsString()
  subMenuSlug?: string;

  @ApiProperty({
    description: 'Label for the item (e.g., for badges or tags)',
    example: 'Top Department',
    required: false,
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    description: 'Hindi title translation, useful for multilingual CMS support',
    example: 'हृदय रोग विभाग',
    required: false,
  })
  @IsOptional()
  @IsString()
  titleHn?: string;

  @ApiProperty({
    description: 'Object type from WordPress (e.g., category, post, page)',
    example: 'category',
    required: false,
  })
  @IsOptional()
  @IsString()
  object?: string;

  @ApiProperty({
    description: 'Object ID from WordPress',
    example: '123',
    required: false,
  })
  @IsOptional()
  @IsString()
  object_id?: string;

  @ApiProperty({
    description: 'Rank of the item, used to order the items in the CMS',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  rank: number;

  @ApiProperty({
    type: FileSubDto,
    description: 'Image associated with the Item (e.g., department or service)',
    example: { filename: 'cardiology-department.jpg', path: '/uploads/images' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  image?: FileSubDto;

  @ApiProperty({
    type: FileSubDto,
    description: 'Icon image representing the Item',
    example: { filename: 'cardiology-icon.png', path: '/uploads/icons' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  icon?: FileSubDto;

  @ApiProperty({
    description:
      'Inline nested children of this item. Use this for items whose children live within the same menu document instead of being referenced via subMenuSlug.',
    type: () => [CreateItemDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  children?: CreateItemDto[];
}

export class CreateMenuDto {
  @ApiProperty({
    description: 'Title of the menu, which could represent a grouping of departments or services',
    example: 'Medical Departments',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Slug for the menu, used for URL generation',
    example: 'medical-departments',
    required: false,
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @IsNotEmpty()
  @IsString()
  propertyId: string;

  @ApiProperty({
    example: 'active',
    description: 'Current status of the menu (e.g., active, inactive)',
    required: false,
  })
  @IsOptional()
  @IsEnum(STATUS)
  status: string;

  @ApiProperty({
    description:
      'List of items under this menu, each item represents a medical department or service',
    type: [CreateItemDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  items: CreateItemDto[];

  @ApiProperty({
    type: FileSubDto,
    description: 'Image associated with the menu (e.g., hospital services banner)',
    example: {
      filename: 'medical-services-banner.jpg',
      path: '/uploads/images',
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  image?: FileSubDto;

  @ApiProperty({
    type: FileSubDto,
    description:
      'Banner Image of the menu, could be a promotional banner for a group of services or departments',
    example: { filename: 'hospital-banner.jpg', path: '/uploads/banners' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  bannerImage: FileSubDto;

  @ApiProperty({
    description:
      'Icon representation for the menu, often used for visual navigation of medical departments or services',
    type: IconDto,
    required: false,
  })
  @IsObject()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => IconDto)
  icon?: IconDto;

  @ApiProperty({
    description: 'Rank of the menu for ordering purposes in the CMS',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  rank: number;
}
