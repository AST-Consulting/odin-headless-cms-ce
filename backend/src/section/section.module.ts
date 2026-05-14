import { Module } from '@nestjs/common';
import { SectionController } from './section.controller';
import { SectionService } from './section.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SlugModule } from '@cms/slug/slug.module';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { TagsModule } from '@tags/tags.module';
import { Section, SectionSchema } from './entities/section.entity';
import { TestimonialsModule } from '@testimonials/testimonials.module';
import { Testimonial, TestimonialSchema } from '@testimonials/schemas/testimonial.schema';
import { CategoryModule } from 'src/category/category.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { Article, ArticleSchema } from '@articles/schemas/article.schema';
import { OrganizationModule } from '@organization/organization.module';
import { PropertyModule } from '@property/property.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Section.name,
        schema: SectionSchema,
      },
      {
        name: Testimonial.name,
        schema: TestimonialSchema,
      },
      {
        name: Article.name,
        schema: ArticleSchema,
      },
    ]),
    SlugModule,
    AuditTrailModule,
    TagsModule,
    CategoryModule,
    ElasticModule,
    TestimonialsModule,
    OrganizationModule,
    PropertyModule,
  ],
  controllers: [SectionController],
  providers: [SectionService],
  exports: [SectionService],
})
export class SectionModule {}
