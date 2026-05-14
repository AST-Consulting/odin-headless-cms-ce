import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import * as https from 'https';

import { MigratorService } from './migrator.service';
import { MIGRATOR_PROVIDER } from './migrator-provider.interface';
import { WordPressProvider } from './providers/wordpress.provider';
import { YouTubeProvider } from './providers/youtube.provider';
import { RichBlocksProcessor, RICH_BLOCKS_QUEUE } from './processors/rich-blocks.processor';
import { PrintMigrationProcessor } from './processors/print-migration.processor';
import { PRINT_MIGRATION_QUEUE } from '@articles/dto/create-print-article.dto';
import { TagsModule } from '@tags/tags.module';
import { CategoryModule } from '../category/category.module';
import { UserModule } from '@user/user.module';
import { ArticlesModule } from '@articles/articles.module';
import { SlugModule } from '@cms/slug/slug.module';
import { PropertyModule } from '@property/property.module';
import { OrganizationModule } from '@organization/organization.module';
import { RedisModule } from '@utilities/redis/redis.module';
import { ElasticModule } from '@core/elastic/elastic.module';

// Import schemas for MongooseModule
import { Tag, tagSchema } from '@tags/entities/tags.schema';
import { Category, categorySchema } from '../category/entities/category.schema';
import { Article, ArticleSchema } from '@articles/schemas/article.schema';
import { User, UserSchema } from '@user/entities/user.schema';
import { FileUploadModule } from '@utilities/file-upload/fileUpload.module';
import { FileUpload, fileUploadSchema } from '@utilities/file-upload/entities/fileUpload.schema';
import { MenuModule } from '@cms/menu/menu.module';
import { Menu, MenuSchema } from '@cms/menu/schema/menu.schema';
import { Slug, slugSchema } from '@cms/slug/entities/slug.schema';
import { StaticPage, staticPageSchema } from '@cms/static-page/entities/static-page.schema';
import { MissingSlug, MissingSlugSchema } from './entities/missing-slug.schema';

// Create HTTPS agent that ignores SSL certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      httpsAgent,
      timeout: 30000,
    }),
    MongooseModule.forFeature([
      { name: Tag.name, schema: tagSchema },
      { name: Category.name, schema: categorySchema },
      { name: Article.name, schema: ArticleSchema },
      { name: User.name, schema: UserSchema },
      { name: Menu.name, schema: MenuSchema },
      { name: Slug.name, schema: slugSchema },
      { name: FileUpload.name, schema: fileUploadSchema },
      { name: StaticPage.name, schema: staticPageSchema },
      { name: MissingSlug.name, schema: MissingSlugSchema },
    ]),
    BullModule.registerQueue({ name: 'create-user' }),
    BullModule.registerQueue({ name: RICH_BLOCKS_QUEUE }),
    BullModule.registerQueue({ name: PRINT_MIGRATION_QUEUE }),
    TagsModule,
    CategoryModule,
    UserModule,
    ArticlesModule,
    SlugModule,
    PropertyModule,
    OrganizationModule,
    RedisModule,
    FileUploadModule,
    ElasticModule,
    MenuModule,
  ],
  providers: [
    MigratorService,
    WordPressProvider,
    YouTubeProvider,
    RichBlocksProcessor,
    PrintMigrationProcessor,
    {
      provide: MIGRATOR_PROVIDER,
      useFactory: (configService: ConfigService, wordPressProvider: WordPressProvider) => {
        const provider = configService.get<string>('MIGRATOR_PROVIDER') || 'wordpress';
        switch (provider) {
          case 'wordpress':
            return wordPressProvider;
          default:
            // Fallback to WordPress if no provider is specified
            return wordPressProvider;
        }
      },
      inject: [ConfigService, WordPressProvider],
    },
  ],
  exports: [MigratorService],
})
export class MigratorModule {}
