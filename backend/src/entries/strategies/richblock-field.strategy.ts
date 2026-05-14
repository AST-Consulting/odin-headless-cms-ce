import { Injectable } from '@nestjs/common';
import { SchemaDefinitionProperty, SchemaTypes } from 'mongoose';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

/**
 * RichBlock field type — an ordered array of BlockNote-compatible blocks.
 * Mirrors the shape used on Article.richBlocks so the same editor/renderer works here.
 *
 * Each block: { id, type, content, metadata?, order?, status? }
 */
@Injectable()
export class RichblockFieldStrategy implements IFieldTypeStrategy {
  readonly type: TFieldType = 'richblock';

  buildSchemaDefinition(_field: Field): SchemaDefinitionProperty {
    return { type: [SchemaTypes.Mixed], default: [] };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required
        ? { valid: false, error: `${field.name} is required` }
        : { valid: true };
    }
    if (!Array.isArray(value)) {
      return { valid: false, error: `${field.name} must be an array of blocks` };
    }
    for (let i = 0; i < value.length; i++) {
      const block = value[i];
      if (!block || typeof block !== 'object') {
        return { valid: false, error: `${field.name}[${i}] must be an object` };
      }
      if (typeof block.id !== 'string' || !block.id) {
        return { valid: false, error: `${field.name}[${i}].id must be a non-empty string` };
      }
      if (typeof block.type !== 'string' || !block.type) {
        return { valid: false, error: `${field.name}[${i}].type must be a non-empty string` };
      }
    }
    return { valid: true };
  }

  transform(value: any): any {
    if (!Array.isArray(value)) return [];
    return value.map((block, i) => ({
      ...block,
      order: typeof block.order === 'number' ? block.order : i,
    }));
  }
}
