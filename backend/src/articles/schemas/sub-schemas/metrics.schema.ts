import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
export class Counters {
  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: 0 })
  shares: number;
}

@Schema({ _id: false })
export class MetricsLatest {
  @Prop()
  uv: number;

  @Prop()
  pv: number;

  @Prop()
  ctr: number;

  @Prop()
  clicks: number;

  @Prop()
  impressions: number;

  @Prop()
  position: number;

  @Prop()
  lastSyncedAt: Date;
}
