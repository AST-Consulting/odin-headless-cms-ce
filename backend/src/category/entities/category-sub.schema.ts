import { Prop, Schema } from '@nestjs/mongoose';

// eslint-disable-next-line @typescript-eslint/naming-convention
@Schema({ _id: false })
export class CategorySub {
  @Prop({ type: String, required: false })
  id?: string;

  @Prop({ type: String, required: false })
  title?: string;

  @Prop({ type: String, required: false })
  titleHn?: string;

  @Prop({ type: String, required: false })
  slug?: string;

  @Prop({ type: String, required: false })
  fullSlug?: string;

  @Prop({ type: String, required: false })
  description?: string;

  @Prop({ type: String, required: false })
  status?: string;

  @Prop({ type: Boolean, required: false })
  isFeatured?: boolean;

  @Prop({ type: Boolean, required: false })
  isPublic?: boolean;

  @Prop({ type: String, required: false })
  link?: string;

  @Prop({ type: Number, required: false })
  rank?: number;

  @Prop({ type: Number, required: false })
  wpCategoryId?: number;

  @Prop({ type: Number, required: false })
  count?: number;
}
