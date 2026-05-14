import { Injectable } from '@nestjs/common';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty, SchemaTypes } from 'mongoose';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

@Injectable()
export class ComponentFieldStrategy implements IFieldTypeStrategy {
  readonly type: TFieldType = 'component';

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    return field.repeatable
      ? { type: [SchemaTypes.Mixed], default: [] }
      : { type: SchemaTypes.Mixed, required: !!field.required, default: field.default ?? undefined };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required && !field.repeatable
        ? { valid: false, error: `${field.name} is required` }
        : { valid: true };
    }
    if (field.repeatable && !Array.isArray(value)) {
      return { valid: false, error: `${field.name} must be an array of components` };
    }
    if (!field.repeatable && (typeof value !== 'object' || Array.isArray(value))) {
      return { valid: false, error: `${field.name} must be a component object` };
    }
    return { valid: true };
  }
}

@Injectable()
export class DynamicZoneFieldStrategy implements IFieldTypeStrategy {
  readonly type: TFieldType = 'dynamiczone';

  buildSchemaDefinition(_field: Field): SchemaDefinitionProperty {
    return { type: [SchemaTypes.Mixed], default: [] };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required ? { valid: false, error: `${field.name} is required` } : { valid: true };
    }
    if (!Array.isArray(value)) {
      return { valid: false, error: `${field.name} must be an array` };
    }
    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return { valid: false, error: `${field.name} contains a non-object item` };
      }
    }
    return { valid: true };
  }
}
