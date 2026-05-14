import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Field, fieldSchema } from './field.schema';

@Schema({ timestamps: true, collection: 'components' })
export class Component {
  @Prop({ type: String, required: true, unique: true })
  displayName: string;

  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: [fieldSchema], default: [] })
  fields: Field[];

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  updatedBy?: Types.ObjectId;
}

export type TComponentDocument = HydratedDocument<Component>;
export const componentSchema = SchemaFactory.createForClass(Component);
