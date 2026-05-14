import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
class InternalLink {
  @Prop({ type: Types.ObjectId })
  articleId: Types.ObjectId;

  @Prop()
  slug: string;

  @Prop()
  title: string;
}

@Schema({ _id: false })
export class Seo {
  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop()
  canonical: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  schema: any;

  @Prop([InternalLink])
  internalLinks: InternalLink[];
}

export const SeoSchema = SchemaFactory.createForClass(Seo);
