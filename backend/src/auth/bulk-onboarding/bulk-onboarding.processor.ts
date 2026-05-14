import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as moment from 'moment';
import { User, TUserDocument } from '@user/entities/user.schema';
import { QUEUE_CONSTANTS } from '@core/constants/redis.constants';
import { EmailService } from '@utilities/communication-provider/email/email.service';
import { STATUS } from '@core/constants/enums.constants';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { getUserInvitationMail } from '@utilities/email-templates';

@Injectable()
@Processor(QUEUE_CONSTANTS.ONBOARDING_QUEUE)
export class BulkOnboardingProcessor extends WorkerHost {
  private readonly _logger = new Logger(BulkOnboardingProcessor.name);

  constructor(
    @InjectModel(User.name) private readonly _userModel: Model<TUserDocument>,
    private readonly _emailService: EmailService,
  ) {
    super();
  }

  /**
   * Processes a single user invitation job.
   */
  async process(job: Job<any>): Promise<void> {
    const { userId, email, name } = job.data;
    this._logger.log(`Processing onboarding job for: ${email}`);

    try {
      const user = await this._userModel.findById(userId);
      if (!user) {
        this._logger.error(`User with ID ${userId} not found.`);
        return;
      }

      // 1. Generate secure temporary credentials
      const tempPassword = this._generateRandomPassword(12);
      const invitationToken = Buffer.from(`${email}:${tempPassword}`).toString('base64');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // 2. Prepare property updates (setting status to pending for onboarding)
      const updatedProperties = (user.properties || []).map((p: any) => {
        const pObj = p.toObject ? p.toObject() : p;
        return { ...pObj, status: STATUS.PENDING };
      });

      // 3. Update User document with invitation details
      await this._userModel.findByIdAndUpdate(userId, {
        $set: {
          password: hashedPassword,
          invitationToken,
          invitationExpiresAt: moment().add(1, 'day').toDate(),
          properties: updatedProperties,
          isVerified: false,
          generateNewPw: true,
          hasCompletedOnboarding: true,
        },
      });

      // 4. Send Invitation Email
      const magicLink = `${process.env.HOSTED_URL}/register?token=${invitationToken}`;
      
      // Determine branding based on property or organization
      const brandName = (user.properties && user.properties.length > 0)
        ? user.properties[0].name
        : (user.organization?.name || 'CMS');

      await this._emailService.sendMail(
        MESSAGE.SUBJECT.USER_INVITATION(brandName),
        getUserInvitationMail(name || email, tempPassword, magicLink, brandName),
        { name: name || email, email: email }
      );

      this._logger.log(`Invitation sent successfully to ${email}`);
    } catch (error: any) {
      this._logger.error(`Error processing onboarding for ${email}: ${error.message}`);
      throw error; // BullMQ handles retries
    }
  }

  /**
   * Utility to generate a random password for onboarding.
   */
  private _generateRandomPassword(length: number): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let retVal = '';
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  }
}
