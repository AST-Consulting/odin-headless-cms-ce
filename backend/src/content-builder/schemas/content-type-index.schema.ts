import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const INDEX_TYPES = ['single', 'compound', 'text', '2dsphere', 'hashed'] as const;
export type TIndexType = (typeof INDEX_TYPES)[number];

export const INDEX_STATUS = ['pending', 'building', 'active', 'failed'] as const;
export type TIndexStatus = (typeof INDEX_STATUS)[number];

@Schema({ _id: false })
export class IndexFieldSpec {
  @Prop({ type: String, required: true })
  path: string;

  @Prop({ type: Number, default: 1 })
  order: number;
}
export const indexFieldSpecSchema = SchemaFactory.createForClass(IndexFieldSpec);

@Schema({ timestamps: true })
export class ContentTypeIndex {
  @Prop({ type: Types.ObjectId })
  contentTypeId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, enum: INDEX_TYPES, default: 'single' })
  type: TIndexType;

  @Prop({ type: [indexFieldSpecSchema], default: [] })
  fields: IndexFieldSpec[];

  @Prop({ type: Boolean, default: false })
  unique: boolean;

  @Prop({ type: Boolean, default: false })
  sparse: boolean;

  @Prop({ type: Object, default: null })
  partialFilter: Record<string, any> | null;

  @Prop({ type: Object, default: null })
  collation: Record<string, any> | null;

  @Prop({ type: String, enum: INDEX_STATUS, default: 'pending' })
  status: TIndexStatus;

  @Prop({ type: String, default: null })
  error: string | null;

  @Prop({ type: Boolean, default: false })
  isSystem: boolean;

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId;
}

export const contentTypeIndexSchema = SchemaFactory.createForClass(ContentTypeIndex);
