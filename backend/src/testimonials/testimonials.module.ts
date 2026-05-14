import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';
import { Testimonial, TestimonialSchema } from './schemas/testimonial.schema';
import { RoleModule } from 'src/role/roles.module';
import { PropertyModule } from '@property/property.module';
import { OrganizationModule } from '@organization/organization.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Testimonial.name, schema: TestimonialSchema }]),
    RoleModule,
    PropertyModule,
    OrganizationModule,
    ElasticModule,
    AuditTrailModule,
  ],
  controllers: [TestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule { }
