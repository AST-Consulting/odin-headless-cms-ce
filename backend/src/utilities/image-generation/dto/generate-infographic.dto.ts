import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Flexible item DTO that accepts both string and number values
export class InfographicItemDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  // Value can be string (for fact-box) or number (for ranking/comparison/timeline)
  // We validate based on type
  @IsNotEmpty()
  value: string | number;

  @IsString()
  @IsOptional()
  meta?: string;
}

export class GenerateInfographicDto {
  @IsString()
  @IsIn(['ranking', 'comparison', 'timeline', 'fact-box', 'quote-highlight', 'stat-card', 'pie-chart', 'carousel-slide'])
  type: 'ranking' | 'comparison' | 'timeline' | 'fact-box' | 'quote-highlight' | 'stat-card' | 'pie-chart' | 'carousel-slide';

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type !== 'quote-highlight' && o.type !== 'stat-card')
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  @IsOptional()
  @IsIn(['16:9', '9:16', '1:1', '4:5'])
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';

  @IsString()
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6})$/)
  accentColor?: string;

  // For list-based templates (ranking, comparison, timeline, fact-box, pie-chart)
  @IsArray()
  @IsOptional()
  @ValidateIf((o) => ['ranking', 'comparison', 'timeline', 'fact-box', 'pie-chart'].includes(o.type))
  @ArrayMinSize(3)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => InfographicItemDto)
  items?: InfographicItemDto[];

  // For quote-highlight
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type === 'quote-highlight')
  @IsNotEmpty()
  quote?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type === 'quote-highlight')
  @IsNotEmpty()
  author?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  // For stat-card
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type === 'stat-card' || o.type === 'carousel-slide')
  @IsNotEmpty()
  statValue?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.type === 'stat-card')
  @IsNotEmpty()
  statLabel?: string;

  @IsString()
  @IsOptional()
  context?: string;

  @IsString()
  @IsOptional()
  propertyId?: string;
}
