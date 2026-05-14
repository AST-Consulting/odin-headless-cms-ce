import { Prop } from '@nestjs/mongoose';
import { Sub } from '@core/schema/sub.schema';

export class FAQ extends Sub {
  @Prop({ type: String, required: false })
  question: string;

  @Prop({ type: String, required: false })
  answer: string;
}
