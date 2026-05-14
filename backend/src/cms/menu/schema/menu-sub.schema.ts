import { STATUS } from '@core/constants/enums.constants';
import { Sub } from '@core/schema/sub.schema';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FileSub } from '@utilities/file-upload/entities/file-sub.schema';

@Schema({ _id: true })
export class Item {
  @Prop({ type: String, required: true })
  titles: string;

  @Prop({ type: String, required: false })
  link: string;

  @Prop({ type: String, enum: STATUS, default: STATUS.ACTIVE })
  status: string;

  @Prop({ type: String, default: 'same-page' })
  type: string;

  @Prop({ type: String, default: '#000000' })
  textColor: string;

  @Prop({ type: String, default: '#000000' })
  bgColor: string;

  @Prop({ type: String, default: '' })
  others: string;

  @Prop({ type: String, default: '' })
  subMenuSlug: string;

  @Prop({ type: String, default: '' })
  label: string;

  @Prop({ type: String, default: '' })
  titleHn: string;

  @Prop({ type: String, default: 'custom' })
  object: string;

  @Prop({ type: String, default: '' })
  object_id: string;

  @Prop({ type: Number, default: 0 })
  rank: number;

  @Prop({ type: FileSub, required: false })
  image?: FileSub;

  @Prop({ type: FileSub, required: false })
  icon?: FileSub;

  // Inline nested children. Registered recursively below via ItemSchema.add(...)
  // because TypeScript decorators can't reference the class being defined.
  children?: Item[];
}

export const ItemSchema = SchemaFactory.createForClass(Item);
ItemSchema.add({ children: { type: [ItemSchema], default: undefined } });

@Schema({ _id: false })
export class Icon {
  @Prop({ type: FileSub, required: true })
  iconImage: FileSub;

  @Prop({ type: String, required: true })
  altText: string;
}

@Schema({ _id: false })
export class MenuSub extends Sub {}
