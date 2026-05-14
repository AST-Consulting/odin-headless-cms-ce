import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import * as twilio from 'twilio';

@Injectable()
export class CommunicationProviderService {
  private readonly twilioClient: twilio.Twilio;
  private readonly accountSid = process.env.TWILIO_SID;
  private readonly authToken = process.env.TWILIO_AUTH_TOKEN;

  constructor() {
    this.twilioClient = new twilio.Twilio(this.accountSid, this.authToken);
  }

  private validateMobileNumber(mobileNumber: string): boolean {
    const regex = /^(\+91[789]\d{9})$/;
    return regex.test(mobileNumber);
  }

  async sendWhatsAppMessage(to: string, message: string) {
    try {
      const isValidPhone = this.validateMobileNumber(to);
      if (!isValidPhone) {
        throw new BadRequestException('Invalid mobile number');
      }
      await this.twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP}`,
        to: `whatsapp:${to}`,
        body: message,
      });
      console.log(`Message sent to ${to} on whatsapp`);
    } catch (error) {
      console.log(`Error while sending message on whatsapp: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error while sending message on whatsapp: ${error.message}`
      );
    }
  }

  async sendSMS(to: string, message: string) {
    try {
      const isValidPhone = this.validateMobileNumber(to);
      if (!isValidPhone) {
        throw new BadRequestException('Invalid mobile number');
      }
      const response = await this.twilioClient.messages.create({
        from: process.env.TWILIO_SMS,
        to,
        body: message,
      });
      return response;
    } catch (error) {
      console.log(`Error while sending SMS: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error while sending SMS: ${error.message}`);
    }
  }
}
