import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeederService } from './seeder.service';
import { TenantTemplate, TenantTemplateSchema } from '../templates/schemas/template.schema';
import { User, UserSchema } from 'src/user/entities/user.schema';
import { Role } from 'src/role/entities/role.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: Role },
      { name: TenantTemplate.name, schema: TenantTemplateSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [SeederService],
})
export class SeederModule {}
