import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AtStrategy, RtStrategy } from './strategies';
import { UserModule } from 'src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { CommunicationProviderModule } from 'src/utilities/communication-provider/communication-provider.module';
import { VerificationCodeModule } from 'src/utilities/communication-provider/verification-code/verification-code.module';
import { EmailModule } from 'src/utilities/communication-provider/email/email.module';
import { AuditTrailModule } from 'src/core/audit-trail/audit-trail.module';
import { ElasticModule } from 'src/core/elastic/elastic.module';
import { RoleModule } from 'src/role/roles.module';
import { OrganizationModule } from 'src/organization/organization.module';
import { PropertyModule } from 'src/property/property.module';

@Module({
  imports: [
    forwardRef(() => UserModule),
    JwtModule.register({}),
    CommunicationProviderModule,
    VerificationCodeModule,
    EmailModule,
    AuditTrailModule,
    ElasticModule,
    forwardRef(() => RoleModule),
    forwardRef(() => OrganizationModule),
    forwardRef(() => PropertyModule),
  ],
  providers: [AuthService, AtStrategy, RtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
