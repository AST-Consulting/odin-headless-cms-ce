import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { PRINT_MIGRATION_QUEUE } from './dto/create-print-article.dto';
import { Article, ArticleSchema } from './schemas/article.schema';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { PermissionModule } from 'src/auth/permission.module';
import { CategoryModule } from 'src/category/category.module';
import { TagsModule } from '@tags/tags.module';
import { HttpModule } from '@nestjs/axios';
import { ElasticModule } from '@core/elastic/elastic.module';
import { SlugModule } from '@cms/slug/slug.module';
import { PropertyModule } from '@property/property.module';
import { OrganizationModule } from '@organization/organization.module';
import { WpCompatibleController } from './wp-compatible.controller';
import { SectionModule } from 'src/section/section.module';
import {
  ArticleRichBlock,
  ArticleRichBlockSchema,
} from './article-rich-blocks/schema/article-rich-block.schema';
import { ArticleRichBlocksService } from './article-rich-blocks/article-rich-blocks.service';
import { LiveBlogSseService } from './live-blog-sse.service';
import { RevalidationModule } from '@core/revalidation/revalidation.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: PRINT_MIGRATION_QUEUE }),
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: ArticleRichBlock.name, schema: ArticleRichBlockSchema },
    ]),
    PermissionModule,
    CategoryModule,
    TagsModule,
    HttpModule,
    ElasticModule,
    forwardRef(() => SlugModule),
    forwardRef(() => PropertyModule),
    forwardRef(() => OrganizationModule),
    forwardRef(() => SectionModule),
    RevalidationModule,
  ],
  controllers: [ArticlesController, WpCompatibleController],
  providers: [ArticlesService, ArticleRichBlocksService, LiveBlogSseService],
  exports: [ArticlesService, ArticleRichBlocksService],
})
export class ArticlesModule {}
