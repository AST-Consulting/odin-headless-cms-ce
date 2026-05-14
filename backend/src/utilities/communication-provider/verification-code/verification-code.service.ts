import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { VerificationCode } from './veification-code.schema';
import { Model } from 'mongoose';

@Injectable()
export class VerificationCodeService {
  constructor(
    @InjectModel(VerificationCode.name)
    private verificationCodeModel: Model<VerificationCode>
  ) {}

  async findByMobileNumberOrEmail({
    mobileNumber,
    email,
  }: {
    mobileNumber?: string;
    email?: string;
  }): Promise<VerificationCode> {
    try {
      let data: VerificationCode | undefined;
      if (mobileNumber) {
        data = await this.verificationCodeModel.findOne({
          mobileNumber: mobileNumber,
        });
      } else if (email) {
        data = await this.verificationCodeModel.findOne({
          email: email,
        });
      }

      // if (!data) {
      //   throw new NotFoundException('Verification Code Not Found');
      // }

      return data;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error finding verification code: ${error.message}`);
    }
  }

  async create(verificationCodeData: Partial<VerificationCode>): Promise<VerificationCode> {
    try {
      const timestamp = this.generate10minTimestamp();
      const createdVerificationCode = new this.verificationCodeModel({
        ...verificationCodeData,
        timestamp: timestamp,
      });
      const savedVerificationCode = await createdVerificationCode.save();
      return savedVerificationCode;
    } catch (error) {
      throw new InternalServerErrorException(`Error creating verification code: ${error.message}`);
    }
  }

  async update(id: string, updateData: Partial<VerificationCode>): Promise<VerificationCode> {
    try {
      const updatedVerificationCode = await this.verificationCodeModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();
      return updatedVerificationCode;
    } catch (error) {
      throw new InternalServerErrorException(`Error updating verification code: ${error.message}`);
    }
  }

  async delete(id: string): Promise<VerificationCode | null> {
    try {
      const deletedVerificationCode = await this.verificationCodeModel.findByIdAndDelete(id).exec();

      return deletedVerificationCode;
    } catch (error) {
      throw new InternalServerErrorException(`Error deleting verification code: ${error.message}`);
    }
  }

  generate10minTimestamp(): number {
    const now = new Date();
    // Add 5 minutes to the current time
    const fiveMinutesLater = new Date(now.getTime() + 10 * 60000); // 5 minutes * 60 seconds * 1000 milliseconds

    // Convert the timestamp to milliseconds
    const timestamp = fiveMinutesLater.getTime();

    return timestamp;
  }

  checkTimeStampExpire(timestamp: number): boolean {
    const now = Date.now();
    if (now <= timestamp) {
      return true;
    }

    return false;
  }
}
