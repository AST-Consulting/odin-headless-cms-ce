import { Module } from '@nestjs/common';
import { BannerTypeService } from './banner-type.service';
import { BannerTypeController } from './banner-type.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BannerType, bannerTypeSchema } from './entities/banner-type.schema';
import { SlugModule } from '@cms/slug/slug.module';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { OnDeleteCascadeModule } from '@core/on-delete-cascade/on-delete-cascade.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { PropertyModule } from '@property/property.module';
import { OrganizationModule } from '@organization/organization.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: BannerType.name,
        schema: bannerTypeSchema,
      },
    ]),
    SlugModule,
    AuditTrailModule,
    ElasticModule,
    OnDeleteCascadeModule,
    PropertyModule,
    OrganizationModule,
  ],
  exports: [BannerTypeService],
  providers: [BannerTypeService],
  controllers: [BannerTypeController],
})
export class BannerTypeModule {}
