import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
class PageExperience {
  @Prop()
  cls: number;

  @Prop()
  lcp: number;
}

@Schema({ _id: false })
export class DiscoverHealth {
  @Prop()
  largeImage: boolean;

  @Prop()
  imageWidth: number;

  @Prop()
  byline: boolean;

  @Prop()
  firstHand: boolean;

  @Prop({ type: PageExperience })
  pageExperience: PageExperience;
}
