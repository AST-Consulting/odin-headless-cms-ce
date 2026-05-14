import { UserInfoSchema } from '@core/schema/general.schema';
import { UserInfo } from '@core/utils/utilVars';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { Document } from 'mongoose';

export type ApiKeyDocument = ApiKey & Document;

@Schema({ timestamps: true })
export class ApiKey {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  keyHash: string;

  @Prop({ required: false })
  organization?: OrganizationSub;

  @Prop({ type: UserInfoSchema, required: true })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy?: UserInfo;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  expiresAt?: Date;

  @Prop()
  lastUsedAt?: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
