import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class VerificationCode extends Document {
  @Prop({ type: String })
  mobileNumber: string;

  @Prop({ type: String })
  email: string;

  @Prop({ required: true })
  otp: string;

  @Prop({ type: Number })
  timestamp: number;

  @Prop({ type: String })
  smsId?: string;

  @Prop({ default: false })
  isVerified: boolean;
}

export const VerificationCodeSchema = SchemaFactory.createForClass(VerificationCode);
