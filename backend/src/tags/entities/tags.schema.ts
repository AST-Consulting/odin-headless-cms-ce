import { STATUS } from '@core/constants/enums.constants';
import { UserInfoSchema } from '@core/schema/general.schema';
import { Seo } from '@core/schema/seo.schema';
import { UserInfo } from '@core/utils/utilVars';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';
import { Document } from 'mongoose';

export type TTagDocument = Tag & Document;

@Schema({ timestamps: true, collection: 'tags' })
export class Tag {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ type: Number, required: false, default: Number.MAX_SAFE_INTEGER })
  rank?: number;

  @Prop({
    required: true,
    default: STATUS.ACTIVE,
    enum: [STATUS.ACTIVE, STATUS.INACTIVE],
  })
  status: string;

  @Prop({ type: Boolean, default: false })
  isFeatured?: boolean;

  @Prop({ type: String, required: false })
  link?: string;

  @Prop({ type: Seo, required: false })
  seo: Seo;

  @Prop({ required: false })
  organization: OrganizationSub;

  @Prop({ required: false })
  property: PropertySub;

  @Prop({ type: UserInfoSchema })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy: UserInfo;

  @Prop({ type: Number })
  wpTagId?: number;

  @Prop({ type: Number })
  count?: number;
}

export const tagSchema = SchemaFactory.createForClass(Tag);

// Name lookup scoped to property (replaces bare name index)
tagSchema.index({ name: 1, 'property.id': 1 });

// Primary listing filter (slug already indexed via unique: true)
tagSchema.index({ 'property.id': 1, status: 1 });

// WordPress import/migration lookups
tagSchema.index({ wpTagId: 1 }, { sparse: true });
