import { forwardRef, Module } from '@nestjs/common';
import { Role, RoleSchema } from './entities/role.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { RoleController } from './role.controller';
import { ElasticModule } from 'src/core/elastic/elastic.module';
import { AuditTrailModule } from 'src/core/audit-trail/audit-trail.module';
import { RoleService } from './role.service';
import { OrganizationModule } from 'src/organization/organization.module';
import { PropertyModule } from 'src/property/property.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Role.name, schema: RoleSchema }]),
    ElasticModule,
    AuditTrailModule,
    forwardRef(() => OrganizationModule),
    forwardRef(() => PropertyModule),
  ],
  providers: [RoleService],
  controllers: [RoleController],
  exports: [RoleService],
})
export class RoleModule {}
