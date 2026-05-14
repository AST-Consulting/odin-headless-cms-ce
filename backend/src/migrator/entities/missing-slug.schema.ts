import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'missing_slugs' })
export class MissingSlug extends Document {
  @Prop({ type: String, required: true })
  esId: string;

  @Prop({ type: String, required: true })
  slug: string;

  @Prop({ type: String })
  fullSlug: string;

  @Prop({ type: String })
  link: string;

  @Prop({ type: String })
  index: string;

  @Prop({ type: String, default: 'pending', enum: ['pending', 'migrated', 'failed'] })
  status: string;
}

export type TMissingSlugDocument = HydratedDocument<MissingSlug>;
export const MissingSlugSchema = SchemaFactory.createForClass(MissingSlug);

MissingSlugSchema.index({ esId: 1 }, { unique: true });
MissingSlugSchema.index({ slug: 1 });
