import { TagSub } from '@tags/entities/tag-sub.schema';
import { STATUS } from '@core/constants/enums.constants';
import { UserInfoSchema } from '@core/schema/general.schema';
import { Seo } from '@core/schema/seo.schema';
import { UserInfo } from '@core/utils/utilVars';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';
import { CategorySub } from 'src/category/entities/category-sub.schema';

@Schema({ timestamps: true }) // This will automatically add `createdAt` and `updatedAt` fields
export class StaticPage extends Document {
  @Prop({ required: false })
  title: string;

  @Prop({ type: String, required: true, unique: true })
  slug?: string;

  @Prop({ type: Number, required: false, default: Number.MAX_SAFE_INTEGER })
  rank?: number;

  @Prop({ type: Seo, required: true })
  seo?: Seo;

  @Prop({ default: STATUS.ACTIVE, required: true, enum: Object.values(STATUS) })
  status: string;

  @Prop({ type: [TagSub], default: [] })
  tags?: TagSub[];

  @Prop({ type: [CategorySub], default: [] })
  categories?: CategorySub[];

  @Prop({ required: false })
  content: string; // HTML or markdown content

  @Prop()
  metaDescription?: string;

  @Prop([String])
  metaKeywords?: string[];

  @Prop({ default: false })
  isPublished: boolean;

  @Prop({ required: true })
  organization: OrganizationSub;

  @Prop({ required: true })
  property: PropertySub;

  @Prop({ type: UserInfoSchema })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy: UserInfo;

  // ── WordPress migration fields ─────────────────────────────────────────────
  @Prop({ type: Number, index: true, sparse: true })
  wpId?: number; // WordPress page ID (used for deduplication)

  @Prop({ type: Number })
  wpParentId?: number; // WordPress parent page ID (0 = top-level)

  @Prop({ type: Number })
  wpAuthorId?: number; // WordPress author user ID

  @Prop({ type: Number })
  wpFeaturedMediaId?: number; // WordPress featured media attachment ID

  @Prop({ type: String })
  wpLink?: string; // Original WordPress page URL

  @Prop({ type: Date })
  wpCreatedAt?: Date; // WordPress date (local time of the site)

  @Prop({ type: Date })
  wpModifiedAt?: Date; // WordPress modified date

  @Prop({ type: String })
  excerpt?: string; // Page excerpt (excerpt.rendered from WP)

  @Prop({ type: String })
  template?: string; // WordPress page template filename

  @Prop({ type: Number })
  menuOrder?: number; // WordPress menu_order value
  // ─────────────────────────────────────────────────────────────────────────
}

// Define the static page document type
export type TStaticPageDocument = HydratedDocument<StaticPage>;

// Generate the schema from the class definition
export const staticPageSchema = SchemaFactory.createForClass(StaticPage);

staticPageSchema.index({ title: 1 });
staticPageSchema.index({ status: 1 });
staticPageSchema.index({ isPublished: 1 });
staticPageSchema.index({ 'tags.id': 1 });
staticPageSchema.index({ 'categories.id': 1 });
