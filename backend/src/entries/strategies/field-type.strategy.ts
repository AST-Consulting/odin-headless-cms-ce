import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty } from 'mongoose';

export interface IFieldValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Strategy contract for each supported field type.
 * One implementation per FIELD_TYPES entry — resolved via FieldTypeRegistry.
 */
export interface IFieldTypeStrategy {
  readonly type: TFieldType;
  buildSchemaDefinition(field: Field): SchemaDefinitionProperty;
  validate(value: any, field: Field): IFieldValidationResult;
  transform?(value: any, field: Field): any;
}
