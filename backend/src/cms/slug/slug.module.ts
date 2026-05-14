import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SlugController } from './slug.controller';
import { SlugService } from './slug.service';
import { Slug, slugSchema } from './entities/slug.schema';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { OnDeleteCascadeModule } from '@core/on-delete-cascade/on-delete-cascade.module';
import { PropertyModule } from '@property/property.module';
import { OrganizationModule } from '@organization/organization.module';

// Import modules for content retrieval
import { ArticlesModule } from '@articles/articles.module';
import { CategoryModule } from 'src/category/category.module';
import { TagsModule } from '@tags/tags.module';

// Import Strategy Pattern classes
import { ContentRetrievalStrategyFactory } from './strategies/content-retrieval.factory';
import { ArticleRetrievalStrategy } from './strategies/article-retrieval.strategy';
import { CategoryRetrievalStrategy } from './strategies/category-retrieval.strategy';
import { TagRetrievalStrategy } from './strategies/tag-retrieval.strategy';
import { ArticlesService } from '@articles/articles.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Slug.name, schema: slugSchema }]),
    AuditTrailModule,
    ElasticModule,
    OnDeleteCascadeModule,
    forwardRef(() => PropertyModule),
    forwardRef(() => OrganizationModule),
    // Add content modules for strategy pattern
    forwardRef(() => ArticlesModule),
    forwardRef(() => CategoryModule),
    forwardRef(() => TagsModule),
  ],
  controllers: [SlugController],
  providers: [
    SlugService,
    // Strategy Pattern Providers
    ContentRetrievalStrategyFactory,
    ArticleRetrievalStrategy,
    CategoryRetrievalStrategy,
    TagRetrievalStrategy,
    // Provide ArticlesService with a custom provider token for the strategy
    {
      provide: 'ARTICLES_SERVICE',
      useExisting: ArticlesService,
    },
  ],
  exports: [SlugService, MongooseModule],
})
export class SlugModule { }
