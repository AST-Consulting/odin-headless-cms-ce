import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFAQDto {
  @ApiProperty({
    description: 'A frequently asked question',
    example: 'What are the visiting hours at the hospital?',
  })
  @IsString()
  question: string;

  @ApiProperty({
    description: 'The answer to the frequently asked question',
    example: 'Visiting hours are from 10 AM to 12 PM and 5 PM to 7 PM on weekdays.',
  })
  @IsString()
  answer: string;

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

  @ApiProperty({
    description: 'The type of entity (e.g., hospital, clinic)',
    example: 'hospital',
    required: false,
  })
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsString()
  propertyId?: string;

  @ApiProperty({
    description: 'The value of the entity (e.g., hospital, clinic)',
    example: 'hospital',
    required: false,
  })
  @IsOptional()
  @IsString()
  entityValue?: string;

  @ApiProperty({
    description: 'The Id for entity type (e.g., hospital, clinic)',
    example: 'hospital123',
    required: false,
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({
    description: 'The status of the FAQ (e.g., active, inactive)',
    example: 'active',
    required: false,
  })
  @IsOptional()
  @IsString()
  status: string;

  @ApiProperty({
    description: 'The rank of the FAQ',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  rank?: number;
}

export class UpdateFAQDto extends PartialType(CreateFAQDto) {}
