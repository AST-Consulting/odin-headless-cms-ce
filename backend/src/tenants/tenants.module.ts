import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { TenantTemplate, TenantTemplateSchema } from '../templates/schemas/template.schema';
import { Role, RoleSchema } from 'src/role/entities/role.schema';
import { RoleModule } from 'src/role/roles.module';
import { Category, categorySchema } from 'src/category/entities/category.schema';
import { Tag, tagSchema } from '@tags/entities/tags.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Category.name, schema: categorySchema },
      { name: Tag.name, schema: tagSchema },
      { name: TenantTemplate.name, schema: TenantTemplateSchema },
    ]),
    RoleModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
