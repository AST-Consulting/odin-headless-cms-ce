import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, TCategoryDocument } from './entities/category.schema';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AuditTrailService } from 'src/core/audit-trail/audit-trail.service';
import { ModuleName, ACTIONS, STATUS } from 'src/core/constants/enums.constants';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { ElasticService } from 'src/core/elastic/elastic.service';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { getFilters } from 'src/core/utils/getFilters';
import { buildSeoObject } from 'src/core/utils/seo.utils';
import { buildUserMetadata } from 'src/core/utils/utils';
import { CreateCategoryDTO } from './dto/category.create.dto';
import { QueryCategoryDto } from './dto/category.query.dto';
import { UpdateCategoryDto } from './dto/category.update.dto';
import { ElasticAPIFeatures } from 'src/core/utils/elasticApiFeatures.utils';
import { SlugService } from '@cms/slug/slug.service';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
import axios from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '@utilities/redis/redis.service';
import { TCurrentUserType } from '@auth/types/user.type';
import { CategorySub } from './entities/category-sub.schema';
import { sanitizeMinimalHtml } from 'src/core/utils/sanitize-html.util';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) // Inject the Mongoose model for Category
    private readonly _categoryModel: Model<TCategoryDocument>,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    @Inject(forwardRef(() => SlugService)) private readonly _slugService: SlugService,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _elasticService: ElasticService,
    private readonly _organizationService: OrganizationService,
    private readonly _propertyService: PropertyService,
    private readonly _redisService: RedisService
    // private readonly _onDeleteCascadeService: OnDeleteCascadeService
  ) { }

  /**
   * Create a new category and associate it with the user who created it.
   * Also generates a unique slug for the category.
   *
   * @param createCategoryDto - The data transfer object (DTO) containing category details
   * @param user - The user creating the category
   * @returns The created category document
   */
  async create(
    createCategoryDto: CreateCategoryDTO,
    user: TCurrentUserType
  ): Promise<TCategoryDocument> {
    // check if category already exists
    const existingCategory = await this._categoryModel.findOne({
      slug: createCategoryDto.slug,
    });
    if (existingCategory) {
      throw new ConflictException(MESSAGE.CATEGORY.ERRORS.CONFLICT);
    }
    const property = await this._propertyService.getById(createCategoryDto.propertyId);
    let organizationData: any = null;
    if (user.organizationId) {
      const organization = await this._organizationService.findOne(user.organizationId);
      organizationData = {
        id: organization._id.toString(),
        name: organization.organization_name,
        slug: organization.organization_name,
        domain: organization.domain,
      };
    }

    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };
    const {
      title,
      description,
      seo,
      parentId,
      propertyId,
      slug: existingSlug,
      fullSlug,
    } = createCategoryDto;
    const sanitizedDescription = sanitizeMinimalHtml(description);
    // Build SEO object
    const seoObj = buildSeoObject(seo, title, sanitizedDescription);
    if (seoObj.metaDescription) {
      seoObj.metaDescription = sanitizeMinimalHtml(seoObj.metaDescription) ?? '';
    }
    if (seoObj.og?.description) {
      seoObj.og.description = sanitizeMinimalHtml(seoObj.og.description) ?? '';
    }
    // Generate unique slug
    const slug = await this._slugService.generateUniqueSlug(
      title,
      ModuleName.CATEGORY,
      user,
      seoObj,
      propertyId,
      existingSlug,
      fullSlug
    );
    let parentCategory: CategorySub | null = null;
    if (parentId) {
      const parent = await this._categoryModel.findOne({ _id: parentId }).exec();
      if (parent) {
        parentCategory = {
          id: parent._id.toString(),
          title: parent.title,
          slug: parent.slug,
        };
      }
    }
    const newCategory = new this._categoryModel({
      slug,
      ...createCategoryDto,
      description: sanitizedDescription,
      property: propertyData,
      organization: organizationData,
      seo: seoObj,
      parent: parentCategory,
      updatedBy: buildUserMetadata(user),
      createdBy: buildUserMetadata(user),
    });

    const savedCategory = await newCategory.save();
    // Index the category in Elasticsearch
    await this._indexCategoryInElasticsearch(savedCategory);

    // Create audit trail
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.CATEGORY,
      user,
      objectId: savedCategory.id,
      existingData: null,
      newData: savedCategory,
    });

    return savedCategory;
  }

  // Function to handle indexing the category in Elasticsearch
  private async _indexCategoryInElasticsearch(category: TCategoryDocument): Promise<void> {
    const indexPayload = {
      id: category.id,
      title: category.title,
      titleHn: category.titleHn,
      isPublic: category.isPublic,
      description: category.description,
      slug: category.slug,
      status: category.status,
      isFeatured: category.isFeatured,
      link: category.link,
      rank: category.rank,
      parent: category.parent,
      seo: category.seo,
      organization: category.organization,
      property: category.property,
      createdBy: category.createdBy,
      updatedBy: category.updatedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await this._elasticService.indexDocument(
        ModuleName.CATEGORY,
        category.id, // Use the ID from the created category
        indexPayload
      );
    } catch (error) {
      console.error('Error indexing category in Elasticsearch:', error);
    }
  }

  /**
   * Retrieve all categories with optional filters, pagination, and sorting.
   *
   * @param query - Query parameters for filtering, pagination, and sorting
   * @returns An object containing an array of categories and the total count
   */
  async findAll(query: QueryCategoryDto): Promise<{
    data: TCategoryDocument[];
    total: number;
    lastId?: string | null;
    lastSortValues?: any[] | null;
  }> {
    // If status filer is not provided, default to active else use the provided status
    // if (!query.status) {
    //   query.status = STATUS.ACTIVE;
    // }

    const queryForCategories = { ...query };

    //Filter by propertyId
    if (queryForCategories.propertyId) {
      queryForCategories['property.id'] = queryForCategories.propertyId;
      delete query.propertyId;
    }

    // Build base filters from query for counting (exclude lastId for stable total)
    const { lastId: _lastId, ...queryForCount } = query;
    const filters = getFilters(queryForCount);
    const total = await this._categoryModel.countDocuments(filters);
    const features = new APIFeatures(this._categoryModel, query)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();

    // Execute the query and get the resulting categories
    const categories = await features.getQuery().exec();

    // Return the categories and the total count
    return {
      data: categories,
      total,
      lastId: categories.length > 0 ? categories[categories.length - 1]._id.toString() : null,
      lastSortValues: null,
    };
  }
  /**
   * Find a single category by its ID.
   *
   * @param id - The ID of the category to find
   * @returns The found category document, or null if not found
   */
  async findOne(id: string): Promise<TCategoryDocument> {
    // Find the category by its ID
    const category = await this._categoryModel.findById(id).exec();

    // check if category is deleted
    if (!category || category.status === STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.CATEGORY.NOT_FOUND);
    }

    return category;
  }

  /**
   * Update an existing category by its ID.
   *
   * @param id - The ID of the category to update
   * @param updateCategoryDto - The data transfer object (DTO) with the updated category details
   * @param user - The user performing the update
   * @returns The updated category document
   * @throws NotFoundException - If the category is not found
   */
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    user: any
  ): Promise<TCategoryDocument> {
    // Find the existing category
    const existingCategory = await this.findOne(id);
    const previousData = existingCategory.toObject();
    let parentCategory: CategorySub | null = null;
    if (updateCategoryDto.parentId) {
      const parent = await this._categoryModel
        .findOne({ _id: updateCategoryDto.parentId })
        .exec();
      if (parent) {
        parentCategory = {
          id: parent._id.toString(),
          title: parent.title,
          slug: parent.slug,
        };
      }
    }

    const sanitizedUpdate: UpdateCategoryDto = { ...updateCategoryDto };
    if (Object.prototype.hasOwnProperty.call(updateCategoryDto, 'description')) {
      sanitizedUpdate.description = sanitizeMinimalHtml(updateCategoryDto.description);
    }
    if (updateCategoryDto.seo) {
      sanitizedUpdate.seo = {
        ...updateCategoryDto.seo,
        metaDescription: sanitizeMinimalHtml(updateCategoryDto.seo.metaDescription) ?? '',
        og: updateCategoryDto.seo.og
          ? {
            ...updateCategoryDto.seo.og,
            description: sanitizeMinimalHtml(updateCategoryDto.seo.og.description) ?? '',
          }
          : updateCategoryDto.seo.og,
      };
    }

    const updatedCategory = await this._categoryModel
      .findByIdAndUpdate(
        id,
        {
          ...sanitizedUpdate,
          parent: parentCategory,
          updatedBy: buildUserMetadata(user),
        },
        { new: true } // Return the updated document
      )
      .exec();

    // Throw an exception if the updated document is not found (edge case)
    if (!updatedCategory) {
      throw new NotFoundException(MESSAGE.CATEGORY.NOT_FOUND);
    }

    // Update the category in Elasticsearch
    await this._updateCategoryInElasticsearch(updatedCategory);

    // await this._onDeleteCascadeService.cascadeUpdate({
    //   id: id,
    //   moduleName: ModuleName.CATEGORY,
    // });
    // Create an audit trail for the update
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.CATEGORY,
      user,
      objectId: updatedCategory.id,
      existingData: previousData,
      newData: updatedCategory,
    });

    return updatedCategory;
  }

  // New function to handle updating the category in Elasticsearch
  private async _updateCategoryInElasticsearch(category: TCategoryDocument): Promise<void> {
    const indexPayload = {
      id: category.id,
      title: category.title,
      titleHn: category.titleHn,
      isPublic: category.isPublic,
      description: category.description,
      slug: category.slug,
      parent: category.parent,
      status: category.status,
      isFeatured: category.isFeatured,
      link: category.link,
      rank: category.rank,
      seo: category.seo,
      updatedBy: category.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this._elasticService.updateDocument(
        ModuleName.CATEGORY,
        category.id, // Use the ID from the updated category
        indexPayload
      );
    } catch (error) {
      console.error('Error updating category in Elasticsearch:', error);
    }
  }

  async remove(id: string, user: any): Promise<TCategoryDocument> {
    const category = await this.findOne(id);
    // Soft delete the category and update the updatedBy field
    const deletedCategory = await this._categoryModel.findByIdAndUpdate(
      id,
      { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
      { new: true }
    );

    if (!deletedCategory) {
      throw new NotFoundException(MESSAGE.CATEGORY.NOT_FOUND);
    }
    // Remove the category from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.CATEGORY, id);

    // await this._onDeleteCascadeService.cascadeDelete({
    //   id: id,
    //   moduleName: ModuleName.CATEGORY,
    // });
    // Create audit trail for delete
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.CATEGORY,
      user,
      objectId: category.id,
      existingData: category,
      newData: deletedCategory,
    });

    this._logger.log('Category deleted successfully', this.constructor.name);

    return deletedCategory;
  }

  async findCategoryByIds(ids: string[]): Promise<TCategoryDocument[]> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return this._categoryModel.find({ _id: { $in: ids } }).exec();
  }

  async findCategoriesByWpIds(wpCategoryIds: number[]): Promise<TCategoryDocument[]> {
    return this._categoryModel.find({ wpCategoryId: { $in: wpCategoryIds } }).exec();
  }

  async findAllDescendantSlugs(parentSlug: string): Promise<string[]> {
    const parentCategory = await this._categoryModel.findOne({ slug: parentSlug }).exec();
    if (!parentCategory) return [parentSlug];

    const fullSlug = parentCategory.fullSlug || parentCategory.slug;

    // Find all categories where fullSlug starts with parent's fullSlug
    // Using regex for prefix match in MongoDB
    const descendants = await this._categoryModel
      .find({
        $or: [{ slug: parentSlug }, { fullSlug: new RegExp(`^${fullSlug}/`) }],
        status: STATUS.ACTIVE,
      })
      .select('slug')
      .exec();

    return descendants.map((cat) => cat.slug);
  }

  async findAllAncestorsByFullSlug(fullSlug: string): Promise<TCategoryDocument[]> {
    if (!fullSlug) return [];
    const parts = fullSlug.split('/').filter(Boolean);
    if (parts.length <= 1) return [];

    const ancestorFullSlugs = [];
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      ancestorFullSlugs.push(currentPath);
    }

    return this._categoryModel
      .find({
        fullSlug: { $in: ancestorFullSlugs },
        status: STATUS.ACTIVE,
      })
      .exec();
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  async findAllFromElastic(query: QueryCategoryDto): Promise<{
    data: Partial<TCategoryDocument>[];
    total: any;
    lastId?: string | null;
    lastSortValues?: any[] | null;
  }> {
    try {
      // If status filter is not provided, default to active
      // if (!query.status) {
      //   query.status = STATUS.ACTIVE;
      // }

      // Handle filters - convert to match Elasticsearch field names
      const queryWithFilters = { ...query };

      // FIX: map propertyId → property.id for Elasticsearch filtering
      if (queryWithFilters.propertyId) {
        queryWithFilters['property.id'] = queryWithFilters.propertyId;
        delete queryWithFilters.propertyId;
      }

      // Handle sorting mapping
      if (queryWithFilters.sort === 'title') {
        queryWithFilters.sort = 'title.keyword_ci';
      } else if (queryWithFilters.sort === 'slug') {
        queryWithFilters.sort = 'slug.keyword_ci';
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      const { searchTerm, ...restQuery } = queryWithFilters;
      const elasticQuery = {
        page: restQuery.page || 1,
        pageSize: restQuery.limit || 20,
        q: searchTerm,
        fields: restQuery.fields,
        ...restQuery,
      };

      if (queryWithFilters.status) {
        elasticQuery.status = queryWithFilters.status;
      }

      const features = (
        await new ElasticAPIFeatures(
          ModuleName.CATEGORY,
          elasticQuery,
          this._elasticService
        ).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();

      const result = await this._elasticService.search(ModuleName.CATEGORY, esQuery);
      console.log('RESULT: ', result);
      const hits = result.hits.hits;
      const categories = hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TCategoryDocument),
      }));

      const lastHit = hits[hits.length - 1];
      const lastSortValues = lastHit ? lastHit.sort : null;

      return {
        data: categories,
        total: result.hits.total,
        lastId: lastHit?._id || null,
        lastSortValues: lastSortValues,
      };
    } catch (error) {
      const categories = await this.findAll(query);
      console.error(
        'Error in fetching categories in elasticsearch and fallback to mongodb:',
        error
      );
      return {
        data: categories.data,
        total: categories.total,
        lastId: categories.lastId,
        lastSortValues: categories.lastSortValues,
      };
    }
  }

  /**
   * Retrieves a single category by field value from Elasticsearch
   * @param field The field to search by (e.g., '_id', 'slug')
   * @param value The value to search for
   * @returns The category with the specified field value
   */
  async findOneFromElastic(field: string, value: string): Promise<Partial<TCategoryDocument>> {
    try {
      this._logger.log(
        `[Category.findOneFromElastic] Fetching category with ${field}: ${value}`,
        this.constructor.name
      );

      const result = await this._elasticService.findOneByField(ModuleName.CATEGORY, field, value);

      if (!result) {
        throw new NotFoundException(`Category with ${field} '${value}' not found`);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching category from Elasticsearch:', error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_10_HOURS)
  async syncCategories(user: any) {
    try {
      const url = `'${process.env.SITE || "https://example.com"}/wp-json/api/v1/getcategory?token=${process.env.WP_TOKEN}`;
      console.log('url', url);
      const response = await axios.get(url);
      console.log('response', response.data);
      const wpCategories = response.data.Data;
      console.log('wpCategories', wpCategories);
      const cachedCategories = await this._redisService.get('wp_categories');
      console.log('cachedCategories', cachedCategories);
      if (cachedCategories == wpCategories) {
        console.log('no new categories');
        return;
      }
      console.log('new categories');
      const cacheKey = 'wp_categories';
      await this._redisService.setWithTTL(cacheKey, wpCategories, 'EX', 86400);

      // Only run this for new changed categories by comparing with cachedCategories
      let cachedCategoryNames: Set<string> = new Set();
      if (Array.isArray(cachedCategories)) {
        cachedCategoryNames = new Set(cachedCategories.map((cat: any) => cat.category_name));
      }

      const categories = await Promise.all(
        wpCategories.map(async (category) => {
          // Only create category if it's not in cachedCategories
          if (cachedCategoryNames.has(category.category_name)) {
            return null;
          }
          const createdCategory = await this.create(
            {
              title: category.category_name,
              isPublic: true,
              status: STATUS.ACTIVE,
              propertyId: '6926b8f59a288ddf06a28884',
              wpCategoryId: category.category_id || category.id, // Just save the ID
            } as any,
            user
          );
          return createdCategory;
        })
      );
    } catch (error) {
      throw new Error(`Failed to fetch WordPress categories: ${error.message}`);
    }
  }

  async syncWpCategoryIds(
    user: TCurrentUserType
  ): Promise<{ success: boolean; updated: number; total: number; errors: any[] }> {
    if (!user || !user.email || !user.sub || !user.organizationId) {
      this._logger.error('[Category.syncWpCategoryIds] Invalid user context');
      throw new Error('User authentication required.');
    }
    const propertyId = '6926b8f59a288ddf06a28884';

    this._logger.log(
      `[Category.syncWpCategoryIds] Starting WP category ID sync for user: ${user.email}`,
      this.constructor.name
    );

    const wpAdmin = process.env.WP_ADMIN;
    const wpPassword = process.env.WP_PASSWORD;
    const wpApiUrl = ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/categories';

    if (!wpAdmin || !wpPassword) {
      this._logger.error('[Category.syncWpCategoryIds] WP_ADMIN or WP_PASSWORD not configured');
      throw new Error('WordPress credentials not configured');
    }

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let updated = 0;
    let total = 0;
    const errors = [];
    const perPage = 100;
    let currentPage = 1;
    let hasMore = true;

    const cacheKey = `wp_category_sync_${propertyId}`;
    await this._redisService.set(
      cacheKey,
      JSON.stringify({ status: 'in_progress', updated: 0, total: 0 })
    );

    try {
      while (hasMore) {
        this._logger.log(
          `[Category.syncWpCategoryIds] Fetching page ${currentPage}`,
          this.constructor.name
        );

        const response = await axios.get(wpApiUrl, {
          params: {
            per_page: perPage,
            page: currentPage,
          },
          auth: {
            username: wpAdmin,
            password: wpPassword,
          },
        });

        const wpCategories = response.data;
        total += wpCategories.length;

        if (wpCategories.length === 0 || wpCategories.length < perPage) {
          hasMore = false;
        }

        for (const wpCategory of wpCategories) {
          try {
            const dbCategory = await this._categoryModel
              .findOne({
                title: wpCategory.name,
                propertyId: propertyId,
              })
              .exec();

            if (dbCategory && !dbCategory.wpCategoryId) {
              await this._categoryModel
                .findByIdAndUpdate(
                  dbCategory._id,
                  {
                    wpCategoryId: wpCategory.id,
                    updatedBy: buildUserMetadata(user),
                  },
                  { new: true }
                )
                .exec();

              updated++;

              this._logger.log(
                `[Category.syncWpCategoryIds] Updated category: ${wpCategory.name} with wpCategoryId: ${wpCategory.id}`,
                this.constructor.name
              );
            }
          } catch (error) {
            this._logger.error(
              `[Category.syncWpCategoryIds] Error updating category ${wpCategory.name}:`,
              {
                error: error.message,
                wpCategoryId: wpCategory.id,
              },
              this.constructor.name
            );
            errors.push({
              name: wpCategory.name,
              wpCategoryId: wpCategory.id,
              error: error.message,
            });
          }
        }

        await this._redisService.set(
          cacheKey,
          JSON.stringify({ status: 'in_progress', updated, total, currentPage })
        );

        if (hasMore) {
          currentPage++;
          await delay(2000);
        }
      }

      await this._redisService.setWithTTL(
        cacheKey,
        JSON.stringify({ status: 'completed', updated, total, errors: errors.length }),
        'EX',
        3600
      );

      this._logger.log(
        `[Category.syncWpCategoryIds] Sync completed. Total: ${total}, Updated: ${updated}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return {
        success: true,
        updated,
        total,
        errors,
      };
    } catch (error) {
      await this._redisService.setWithTTL(
        cacheKey,
        JSON.stringify({ status: 'failed', error: error.message }),
        'EX',
        3600
      );

      this._logger.error(
        '[Category.syncWpCategoryIds] Failed to sync:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );
      throw new Error(`Failed to sync WordPress category IDs: ${error.message}`);
    }
  }

  async fetchAndCreateWpCategories(
    user: TCurrentUserType
  ): Promise<{ success: boolean; created: number; total: number; errors: any[] }> {
    if (!user || !user.email || !user.sub || !user.organizationId) {
      this._logger.error('[Category.fetchAndCreateWpCategories] Invalid user context');
      throw new Error('User authentication required.');
    }

    const propertyId = '6926b8f59a288ddf06a28884';

    this._logger.log(
      `[Category.fetchAndCreateWpCategories] Starting WP category sync for user: ${user.email}`,
      this.constructor.name
    );

    const wpAdmin = process.env.WP_ADMIN;
    const wpPassword = process.env.WP_PASSWORD;
    const wpApiUrl = ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/categories';

    if (!wpAdmin || !wpPassword) {
      this._logger.error(
        '[Category.fetchAndCreateWpCategories] WP_ADMIN or WP_PASSWORD not configured'
      );
      throw new Error('WordPress credentials not configured');
    }

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let created = 0;
    let total = 0;
    const errors = [];
    const perPage = 50;
    let currentPage = 1;
    let hasMore = true;

    const property = await this._propertyService.getById(propertyId);
    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    try {
      while (hasMore) {
        this._logger.log(
          `[Category.fetchAndCreateWpCategories] Fetching page ${currentPage}`,
          this.constructor.name
        );

        const response = await axios.get(wpApiUrl, {
          params: {
            per_page: perPage,
            page: currentPage,
          },
          auth: {
            username: wpAdmin,
            password: wpPassword,
          },
        });

        const wpCategories = response.data;
        total += wpCategories.length;

        if (wpCategories.length === 0 || wpCategories.length < perPage) {
          hasMore = false;
        }

        for (const wpCategory of wpCategories) {
          try {
            const slug = await this._slugService.generateUniqueSlug(
              wpCategory.name,
              ModuleName.CATEGORY,
              user,
              null,
              propertyId
            );

            const seoObj = buildSeoObject(null, wpCategory.name, wpCategory.description);

            const newCategory = new this._categoryModel({
              wpCategoryId: wpCategory.id,
              title: wpCategory.name,
              description: wpCategory.description || '',
              slug: slug,
              status: STATUS.ACTIVE,
              isPublic: true,
              property: propertyData,
              organization: organizationData,
              seo: seoObj,
              createdBy: buildUserMetadata(user),
              updatedBy: buildUserMetadata(user),
            });

            await newCategory.save();

            created++;

            this._logger.log(
              `[Category.fetchAndCreateWpCategories] Created category: ${wpCategory.name} with wpCategoryId: ${wpCategory.id}`,
              this.constructor.name
            );
          } catch (error) {
            this._logger.error(
              `[Category.fetchAndCreateWpCategories] Error processing category ${wpCategory.name}:`,
              {
                error: error.message,
                wpCategoryId: wpCategory.id,
              },
              this.constructor.name
            );
            errors.push({
              name: wpCategory.name,
              wpCategoryId: wpCategory.id,
              error: error.message,
            });
          }
        }

        if (hasMore) {
          currentPage++;
          await delay(2000);
        }
      }

      this._logger.log(
        `[Category.fetchAndCreateWpCategories] Sync completed. Total: ${total}, Created: ${created}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return {
        success: true,
        created,
        total,
        errors,
      };
    } catch (error) {
      this._logger.error(
        '[Category.fetchAndCreateWpCategories] Failed to sync:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );
      throw new Error(`Failed to sync WordPress categories: ${error.message}`);
    }
  }

  /**
   * Maps category to WordPress REST API v2 format
   * Used by the /v2/categories endpoint
   * Returns data matching the standard WordPress REST API category structure
   * @param category The category to map
   * @returns Mapped category in WordPress REST API v2 format
   */
  mapCategoryToWordPressRestApiFormat(category: any): any {
    return {
      id: category.wpCategoryId || category._id,
      count: 0, // This would need to be calculated by counting articles in this category
      description: category.description || '',
      name: category.title || '',
      slug: category.slug || '',
      taxonomy: 'category',
      parent: category.parent?.wpCategoryId || category.parent?.id || 0,
      _links: {
        self: [
          {
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/categories/${category.wpCategoryId || category._id}`,
          },
        ],
        collection: [
          {
            href: ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/categories',
          },
        ],
        about: [
          {
            href: ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/taxonomies/category',
          },
        ],
        ...(category.parent && category.parent.id
          ? {
            up: [
              {
                embeddable: true,
                href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/categories/${category.parent.wpCategoryId || category.parent.id}`,
              },
            ],
          }
          : {}),
        'wp:post_type': [
          {
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/posts?categories=${category.wpCategoryId || category._id}`,
          },
        ],
        curies: [
          {
            name: 'wp',
            href: 'https://api.w.org/{rel}',
            templated: true,
          },
        ],
      },
    };
  }
}
