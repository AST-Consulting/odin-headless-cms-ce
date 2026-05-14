import { Prop, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

// Enhanced RichBlock with structured content and metadata
// Supports BlockNote block types: paragraph, heading, bulletListItem, numberedListItem,
// checkListItem, table, image, video, audio, file, and custom block types
@Schema({ _id: false })
export class RichBlock {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  type: string; // Flexible to support any BlockNote block type (paragraph, heading, bulletListItem, etc.)

  @Prop({ type: MongooseSchema.Types.Mixed })
  content: any; // Flexible content based on block type

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: any; // Optional metadata per block (props, children, etc.)

  @Prop()
  order?: number; // For explicit ordering

  @Prop()
  status?: string;
}

// Structured Image Asset
@Schema({ _id: false })
export class ImageAsset {
  @Prop({ required: false })
  id?: string;

  @Prop({ required: false })
  url: string;

  @Prop()
  alt?: string;

  @Prop()
  caption?: string;

  @Prop()
  credit?: string;

  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop()
  mimeType?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  sizes?: any; // Different image sizes/crops
}

// Structured Video Asset
@Schema({ _id: false })
export class VideoAsset {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  title?: string;

  @Prop()
  description?: string;

  @Prop()
  thumbnail?: string;

  @Prop()
  duration?: number; // in seconds

  @Prop()
  provider?: string; // youtube, vimeo, self-hosted, etc.

  @Prop()
  embedCode?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: any;
}

@Schema({ _id: false })
export class Embeddings {
  @Prop({ type: [Number], default: [] })
  title: number[];

  @Prop({ type: [Number], default: [] })
  body: number[];
}
