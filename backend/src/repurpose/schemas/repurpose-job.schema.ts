import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class RepurposeCreator {
  @Prop({ required: true })
  userId: string;

  @Prop()
  userName?: string;

  @Prop()
  email?: string;
}

const RepurposeCreatorSchema = SchemaFactory.createForClass(RepurposeCreator);

@Schema({ timestamps: true, collection: 'repurpose_jobs' })
export class RepurposeJob {
  @Prop({ required: true, index: true })
  articleId: string;

  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true })
  propertyId: string;

  @Prop({ type: RepurposeCreatorSchema, required: true })
  createdBy: RepurposeCreator;

  @Prop({ required: true })
  articleHash: string;

  @Prop()
  articleTitle?: string;

  @Prop()
  language?: string;

  @Prop({ required: true, default: 'completed', enum: ['completed', 'failed'] })
  status: 'completed' | 'failed';

  @Prop({ type: Object, required: true })
  outputs: Record<string, unknown>;

  @Prop({ type: Object })
  config?: {
    instaSlideCount?: number;
    webStorySlideCount?: number;
    mirrorInstaToWebstory?: boolean;
  };

  @Prop()
  errorMessage?: string;
}

export const RepurposeJobSchema = SchemaFactory.createForClass(RepurposeJob);
RepurposeJobSchema.index({ articleId: 1, createdAt: -1 });
RepurposeJobSchema.index({ organizationId: 1, createdAt: -1 });
RepurposeJobSchema.index({ articleId: 1, articleHash: 1 });

export type TRepurposeJobDocument = HydratedDocument<RepurposeJob>;
