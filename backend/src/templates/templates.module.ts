import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantTemplate, TenantTemplateSchema } from './schemas/template.schema';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TenantTemplate.name, schema: TenantTemplateSchema }]),
  ],
  providers: [TemplatesService],
  controllers: [TemplatesController],
  exports: [MongooseModule],
})
export class TemplatesModule {}
