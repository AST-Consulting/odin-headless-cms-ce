import { Injectable, Inject, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Slug, TSlugDocument } from './entities/slug.schema';
import { CreateSlugDto } from './dto/create-slug.dto';
import { UpdateSlugDto } from './dto/update-slug.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { getFilters } from '@core/utils/getFilters';
import { APIFeatures } from '@core/utils/apiFeatures.utils';
import { ElasticAPIFeatures } from '@core/utils/elasticApiFeatures.utils';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import slugify from 'slugify';
import { TCurrentUserType } from '@auth/types/user.type';
import { AuditTrailService } from '@core/audit-trail/audit-trail.service';
import { buildUserMetadata, detectLanguage, generateHindiSlug } from '@core/utils/utils';
import { ACTIONS, BLOG_STATUS, LANGUAGE, ModuleName, STATUS } from '@core/constants/enums.constants';
import { QuerySlugDto } from './dto/query-slug.dto';
import { ISeo } from '@core/utils/seo.utils';
import { ElasticService } from '@core/elastic/elastic.service';
import { OnDeleteCascadeService } from '@core/on-delete-cascade/on-delete-cascade.service';
import { PropertyService } from '@property/property.service';
import { OrganizationService } from '@organization/organization.service';
import { SearchTotalHits } from 'node_modules/@elastic/elasticsearch/lib/api/types';
import { ContentRetrievalStrategyFactory } from './strategies/content-retrieval.factory';

@Injectable()
export class SlugService {
  /**
   * Simple in-memory cache to avoid fetching the same property/org data repeatedly during
   * bulk operations (e.g., migrations). Keyed by `${organizationId}:${propertyId}`.
   */
  private readonly _propertyOrgCache = new Map<
    string,
    {
      propertyData: { id: string; name: string; domain: string };
      organizationData: { id: string; name: string; slug: string; domain: string };
    }
  >();

  constructor(
    @InjectModel(Slug.name) private readonly _slugModel: Model<Slug>,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    private readonly _elasticService: ElasticService,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _onDeleteCascadeService: OnDeleteCascadeService,
    @Inject(forwardRef(() => PropertyService))
    private readonly _propertyService: PropertyService,
    @Inject(forwardRef(() => OrganizationService))
    private readonly _organizationService: OrganizationService,
    private readonly _contentRetrievalStrategyFactory: ContentRetrievalStrategyFactory
  ) { }

  /**
   * Retrieves content by slug using the Strategy Pattern
   * First fetches the module type from the slug collection,
   * then uses the appropriate strategy to fetch the actual content
   *
   * @param slug - The slug to search for
   * @param type - Optional module type filter (e.g., 'article', 'category', 'tag')
   * @returns An object containing the slug metadata and the actual content
   */
  async getContentBySlug(
    slug: string,
    type?: string
  ): Promise<{
    slugMetadata: TSlugDocument;
    content: any;
    moduleType: string;
  }> {
    try {
      this._logger.log(
        `[SlugService] Fetching content for slug: ${slug}${type ? ` with type filter: ${type}` : ''}`,
        this.constructor.name
      );

      // Step 1: Fetch the slug metadata from the slug collection
      const slugMetadata = await this.getSlugDetails(slug, type);

      this._logger.log(
        `[SlugService] Found slug metadata with module type: ${slugMetadata.type}`,
        this.constructor.name
      );

      // Step 2: Get the appropriate retrieval strategy based on module type
      const strategy = this._contentRetrievalStrategyFactory.getStrategy(slugMetadata.type);

      // Step 3: Use the strategy to fetch the actual content
      const content = await strategy.getContentBySlug(slug);

      this._logger.log(
        `[SlugService] Successfully retrieved content for slug: ${slug}`,
        this.constructor.name
      );

      return {
        slugMetadata,
        content,
        moduleType: slugMetadata.type,
      };
    } catch (error) {
      this._logger.error(
        `[SlugService] Failed to fetch content by slug: ${slug}`,
        error.stack,
        this.constructor.name
      );
      throw error;
    }
  }

