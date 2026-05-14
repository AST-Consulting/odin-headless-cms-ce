import { Module } from '@nestjs/common';
import { BannerController } from './banner.controller';
import { BannerService } from './banner.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Banner, bannerSchema } from './entities/banner.schema';
import { SlugModule } from '@cms/slug/slug.module';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { BannerTypeModule } from './banner-type/banner-type.module';
import { TagsModule } from '@tags/tags.module';
import { CategoryModule } from 'src/category/category.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { OnDeleteCascadeModule } from '@core/on-delete-cascade/on-delete-cascade.module';
import { OrganizationModule } from '@organization/organization.module';
import { PropertyModule } from '@property/property.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Banner.name,
        schema: bannerSchema,
      },
    ]),
    SlugModule,
    AuditTrailModule,
    TagsModule,
    CategoryModule,
    BannerTypeModule,
    ElasticModule,
    OrganizationModule,
    PropertyModule,
    OnDeleteCascadeModule,
  ],
  controllers: [BannerController],
  providers: [BannerService],
})
export class BannerModule {}
