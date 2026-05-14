import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { TenantTemplate, TenantTemplateDocument } from '../templates/schemas/template.schema';
import { defaultTemplates } from './templates/default-templates';
import { TUserDocument, User } from 'src/user/entities/user.schema';
import { Role, TRoleDocument } from 'src/role/entities/role.schema';

enum RoleEnum {
  SuperAdmin = 'SuperAdmin',
  TenantAdmin = 'TenantAdmin',
}

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectModel(Role.name) private roleModel: Model<TRoleDocument>,
    @InjectModel(TenantTemplate.name) private templateModel: Model<TenantTemplateDocument>,
    @InjectModel(User.name) private userModel: Model<TUserDocument>
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('--- Seeding Initial System Data ---');
    await this.createSystemRoles();
    await this.createTenantTemplates();
    await this.createSuperAdminUser();
    this.logger.log('--- Seeding Complete ---');
  }

  private async createSystemRoles() {
    const rolesToCreate = [RoleEnum.SuperAdmin, RoleEnum.TenantAdmin];
    for (const roleName of rolesToCreate) {
      const roleExists = await this.roleModel.findOne({ name: roleName, isSystemRole: true });
      if (!roleExists) {
        await this.roleModel.create({ name: roleName, isSystemRole: true, tenant: null });
        this.logger.log(`Created system role: ${roleName}`);
      }
    }
  }

  private async createTenantTemplates() {
    for (const templateData of defaultTemplates) {
      const templateExists = await this.templateModel.findOne({ name: templateData.name });
      if (!templateExists) {
        await this.templateModel.create(templateData);
        this.logger.log(`Created tenant template: ${templateData.name}`);
      }
    }
  }

  private async createSuperAdminUser() {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const userExists = await this.userModel.findOne({ email });

    if (!userExists) {
      // Get SuperAdmin role
      const superAdminRole = await this.roleModel.findOne({
        name: RoleEnum.SuperAdmin,
        isSystemRole: true,
      });

      // Hash password
      const hashedPassword = await bcrypt.hash('aBc#45980Z', 10);

      // Create user
      await this.userModel.create({
        name: 'Ashok Kumar',
        email: email,
        password: hashedPassword,
        role: superAdminRole._id,
      });

      this.logger.log(`Created SuperAdmin user: ${email}`);
    } else {
      this.logger.log(`SuperAdmin user already exists: ${email}`);
    }
  }
}
