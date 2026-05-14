import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { User, TUserDocument } from '@user/entities/user.schema';
import { QUEUE_CONSTANTS } from '@core/constants/redis.constants';
import { STATUS } from '@core/constants/enums.constants';

@Injectable()
export class BulkOnboardingService {
  private readonly _logger = new Logger(BulkOnboardingService.name);

  constructor(
    @InjectModel(User.name) private readonly _userModel: Model<TUserDocument>,
    @InjectQueue(QUEUE_CONSTANTS.ONBOARDING_QUEUE) private readonly _onboardingQueue: Queue,
  ) {}

  /**
   * Bulk triggers the onboarding process for users who haven't completed it.
   * Supports an optional email for targeted testing.
   */
  async bulkInviteUsers(limit?: number, email?: string): Promise<{ queued: number }> {
    this._logger.log(`Starting bulk trigger...`);
    
    // Target users who haven't finished onboarding and are not active in any property.
    const filter: any = {
      hasCompletedOnboarding: { $ne: true },
      'properties.status': { $ne: STATUS.ACTIVE },
      email: { $exists: true, $ne: '' },
    };

    if (email) {
      const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.email = { $regex: new RegExp(`^${escapedEmail}$`, 'i') };
      delete filter.hasCompletedOnboarding; // Allow re-testing for specific email
      this._logger.log(`Targeting specific email: ${email} (case-insensitive, escaped, lenient)`);
    }

    const users = await this._userModel
      .find(filter)
      .limit(limit || 0)
      .select('_id email name')
      .lean();
    
    this._logger.log(`Found ${users.length} candidate users. Adding to queue...`);

    let queuedCount = 0;
    for (const user of users) {
      try {
        await this._onboardingQueue.add(QUEUE_CONSTANTS.USER_INVITATION_JOB, {
          userId: (user as any)._id.toString(),
          email: user.email,
          name: user.name,
        });
        queuedCount++;
      } catch (err: any) {
        this._logger.error(`Failed to queue user ${user.email}: ${err.message}`);
      }
    }

    this._logger.log(`Batch queuing completed: ${queuedCount} users added.`);
    return { queued: queuedCount };
  }

  /**
   * Returns current job counts for queue auditing.
   */
  async getQueueStatus() {
    const counts = await this._onboardingQueue.getJobCounts();
    return {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    };
  }
}
