import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ArticlesModule } from './articles/articles.module';
import { TopicsModule } from './topics/topics.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { SearchModule } from './search/search.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TemplatesModule } from './templates/templates.module';
import { TagsModule } from './tags/tags.module';
import { SystemSetupModule } from './system-setup/system-setup.module';
import { TrendsModule } from './trends/trends.module';
import { CommunicationProviderModule } from './utilities/communication-provider/communication-provider.module';
import { VerificationCodeModule } from './utilities/communication-provider/verification-code/verification-code.module';
import { EmailModule } from './utilities/communication-provider/email/email.module';
import { RedisModule } from './utilities/redis/redis.module';
import { AuditTrailModule } from './core/audit-trail/audit-trail.module';
import { ApiConfigModule } from './core/config/config.module';
import { ApiConfigService } from './core/config/config.service';
import { WinstonLogModule } from './core/winston/winston.module';
import { OrganizationModule } from './organization/organization.module';
import { RoleModule } from './role/roles.module';
import { PermissionModule } from './auth/permission.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PropertyModule } from './property/property.module';
import { DriveModule } from './utilities/drive/drive.module';
import { FileUploadModule } from './utilities/file-upload/fileUpload.module';
import { ImageGenerationModule } from './utilities/image-generation/image-generation.module';
import { FaqsModule } from './faqs/faqs.module';
import { MenuModule } from './cms/menu/menu.module';
import { StaticPageModule } from './cms/static-page/static-page.module';
import { SlugModule } from './cms/slug/slug.module';
import { ModelRegistryModule } from './core/model-registry/model-registry.module';
import { OnDeleteCascadeModule } from './core/on-delete-cascade/on-delete-cascade.module';
import { WebStoryTemplateModule } from './webstory-template/webstory-template.module';
import { BulkOnboardingModule } from './auth/bulk-onboarding/bulk-onboarding.module';
import { PollModule } from './poll/poll.module';

import { CategoryModule } from './category/category.module';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { PermissionsGuard } from './auth/guards/permission.guard';
import { BannerTypeModule } from './banner/banner-type/banner-type.module';
import { BannerModule } from './banner/banner.module';
import { SectionModule } from './section/section.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MigratorModule } from './migrator/migrator.module';
import { SeoSettingsModule } from './seo-settings/seo-settings.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ArticleMetricsModule } from './articles/article-metrics/article-metrics.module';
import { VideoGenerationModule } from './video-generation/video-generation.module';
import { RepurposeModule } from './repurpose/repurpose.module';
import { ContentBuilderModule } from './content-builder/content-builder.module';
import { EntriesModule } from './entries/entries.module';
import { ApiKeysModule } from './api-keys/api-keys.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ApiConfigModule],
      inject: [ApiConfigService],
      useFactory: (config: ApiConfigService) => ({
        uri: config.mongoDB.uri,
        dbName: config.mongoDB.database || undefined,
      }),
    }),
    // ThrottlerModule.forRoot([
    //   {
    //     ttl: 60000,
    //     limit: 100,
    //   },
    // ]),
    ModelRegistryModule,
    OnDeleteCascadeModule,
    ArticlesModule,
    TopicsModule,
    UserModule,
    AuthModule,
    SearchModule,
    AiModule,
    AnalyticsModule,
    RoleModule,
    PermissionModule,
    TemplatesModule,
    TagsModule,
    SystemSetupModule,
    TrendsModule,
    VerificationCodeModule,
    AuditTrailModule,
    ApiConfigModule,
    EmailModule,
    WinstonLogModule,
    OrganizationModule,
    RedisModule,
    BannerTypeModule,
    BannerModule,
    CommunicationProviderModule,
    PropertyModule,
    CategoryModule,
    DriveModule,
    FileUploadModule,
    ImageGenerationModule,
    FaqsModule,
    MenuModule,
    StaticPageModule,
    SlugModule,
    TestimonialsModule,
    SectionModule,
    ScheduleModule.forRoot(),
    MigratorModule,
    SeoSettingsModule,
    IntegrationsModule,
    WebStoryTemplateModule,
    ArticleMetricsModule,
    VideoGenerationModule,
    BulkOnboardingModule,
    PollModule,
    RepurposeModule,
    ApiKeysModule,
    ContentBuilderModule,
    EntriesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // {
    //   provide: APP_GUARD,
    //   useClass: PermissionsGuard,
    // },
  ],
})
export class AppModule { }
