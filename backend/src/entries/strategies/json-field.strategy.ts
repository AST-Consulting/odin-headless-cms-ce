import { Injectable } from '@nestjs/common';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty, SchemaTypes } from 'mongoose';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

@Injectable()
export class JsonFieldStrategy implements IFieldTypeStrategy {
  readonly type: TFieldType = 'json';

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    return {
      type: SchemaTypes.Mixed,
      required: !!field.required,
      default: field.default ?? undefined,
    };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required ? { valid: false, error: `${field.name} is required` } : { valid: true };
    }
    return { valid: true };
  }
}

@Injectable()
export class EnumFieldStrategy implements IFieldTypeStrategy {
  readonly type: TFieldType = 'enum';

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    const enumValues = this._resolveValues(field);
    return {
      type: String,
      enum: enumValues.length ? enumValues : undefined,
      required: !!field.required,
      default: field.default ?? undefined,
    };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required ? { valid: false, error: `${field.name} is required` } : { valid: true };
    }
    const allowed = this._resolveValues(field);
    if (allowed.length && !allowed.includes(value)) {
      return { valid: false, error: `${field.name} must be one of ${allowed.join(', ')}` };
    }
    return { valid: true };
  }

  private _resolveValues(field: Field): string[] {
    const opts = field.validation?.enumOptions;
    if (opts?.length) return opts.map(o => o.value);
    return field.validation?.enumValues || [];
  }
}
