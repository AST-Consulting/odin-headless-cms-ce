import { Injectable } from '@nestjs/common';
import { ContentType } from '@content-builder/schemas/content-type.schema';

/**
 * System fields that live at the top level of every Entry document.
 * Keys matching these (optionally with range suffixes) pass through untouched.
 * Everything else is prefixed with `data.` when the name matches a ContentType field.
 */
const SYSTEM_FIELDS = new Set([
  '_id',
  'contentTypeId',
  'contentTypeUid',
  'propertyId',
  'organizationId',
  'locale',
  'localeOf',
  'status',
  'publishedAt',
  'scheduledAt',
  'unpublishedAt',
  'version',
  'schemaVersion',
  'createdBy',
  'updatedBy',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

const RANGE_SUFFIXES = ['gte', 'lte', 'gt', 'lt'];

/**
 * Maps public query keys (`title`, `price.gte`) to the actual document paths
 * (`data.title`, `data.price.gte`) before handing the query to APIFeatures.
 *
 * Also passes through system-field keys and ignores unknown keys so callers
 * don't accidentally hit arbitrary collection paths.
 */
@Injectable()
export class FilterKeyTranslator {
  translate(contentType: ContentType, rawQuery: Record<string, any>): Record<string, any> {
    const fieldNames = new Set((contentType.fields || []).map((f) => f.name));
    const out: Record<string, any> = {};

    for (const [key, value] of Object.entries(rawQuery || {})) {
      const base = key.split('.')[0];

      if (SYSTEM_FIELDS.has(base)) {
        // system field — pass through as-is (e.g. status, createdAt.gte)
        out[key] = value;
        continue;
      }

      if (fieldNames.has(base)) {
        // known content-type field — prefix full dot-path with data.
        // handles: name, address.city, address.pincode.gte, price.lte, etc.
        out[`data.${key}`] = value;
        continue;
      }

      // reserved query-shape keys handled by APIFeatures itself
      if (['page', 'limit', 'sort', 'sortOrder', 'fields', 'searchTerm', 'lastId'].includes(key)) {
        out[key] = value;
      }
      // anything else is ignored — prevents arbitrary path queries
    }

    return out;
  }
}
