import { Injectable } from '@nestjs/common';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty } from 'mongoose';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

@Injectable()
export class BooleanFieldStrategy implements IFieldTypeStrategy {
  readonly type: TFieldType = 'boolean';

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    return {
      type: Boolean,
      required: !!field.required,
      default: field.default ?? undefined,
    };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required ? { valid: false, error: `${field.name} is required` } : { valid: true };
    }
    if (typeof value !== 'boolean') {
      return { valid: false, error: `${field.name} must be a boolean` };
    }
    return { valid: true };
  }
}
