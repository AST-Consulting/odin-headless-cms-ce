import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { TContentTypeDocument } from '@content-builder/schemas/content-type.schema';
import { DynamicSchemaFactory } from './dynamic-schema.factory';

/**
 * Registry: caches runtime Mongoose models, one per ContentType.
 *
 * Keyed by the ContentType's _id (as a string) so the key is stable even if
 * the collectionName is renamed.
 */
@Injectable()
export class DynamicModelRegistry {
  private readonly _models = new Map<string, Model<any>>();

  constructor(
    @InjectConnection() private readonly _connection: Connection,
    private readonly _schemaFactory: DynamicSchemaFactory,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
  ) {}

  register(contentType: TContentTypeDocument): Model<any> {
    const id = contentType._id.toString();
    this.drop(id);

    const schema = this._schemaFactory.create(contentType);
    const modelName = this._modelName(id);

    if (this._connection.models[modelName]) {
      this._connection.deleteModel(modelName);
    }

    const model = this._connection.model(modelName, schema, contentType.collectionName);
    this._models.set(id, model);

    this._logger.log(
      `Registered dynamic model "${modelName}" on collection "${contentType.collectionName}"`,
      DynamicModelRegistry.name,
    );

    return model;
  }

  getById(id: string): Model<any> {
    const model = this._models.get(id);
    if (!model) {
      throw new NotFoundException(`No registered model for content type id "${id}"`);
    }
    return model;
  }

  hasId(id: string): boolean {
    return this._models.has(id);
  }

  drop(id: string): void {
    const model = this._models.get(id);
    if (!model) return;
    const modelName = this._modelName(id);
    if (this._connection.models[modelName]) {
      this._connection.deleteModel(modelName);
    }
    this._models.delete(id);
  }

  listIds(): string[] {
    return Array.from(this._models.keys());
  }

  private _modelName(id: string): string {
    return `Dynamic::${id}`;
  }
}
