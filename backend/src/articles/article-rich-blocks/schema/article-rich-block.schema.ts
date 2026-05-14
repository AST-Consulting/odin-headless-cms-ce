import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { UserInfo } from '@core/utils/utilVars';
import { UserInfoSchema } from '@core/schema/general.schema';

@Schema({ timestamps: true, collection: 'article_rich_blocks' })
export class ArticleRichBlock {
  @Prop({ required: true, index: true })
  articleId: string;

  // Original block ID from BlockNote (used as upsert key for new blocks)
  @Prop({ required: true })
  blockId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  content?: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: any;

  @Prop()
  order?: number;

  @Prop({ type: String, enum: ['active', 'deleted'], default: 'active', index: true })
  status: string;

  @Prop({ type: UserInfoSchema })
  createdBy?: UserInfo;

  @Prop({ type: UserInfoSchema })
  updatedBy?: UserInfo;

  @Prop({ type: { id: String, name: String, slug: String }, _id: false })
  author?: { id: string; name: string; slug?: string };
}

export const ArticleRichBlockSchema = SchemaFactory.createForClass(ArticleRichBlock);

// Unique per article + blockId so upserts are safe
ArticleRichBlockSchema.index({ articleId: 1, blockId: 1 }, { unique: true });
// Fast ordered reads for a given article (active only)
ArticleRichBlockSchema.index({ articleId: 1, status: 1, order: 1 });

export type TArticleRichBlockDocument = HydratedDocument<ArticleRichBlock>;
