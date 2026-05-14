import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSetupService } from './system-setup.service';
import { TenantTemplate, TenantTemplateSchema } from '../templates/schemas/template.schema';
import { Role, RoleSchema } from 'src/role/entities/role.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: TenantTemplate.name, schema: TenantTemplateSchema },
    ]),
  ],
  providers: [SystemSetupService],
  exports: [SystemSetupService],
})
export class SystemSetupModule {}
