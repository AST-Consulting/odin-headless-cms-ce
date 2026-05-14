import { Injectable } from '@nestjs/common';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty } from 'mongoose';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

abstract class BaseDateStrategy implements IFieldTypeStrategy {
  abstract readonly type: TFieldType;

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    const defaultVal = field.default === '$now' ? () => new Date() : (field.default ?? undefined);
    return {
      type: Date,
      required: !!field.required,
      default: defaultVal,
    };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required ? { valid: false, error: `${field.name} is required` } : { valid: true };
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      return { valid: false, error: `${field.name} must be a valid date` };
    }
    return { valid: true };
  }

  transform(value: any): any {
    if (value === undefined || value === null) return value;
    return value instanceof Date ? value : new Date(value);
  }
}

@Injectable()
export class DateFieldStrategy extends BaseDateStrategy {
  readonly type: TFieldType = 'date';
}

@Injectable()
export class DateTimeFieldStrategy extends BaseDateStrategy {
  readonly type: TFieldType = 'datetime';
}

@Injectable()
export class TimeFieldStrategy extends BaseDateStrategy {
  readonly type: TFieldType = 'time';
}
