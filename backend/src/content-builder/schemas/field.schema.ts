import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

export const FIELD_TYPES = [
  'string',
  'text',
  'richtext',
  'richblock',
  'int',
  'float',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'time',
  'json',
  'enum',
  'uid',
  'email',
  'password',
  'url',
  'media',
  'relation',
  'component',
  'dynamiczone',
] as const;

export type TFieldType = (typeof FIELD_TYPES)[number];

export const RELATION_TYPES = ['oneToOne', 'oneToMany', 'manyToOne', 'manyToMany'] as const;
export type TRelationType = (typeof RELATION_TYPES)[number];

@Schema({ _id: false })
export class FieldValidation {
  @Prop({ type: Number }) min?: number;
  @Prop({ type: Number }) max?: number;
  @Prop({ type: Number }) minLength?: number;
  @Prop({ type: Number }) maxLength?: number;
  @Prop({ type: String }) regex?: string;
  @Prop({ type: [String] }) enumValues?: string[];
  @Prop({ type: [{ label: String, value: String }], default: [] })
  enumOptions?: { label: string; value: string }[];
}
export const fieldValidationSchema = SchemaFactory.createForClass(FieldValidation);

@Schema({ timestamps: true })
export class Field {
  @Prop({ type: Types.ObjectId })
  contentTypeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  componentId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  label?: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String, enum: FIELD_TYPES, required: true })
  type: TFieldType;

  @Prop({ type: Boolean, default: false })
  required: boolean;

  @Prop({ type: Boolean, default: false })
  unique: boolean;

  @Prop({ type: Boolean, default: false })
  private: boolean;

  @Prop({ type: Boolean, default: false })
  searchable: boolean;

  @Prop({ type: Boolean, default: false })
  indexed: boolean;

  @Prop({ type: Boolean, default: false })
  listable: boolean;

  @Prop({ type: Boolean, default: false })
  filterable: boolean;

  @Prop({ type: Boolean, default: false })
  sparse: boolean;

  @Prop({ type: Object, default: null })
  default: any;

  @Prop({ type: fieldValidationSchema, default: () => ({}) })
  validation: FieldValidation;

  // relation
  @Prop({ type: String })
  relationTarget?: string;

  @Prop({ type: String, enum: RELATION_TYPES })
  relationType?: TRelationType;

  @Prop({ type: String })
  relationInverse?: string;

  // component / dynamiczone
  @Prop({ type: String })
  componentRef?: string;

  @Prop({ type: Boolean, default: false })
  repeatable?: boolean;

  @Prop({ type: [String], default: [] })
  allowedComponents?: string[];

  // dynamiczone — inline field definitions for each item in the zone
  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  zoneFields?: any[];

  // media
  @Prop({ type: Boolean, default: false })
  mediaMultiple?: boolean;

  @Prop({ type: [String], default: [] })
  mediaAllowedTypes?: string[];

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  updatedBy?: Types.ObjectId;
}

export const fieldSchema = SchemaFactory.createForClass(Field);
