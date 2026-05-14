import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { BulkOnboardingService } from './bulk-onboarding.service';
import { BulkOnboardingProcessor } from './bulk-onboarding.processor';
import { QUEUE_CONSTANTS } from '@core/constants/redis.constants';
import { User, UserSchema } from '@user/entities/user.schema';
import { EmailModule } from '@utilities/communication-provider/email/email.module';
import { UserModule } from '@user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    BullModule.registerQueue({
      name: QUEUE_CONSTANTS.ONBOARDING_QUEUE,
    }),
    EmailModule,
    UserModule,
  ],
  providers: [BulkOnboardingService, BulkOnboardingProcessor],
  exports: [BulkOnboardingService],
})
export class BulkOnboardingModule {}
