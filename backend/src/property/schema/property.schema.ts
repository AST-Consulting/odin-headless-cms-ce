import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  ARTICLE_TYPE,
  PLATFORM,
  PUBLISH_TYPE,
  STATUS,
  INDUSTRY,
  PUBLISH_STATUS,
} from 'src/core/constants/enums.constants';
import { IUserSub } from 'src/user/entities/user-sub.interface';
import { UserSub } from 'src/user/entities/user-sub.schema';
import {
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import * as moment from 'moment-timezone';
import { UserInfoSchema } from 'src/core/schema/general.schema';
import { UserInfo } from 'src/core/utils/utilVars';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';

@ValidatorConstraint({ name: 'isTimeZone', async: false })
export class IsTimeZoneConstraint implements ValidatorConstraintInterface {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(timeZone: string, _args: ValidationArguments) {
    return moment.tz.zone(timeZone) !== null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultMessage(_args: ValidationArguments) {
    return 'Invalid time zone. Please use a valid IANA time zone like "Asia/Kolkata"';
  }
}

export
@Schema({ _id: true })
class Property {
  @Prop({ required: true })
  domain: string;

  @Prop({
    type: {
      username: String,
      password: String,
    },
    required: false,
  })
  credential: {
    username: string;
    password: string;
  };

  @Prop({ type: [{ email: String, verified: Boolean }], required: false })
  postignEmail: { email: string; verified: boolean }[];

  @Prop({ required: true, default: STATUS.ACTIVE })
  status: string;

  @Prop({ required: false, enum: PLATFORM, default: PLATFORM.OTHER })
  platform: string;

  @Prop({ required: false })
  websiteType: string;

  @Prop({ required: false })
  name: string;

  @Prop({ required: false })
  about: string;

  @Prop({ required: false, enum: ARTICLE_TYPE })
  articleType: string;

  @Prop({ required: false })
  lastScheduledAt: Date;

  @Prop({ required: false, enum: PUBLISH_STATUS, default: PUBLISH_STATUS.SCHEDULED })
  publishStatus: string;

  @Prop({ required: false, enum: PUBLISH_TYPE })
  publish_type: string;

  @Prop({ required: false, enum: INDUSTRY })
  industry: string;

  // Google Search Console Configuration
  @Prop({ required: false })
  googleSearchConsoleUrl: string;

  @Prop({ type: Boolean, default: false })
  isGoogleSearchConsoleActive: boolean;

  // Google Analytics Configuration
  @Prop({ required: false })
  googleAnalyticsPropertyId: string[];

  @Prop({ type: Boolean, default: false })
  isGoogleAnalyticsActive: boolean;

  // Website Analysis Data
  @Prop({ required: false })
  websiteName: string;

  @Prop({ required: false })
  specialInstruction: string;

  @Prop({ required: false, type: Number, default: 1920 })
  imageWidth: number;

  @Prop({ required: false, type: Number, default: 1080 })
  imageHeight: number;

  @Prop({ required: false })
  businessType: string;

  @Prop({ required: false })
  summary: string;

  @Prop({ type: [String], required: false })
  blogThemes: string[];

  @Prop({ type: [String], required: false })
  featuresAndBenefits: string[];

  @Prop({
    type: [String],
    required: false,
  })
  targetAudience: string[];

  // ✅ Add this for time zone
  @Prop({ required: false, default: 'Asia/Kolkata' })
  @IsString()
  @Validate(IsTimeZoneConstraint)
  timeZone: string;

  @Prop({ type: [String], required: false })
  audienceChallenges: string[];

  @Prop({ type: [String], required: false })
  productUses: string[];

  @Prop({
    type: [
      {
        heading: String,
        url: String,
      },
    ],
    required: false,
  })
  internalLinks: { heading: string; url: string }[];

  @Prop({
    type: {
      tag: { type: String, default: 'topic' },
      category: { type: String, default: '' },
      author: { type: String, default: 'author' },
      page: { type: String, default: '' },
    },
    _id: false,
  })
  urlPatterns?: {
    tag: string;
    category: string;
    author: string;
    page: string;
  };

  @Prop({ type: UserSub, required: true })
  user: IUserSub;

  @Prop({ type: Boolean, default: false })
  isComplete: boolean;

  @Prop({ type: [String], required: false })
  categories: string[];

  @Prop({ type: [String], required: false })
  authors: string[];

  @Prop({ type: Boolean, default: false })
  processing: boolean;

  @Prop({ required: false })
  organization?: OrganizationSub;

  @Prop({
    type: {
      primary_phone: { type: String },
      email: { type: String },
    },
    required: false,
    _id: false,
  })
  contact_details?: {
    primary_phone?: string;
    email?: string;
  };

  @Prop({
    type: {
      facebook: { type: String },
      twitter: { type: String },
      instagram: { type: String },
      youtube: { type: String },
      wikipedia: { type: String },
      linkedin: { type: String },
    },
    required: false,
    _id: false,
  })
  social_links?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
    wikipedia?: string;
    linkedin?: string;
  };

  @Prop({
    type: {
      meta_title: { type: String },
      meta_description: { type: String },
    },
    required: false,
    _id: false,
  })
  seo_data?: {
    meta_title?: string;
    meta_description?: string;
  };

  @Prop({ type: UserInfoSchema })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy: UserInfo;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

export type TPropertyDocument = HydratedDocument<Property>;

// findByDomain + getByDomain — most frequent property lookup
PropertySchema.index({ domain: 1 });

// findAll: list properties scoped to an organization
PropertySchema.index({ 'organization.id': 1, status: 1 });

// getAllPropertiesForReport + general status filtering
PropertySchema.index({ status: 1 });
