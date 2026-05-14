import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoGenerationController } from './video-generation.controller';
import { VideoGenerationService } from './video-generation.service';
import { VideoGenerationJob, VideoGenerationJobSchema } from './schemas/video-generation-job.schema';
import { Article, ArticleSchema } from 'src/articles/schemas/article.schema';
import { FileUploadModule } from 'src/utilities/file-upload/fileUpload.module';

@Module({
  imports: [
    FileUploadModule,
    MongooseModule.forFeature([
      { name: VideoGenerationJob.name, schema: VideoGenerationJobSchema },
      { name: Article.name, schema: ArticleSchema },
    ]),
  ],
  controllers: [VideoGenerationController],
  providers: [VideoGenerationService],
  exports: [VideoGenerationService],
})
export class VideoGenerationModule {}
