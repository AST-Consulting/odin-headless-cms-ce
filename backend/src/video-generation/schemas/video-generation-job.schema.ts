import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoGenerationJobDocument = VideoGenerationJob & Document;

export enum VideoGenerationJobStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  PARTIAL_FAILURE = 'partial_failure',
}

@Schema({ timestamps: true })
export class VideoGenerationJob {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  organizationId: string;

  @Prop()
  propertyId?: string;

  @Prop()
  articleId?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [Object], default: [] })
  mediaAssets: Array<{
    url: string;
    alt?: string;
    caption?: string;
    source?: string;
    assetType?: 'image' | 'video';
    sourceId?: string;
    durationSec?: number;
  }>;

  @Prop({ type: String, enum: VideoGenerationJobStatus, default: VideoGenerationJobStatus.PROCESSING })
  status: VideoGenerationJobStatus;

  @Prop({ type: Object, default: null })
  result: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  publishResult: Record<string, unknown> | null;

  @Prop({ default: null })
  errorCode: string | null;

  @Prop({ default: null })
  errorMessage: string | null;

  @Prop({ default: null })
  cancelledAt: Date | null;

  @Prop({ default: null })
  completedAt: Date | null;

  @Prop({ default: null })
  publishedAt: Date | null;
}

export const VideoGenerationJobSchema = SchemaFactory.createForClass(VideoGenerationJob);
