import { BadRequestException, Injectable } from '@nestjs/common';
import { ContentType } from '@content-builder/schemas/content-type.schema';
import { Field } from '@content-builder/schemas/field.schema';
import { FieldTypeRegistry } from './registry/field-type.registry';

/**
 * Validates and transforms the `data` payload of an entry against its ContentType fields.
 * Orchestrates the field-type strategies; does not know about Mongo.
 */
@Injectable()
export class EntryValidator {
  constructor(private readonly _fieldTypes: FieldTypeRegistry) {}

  validateAndTransform(
    contentType: ContentType,
    data: Record<string, any>,
    partial: boolean = false,
  ): Record<string, any> {
    const payload = data || {};
    const result: Record<string, any> = {};
    const errors: string[] = [];

    for (const field of contentType.fields || []) {
      const incoming = payload[field.name];
      const present = field.name in payload;

      if (partial && !present) continue;

      const strategy = this._fieldTypes.get(field.type);

      const isSelfRepeating = field.type === 'component' || field.type === 'dynamiczone'
        || (field.type === 'media' && field.mediaMultiple);

      if (field.repeatable && !isSelfRepeating) {
        if (incoming === undefined || incoming === null) {
          if (field.required) errors.push(`${field.name} is required`);
          else result[field.name] = [];
          continue;
        }
        if (!Array.isArray(incoming)) {
          errors.push(`${field.name} must be an array`);
          continue;
        }
        const transformed: any[] = [];
        let hasError = false;
        for (const item of incoming) {
          const check = strategy.validate(item, { ...field, repeatable: false } as Field);
          if (!check.valid) { errors.push(check.error!); hasError = true; break; }
          transformed.push(strategy.transform ? strategy.transform(item, field) : item);
        }
        if (!hasError) result[field.name] = transformed;
        continue;
      }

      const check = strategy.validate(incoming, field);
      if (!check.valid) {
        errors.push(check.error!);
        continue;
      }

      const value = strategy.transform ? strategy.transform(incoming, field) : incoming;
      if (value !== undefined) result[field.name] = value;
    }

    this._rejectUnknownFields(contentType.fields || [], payload, errors);

    if (errors.length) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    return result;
  }

  private _rejectUnknownFields(
    fields: Field[],
    payload: Record<string, any>,
    errors: string[],
  ): void {
    const allowed = new Set(fields.map((f) => f.name));
    for (const key of Object.keys(payload)) {
      if (!allowed.has(key)) {
        errors.push(`Unknown field "${key}"`);
      }
    }
  }
}
