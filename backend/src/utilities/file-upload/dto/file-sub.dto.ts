import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class FileSubDto {
  @ApiProperty({
    description: 'ID of the file',
    example: '60c72b2f5f1b2c001f58e7a3',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Name of the file', example: 'image.png' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({
    description: 'Path where the file is stored',
    example: '/uploads/2024/09/30/image.png',
  })
  @IsString()
  @IsOptional()
  path?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ description: 'Alt text for the file', example: 'A descriptive alt text', required: false })
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiProperty({ description: 'Caption for the file', example: 'Photo by John Doe', required: false })
  @IsOptional()
  @IsString()
  caption?: string;
}
