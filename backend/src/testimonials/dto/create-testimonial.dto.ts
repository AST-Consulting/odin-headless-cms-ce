import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

export class CreateTestimonialDto {
  @IsString()
  testimonialText: string;

  @IsString()
  authorName: string;

  @IsOptional()
  @IsString()
  authorDesignation?: string;

  @IsOptional()
  @IsString()
  authorCompany?: string;

  @IsEnum(['approved', 'pending', 'rejected'])
  status: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  date?: Date;

  @IsOptional()
  @IsArray()
  media?: Array<{ id: string; fileName: string; path: string }>;

  @IsOptional()
  @IsNumber()
  rank?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsString()
  videoURL?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsString()
  propertyId: string;
}
