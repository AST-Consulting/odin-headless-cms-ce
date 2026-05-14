import { Injectable, NotFoundException } from '@nestjs/common';
import { MESSAGE } from '../core/constants/generalMessages.constants';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WebStoryTemplate, WebStoryTemplateDocument } from './schemas/webstory-template.schema';
import { PropertyService } from '../property/property.service';
import { OrganizationService } from '../organization/organization.service';
import { SlugService } from '../cms/slug/slug.service';
import { buildUserMetadata } from '../core/utils/utils';
import { TCurrentUserType } from '../auth/types/user.type';
import { AuditTrailService } from '../core/audit-trail/audit-trail.service';
import { ACTIONS, ModuleName } from '../core/constants/enums.constants';

@Injectable()
export class WebStoryTemplateService {
  constructor(
    @InjectModel(WebStoryTemplate.name)
    private templateModel: Model<WebStoryTemplateDocument>,
    private readonly propertyService: PropertyService,
    private readonly organizationService: OrganizationService,
    private readonly slugService: SlugService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  private async enrichData(data: any) {
    const { propertyId, organizationId, ...rest } = data;
    const enriched = { ...rest };

    if (propertyId) {
      const property = await this.propertyService.getById(propertyId);
      if (property) {
        enriched.property = {
          id: property._id.toString(),
          name: property.name,
          domain: property.domain,
        };
      }
    }

    if (organizationId) {
      const organization = await this.organizationService.findOne(organizationId);
      if (organization) {
        enriched.organization = {
          id: organization._id.toString(),
          name: organization.organization_name,
          slug: organization.organization_name,
          domain: organization.domain,
        };
      }
    }

    return enriched;
  }

  async create(data: any, user: TCurrentUserType) {
    const enrichedData = await this.enrichData(data);
    
    // Generate unique slug
    enrichedData.slug = await this.slugService.generateUniqueSlug(
      data.name,
      'webstory-template' as any,
      user,
      undefined,
      data.propertyId,
      data.slug,
    );

    const userMetadata = buildUserMetadata(user);
    enrichedData.createdBy = userMetadata;
    enrichedData.updatedBy = userMetadata;

    const createdTemplate = new this.templateModel(enrichedData);
    const saved = await createdTemplate.save();

    await this.auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.WEBSTORY_TEMPLATE,
      user,
      objectId: saved._id as any,
      existingData: null,
      newData: saved,
    });

    return saved;
  }

  async findAll() {
    return this.templateModel.find().exec();
  }

  async findOne(id: string) {
    const template = await this.templateModel.findById(id).exec();
    if (!template) throw new NotFoundException(MESSAGE.WEBSTORY_TEMPLATE.NOT_FOUND);
    return template;
  }

  async update(id: string, data: any, user?: TCurrentUserType) {
    const enrichedData = await this.enrichData(data);
    
    if (user) {
      enrichedData.updatedBy = buildUserMetadata(user);
    }

    const existing = await this.templateModel.findById(id).exec();
    if (!existing) throw new NotFoundException(MESSAGE.WEBSTORY_TEMPLATE.NOT_FOUND);

    const updated = await this.templateModel
      .findByIdAndUpdate(id, enrichedData, { new: true })
      .exec();
    
    if (user) {
      await this.auditTrailService.logAuditTrail({
        action: ACTIONS.UPDATE,
        collectionName: ModuleName.WEBSTORY_TEMPLATE,
        user,
        objectId: new Types.ObjectId(id) as any,
        existingData: existing,
        newData: updated,
      });
    }

    return updated;
  }

  async remove(id: string, user: TCurrentUserType) {
    const existing = await this.templateModel.findById(id).exec();
    if (!existing) throw new NotFoundException(MESSAGE.WEBSTORY_TEMPLATE.NOT_FOUND);

    const deleted = await this.templateModel.findByIdAndDelete(id).exec();

    await this.auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.WEBSTORY_TEMPLATE,
      user,
      objectId: new Types.ObjectId(id) as any,
      existingData: existing,
      newData: null,
    });

    return deleted;
  }
}
