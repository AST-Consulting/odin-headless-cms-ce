import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TFileSubDocument = FileSub & Document;

// eslint-disable-next-line @typescript-eslint/naming-convention
@Schema({ _id: false })
export class FileSub {
  @Prop({ type: String, required: false })
  fileName?: string;

  @Prop({ type: String, required: false })
  path?: string;

  @Prop({ required: false })
  id?: string;

  @Prop({ required: false })
  url?: string;

  @Prop({ type: String, required: false })
  alt?: string;

  @Prop({ type: String, required: false })
  caption?: string;

  @Prop({ type: String, required: false })
  duration?: string;
}
export const fileSubSchema = SchemaFactory.createForClass(FileSub);
