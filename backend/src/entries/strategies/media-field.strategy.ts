import { Injectable } from '@nestjs/common';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty, SchemaTypes } from 'mongoose';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

export interface MediaRef {
  id: string;
  url: string;
  path: string;
  fileName?: string;
  mimeType?: string;
}

@Injectable()
export class MediaFieldStrategy implements IFieldTypeStrategy {
  readonly type: TFieldType = 'media';

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    return field.mediaMultiple
      ? { type: [SchemaTypes.Mixed], default: [] }
      : { type: SchemaTypes.Mixed, required: !!field.required, default: field.default ?? undefined };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required && !field.mediaMultiple
        ? { valid: false, error: `${field.name} is required` }
        : { valid: true };
    }

    if (field.mediaMultiple) {
      if (!Array.isArray(value)) {
        return { valid: false, error: `${field.name} must be an array` };
      }
      for (const item of value) {
        const check = this._validateRef(item, field.name);
        if (!check.valid) return check;
      }
      return { valid: true };
    }

    return this._validateRef(value, field.name);
  }

  transform(value: any, field: Field): any {
    if (value === undefined || value === null) return field.mediaMultiple ? [] : value;
    return value;
  }

  private _validateRef(value: any, fieldName: string): IFieldValidationResult {
    if (typeof value !== 'object' || Array.isArray(value) || value === null) {
      return { valid: false, error: `${fieldName}: each media item must be an object` };
    }
    if (!value.id || typeof value.id !== 'string') {
      return { valid: false, error: `${fieldName}: media item missing "id"` };
    }
    if (!value.url || typeof value.url !== 'string') {
      return { valid: false, error: `${fieldName}: media item missing "url"` };
    }
    if (!value.path || typeof value.path !== 'string') {
      return { valid: false, error: `${fieldName}: media item missing "path"` };
    }
    return { valid: true };
  }
}
