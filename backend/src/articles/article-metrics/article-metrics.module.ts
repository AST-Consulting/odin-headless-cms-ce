import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../schemas/article.schema';
import { ArticleMetricsController } from './article-metrics.controller';
import { ArticleMetricsService } from './article-metrics.service';
import { IntegrationsModule } from 'src/integrations/integrations.module';
import { Integration, IntegrationSchema } from 'src/integrations/schemas/integration.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: Integration.name, schema: IntegrationSchema },
    ]),
    IntegrationsModule,
  ],
  controllers: [ArticleMetricsController],
  providers: [ArticleMetricsService],
  exports: [ArticleMetricsService],
})
export class ArticleMetricsModule {}
