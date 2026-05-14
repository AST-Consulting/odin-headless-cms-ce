import { Module } from '@nestjs/common';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailService } from './audit-trail.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditTrail, auditTrailSchema } from './entities/audit-trail.schema';
import { AuditTrailProcessor } from './audit-trail.processor';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from 'src/utilities/redis/redis.module';
import { QUEUE_CONSTANTS } from '../constants/redis.constants';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditTrail.name, schema: auditTrailSchema }]),
    RedisModule, // Import the Redis module that configures Bull
    BullModule.registerQueue({
      name: QUEUE_CONSTANTS.AUDIT_QUEUE, // Register the unique queue name
    }),
  ],
  controllers: [AuditTrailController],
  providers: [AuditTrailService, AuditTrailProcessor],
  exports: [AuditTrailService],
})
export class AuditTrailModule { }
