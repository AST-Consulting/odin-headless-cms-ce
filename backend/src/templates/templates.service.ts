import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantTemplate, TenantTemplateDocument } from './schemas/template.schema';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(TenantTemplate.name) private templateModel: Model<TenantTemplateDocument>
  ) {}

  async findAll(): Promise<TenantTemplate[]> {
    return this.templateModel.find().exec();
  }
}
