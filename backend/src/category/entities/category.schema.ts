import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';
import { Document, HydratedDocument } from 'mongoose';
import { STATUS } from 'src/core/constants/enums.constants';
import { UserInfoSchema } from 'src/core/schema/general.schema';
import { Seo } from 'src/core/schema/seo.schema';
import { UserInfo } from 'src/core/utils/utilVars';
import { CategorySub } from './category-sub.schema';
import { FileSub } from '@utilities/file-upload/entities/file-sub.schema';

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String })
  titleHn?: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String, required: true, unique: true })
  slug?: string;

  @Prop({ type: String, required: false })
  fullSlug?: string;

  @Prop({ type: CategorySub })
  parent?: CategorySub;

  @Prop({
    required: true,
    default: STATUS.ACTIVE,
    enum: STATUS,
  })
  status: string;

  @Prop({ type: Boolean, default: false })
  isFeatured?: boolean;

  @Prop({ type: Boolean, default: false })
  isPublic?: boolean;

  @Prop({ type: String })
  link?: string;

  @Prop({ type: FileSub, required: false })
  icon?: FileSub;

  @Prop({ required: true })
  organization: OrganizationSub;

  @Prop({ required: true })
  property: PropertySub;

  @Prop({ type: Number, required: false, default: Number.MAX_SAFE_INTEGER })
  rank?: number;

  @Prop({ type: Seo, required: false })
  seo: Seo;

  @Prop({ type: UserInfoSchema })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy: UserInfo;

  @Prop({ type: Number })
  wpCategoryId?: number;

  @Prop({ type: Number })
  count?: number;

  @Prop({ type: String })
  header?: string;
}

export type TCategoryDocument = HydratedDocument<Category>;

export const categorySchema = SchemaFactory.createForClass(Category);

// Primary listing filter (slug already indexed via unique: true)
categorySchema.index({ 'property.id': 1, status: 1 });

// WordPress import/migration lookups
categorySchema.index({ wpCategoryId: 1 }, { sparse: true });
