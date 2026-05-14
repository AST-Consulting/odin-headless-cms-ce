import { Injectable } from '@nestjs/common';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty } from 'mongoose';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

abstract class BaseNumberStrategy implements IFieldTypeStrategy {
  abstract readonly type: TFieldType;
  protected readonly isInteger: boolean = false;

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    return {
      type: Number,
      required: !!field.required,
      unique: field.unique || undefined,
      sparse: field.sparse || undefined,
      default: field.default ?? undefined,
    };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required ? { valid: false, error: `${field.name} is required` } : { valid: true };
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { valid: false, error: `${field.name} must be a number` };
    }
    if (this.isInteger && !Number.isInteger(value)) {
      return { valid: false, error: `${field.name} must be an integer` };
    }
    const v = field.validation || ({} as any);
    if (v.min != null && value < v.min) {
      return { valid: false, error: `${field.name} must be >= ${v.min}` };
    }
    if (v.max != null && value > v.max) {
      return { valid: false, error: `${field.name} must be <= ${v.max}` };
    }
    return { valid: true };
  }
}

@Injectable()
export class IntFieldStrategy extends BaseNumberStrategy {
  readonly type: TFieldType = 'int';
  protected readonly isInteger = true;
}

@Injectable()
export class FloatFieldStrategy extends BaseNumberStrategy {
  readonly type: TFieldType = 'float';
}

@Injectable()
export class DecimalFieldStrategy extends BaseNumberStrategy {
  readonly type: TFieldType = 'decimal';
}
