import { Prop, Schema } from '@nestjs/mongoose';

// eslint-disable-next-line @typescript-eslint/naming-convention
@Schema({ _id: false })
export class TagSub {
  @Prop({ type: String, required: false })
  id?: string;

  @Prop({ type: String, required: false })
  name?: string;

  @Prop({ type: String, required: false })
  slug?: string;

  @Prop({ type: String, required: false })
  description?: string;

  @Prop({ type: Number, required: false })
  rank?: number;

  @Prop({ type: String, required: false })
  status?: string;

  @Prop({ type: Boolean, required: false })
  isFeatured?: boolean;

  @Prop({ type: String, required: false })
  link?: string;

  @Prop({ type: Number, required: false })
  wpTagId?: number;

  @Prop({ type: Number, required: false })
  count?: number;
}
