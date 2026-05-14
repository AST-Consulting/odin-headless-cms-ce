import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Document } from 'mongoose';

interface MediaItem {
  id: string;
  fileName: string;
  path: string;
}

interface OrganizationSub {
  id: string;
  name: string;
}

interface PropertySub {
  id: string;
  name: string;
  domain: string;
}

@Schema({ timestamps: true, collection: 'testimonials' })
export class Testimonial extends Document {
  @Prop({ required: true })
  testimonialText: string;

  @Prop({ required: true })
  authorName: string;

  @Prop()
  authorDesignation: string;

  @Prop()
  authorCompany: string;

  @Prop({
    required: true,
    enum: ['approved', 'pending', 'rejected'],
    default: 'pending',
  })
  status: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: Date })
  date: Date;

  @Prop({ type: Array })
  media: MediaItem[];

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ type: Number })
  rank: number;

  @Prop({ type: Boolean, default: false })
  isFeatured: boolean;

  @Prop()
  videoURL: string;

  @Prop({ type: Object, required: true })
  organization: OrganizationSub;

  @Prop({ type: Object, required: true })
  property: PropertySub;

  @Prop({ type: Object })
  createdBy: any;

  @Prop({ type: Object })
  updatedBy: any;

  createdAt: Date;
  updatedAt: Date;
}

export const TestimonialSchema = SchemaFactory.createForClass(Testimonial);

export type TTestimonialDocument = HydratedDocument<Testimonial>;

// Indexes
TestimonialSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
TestimonialSchema.index({ propertyId: 1, status: 1, createdAt: -1 });
TestimonialSchema.index({ isFeatured: 1, rating: -1 });
