import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
export class Entity {
  @Prop()
  type: string;

  @Prop()
  name: string;

  @Prop()
  qid: string;
}
