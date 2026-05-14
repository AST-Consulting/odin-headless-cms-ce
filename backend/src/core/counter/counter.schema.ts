import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TCounterDocumnet = Counter & Document;

@Schema()
export class Counter extends Document {
  @Prop({ required: true, type: String })
  name: string;
  @Prop({ type: Number, default: 1 })
  count: number;
}

export const counterSchema = SchemaFactory.createForClass(Counter);
