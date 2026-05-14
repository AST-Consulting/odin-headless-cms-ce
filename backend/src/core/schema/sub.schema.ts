import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TSubDocument = Sub & Document;

// eslint-disable-next-line @typescript-eslint/naming-convention
@Schema({ _id: false })
export class Sub {
  @Prop({ type: String, required: false })
  id: string;

  @Prop({ type: String, required: false })
  name?: string;

  @Prop({ type: String, required: false })
  slug?: string;
}
export const subSchema = SchemaFactory.createForClass(Sub);
