import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { TenantTemplate, TenantTemplateDocument } from '../templates/schemas/template.schema';
import slugify from 'slugify';
import { Role, TRoleDocument } from 'src/role/entities/role.schema';
import { Category, TCategoryDocument } from 'src/category/entities/category.schema';
import { Tag, TTagDocument } from '@tags/entities/tags.schema';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    @InjectModel(Role.name) private roleModel: Model<TRoleDocument>,
    @InjectModel(Category.name) private categoryModel: Model<TCategoryDocument>,
    @InjectModel(Tag.name) private tagModel: Model<TTagDocument>,
    @InjectModel(TenantTemplate.name) private templateModel: Model<TenantTemplateDocument>
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<TenantDocument> {
    const template = await this.templateModel.findOne({ name: createTenantDto.templateName });
    if (!template) {
      throw new NotFoundException(`Template "${createTenantDto.templateName}" not found.`);
    }

    const newTenant = await this.tenantModel.create({ name: createTenantDto.name });

    await this.createDefaultRolesForTenant(newTenant, template);
    await this.createDefaultCategoriesForTenant(newTenant, template);
    await this.createDefaultTagsForTenant(newTenant, template);

    return newTenant;
  }

  private async createDefaultRolesForTenant(
    tenant: TenantDocument,
    template: TenantTemplateDocument
  ) {
    const rolesToCreate = template.defaultRoles.map((roleName) => ({
      name: roleName,
      tenant: tenant._id,
      isSystemRole: false,
    }));
    await this.roleModel.insertMany(rolesToCreate);
  }

  private async createDefaultCategoriesForTenant(
    tenant: TenantDocument,
    template: TenantTemplateDocument
  ) {
    const categoriesToCreate = template.defaultCategories.map((catName) => ({
      name: catName,
      slug: slugify(catName, { lower: true, strict: true }),
      tenant: tenant._id,
    }));
    await this.categoryModel.insertMany(categoriesToCreate);
  }

  private async createDefaultTagsForTenant(
    tenant: TenantDocument,
    template: TenantTemplateDocument
  ) {
    const tagsToCreate = template.defaultTags.map((tagName) => ({
      name: tagName,
      slug: slugify(tagName, { lower: true, strict: true }),
      tenant: tenant._id,
    }));
    await this.tagModel.insertMany(tagsToCreate);
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantModel.find().exec();
  }

  async findOne(id: string): Promise<Tenant> {
    return this.tenantModel.findById(id).exec();
  }

  async findByName(name: string): Promise<TenantDocument> {
    return this.tenantModel.findOne({ name }).exec();
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    return this.tenantModel.findByIdAndUpdate(id, updateTenantDto, { new: true }).exec();
  }

  async remove(id: string): Promise<Tenant> {
    return this.tenantModel.findByIdAndDelete(id).exec();
  }
}
