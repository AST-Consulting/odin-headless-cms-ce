import { forwardRef, Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permission.guard';
import { RoleModule } from '../role/roles.module';
import { UserModule } from '../user/user.module';
import { AuthModule } from './auth.module';

@Module({
  imports: [RoleModule, forwardRef(() => UserModule), forwardRef(() => AuthModule)],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard, RoleModule, AuthModule],
})
export class PermissionModule {}
