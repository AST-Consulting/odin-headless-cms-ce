import { Injectable } from '@nestjs/common';
import { Schema, SchemaDefinition, SchemaTypes } from 'mongoose';
import { ContentType } from '@content-builder/schemas/content-type.schema';
import { Field } from '@content-builder/schemas/field.schema';
import { FieldTypeRegistry } from './field-type.registry';

/**
 * Factory: turns a ContentType (blueprint) into a Mongoose Schema.
 *
 * System fields live at the top level; user-defined fields are grouped under `data`.
 */
@Injectable()
export class DynamicSchemaFactory {
  constructor(private readonly _fieldTypeRegistry: FieldTypeRegistry) {}

  create(contentType: ContentType): Schema {
    const dataDefinition = this._buildDataDefinition(contentType.fields || []);

    const definition: SchemaDefinition = {
      contentTypeId: { type: SchemaTypes.ObjectId, required: true },

      data: dataDefinition,

      propertyId: { type: SchemaTypes.ObjectId },
      organizationId: { type: SchemaTypes.ObjectId },

      locale: { type: String, default: null },
      localeOf: { type: SchemaTypes.ObjectId, default: null },
      localizations: { type: [SchemaTypes.ObjectId], default: [] },

      status: {
        type: String,
        enum: ['draft', 'published', 'scheduled', 'archived'],
        default: 'draft',
      },
      publishedAt: { type: Date, default: null },
      scheduledAt: { type: Date, default: null },
      unpublishedAt: { type: Date, default: null },

      version: { type: Number, default: 1 },

      createdBy: { type: SchemaTypes.ObjectId },
      updatedBy: { type: SchemaTypes.ObjectId },
      deletedAt: { type: Date, default: null },
    };

    const schema = new Schema(definition, {
      timestamps: true,
      collection: contentType.collectionName,
      minimize: false,
      strict: true,
    });

    this._applyFieldLevelIndexes(schema, contentType.fields || []);
    this._applySystemIndexes(schema);

    return schema;
  }

  private _buildDataDefinition(fields: Field[]): SchemaDefinition {
    const data: SchemaDefinition = {};
    for (const field of fields) {
      if (!this._fieldTypeRegistry.has(field.type)) continue;
      const strategy = this._fieldTypeRegistry.get(field.type);
      const isSelfRepeating = field.type === 'component' || field.type === 'dynamiczone'
        || (field.type === 'media' && field.mediaMultiple);
      if (field.repeatable && !isSelfRepeating) {
        // Extract the base Mongoose type and wrap it in an array
        const baseDef = strategy.buildSchemaDefinition({ ...field, repeatable: false } as Field);
        const baseType = (baseDef as any).type ?? SchemaTypes.Mixed;
        data[field.name] = { type: [baseType], default: [] };
      } else {
        data[field.name] = strategy.buildSchemaDefinition(field) as any;
      }
    }
    return data;
  }

  private _applyFieldLevelIndexes(schema: Schema, fields: Field[]): void {
    for (const field of fields) {
      if (field.unique) {
        schema.index({ [`data.${field.name}`]: 1 }, { unique: true, sparse: !!field.sparse });
      } else if (field.indexed) {
        schema.index({ [`data.${field.name}`]: 1 }, { sparse: !!field.sparse });
      }
    }
  }

  private _applySystemIndexes(schema: Schema): void {
    schema.index({ propertyId: 1, status: 1 });
    schema.index({ status: 1, publishedAt: -1 });
    schema.index({ createdAt: -1 });
    schema.index({ locale: 1 });
    schema.index(
      { deletedAt: 1 },
      { partialFilterExpression: { deletedAt: { $exists: true, $ne: null } } },
    );
  }
}
