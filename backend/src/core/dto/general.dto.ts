import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  lastId?: string;

  @IsOptional()
  lastSortValues?: any[];

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @IsOptional()
  @IsString()
  fields?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  searchTerm?: string;
}

export class TransactionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  'user.userId'?: string;

  @IsOptional()
  @IsString()
  'organization.organizationId'?: string;
}
