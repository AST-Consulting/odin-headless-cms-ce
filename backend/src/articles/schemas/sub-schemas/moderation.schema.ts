import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
export class Moderation {
  @Prop([String])
  flags: string[];

  @Prop()
  notes: string;
}
