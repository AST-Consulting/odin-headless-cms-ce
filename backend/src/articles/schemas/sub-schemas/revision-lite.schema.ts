import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
export class RevisionLite {
  @Prop()
  v: number;

  @Prop()
  title: string;

  @Prop()
  updatedAt: Date;

  @Prop()
  updatedBy: string;
}
