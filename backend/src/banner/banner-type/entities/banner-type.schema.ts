import { STATUS } from '@core/constants/enums.constants';
import { UserInfoSchema } from '@core/schema/general.schema';
import { UserInfo } from '@core/utils/utilVars';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';
import { HydratedDocument } from 'mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true }) // Automatically adds `createdAt` and `updatedAt` fields
export class BannerType extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, required: true, unique: true }) // Added slug for uniqueness
  slug: string;

  @Prop({ required: false })
  entity: string;

  @Prop({ type: String, enum: STATUS, default: STATUS.ACTIVE })
  status: string; // Status of the banner

  @Prop({ type: UserInfoSchema }) // Keeping track of who created the banner
  createdBy: UserInfo; // User info of the creator

  @Prop({ type: UserInfoSchema }) // Keeping track of who last updated the banner
  updatedBy: UserInfo; // User info of the last updater

  @Prop({ required: false })
  organization: OrganizationSub;

  @Prop({ required: false })
  property: PropertySub;
}

export type TBannerTypeDocument = HydratedDocument<BannerType>;

export const bannerTypeSchema = SchemaFactory.createForClass(BannerType);

bannerTypeSchema.index({ status: 1 });
bannerTypeSchema.index({ name: 1 });
