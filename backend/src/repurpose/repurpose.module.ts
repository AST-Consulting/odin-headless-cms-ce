import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '@ai/ai.module';
import { ArticlesModule } from '@articles/articles.module';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { QUEUE_CONSTANTS } from '@core/constants/redis.constants';
import { ImageGenerationModule } from '@utilities/image-generation/image-generation.module';
import { IntegrationsModule } from 'src/integrations/integrations.module';
import { RepurposeController } from './repurpose.controller';
import { RepurposeProcessor } from './repurpose.processor';
import { RepurposeService } from './repurpose.service';
import {
  RepurposeJob,
  RepurposeJobSchema,
} from './schemas/repurpose-job.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RepurposeJob.name, schema: RepurposeJobSchema },
    ]),
    BullModule.registerQueue({ name: QUEUE_CONSTANTS.REPURPOSE_QUEUE }),
    forwardRef(() => AiModule),
    forwardRef(() => ArticlesModule),
    AuditTrailModule,
    ImageGenerationModule,
    IntegrationsModule,
  ],
  controllers: [RepurposeController],
  providers: [RepurposeService, RepurposeProcessor],
  exports: [RepurposeService],
})
export class RepurposeModule {}
