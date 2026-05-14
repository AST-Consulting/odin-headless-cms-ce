import { Prop, Schema } from '@nestjs/mongoose';

@Schema({ _id: false })
class ChannelConfig {
  @Prop()
  enabled: boolean;

  @Prop()
  path?: string;

  @Prop()
  category?: string;
}

@Schema({ _id: false })
class DiscoverChannelConfig {
  @Prop()
  largeImage: boolean;

  @Prop()
  eligible: boolean;
}

@Schema({ _id: false })
export class Channels {
  @Prop({ type: ChannelConfig })
  web: ChannelConfig;

  @Prop({ type: ChannelConfig })
  gnews: ChannelConfig;

  @Prop({ type: DiscoverChannelConfig })
  discover: DiscoverChannelConfig;

  @Prop({ type: ChannelConfig })
  dailyhunt: ChannelConfig;

  @Prop({ type: ChannelConfig })
  msn: ChannelConfig;
}
