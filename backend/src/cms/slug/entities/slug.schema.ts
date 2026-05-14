import { STATUS } from '@core/constants/enums.constants';
import { UserInfoSchema } from '@core/schema/general.schema';
import { Seo } from '@core/schema/seo.schema';
import { UserInfo } from '@core/utils/utilVars';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';

@Schema({ timestamps: true })
export class Slug extends Document {
  @Prop({ type: String, required: true })
  slug: string;

  @Prop({ type: String, required: true })
  type: string;

  @Prop({ type: String, required: false })
  fullSlug: string;

  @Prop({
    required: true,
    default: STATUS.ACTIVE,
    enum: [STATUS.ACTIVE, STATUS.INACTIVE, STATUS.DELETED, 'draft', 'scheduled', 'review', 'archived'],
  })
  status: string;

  @Prop({ type: Seo, required: false })
  seo: Seo;

  @Prop({ type: String, required: false })
  redirectTo: string;

  @Prop({ type: String, required: false })
  redirectCode: string;

  @Prop({ type: String, required: false })
  canonicalUrl: string;

  @Prop({ required: false })
  organization: OrganizationSub;

  @Prop({ required: false })
  property: PropertySub;

  @Prop({ type: UserInfoSchema, required: true })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema, required: true })
  updatedBy: UserInfo;
}

export type TSlugDocument = HydratedDocument<Slug>;

export const slugSchema = SchemaFactory.createForClass(Slug);

slugSchema.index({ slug: 1 });
slugSchema.index({ slug: 1, type: 1 }, { unique: true });
slugSchema.index({ fullSlug: 1 }, { unique: true, sparse: true });

