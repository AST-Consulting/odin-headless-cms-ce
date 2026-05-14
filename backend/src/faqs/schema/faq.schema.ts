import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { FAQ_ENTITY_TYPE, STATUS } from 'src/core/constants/enums.constants';
import { TagSub } from 'src/tags/entities/tag-sub.schema';
import { UserInfoSchema } from 'src/core/schema/general.schema';
import { UserInfo } from 'src/core/utils/utilVars';
import { CategorySub } from 'src/category/entities/category-sub.schema';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';

export type TFaqDocument = FAQ & Document;

@Schema({ timestamps: true })
export class FAQ {
  @Prop({ required: true, index: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ type: Number, required: true, default: Number.MAX_SAFE_INTEGER })
  rank: number;

  @Prop({ default: STATUS.ACTIVE, required: true, enum: Object.values(STATUS) })
  status: string;

  @ApiProperty({
    description: 'Tags associated with the FAQs',
    type: [TagSub],
    default: [],
  })
  @Prop({ type: [TagSub], default: [] })
  tags?: TagSub[];

  @ApiProperty({
    description: 'Categories associated with the FAQs',
    type: [CategorySub],
    default: [],
  })
  @Prop({ type: [CategorySub], default: [] })
  categories?: CategorySub[];

  @ApiProperty({
    description: 'The Id for entity type (e.g., hospital, clinic)',
    example: 'hospital123',
    required: false,
  })
  @Prop({ type: String, required: false })
  entityId: string;

  @ApiProperty({
    description: 'The type of entity (e.g., hospital, clinic)',
    example: 'hospital',
    required: false,
  })
  @Prop({ type: String, required: false, enum: Object.values(FAQ_ENTITY_TYPE) })
  entityType: string;

  @Prop({ type: String, required: false })
  entityValue: string;

  @Prop({ required: true })
  organization: OrganizationSub;

  @Prop({ required: true })
  property: PropertySub;

  @Prop({ type: UserInfoSchema, required: true })
  createdBy: UserInfo;

  @Prop({ type: UserInfoSchema, required: true })
  updatedBy: UserInfo;
}

export const faqSchema = SchemaFactory.createForClass(FAQ);
