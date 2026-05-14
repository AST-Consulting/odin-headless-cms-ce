import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';
import { Document } from 'mongoose';

export type TFileUploadDocument = FileUpload & Document;

@Schema({ collection: 'media', timestamps: true })
export class FileUpload {
  @ApiProperty({
    description: 'The name of the file as stored on the server.',
    example: 'unique_filename.txt',
  })
  @Prop({ type: String, required: true })
  fileName: string;

  @ApiProperty({
    description: 'The MIME type of the file.',
    example: 'text/plain',
  })
  @Prop({ type: String, required: true })
  mimeType: string;

  @ApiProperty({
    description: 'The size of the file in bytes.',
    example: 1024,
  })
  @Prop({ type: Number, required: false })
  size: number;

  @ApiProperty({
    description: 'The source of the file.',
    example: 'user_upload',
  })
  @Prop({ type: String, required: false })
  source?: string;

  @ApiProperty({
    description: 'The source of the file.',
    example: 'user_upload',
  })
  @Prop({ type: String, required: false })
  source_url?: string;

  @ApiProperty({
    description: 'The caption of the file.',
    example: 'A beautiful sunset over the mountains.',
  })
  @Prop({ type: String, required: false })
  caption?: string;

  @ApiProperty({
    description: 'Image size variants with metadata',
    example: {
      original: {
        file: 'photo.jpg',
        width: 1920,
        height: 1080,
        filesize: 245632,
        source_url: 'https://example.com/photo.jpg',
      },
    },
  })
  @Prop({
    required: false,
    type: Object,
  })
  sizes?: {
    [key: string]: {
      file: string;
      width: number;
      height: number;
      filesize: number;
      source_url: string;
    };
  };

  @Prop({ type: String })
  url: string;

  @Prop({ required: true })
  path: string;

  @ApiProperty({
    description: 'The path where the file is stored on the server.',
    example: '/uploads/example_file.txt',
  })
  @Prop({ type: String, required: true })
  folderPath: string;

  @Prop({ type: Boolean, required: true })
  isPrivate: boolean;

  @Prop({
    type: {
      userId: String,
      userName: String,
      _id: false,
    },
  })
  createdBy: {
    userId: string;
    userName: string;
    slug?: string;
  };

  @Prop({
    type: {
      userId: String,
      userName: String,
      _id: false,
    },
  })
  updatedBy?: {
    userId: string;
    userName: string;
    slug?: string;
  };

  @ApiProperty({
    description: 'The organization Id',
  })
  @Prop({ required: false })
  organization: OrganizationSub;

  @Prop({ required: false })
  property: PropertySub;

  @Prop({ required: false })
  wpId?: number;

  @Prop({ required: false })
  alt_text?: string;

  @Prop({ required: false, type: String })
  type?: string;

  @Prop({ required: false, type: Number })
  postId?: number;

  @Prop({ required: false, type: Object })
  media_details?: any;

  @Prop({ required: false, type: Number })
  featured_media?: number;
}

// organization slug as first folder so /public/org slug/type (audio, video, image , pdf , csv, excel, doc etc)/date
// mention crop sizes : 64x64, 2x2 as key value { 2x2 : image path}
// public/ private in schema
// enum management api for notification service
export const fileUploadSchema = SchemaFactory.createForClass(FileUpload);

// Primary media library listing filter
fileUploadSchema.index({ 'property.id': 1 });

// Org-level media listing (organization is required)
fileUploadSchema.index({ 'organization.id': 1 });

// Filter by uploader in findAll
fileUploadSchema.index({ 'createdBy.userId': 1 });

// findOne({ path }) — dedup check on upload
fileUploadSchema.index({ path: 1 }, { unique: true });
