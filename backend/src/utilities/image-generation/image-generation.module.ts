import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageGenerationController } from './image-generation.controller';
import { ImageGenerationService } from './image-generation.service';
import { FileUploadModule } from '../file-upload/fileUpload.module';
import { InfographicRendererService } from './infographic-renderer.service';

@Module({
  imports: [FileUploadModule, ConfigModule],
  controllers: [ImageGenerationController],
  providers: [ImageGenerationService, InfographicRendererService],
  exports: [ImageGenerationService],
})
export class ImageGenerationModule {}
