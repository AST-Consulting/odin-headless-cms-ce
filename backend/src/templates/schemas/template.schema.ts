import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TenantTemplateDocument = TenantTemplate & Document;

@Schema({ timestamps: true })
export class TenantTemplate {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [{ type: String }] })
  defaultRoles: string[];

  @Prop({ type: [{ type: String }] })
  defaultCategories: string[];

  @Prop({ type: [{ type: String }] })
  defaultTags: string[];
}

export const TenantTemplateSchema = SchemaFactory.createForClass(TenantTemplate);
