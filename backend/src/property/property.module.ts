import { Module, forwardRef } from '@nestjs/common';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from 'src/user/user.module';
import { ElasticModule } from 'src/core/elastic/elastic.module';
import { Property, PropertySchema } from './schema/property.schema';
import { AuditTrailModule } from 'src/core/audit-trail/audit-trail.module';
import { EmailModule } from 'src/utilities/communication-provider/email/email.module';
import { VerificationCodeModule } from 'src/utilities/communication-provider/verification-code/verification-code.module';
import { JwtModule } from '@nestjs/jwt';
import { ApiConfigService } from 'src/core/config/config.service';
import { PermissionModule } from 'src/auth/permission.module';
import { OrganizationModule } from '@organization/organization.module';
import { SeoSettingsModule } from 'src/seo-settings/seo-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }]),
    ElasticModule,
    forwardRef(() => UserModule),
    AuditTrailModule,
    EmailModule,
    forwardRef(() => PermissionModule),
    VerificationCodeModule,
    forwardRef(() => OrganizationModule),
    SeoSettingsModule,
    JwtModule.registerAsync({
      useFactory: (configService: ApiConfigService) => ({
        secret: configService.jwt.accessSecret,
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ApiConfigService],
    }),
  ],

  providers: [PropertyService, ApiConfigService],
  controllers: [PropertyController],
  exports: [PropertyService],
})
export class PropertyModule {}
