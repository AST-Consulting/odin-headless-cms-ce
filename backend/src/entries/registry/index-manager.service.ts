import { Inject, Injectable, Logger } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { TContentTypeDocument } from '@content-builder/schemas/content-type.schema';
import { ContentTypeIndex } from '@content-builder/schemas/content-type-index.schema';
import { DynamicModelRegistry } from './dynamic-model.registry';

/**
 * Applies embedded ContentType.indexes[] entries to the underlying Mongo collection.
 * Field-level indexes (Field.indexed/unique) are declared on the schema itself
 * and auto-created by Mongoose — this service handles only the explicit entries.
 */
@Injectable()
export class IndexManagerService {
  constructor(
    private readonly _registry: DynamicModelRegistry,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
  ) {}

  async syncIndexes(contentType: TContentTypeDocument): Promise<void> {
    if (!contentType.indexes?.length) return;

    const model = this._registry.getById(contentType._id.toString());
    const collection = model.collection;

    for (const idx of contentType.indexes) {
      try {
        idx.status = 'building';
        await this._createIndex(collection, idx);
        idx.status = 'active';
        idx.error = null;
      } catch (err: any) {
        idx.status = 'failed';
        idx.error = err?.message || String(err);
        this._logger.error(
          `Failed to create index "${idx.name}" on ${contentType.collectionName}: ${idx.error}`,
          err?.stack,
          IndexManagerService.name,
        );
      }
    }

    contentType.markModified('indexes');
    await contentType.save();
  }

  async dropIndex(contentType: TContentTypeDocument, indexName: string): Promise<void> {
    const model = this._registry.getById(contentType._id.toString());
    try {
      await model.collection.dropIndex(indexName);
    } catch (err: any) {
      if (err?.codeName !== 'IndexNotFound') throw err;
    }
  }

  private async _createIndex(collection: any, idx: ContentTypeIndex): Promise<void> {
    const keySpec = this._buildKeySpec(idx);
    const options: any = { name: idx.name, background: true };

    if (idx.unique) options.unique = true;
    if (idx.sparse) options.sparse = true;
    if (idx.partialFilter) options.partialFilterExpression = idx.partialFilter;
    if (idx.collation) options.collation = idx.collation;

    await collection.createIndex(keySpec, options);
  }

  private _buildKeySpec(idx: ContentTypeIndex): Record<string, any> {
    if (idx.type === 'text') {
      return idx.fields.reduce((acc, f) => ({ ...acc, [f.path]: 'text' }), {});
    }
    if (idx.type === '2dsphere') {
      return idx.fields.reduce((acc, f) => ({ ...acc, [f.path]: '2dsphere' }), {});
    }
    if (idx.type === 'hashed') {
      return idx.fields.reduce((acc, f) => ({ ...acc, [f.path]: 'hashed' }), {});
    }
    return idx.fields.reduce((acc, f) => ({ ...acc, [f.path]: f.order || 1 }), {});
  }
}
