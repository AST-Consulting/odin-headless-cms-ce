import { IsOptional, IsString, IsObject, IsIn } from 'class-validator';

export const ENTRY_STATUS = ['draft', 'published', 'scheduled', 'archived'] as const;

export class CreateEntryDto {
  @IsObject()
  data: Record<string, any>;

  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsString() propertyId?: string;
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() @IsIn([...ENTRY_STATUS]) status?: (typeof ENTRY_STATUS)[number];
}

export class UpdateEntryDto {
  @IsOptional() @IsObject() data?: Record<string, any>;
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsIn([...ENTRY_STATUS]) status?: (typeof ENTRY_STATUS)[number];
}
