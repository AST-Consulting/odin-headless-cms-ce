import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TopicDocument = Topic & Document;

@Schema({ _id: false })
class Seasonality {
  @Prop([Number])
  month: number[];
}

@Schema({ _id: false })
class ArticleInTopic {
  @Prop({ type: Types.ObjectId, ref: 'Article' })
  articleId: Types.ObjectId;

  @Prop()
  title: string;

  @Prop()
  publishedAt: Date;
}

@Schema({ _id: false })
class Rollup {
  @Prop()
  uv: number;

  @Prop()
  pv: number;

  @Prop()
  ctr: number;
}

@Schema({ _id: false })
class TopicEntity {
  @Prop()
  type: string;

  @Prop()
  name: string;
}

@Schema({ timestamps: true, collection: 'topics' })
export class Topic {
  @Prop({ required: true })
  tenantId: string;

  @Prop()
  seedQuery: string;

  @Prop()
  lang: string;

  @Prop({ index: true })
  trendScore: number;

  @Prop({ type: Seasonality })
  seasonality: Seasonality;

  @Prop([String])
  competitors: string[];

  @Prop([String])
  suggestedAngles: string[];

  @Prop([TopicEntity])
  entities: TopicEntity[];

  @Prop({ index: true })
  freshnessWindowStart: Date;

  @Prop({ index: true })
  freshnessWindowEnd: Date;

  @Prop([ArticleInTopic])
  articles: ArticleInTopic[];

  @Prop({ type: Rollup })
  rollup24h: Rollup;

  createdAt: Date;
  updatedAt: Date;
}

export const TopicSchema = SchemaFactory.createForClass(Topic);

TopicSchema.index({ tenantId: 1, trendScore: -1 });
TopicSchema.index({ tenantId: 1, lang: 1, freshnessWindowEnd: -1 });
