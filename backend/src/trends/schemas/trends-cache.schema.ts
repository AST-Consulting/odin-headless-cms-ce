import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TrendsCacheDocument = TrendsCache & Document;

@Schema({ timestamps: true })
export class TrendsCache {
  @Prop({ required: true, index: true })
  cacheKey: string; // e.g., "search:bitcoin" or "trending:IN"

  @Prop({ required: true })
  cacheType: string; // "search" or "trending"

  @Prop({ type: Object, required: true })
  data: Record<string, any>; // The actual trends data

  @Prop({ required: true, index: true })
  expiresAt: Date; // When this cache entry should be considered stale

  @Prop()
  query?: string; // For search type

  @Prop()
  geo?: string; // For trending type

  @Prop()
  dataType?: string; // For search type (TIMESERIES, GEO_MAP, etc.)
}

export const TrendsCacheSchema = SchemaFactory.createForClass(TrendsCache);

