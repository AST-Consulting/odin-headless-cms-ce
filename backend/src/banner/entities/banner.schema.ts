import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import { BannerOpenIn, BannerRunsOn, STATUS } from '@core/constants/enums.constants';
import { UserInfoSchema } from '@core/schema/general.schema';
import { UserInfo } from '@core/utils/utilVars';
import { FileSub } from '@utilities/file-upload/entities/file-sub.schema';
import { TagSub } from '@tags/entities/tag-sub.schema';
import { CategorySub } from 'src/category/entities/category-sub.schema';
import { BannerTypeSub } from '../banner-type/entities/sub/banner-type-sub.schema';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';

// Sub-schema for Nested Banner
export class NestedBanner {
  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: false })
  ctaText: string;

  @Prop({ required: false })
  appLink: string;

  @Prop({ required: false })
  apiLink: string;

  @Prop({ required: false })
  webLink: string;

  @Prop({ type: FileSub, required: false })
  image: FileSub;

  @Prop({ type: String })
  description: string;

  @Prop({ type: String, enum: BannerOpenIn, default: BannerOpenIn.SAME })
  openIn: string;

  @Prop({ type: String, enum: BannerRunsOn, default: BannerRunsOn.BOTH })
  runsOn: string;

  @Prop({ default: 0 })
  rank: number;

  @Prop({ type: Date, required: false })
  startDate: Date;

  @Prop({ type: Date, required: false })
  endDate: Date;

  @Prop({ type: String, enum: STATUS, default: STATUS.ACTIVE })
  status: string;
}

// Parent Banner Schema
@Schema({ timestamps: true })
export class Banner extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ type: String })
  description: string;

  @Prop({ required: true, type: BannerTypeSub })
  bannerType: BannerTypeSub;

  @Prop({ type: [NestedBanner], required: true })
  banners: NestedBanner[]; // Array of banners grouped under the parent

  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ type: Number })
  rank: number;

  @Prop({ type: String, default: STATUS.ACTIVE, required: true })
  status: string;

  @Prop({ type: [CategorySub], required: true })
  categories: CategorySub[];

  @Prop({ type: [TagSub], default: [] })
  tags: TagSub[];

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: UserInfoSchema })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy: UserInfo;

  @Prop({ required: false })
  organization: OrganizationSub;

  @Prop({ required: false })
  property: PropertySub;
}

export type TBannerDocument = HydratedDocument<Banner>;
export type TNestedBannerDocument = HydratedDocument<NestedBanner>;
export const bannerSchema = SchemaFactory.createForClass(Banner);

// Indexes for Query Optimization
bannerSchema.index({ status: 1 });
bannerSchema.index({ 'banners.rank': 1 });
bannerSchema.index({ 'banners.bannerType.id': 1 });
