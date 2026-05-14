import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefitMediaDto {
  @IsString()
  @IsNotEmpty()
  mediaId: string;

  // Target aspect ratio as "W:H" (e.g. "16:9", "9:16")
  @IsString()
  @IsNotEmpty()
  fitAspect: string;

  @IsString()
  @IsOptional()
  propertyId?: string;
}
