import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Field, fieldSchema } from './field.schema';
import { ContentTypeIndex, contentTypeIndexSchema } from './content-type-index.schema';

export const CONTENT_TYPE_STATUS = ['draft', 'published'] as const;
export type TContentTypeStatus = (typeof CONTENT_TYPE_STATUS)[number];

@Schema({ timestamps: true, collection: 'content_types' })
export class ContentType {
  @Prop({ type: String, required: true })
  displayName: string;

  @Prop({ type: String, required: true })
  singularName: string;

  @Prop({ type: String, required: true })
  pluralName: string;

  @Prop({ type: String, required: true, unique: true })
  collectionName: string;

  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: String, enum: CONTENT_TYPE_STATUS, default: 'draft' })
  status: TContentTypeStatus;

  @Prop({ type: [fieldSchema], default: [] })
  fields: Field[];

  @Prop({ type: [contentTypeIndexSchema], default: [] })
  indexes: ContentTypeIndex[];

  @Prop({ type: [String], default: [] })
  listColumns: string[];

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  updatedBy?: Types.ObjectId;
}

export type TContentTypeDocument = HydratedDocument<ContentType>;
export const contentTypeSchema = SchemaFactory.createForClass(ContentType);

contentTypeSchema.index({ pluralName: 1 }, { unique: true });
contentTypeSchema.index({ singularName: 1 }, { unique: true });
contentTypeSchema.index({ status: 1 });
