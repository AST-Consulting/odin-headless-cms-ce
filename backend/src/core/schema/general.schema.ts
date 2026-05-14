import { Prop } from '@nestjs/mongoose';
import { Schema } from 'mongoose';

export const UserInfoSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    userType: { type: String, required: true },
  },
  { _id: false }
);
export const UserDetailsSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: false },
  },
  { _id: false }
);

export class Image {
  @Prop({ type: String, required: false })
  imageId?: string;

  @Prop({ type: String, required: false })
  type?: string; // e.g., 'square', 'landscape', 'portrait'
}

export class Icon {
  @Prop({ type: String, required: false })
  iconUrl?: string;

  @Prop({ type: String, required: false })
  altText?: string;
}

export const entitySchema = new Schema(
  {
    id: String,
    name: String,
    slug: String,
  },
  { _id: false }
);

export class PhoneSchema {
  @Prop({ type: String, required: true })
  countryPrefix: string;

  @Prop({ type: String, required: true })
  fullNumber: string;

  @Prop({ type: String, required: true })
  number: string;
}