  /**
   * Creates a new slug document in the database.
   * @param createSlugDto - DTO containing the data for the new slug.
   * @returns The newly created slug document.
   */
  async createSlug(createSlugDto: CreateSlugDto, user: any): Promise<TSlugDocument> {
    const property = await this._propertyService.getById(createSlugDto.propertyId);
    const organization = await this._organizationService.findOne(user.organizationId);

    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const newSlug = new this._slugModel({
      ...createSlugDto,
      property: propertyData,
      organization: organizationData,
      createdBy: buildUserMetadata(user),
      updatedBy: buildUserMetadata(user),
    });

    await newSlug.save();
    this._logger.log(`Slug created successfully: ${newSlug.slug}`, this.constructor.name);

    // Index the new slug in Elasticsearch
    await this._indexSlugInElasticsearch(newSlug);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.SLUG,
      user,
      objectId: newSlug.id,
      existingData: null,
      newData: newSlug,
    });
    return newSlug;
  }

  private async _indexSlugInElasticsearch(newSlug: TSlugDocument): Promise<void> {
    // add location into elastic search
    const elasticSlugDocument = {
      slug: newSlug.slug,
      type: newSlug.type,
      status: newSlug.status,
      seo: newSlug.seo,
      fullSlug: newSlug.fullSlug,
      redirectTo: newSlug.redirectTo,
      redirectCode: newSlug.redirectCode,
      canonicalUrl: newSlug.canonicalUrl,
      organization: newSlug.organization,
      property: newSlug.property,
      createdBy: newSlug.createdBy,
      updatedBy: newSlug.updatedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Indexing the elasticLocationDocument in Elasticsearch with error handling
    try {
      await this._elasticService.indexDocument(
        ModuleName.SLUG, // Module type for the slug
        newSlug.id, // Unique ID for the slug
        elasticSlugDocument // The document to be indexed
      );
    } catch (error) {
      console.error('Error indexing Slug in Elasticsearch:', error);
    }
  }

  /**
   * Retrieves all slugs with pagination and filtering options.
   * @param query - Pagination and filtering query parameters.
   * @returns An object containing the array of slug documents and the total number of slugs.
   */
  async getAllSlugs(query: QuerySlugDto): Promise<{
    slugs: TSlugDocument[];
    total: number;
    lastId?: string | null;
    lastSortValues?: any[] | null;
  }> {
    if (!query.status) {
      query.status = STATUS.ACTIVE;
    }

    const queryForSlugs = { ...query };

    //Filter by propertyId
    if (queryForSlugs.propertyId) {
      queryForSlugs['property.id'] = queryForSlugs.propertyId;
      delete queryForSlugs.propertyId;
    }

    const filters = getFilters(queryForSlugs);
    const total = await this._slugModel.countDocuments(filters);
    const features = new APIFeatures(this._slugModel, queryForSlugs)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();
    const slugs = await features.getQuery().exec();
    return {
      slugs,
      total,
      lastId: slugs.length > 0 ? slugs[slugs.length - 1]._id.toString() : null,
      lastSortValues: null,
    };
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  async getAllSlugsFromElasticSearch(query: QuerySlugDto): Promise<{
    slugs: Partial<TSlugDocument>[];
    total: number;
    lastId?: string | null;
    lastSortValues?: any[] | null;
  }> {
    try {
      if (!query.status) {
        query.status = STATUS.ACTIVE;
      }

      // Handle propertyId filter - map to property.id for Elasticsearch
      const queryWithPropertyFilter = { ...query };
      if (queryWithPropertyFilter.propertyId) {
        queryWithPropertyFilter['property.id'] = queryWithPropertyFilter.propertyId;
        delete queryWithPropertyFilter.propertyId;
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      // Spread first, then set defaults to avoid undefined overwriting
      const elasticQuery = {
        ...queryWithPropertyFilter,
        page: queryWithPropertyFilter.page || 1,
        pageSize: queryWithPropertyFilter.limit || 20,
        q: queryWithPropertyFilter.searchTerm,
        fields: queryWithPropertyFilter.fields,
      };

      const features = (
        await new ElasticAPIFeatures(ModuleName.SLUG, elasticQuery, this._elasticService).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();
      const result = await this._elasticService.search(ModuleName.SLUG, esQuery);

      const slugs = result.hits.hits.map((hit) => ({
        _id: hit._id,
        id: hit._id,
        ...(hit._source as TSlugDocument),
      }));

      const totalValue =
        typeof result.hits.total === 'number' ? result.hits.total : result.hits.total.value;

      return {
        slugs,
        total: totalValue,
      };
    } catch (error) {
      this._logger.error(
        `Error in fetching Slugs from Elasticsearch and falling back to MongoDB: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      // fall back to mongoDB
      return await this.getAllSlugs(query);
    }
  }
  /**
   * Retrieves a slug by its ID.
   * Throws a NotFoundException if the slug is not found.
   * @param id - The ID of the slug to retrieve.
   * @returns The slug document corresponding to the given ID.
   */
  async getSlugById(id: string): Promise<TSlugDocument> {
    const slug = await this._slugModel.findById(id).exec();
    if (!slug || slug.status == STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.SLUG.NOT_FOUND);
    }
    return slug;
  }
  /**
   * Retrieves a slug by its ID.
   * Throws a NotFoundException if the slug is not found.
   * @param id - The ID of the slug to retrieve.
   * @returns The slug document corresponding to the given ID.
   */
  async getSlugDetails(slug: string, type?: string): Promise<TSlugDocument> {
    const query: any = { slug: slug };
    if (type) {
      query.type = type; // Add type filter if present
    }
    const slugData = await this._slugModel.findOne(query).exec();

    if (!slugData || slugData.status === STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.SLUG.NOT_FOUND);
    }
    return slugData;
  }

  /**
   * Updates a slug document by its ID.
   * Throws a NotFoundException if the slug is not found.
   * @param id - The ID of the slug to update.
   * @param updateSlugDto - DTO containing the updated slug data.
   * @returns The updated slug document.
   */
  async updateSlug(id: string, updateSlugDto: UpdateSlugDto, user: any): Promise<TSlugDocument> {
    const existingSlug = await this.getSlugById(id);
    const oldSlugValue = existingSlug.slug;
    const newSlugValue = updateSlugDto.slug;
    const isSlugChanging = newSlugValue && newSlugValue !== oldSlugValue;

    if (isSlugChanging) {
      // Check the entity's status via the content retrieval strategy
      let entityIsActive = false;
      try {
        const strategy = this._contentRetrievalStrategyFactory.getStrategy(existingSlug.type);
        const entity = await strategy.getContentBySlug(oldSlugValue);
        // Mapped article responses use post_status:'publish'; other entities use status:'active'
        entityIsActive =
          entity?.status === STATUS.ACTIVE ||
          entity?.status === BLOG_STATUS.PUBLISHED ||
          entity?.post_status === 'publish';
      } catch (err) {
        this._logger.warn(
          `updateSlug: strategy/entity fetch failed — ${err?.message}; falling through to direct update`,
          this.constructor.name
        );
      }

      if (entityIsActive) {
        const domain = existingSlug.property?.domain ?? '';
        const newFullSlug = updateSlugDto.fullSlug ?? newSlugValue;
        const oldFullSlug = existingSlug.fullSlug ?? oldSlugValue;

        // 1. Update the existing slug document with new slug + fullSlug
        const updatedSlug = await this._slugModel
          .findByIdAndUpdate(
            id,
            { ...updateSlugDto, fullSlug: newFullSlug, updatedBy: buildUserMetadata(user) },
            { new: true }
          )
          .exec();

        await this._updateIdexedSlugInElasticsearch(updatedSlug);

        // 2. Create a redirect document using the old slug pointing to the new full URL
        const redirectDoc = new this._slugModel({
          slug: oldSlugValue,
          fullSlug: oldFullSlug,
          type: existingSlug.type,
          redirectTo: `${domain}/${newFullSlug}`,
          redirectCode: '301',
          property: existingSlug.property,
          organization: existingSlug.organization,
          createdBy: buildUserMetadata(user),
          updatedBy: buildUserMetadata(user),
        });
        await redirectDoc.save();
        await this._indexSlugInElasticsearch(redirectDoc);

        this._logger.log(
          `Slug updated to "${newSlugValue}"; old slug "${oldSlugValue}" now redirects to it`,
          this.constructor.name
        );

        await this._auditTrailService.logAuditTrail({
          action: ACTIONS.UPDATE,
          collectionName: ModuleName.SLUG,
          user,
          objectId: existingSlug._id,
          existingData: existingSlug,
          newData: updatedSlug,
        });

        return updatedSlug;
      }
    }

    // Entity is inactive, slug unchanged, or type has no strategy: direct update
    const updatedSlug = await this._slugModel
      .findByIdAndUpdate(
        id,
        { ...updateSlugDto, updatedBy: buildUserMetadata(user) },
        { new: true }
      )
      .exec();

    this._logger.log(`Slug updated successfully: ${updatedSlug.slug}`, this.constructor.name);

    await this._updateIdexedSlugInElasticsearch(updatedSlug);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.SLUG,
      user,
      objectId: updatedSlug._id,
      existingData: existingSlug,
      newData: updatedSlug,
    });

    return updatedSlug;
  }

  private async _updateIdexedSlugInElasticsearch(updatedSlug: TSlugDocument): Promise<void> {
    const indexPayload = {
      slug: updatedSlug.slug,
      type: updatedSlug.type,
      status: updatedSlug.status,
      seo: updatedSlug.seo,
      fullSlug: updatedSlug.fullSlug,
      redirectTo: updatedSlug.redirectTo,
      redirectCode: updatedSlug.redirectCode,
      canonicalUrl: updatedSlug.canonicalUrl,
      updatedBy: updatedSlug.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this._elasticService.updateDocument(ModuleName.SLUG, updatedSlug.id, indexPayload);
    } catch (error) {
      console.error('Error updating slug in Elasticsearch:', error);
    }
  }

  /**
   * Updates metadata for an existing slug (fullSlug, status, updatedBy).
   */
  async updateSlugMetadata(
    slug: string,
    type: string,
    propertyId: string,
    updates: { fullSlug?: string; status?: string },
    user: any
  ): Promise<void> {
    const query = { slug, type, 'property.id': propertyId };
    const updateData: any = { updatedBy: buildUserMetadata(user) };

    if (updates.fullSlug) updateData.fullSlug = updates.fullSlug;
    if (updates.status) {
      // Map entity status to valid Slug status if needed, or pass through
      // Since we updated the schema to allow 'draft', 'scheduled', etc., we can pass those through.
      if (updates.status === 'published' || updates.status === 'active') {
        updateData.status = STATUS.ACTIVE;
      } else {
        updateData.status = updates.status;
      }
    }

    await this._slugModel.updateOne(query, { $set: updateData });

    // Sync with Elasticsearch
    const updatedDoc = (await this._slugModel.findOne(query)) as TSlugDocument;
    if (updatedDoc) {
      await this._updateIdexedSlugInElasticsearch(updatedDoc);
    }
  }

  /**
   * Deletes a slug document by its ID.
   * Throws a NotFoundException if the slug is not found.
   * @param id - The ID of the slug to delete.
   * @returns void
   */
  async deleteSlug(id: string, user: TCurrentUserType): Promise<TSlugDocument> {
    const slug = await this.getSlugById(id);
    if (slug.status === STATUS.DELETED || slug.status === STATUS.TO_BE_DELETED) {
      throw new NotFoundException(MESSAGE.SLUG.NOT_FOUND);
    }

    const deletedSlug = await this._slugModel
      .findByIdAndUpdate(
        id,
        { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
        { new: true }
      )
      .exec();

    this._logger.log('SLug deleted successfully', this.constructor.name);

    // Create audit trail for delete
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.SLUG,
      user,
      objectId: slug.id,
      existingData: slug,
      newData: deletedSlug,
    });

    // Delete the slug from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.SLUG, deletedSlug.id);

    return deletedSlug;
  }
  async hardDeleteSlug(id: string): Promise<void> {
    await this._slugModel.deleteOne({ _id: id }).exec();
  }
  async generateUniqueSlug(
    name: string,
    type: ModuleName,
    user: TCurrentUserType,
    seo?: ISeo,
    propertyId?: string,
    existingSlug?: any,
    fullSlug?: string
  ): Promise<string> {
    try {
      // Fetch property and organization data
      let propertyData, organizationData;

      if (propertyId) {
        const cacheKey = `${user.organizationId}:${propertyId}`;
        const cached = this._propertyOrgCache.get(cacheKey);
        if (cached) {
          propertyData = cached.propertyData;
          organizationData = cached.organizationData;
        } else {
          const property = await this._propertyService.getById(propertyId);
          const organization = await this._organizationService.findOne(user.organizationId);

          propertyData = {
            id: property._id.toString(),
            name: property.name,
            domain: property.domain,
          };
          organizationData = {
            id: organization._id.toString(),
            name: organization.organization_name,
            slug: organization.organization_name,
            domain: organization.domain,
          };
          this._propertyOrgCache.set(cacheKey, { propertyData, organizationData });
        }
      }

      // Step 1: Create the initial slug using slugify
      if (!name) {
        throw new Error('Name is required to generate a slug');
      }
      const language = detectLanguage(name);
      // Step 2: Generate slug based on language
      let slug;
      if (existingSlug) {
        slug = existingSlug;
      } else {
        if (language === LANGUAGE.HINDI) {
          slug = generateHindiSlug(name);
        } else {
          const sanitizedName = name.replace(/\./g, ''); // This removes any dots
          slug = slugify(sanitizedName, { lower: true });
        }
      }

      if (!slug) {
        throw new Error(`Unable to generate slug from name: "${name}"`);
      }

      // Step 2: Check if the generated slug already exists in the Slug collection
      let slugExists = await this._slugModel.findOne({ slug, type });

      if (slugExists && type === ModuleName.LOCATION) {
        return slug;
      }

      if (!slugExists) {
        const slugDocument: any = {
          slug,
          type,
          seo: seo ? seo : null,
          fullSlug: fullSlug || undefined,
          createdBy: buildUserMetadata(user),
          updatedBy: buildUserMetadata(user),
        };

        if (propertyData && organizationData) {
          slugDocument.property = propertyData;
          slugDocument.organization = organizationData;
        }

        const newSlugDocument = new this._slugModel(slugDocument);
        await newSlugDocument.save();

        // Index in Elasticsearch
        await this._indexSlugInElasticsearch(newSlugDocument);

        return slug;
      }

      // Step 3: If the slug exists, modify the slug by appending/incrementing the number
      while (slugExists) {
        const slugParts = slug.split('-');
        const lastPart = slugParts[slugParts.length - 1];

        let newSlug: string;
        if (!isNaN(parseInt(lastPart))) {
          // If the last part is a number, increment it
          const lastNumber = parseInt(lastPart);
          slugParts[slugParts.length - 1] = (lastNumber + 1).toString();
          newSlug = slugParts.join('-');
        } else {
          // If no number at the end or '-' not present, append "-1"
          newSlug = `${slug}-1`;
        }

        slug = newSlug;
        slugExists = await this._slugModel.findOne({ slug });
      }

      // Save the unique slug in the collection
      const slugDocument: any = {
        slug,
        type,
        seo: seo ? seo : null,
        fullSlug: fullSlug || undefined,
        createdBy: buildUserMetadata(user),
        updatedBy: buildUserMetadata(user),
      };

      if (propertyData && organizationData) {
        slugDocument.property = propertyData;
        slugDocument.organization = organizationData;
      }

      const newSlugDocument = new this._slugModel(slugDocument);
      await newSlugDocument.save();

      // Index in Elasticsearch
      await this._indexSlugInElasticsearch(newSlugDocument);

      // Return the modified or unique slug
      return slug;
    } catch (error) {
      this._logger.error(
        `Error generating unique slug: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      throw error;
    }
  }
}
