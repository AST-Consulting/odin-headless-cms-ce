/* eslint-disable @typescript-eslint/naming-convention */
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@core/dto/general.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { STATUS } from '@core/constants/enums.constants';
import { Transform } from 'class-transformer';

export class FaqQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by question text',
    example: 'How to book an appointment?',
  })
  @IsString()
  @IsOptional()
  question?: string;

  @ApiPropertyOptional({
    description: 'Filter by answer text',
    example: 'You can book an appointment via the online portal or by calling the hospital.',
  })
  @IsString()
  @IsOptional()
  answer?: string;

  @ApiPropertyOptional({
    description: 'Filter by category name (e.g., General Information, Services, etc.)',
    example: 'General Information',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'category.name': string;

  @ApiPropertyOptional({
    description: 'Filter by tag name (e.g., Emergency, Insurance, etc.)',
    example: 'Emergency',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'tags.name'?: string;

  @ApiPropertyOptional({
    description: "Filter by the creator's name",
    example: 'Dr. Ramesh Kumar',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'createdBy.name'?: string;

  @ApiPropertyOptional({
    description: "Filter by the updater's name",
    example: 'Admin User',
  })
  @IsString()
  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'updatedBy.name'?: string;

  @ApiPropertyOptional({
    description: 'Filter by category ID',
    example: '612f3b4d23e6f700129afe12',
  })
  @IsString()
  @IsOptional()
  'category.id': string;

  @ApiPropertyOptional({
    description: 'Filter by tag ID',
    example: '613f3b4d56e6b700134dfb23',
  })
  @IsString()
  @IsOptional()
  'tags.id'?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity ID',
    example: '614f3b4d89e6c700145dfb34',
  })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type (e.g., hospital, clinic)',
    example: 'hospital',
  })
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({
    description: 'The rank of the FAQ',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  rank?: number;

  @ApiPropertyOptional({
    name: 'Status',
    description: 'Status of the faq',
    example: STATUS.ACTIVE,
    enum: STATUS,
  })
  @IsOptional()
  @IsEnum(STATUS)
  status?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by category ID (alternative to category.id)',
    example: '612f3b4d23e6f700129afe12',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
