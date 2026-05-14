import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Analytics, AnalyticsSchema } from './schemas/analytics.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ElasticModule } from 'src/core/elastic/elastic.module';
import { Article, ArticleSchema } from 'src/articles/schemas/article.schema';
import { ArticlesModule } from 'src/articles/articles.module';
import { IntegrationsModule } from 'src/integrations/integrations.module';
import { GaAnalyticsController } from './ga-analytics.controller';
import { GaAnalyticsService } from './ga-analytics.service';
import { YtAnalyticsController } from './yt-analytics.controller';
import { YtAnalyticsService } from './yt-analytics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Analytics.name, schema: AnalyticsSchema },
      { name: Article.name, schema: ArticleSchema },
    ]),
    ElasticModule,
    ArticlesModule,
    IntegrationsModule,
  ],
  controllers: [AnalyticsController, GaAnalyticsController, YtAnalyticsController],
  providers: [AnalyticsService, GaAnalyticsService, YtAnalyticsService],
  exports: [AnalyticsService, GaAnalyticsService, YtAnalyticsService],
})
export class AnalyticsModule {}
