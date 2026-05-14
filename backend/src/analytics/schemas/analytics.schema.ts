import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

export type AnalyticsDocument = Analytics & Document;

@Schema({ timestamps: true })
export class Analytics {
  @Prop({ required: true })
  content_id: string;

  @Prop({ required: false })
  published_url: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  content_type: string;

  @Prop({ required: false, default: 0 })
  impression: number;

  @Prop({ required: true, default: 0 })
  views: number;

  @Prop({ required: true, type: String })
  category: string;

  @Prop({ required: true })
  author_id: string;

  @Prop({ required: false })
  organization_id: string;

  @Prop({ required: true })
  client_id: string;

  @Prop({ required: true })
  property_id: string;

  @Prop({ required: true })
  propertyName: string;
}

export const AnalyticsSchema = SchemaFactory.createForClass(Analytics);

export type TAnalyticsDocument = HydratedDocument<Analytics>;
