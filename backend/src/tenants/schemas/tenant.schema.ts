import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantDocument = Tenant & Document;

@Schema({ _id: false })
class Features {
  @Prop({ default: false })
  personalization: boolean;

  @Prop({ default: false })
  abTesting: boolean;
}

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ default: 'standard' })
  plan: string;

  @Prop({ type: Features, default: () => ({}) })
  features: Features;

  @Prop({ default: true })
  isActive: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
