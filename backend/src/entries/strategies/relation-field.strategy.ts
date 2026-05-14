import { Injectable } from '@nestjs/common';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty, SchemaTypes, Types } from 'mongoose';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

@Injectable()
export class RelationFieldStrategy implements IFieldTypeStrategy {
  readonly type: TFieldType = 'relation';

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    return {
      type: SchemaTypes.ObjectId,
      required: !!field.required,
      default: field.default ?? undefined,
    };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required
        ? { valid: false, error: `${field.name} is required` }
        : { valid: true };
    }
    if (!Types.ObjectId.isValid(value)) {
      return { valid: false, error: `${field.name} must be a valid ID` };
    }
    return { valid: true };
  }

  transform(value: any): any {
    if (value === undefined || value === null) return value;
    return new Types.ObjectId(value);
  }
}
