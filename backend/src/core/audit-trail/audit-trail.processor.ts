import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditTrailService } from './audit-trail.service';
import { ICreateAuditTrail } from './entities/create-audit-trail.interface';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUE_CONSTANTS } from '../constants/redis.constants';
import { Job } from 'bullmq';

@Injectable()
@Processor(QUEUE_CONSTANTS.AUDIT_QUEUE)
export class AuditTrailProcessor extends WorkerHost {
  constructor(
    private readonly _auditTrailService: AuditTrailService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {
    super();
  }

  async process(job: Job<ICreateAuditTrail>): Promise<void> {
    // console.log('inside the processor', data);
    this._logger.log(`Received audit trail job ${job.id}`);
    const { action, collectionName, user, objectId, existingData, newData } = job.data;

    try {
      // Create and save a new AuditTrail document
      await this._auditTrailService.createAuditTrail({
        action,
        collectionName,
        user,
        objectId,
        existingData,
        newData,
      });

      this._logger.log(`Audit log processed: ${action} on ${collectionName} by ${user.name}`);
    } catch (error) {
      this._logger.error('Error processing audit log:', error);
    }
  }
}
