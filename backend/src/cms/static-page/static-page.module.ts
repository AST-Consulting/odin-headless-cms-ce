import { Module } from '@nestjs/common';
import { StaticPageService } from './static-page.service';
import { StaticPageController } from './static-page.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StaticPage, staticPageSchema } from './entities/static-page.schema';
import { SlugModule } from '@cms/slug/slug.module';
import { TagsModule } from '../../tags/tags.module';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { OnDeleteCascadeModule } from '@core/on-delete-cascade/on-delete-cascade.module';
import { CategoryModule } from 'src/category/category.module';
import { PropertyModule } from '@property/property.module';
import { OrganizationModule } from '@organization/organization.module';
import { WpCompatibleController } from './wp-compatible.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: StaticPage.name,
        schema: staticPageSchema,
      },
    ]),
    SlugModule,
    TagsModule,
    CategoryModule,
    AuditTrailModule,
    ElasticModule,
    OnDeleteCascadeModule,
    PropertyModule,
    OrganizationModule,
  ],
  providers: [StaticPageService],
  controllers: [StaticPageController,WpCompatibleController],
})
export class StaticPageModule {}
