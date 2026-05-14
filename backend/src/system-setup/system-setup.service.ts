import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role as RoleEnum } from '../auth/guards/role.enum';
import { TenantTemplate, TenantTemplateDocument } from 'src/templates/schemas/template.schema';
import { defaultTemplates } from 'src/seeder/templates/default-templates';
import { Role, TRoleDocument } from 'src/role/entities/role.schema';

@Injectable()
export class SystemSetupService {
  private readonly logger = new Logger(SystemSetupService.name);

  constructor(
    @InjectModel(Role.name) private roleModel: Model<TRoleDocument>,
    @InjectModel(TenantTemplate.name) private templateModel: Model<TenantTemplateDocument>
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('--- Running System Setup ---');
    await this.createSystemRolesIfNotExist();
    await this.createTenantTemplatesIfNotExist();
    this.logger.log('--- System Setup Complete ---');
  }

  private async createSystemRolesIfNotExist() {
    const rolesToCreate = [RoleEnum.SuperAdmin, RoleEnum.TenantAdmin];
    for (const roleName of rolesToCreate) {
      const roleExists = await this.roleModel.findOne({ name: roleName, isSystemRole: true });
      // if (!roleExists) {
      //   await this.roleModel.create({ name: roleName, isSystemRole: true, tenant: null });
      //   this.logger.log(`Created system role: ${roleName}`);
      // }
    }
  }

  private async createTenantTemplatesIfNotExist() {
    for (const templateData of defaultTemplates) {
      const templateExists = await this.templateModel.findOne({ name: templateData.name });
      if (!templateExists) {
        await this.templateModel.create(templateData);
        this.logger.log(`Created tenant template: ${templateData.name}`);
      }
    }
  }
}
