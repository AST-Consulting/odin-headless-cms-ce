import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserInfoSchema } from 'src/core/schema/general.schema';
import { UserInfo } from 'src/core/utils/utilVars';
import { PropertySub } from 'src/property/schema/property.sub-schema';
import { OrganizationSub } from 'src/organization/entities/organization-sub.schema';

export type TSeoSettingsHistoryDocument = HydratedDocument<SeoSettingsHistory>;

@Schema({ timestamps: true, collection: 'seo_settings_history' })
export class SeoSettingsHistory {
  @Prop({ required: true })
  property: PropertySub;

  @Prop({ required: false })
  organization?: OrganizationSub;

  @Prop({ required: true, enum: ['robots', 'ads', 'llms'] })
  fileType: string;

  /** Monotonically increasing per (property.id, fileType) — e.g. "v1", "v2" */
  @Prop({ required: true })
  version: string;

  /** 'auto-generated' | 'manual-update' | 'rollback-from-v{n}' */
  @Prop({ required: true })
  action: string;

  @Prop({ type: UserInfoSchema, required: true })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema, required: true })
  updatedBy: UserInfo;

  /** Full file content at this point in time */
  @Prop({ required: true })
  content: string;
}

export const SeoSettingsHistorySchema = SchemaFactory.createForClass(SeoSettingsHistory);

SeoSettingsHistorySchema.index({ 'property.id': 1, fileType: 1 });
