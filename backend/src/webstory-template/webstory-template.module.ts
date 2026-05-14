import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebStoryTemplateService } from './webstory-template.service';
import { WebStoryTemplateController } from './webstory-template.controller';
import { WebStoryTemplate, WebStoryTemplateSchema } from './schemas/webstory-template.schema';

import { PropertyModule } from '../property/property.module';
import { OrganizationModule } from '../organization/organization.module';
import { SlugModule } from '../cms/slug/slug.module';
import { AuditTrailModule } from '../core/audit-trail/audit-trail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebStoryTemplate.name, schema: WebStoryTemplateSchema },
    ]),
    PropertyModule,
    OrganizationModule,
    SlugModule,
    AuditTrailModule,
  ],
  controllers: [WebStoryTemplateController],
  providers: [WebStoryTemplateService],
  exports: [WebStoryTemplateService],
})
export class WebStoryTemplateModule {}
