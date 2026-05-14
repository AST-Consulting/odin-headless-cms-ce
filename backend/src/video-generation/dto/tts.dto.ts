import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class TtsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text: string;

  @IsOptional()
  @IsIn(['neutral', 'male', 'female'])
  voice?: 'neutral' | 'male' | 'female';

  @IsOptional()
  @IsNumber()
  rate?: number;

  @IsOptional()
  @IsString()
  language?: string;
}
