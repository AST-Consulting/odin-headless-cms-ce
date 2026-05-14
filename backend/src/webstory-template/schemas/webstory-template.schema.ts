import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebStoryTemplateDocument = WebStoryTemplate & Document;

@Schema({ timestamps: true })
export class WebStoryTemplate {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  html: string;

  @Prop({ required: true })
  css: string;

  @Prop({ type: Object, required: false })
  previewImage?: Record<string, any>;

  @Prop({ type: [Object], default: [] })
  authors: Record<string, any>[];

  @Prop({ type: Object })
  property: Record<string, any>;

  @Prop({ type: Object })
  organization: Record<string, any>;

  @Prop({ type: Object })
  createdBy: Record<string, any>;

  @Prop({ type: Object })
  updatedBy: Record<string, any>;

  @Prop({ type: [{ type: String }], default: [] })
  allowedFields: string[]; // e.g., ["headline", "sub_headline", "main_image", "cta_text", "cta_url"]
}

export const WebStoryTemplateSchema = SchemaFactory.createForClass(WebStoryTemplate);
