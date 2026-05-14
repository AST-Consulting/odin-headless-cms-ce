import { Inject, Injectable, Logger } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ModelRegistryService } from '../model-registry/model-registry.service';
import { ElasticService } from '../elastic/elastic.service';
import * as cascadeMapping from './cascadeMapping.json';

@Injectable()
export class OnDeleteCascadeService {
  constructor(
    private readonly _modelRegistryService: ModelRegistryService,
    private readonly _elasticService: ElasticService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

  /**
   * Cascade delete: Remove references to a deleted document from related collections
   * @param params - Object containing id and moduleName of the deleted entity
   */
  async cascadeDelete(params: { id: string; moduleName: string }): Promise<void> {
    const { id, moduleName } = params;

    const mappings = cascadeMapping[moduleName.toLowerCase()];
    if (!mappings || mappings.length === 0) {
      this._logger.warn(
        `No cascade mappings found for module: ${moduleName}`,
        this.constructor.name
      );
      return;
    }

    this._logger.log(
      `Starting cascade delete for ${moduleName} with id: ${id}`,
      this.constructor.name
    );

    for (const mapping of mappings) {
      try {
        await this._processCascadeDeleteMapping(id, moduleName, mapping);
      } catch (error) {
        this._logger.error(
          `Error processing cascade delete mapping for ${mapping.model}.${mapping.field}: ${error.message}`,
          error.stack,
          this.constructor.name
        );
      }
    }

    this._logger.log(`Cascade delete completed for ${moduleName} id: ${id}`, this.constructor.name);
  }

  /**
   * Cascade update: Update references to a modified document in related collections
   * @param params - Object containing id, moduleName, and optionally oldSlug
   */
  async cascadeUpdate(params: { id: string; moduleName: string; oldSlug?: string }): Promise<void> {
    const { id, moduleName, oldSlug } = params;

    const mappings = cascadeMapping[moduleName.toLowerCase()];
    console.log('Mappings found:', mappings);
    if (!mappings || mappings.length === 0) {
      this._logger.warn(
        `No cascade mappings found for module: ${moduleName}`,
        this.constructor.name
      );
      return;
    }

    this._logger.log(
      `Starting cascade update for ${moduleName} with id: ${id}`,
      this.constructor.name
    );

    // Get the updated document
    const model = this._modelRegistryService.getModel(moduleName);
    if (!model) {
      this._logger.warn(`Model not found for: ${moduleName}`, this.constructor.name);
      return;
    }

    const latestDocument = await model.findById(id).exec();
    if (!latestDocument) {
      this._logger.error(
        `Document with id ${id} not found in ${moduleName}`,
        this.constructor.name
      );
      return;
    }

    const latestDocumentData = latestDocument.toObject();
    if (latestDocumentData._id) {
      latestDocumentData.id = latestDocumentData._id.toString();
      delete latestDocumentData._id;
    }

    const isSlugUpdate = moduleName.toLowerCase() === 'slug';
    const updatedSlug = isSlugUpdate ? latestDocumentData.slug : null;

    for (const mapping of mappings) {
      try {
        await this._processCascadeUpdateMapping(
          id,
          moduleName,
          mapping,
          latestDocumentData,
          isSlugUpdate,
          updatedSlug,
          oldSlug
        );
      } catch (error) {
        this._logger.error(
          `Error processing cascade update mapping for ${mapping.model}.${mapping.field}: ${error.message}`,
          error.stack,
          this.constructor.name
        );
      }
    }

    this._logger.log(`Cascade update completed for ${moduleName} id: ${id}`, this.constructor.name);
  }

  /**
   * Process a single cascade delete mapping
   */
  private async _processCascadeDeleteMapping(
    id: string,
    moduleName: string,
    mapping: { model: string; field: string }
  ): Promise<void> {
    const { model: relatedModelName, field } = mapping;

    const relatedModel = this._modelRegistryService.getModel(relatedModelName.toLowerCase());
    if (!relatedModel) {
      this._logger.warn(`Related model not found: ${relatedModelName}`, this.constructor.name);
      return;
    }

    // Sample document to check field type
    const sampleDoc = await relatedModel.findOne().exec();
    if (!sampleDoc) {
      return; // No documents exist
    }

    const fieldValue = sampleDoc.toObject()[field];

    if (Array.isArray(fieldValue)) {
      // Array field: Remove the item with matching id
      const result = await relatedModel
        .updateMany({ [`${field}.id`]: id }, { $pull: { [field]: { id } } })
        .exec();

      this._logger.log(
        `Removed ${id} from array field ${field} in ${relatedModelName}: ${result.modifiedCount} documents updated`,
        this.constructor.name
      );
    } else if (typeof fieldValue === 'object' && fieldValue !== null) {
      // Object field: Clear the object if it matches
      const result = await relatedModel
        .updateMany({ [`${field}.id`]: id }, { $set: { [field]: {} } })
        .exec();

      this._logger.log(
        `Cleared object field ${field} in ${relatedModelName}: ${result.modifiedCount} documents updated`,
        this.constructor.name
      );
    } else {
      // Scalar field (like slug string)
      // Just log, don't delete - let the application handle it
      this._logger.warn(
        `Field ${field} in ${relatedModelName} is scalar, skipping cascade delete`,
        this.constructor.name
      );
    }
  }

  /**
   * Process a single cascade update mapping
   */
  private async _processCascadeUpdateMapping(
    id: string,
    moduleName: string,
    mapping: { model: string; field: string },
    latestDocumentData: Record<string, any>,
    isSlugUpdate: boolean,
    updatedSlug: string | null,
    oldSlug: string | undefined
  ): Promise<void> {
    const { model: relatedModelName, field } = mapping;

    const relatedModel = this._modelRegistryService.getModel(relatedModelName);
    if (!relatedModel) {
      this._logger.warn(`Related model not found: ${relatedModelName}`, this.constructor.name);
      return;
    }

    const updatedValues: Record<string, any> = { ...latestDocumentData };

    if (isSlugUpdate && updatedSlug) {
      updatedValues[field] = updatedSlug;
    }

    // Sample document to check field type
    const sampleDoc = await relatedModel.findOne({ [field]: { $exists: true } }).exec();
    if (!sampleDoc) {
      return; // No documents with this field
    }

    const fieldValue = sampleDoc.toObject()[field];

    if (Array.isArray(fieldValue)) {
      // Array field: Update matching items
      const result = await relatedModel
        .updateMany(
          { [`${field}.id`]: id },
          { $set: { [`${field}.$[element]`]: updatedValues } },
          { arrayFilters: [{ 'element.id': id }] }
        )
        .exec();

      this._logger.log(
        `Updated array field ${field} in ${relatedModelName}: ${result.modifiedCount} documents updated`,
        this.constructor.name
      );
    } else if (typeof fieldValue === 'object' && fieldValue !== null) {
      // Object field: Update the entire object
      const result = await relatedModel
        .updateMany({ [`${field}.id`]: id }, { $set: { [field]: updatedValues } })
        .exec();

      this._logger.log(
        `Updated object field ${field} in ${relatedModelName}: ${result.modifiedCount} documents updated`,
        this.constructor.name
      );
    } else if (isSlugUpdate && oldSlug) {
      // Scalar slug field: Update from old slug to new slug
      const result = await relatedModel
        .updateMany({ [field]: oldSlug }, { $set: { [field]: updatedSlug } })
        .exec();

      this._logger.log(
        `Updated slug field ${field} in ${relatedModelName}: ${result.modifiedCount} documents updated`,
        this.constructor.name
      );
    }
  }
}
