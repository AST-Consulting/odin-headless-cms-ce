import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ExtractScreenshotInsightsDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/webp'])
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}
