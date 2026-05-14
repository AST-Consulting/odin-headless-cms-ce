import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UploadBlogDto {
  @IsString()
  @IsNotEmpty()
  blogTitle: string;

  @IsString()
  @IsNotEmpty()
  htmlContent: string;

  @IsString()
  @IsOptional()
  authorName?: string;

  @IsString()
  @IsOptional()
  siteSlug?: string;
}
