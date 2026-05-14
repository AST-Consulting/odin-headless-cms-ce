import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TagsService } from './tags.service';
import { TagController } from './tags.controller';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { OnDeleteCascadeModule } from '@core/on-delete-cascade/on-delete-cascade.module';
import { SlugModule } from '@cms/slug/slug.module';
import { Tag, tagSchema } from './entities/tags.schema';
import { OrganizationModule } from '@organization/organization.module';
import { PropertyModule } from '@property/property.module';
import { WpCompatibleController } from './wp-compatible.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tag.name, schema: tagSchema }]),
    AuditTrailModule,
    ElasticModule,
    OnDeleteCascadeModule,
    forwardRef(() => OrganizationModule),
    forwardRef(() => PropertyModule),
    forwardRef(() => SlugModule),
  ],
  controllers: [TagController, WpCompatibleController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule { }
