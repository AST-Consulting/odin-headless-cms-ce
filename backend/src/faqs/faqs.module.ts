import { Module } from '@nestjs/common';
import { FAQService } from './faqs.service';
import { FAQController } from './faqs.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FAQ, faqSchema } from './schema/faq.schema';
import { TagsModule } from '../tags/tags.module';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { SlugModule } from '@cms/slug/slug.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { OnDeleteCascadeModule } from '@core/on-delete-cascade/on-delete-cascade.module';
import { CategoryModule } from 'src/category/category.module';
import { OrganizationModule } from '@organization/organization.module';
import { PropertyModule } from '@property/property.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FAQ.name, schema: faqSchema }]),
    TagsModule,
    CategoryModule,
    AuditTrailModule,
    SlugModule,
    ElasticModule,
    OnDeleteCascadeModule,
    PropertyModule,
    OrganizationModule,
  ],
  providers: [FAQService],
  exports: [FAQService],
  controllers: [FAQController],
})
export class FaqsModule {}
