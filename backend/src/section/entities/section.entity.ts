/* eslint-disable @typescript-eslint/naming-convention */
import { STATUS } from '@core/constants/enums.constants';
import { SeoDto } from '@core/dto/seo.dto';
import { UserInfoSchema, entitySchema } from '@core/schema/general.schema';
import { UserInfo } from '@core/utils/utilVars';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PropertySub } from '@property/schema/property.sub-schema';
import { IUserSub } from '@user/entities/user-sub.interface';
import { UserSub } from '@user/entities/user-sub.schema';
import { FileSub } from '@utilities/file-upload/entities/file-sub.schema';
import { HydratedDocument, Document } from 'mongoose';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';

@Schema({ _id: false })
export class Author extends Document {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  slug?: string;
}

@Schema({ _id: false })
export class ContentPriority {
  @Prop({ required: true })
  id: string; // Unique identifier of the linked content

  @Prop({ required: false })
  title: string; // Title of the content item

  @Prop({ required: false })
  slug: string; // Unique identifier or slug for the content item

  @Prop({ type: Number, default: 0 })
  contentRank: number; // Priority or rank of the content in the section

  @Prop({ required: false })
  url?: string; // Optional URL to the content item

  @Prop({ required: false })
  contentType?: string; // Type of content (e.g., story, article, etc.)

  //below are possible feilds from different entities
  @Prop({
    type: Author,
    required: false,
    description: 'Name of the author',
  })
  author?: Author;

  @Prop({
    type: [FileSub],
    required: false,
  })
  media?: FileSub[];

  @Prop({ type: String, required: false, maxlength: 200 })
  headline?: string;

  @Prop({ required: false, type: Date })
  lastPublishedAt?: Date;

  @Prop({ required: false, type: FileSub })
  featureImage?: FileSub;

  @Prop({ required: false })
  subheadline?: string; // subheadline of content (e.g., story, article, etc.)

  @Prop({ required: false })
  awardName?: string;

  @Prop({ required: false })
  details?: string;

  @Prop({ required: false })
  name?: string;

  @Prop({ required: false })
  year?: number;

  @Prop({ required: false, type: FileSub })
  image?: FileSub;

  @Prop({ required: false, type: [FileSub] })
  images?: FileSub[];

  @Prop({ required: false, type: FileSub })
  icon?: FileSub;

  @Prop({
    type: UserSub,
    required: false,
    _id: false,
  })
  user: IUserSub;

  // @Prop({ type: AddressSub, required: false })
  // location: AddressSub;

  @Prop({ type: Date, required: false })
  startDate: Date;

  @Prop({ type: Date, required: false })
  endDate: Date;

  @Prop({ type: Date, required: false })
  eventStartDate: Date;

  @Prop({ type: Date, required: false })
  eventEndDate: Date;

  @Prop({ type: Date, required: false })
  revealDate: Date;

  @Prop({ required: false })
  organization: OrganizationSub

  @Prop({ required: false })
  property: PropertySub

  @Prop({ required: false })
  videoURL?: string;

  @Prop({ type: String, required: false })
  externalLink?: string;

  @Prop({
    type: entitySchema,
    required: false,
    _id: false,
  })
  primaryCategory?: any;

  @Prop({
    type: [entitySchema],
    required: false,
    _id: false,
  })
  categories?: any[];
}

@Schema({ timestamps: true })
export class Section extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ type: String, required: false })
  titleHindi?: string; // New field for Hindi title

  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ type: SeoDto, required: true, unique: true })
  seo: SeoDto;

  @Prop({ type: String, required: false })
  description?: string;

  @Prop({ type: String, default: STATUS.ACTIVE, required: true })
  status: string;

  @Prop({ required: false })
  link?: string;

  @Prop({ required: false })
  widgetCode?: string;

  @Prop({ required: false })
  displayType?: string;


  @Prop({ type: FileSub, required: false })
  image?: FileSub;

  @Prop({ type: Number, required: false })
  count?: number;

  @Prop({ default: 0 })
  rank: number;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: false })
  endDate?: Date;

  @Prop({ type: [String], required: false })
  category?: string[];

  @Prop({ type: [String], required: false })
  sectionUrls?: string[];

  @Prop({ required: true })
  organization: OrganizationSub

  @Prop({ required: true })
  property: PropertySub

  // Subschema for content ranking
  @Prop({ type: [ContentPriority], default: [] })
  contentPriority: ContentPriority[]; //

  @Prop({ type: UserInfoSchema })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy: UserInfo;

  @Prop({ type: Boolean, default: false })
  enablePeriodicUpdate?: boolean; // Toggle for periodic article updates

  @Prop({ type: [String], default: [] })
  fixedArticleIds?: string[]; // Array of article IDs that should remain fixed during updates
}

export type TSectionDocument = HydratedDocument<Section>;
export type TNestedSectionDocument = HydratedDocument<Section>;
export const SectionSchema = SchemaFactory.createForClass(Section);

// Indexes for Query Optimization
SectionSchema.index({ status: 1 });
SectionSchema.index({ 'Sections.rank': 1 });
SectionSchema.index({ 'Sections.SectionType.id': 1 });
