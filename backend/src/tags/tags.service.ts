import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Tag, TTagDocument } from './entities/tags.schema';
import { Model } from 'mongoose';
import { TagDto, UpdateTagDto, UpdateTagRank } from './dto/tags.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { TagQueryDto } from './dto/query-tags.dto';
import { AuditTrailService } from 'src/core/audit-trail/audit-trail.service';
import { ElasticService } from 'src/core/elastic/elastic.service';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { ACTIONS, ModuleName, STATUS } from 'src/core/constants/enums.constants';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { getFilters } from 'src/core/utils/getFilters';
import { buildUserMetadata } from 'src/core/utils/utils';
import { SlugService } from '@cms/slug/slug.service';
import { PropertyService } from '@property/property.service';
import { OrganizationService } from '@organization/organization.service';
import { TCurrentUserType } from '@auth/types/user.type';
import axios from 'axios';
import { ElasticAPIFeatures } from 'src/core/utils/elasticApiFeatures.utils';
import { SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';
import { OnDeleteCascadeService } from '@core/on-delete-cascade/on-delete-cascade.service';
import slugify from 'slugify';

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name)
    private _tagModel: Model<TTagDocument>,
    @Inject(forwardRef(() => SlugService)) private readonly _slugService: SlugService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _elasticService: ElasticService,
    private readonly _propertyService: PropertyService,
    private readonly _organizationService: OrganizationService,
    private readonly _onDeleteCascadeService: OnDeleteCascadeService
  ) {}

  async create(createTagDto: TagDto, user: TCurrentUserType): Promise<TTagDocument> {
    const { description, name, rank, slug: existingSlug } = createTagDto;
    // Check if a tag with the same name already exists
    const existingTagByName = await this._tagModel.findOne({ name });
    if (existingTagByName) {
      throw new ConflictException(MESSAGE.TAG.ALREADY_EXISTS);
    }

    const property = await this._propertyService.getById(createTagDto.propertyId);
    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.slug,
    };

    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    // Build SEO object
    // const seoObj = buildSeoObject(seo, name, description);
    const generatedSlug = existingSlug || slugify(name, { lower: true });

    // Generate unique slug
    const slug = await this._slugService.generateUniqueSlug(
      name,
      ModuleName.TAG,
      user,
      null,
      createTagDto.propertyId,
      existingSlug,
      generatedSlug
    );

    const createdTag = new this._tagModel({
      ...createTagDto,
      name,
      slug,
      description: description,
      organization: organizationData,
      property: propertyData,
      rank,
      createdBy: buildUserMetadata(user),
      updatedBy: buildUserMetadata(user),
    });

    await createdTag.save();

    this._logger.log(`Tag created successfully: ${createdTag.name}`, this.constructor.name);

    // Create audit trail
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.TAG,
      user,
      objectId: createdTag.id,
      existingData: null,
      newData: createdTag,
    });

    // Index the tag in Elasticsearch
    await this._indexTagInElasticsearch(createdTag);

    return createdTag;
  }

  // New function to handle indexing the tag in Elasticsearch
  private async _indexTagInElasticsearch(tag: TTagDocument): Promise<void> {
    const indexPayload = {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      rank: tag.rank,
      status: tag.status,
      isFeatured: tag.isFeatured,
      seo: tag.seo,
      organization: tag.organization,
      property: tag.property,
      createdBy: tag.createdBy,
      updatedBy: tag.updatedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await this._elasticService.indexDocument(
        ModuleName.TAG,
        tag.id, // Use the ID from the created tag
        indexPayload
      );
    } catch (error) {
      console.error('Error indexing document in Elasticsearch:', error);
    }
  }

  async findAll(query: TagQueryDto): Promise<{
    total: number;
    data: TTagDocument[];
    lastId?: string | null;
    lastSortValues?: any[] | null;
  }> {
    // If status filer is not provided, default to active else use the provided status
    if (!query.status) {
      query.status = STATUS.ACTIVE;
    }

    const queryForFilters = { ...query };

    // Filter by propertyId if provided
    if (queryForFilters.propertyId) {
      queryForFilters['property.id'] = queryForFilters.propertyId;
      delete queryForFilters.propertyId;
    }

    const filters = getFilters(queryForFilters);
    const total = await this._tagModel.countDocuments(filters);

    const features = new APIFeatures(this._tagModel, queryForFilters)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();
    const doc = await features.getQuery().exec();

    return {
      total: total,
      data: doc,
      lastId: doc.length > 0 ? doc[doc.length - 1]._id.toString() : null,
      lastSortValues: null,
    };
  }

  async findOne(id: string): Promise<TTagDocument> {
    const tag = await this._tagModel.findById(id).exec();

    if (!tag || tag.status === STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.TAG.NOT_FOUND);
    }

    return tag;
  }

  async findBySlug(slug: string): Promise<TTagDocument> {
    const tag = await this._tagModel.findOne({
      status: STATUS.ACTIVE,
      slug: slug,
    });
    if (!tag) {
      throw new NotFoundException(MESSAGE.TAG.NOT_FOUND);
    }
    return tag;
  }

  async findTagsByIds(tagIds: string[]): Promise<TTagDocument[]> {
    const tags = await this._tagModel.find({ _id: { $in: tagIds } });

    return tags;
  }

  async findByName(name: string, propertyId: string): Promise<TTagDocument | null> {
    const slugifiedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    const tag = await this._tagModel

      .findOne({
        slug: {
          $regex: new RegExp(`^${slugifiedName}$`, 'i'),
        },
        'property.id': propertyId,
      })
      .exec();

    return tag;
  }

  async findTagsByWpIds(wpTagIds: number[]): Promise<TTagDocument[]> {
    const tags = await this._tagModel.find({ wpTagId: { $in: wpTagIds } });
    return tags;
  }

  async updateTagAndRanks(updatedTag: UpdateTagRank, user: any): Promise<TTagDocument[]> {
    // Find the original tag to get its rank
    const originalTag = await this.findOne(updatedTag.id);
    const updatedTagDocument = await this._tagModel.findByIdAndUpdate(
      updatedTag.id,
      {
        rank: updatedTag.rank,
        updatedBy: buildUserMetadata(user),
      },
      { new: true }
    );

    // Calculate the change in rank
    const rankChange = updatedTag.rank - originalTag.rank;

    const otherTags = await this._tagModel.find({
      _id: { $ne: updatedTag.id },
    });

    const updatedTags = otherTags.map((tag) => {
      if (rankChange > 0 && tag.rank >= originalTag.rank && tag.rank <= updatedTag.rank) {
        tag.rank -= 1;
      } else if (rankChange < 0 && tag.rank <= originalTag.rank && tag.rank >= updatedTag.rank) {
        tag.rank += 1;
      }

      return tag;
    });

    const bulkOps = updatedTags.map((tag) => ({
      updateOne: {
        filter: { _id: tag._id },
        update: {
          rank: tag.rank,
        },
      },
    }));

    await this._tagModel.bulkWrite(bulkOps);

    const allTags = [updatedTagDocument, ...updatedTags];

    const sortedTags = allTags.sort((a, b) => a.rank - b.rank);

    return sortedTags;
  }

  async update(id: string, updateTagDto: UpdateTagDto, user: any): Promise<TTagDocument> {
    const existingTag = await this._tagModel.findById(id);
    if (!existingTag) {
      throw new NotFoundException(MESSAGE.TAG.NOT_FOUND);
    }

    const previousData = existingTag.toObject();

    const updatedTag = await this._tagModel
      .findByIdAndUpdate(
        id,
        {
          ...updateTagDto,
          updatedBy: buildUserMetadata(user),
        },
        { new: true }
      )
      .exec();
    if (!updatedTag) {
      throw new NotFoundException(MESSAGE.TAG.NOT_FOUND);
    }

    this._logger.log(`Tag updated successfully: ${updatedTag.name}`, this.constructor.name);
    // await this._onDeleteCascadeService.cascadeUpdate({
    //   id: id,
    //   moduleName: ModuleName.TAG,
    // });
    // Create an audit trail for the update
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.TAG,
      user,
      objectId: updatedTag.id,
      existingData: previousData,
      newData: updatedTag,
    });

    // Update the tag in Elasticsearch
    await this._updateTagInElasticsearch(updatedTag);

    return updatedTag;
  }

  // New function to handle updating the tag in Elasticsearch
  private async _updateTagInElasticsearch(tag: TTagDocument): Promise<void> {
    const indexPayload = {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      rank: tag.rank,
      status: tag.status,
      seo: tag.seo,
      isFeatured: tag.isFeatured,
      updatedBy: tag.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this._elasticService.updateDocument(
        ModuleName.TAG,
        tag.id, // Use the ID from the updated tag
        indexPayload
      );
    } catch (error) {
      console.error('Error updating document in Elasticsearch:', error);
    }
  }

  async remove(id: string, user: any): Promise<TTagDocument> {
    const tag = await this.findOne(id);
    const deletedTag = await this._tagModel
      .findByIdAndUpdate(
        id,
        { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
        { new: true }
      )
      .exec();

    if (!deletedTag) {
      throw new NotFoundException(MESSAGE.TAG.NOT_FOUND);
    }

    this._logger.log('Tag deleted successfully', this.constructor.name);

    // Delete the tag from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.TAG, tag.id);

    await this._onDeleteCascadeService.cascadeDelete({
      id: id,
      moduleName: ModuleName.TAG,
    });

    // Create audit trail for delete
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.TAG,
      user,
      objectId: tag.id,
      existingData: tag,
      newData: deletedTag,
    });

    return deletedTag;
  }

  async syncWpTagIds(
    user: TCurrentUserType
  ): Promise<{ success: boolean; created: number; total: number; errors: any[] }> {
    if (!user || !user.email || !user.sub || !user.organizationId) {
      this._logger.error('[Tags.syncWpTagIds] Invalid user context');
      throw new Error('User authentication required.');
    }

    const propertyId = '6926b8f59a288ddf06a28884';

    this._logger.log(
      `[Tags.syncWpTagIds] Starting WP tag ID sync for user: ${user.email}`,
      this.constructor.name
    );

    const wpAdmin = process.env.WP_ADMIN;
    const wpPassword = process.env.WP_PASSWORD;
    const wpApiUrl = process.env.SITE ? `${process.env.SITE}/wp-json/wp/v2/tags` : '';

    if (!wpAdmin || !wpPassword) {
      this._logger.error('[Tags.syncWpTagIds] WP_ADMIN or WP_PASSWORD not configured');
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
        this._logger.log(`[Tags.syncWpTagIds] Fetching page ${currentPage}`, this.constructor.name);

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

        const wpTags = response.data;
        total += wpTags.length;

        if (wpTags.length === 0 || wpTags.length < perPage) {
          hasMore = false;
        }

        for (const wpTag of wpTags) {
          try {
            const slug = await this._slugService.generateUniqueSlug(
              wpTag.name,
              ModuleName.TAG,
              user,
              null,
              propertyId
            );

            const newTag = new this._tagModel({
              name: wpTag.name,
              slug: slug,
              description: wpTag.description || '',
              wpTagId: wpTag.id,
              status: STATUS.ACTIVE,
              organization: organizationData,
              property: propertyData,
              createdBy: buildUserMetadata(user),
              updatedBy: buildUserMetadata(user),
            });

            await newTag.save();

            created++;

            this._logger.log(
              `[Tags.syncWpTagIds] Created tag: ${wpTag.name} with wpTagId: ${wpTag.id}`,
              this.constructor.name
            );
          } catch (error) {
            this._logger.error(
              `[Tags.syncWpTagIds] Error processing tag ${wpTag.name}:`,
              {
                error: error.message,
                wpTagId: wpTag.id,
              },
              this.constructor.name
            );
            errors.push({
              name: wpTag.name,
              wpTagId: wpTag.id,
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
        `[Tags.syncWpTagIds] Sync completed. Total: ${total}, Created: ${created}, Errors: ${errors.length}`,
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
        '[Tags.syncWpTagIds] Failed to sync:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );
      throw new Error(`Failed to sync WordPress tag IDs: ${error.message}`);
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  async findAllFromElastic(
    query: TagQueryDto,
    user: any
  ): Promise<{
    data: Partial<TTagDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
    lastSortValues?: any[] | null;
  }> {
    try {
      // If status filter is not provided, default to active
      if (!query.status) {
        query.status = STATUS.ACTIVE;
      }

      // Handle property filter - convert to property.id for Elasticsearch filtering
      const queryWithFilters = { ...query };

      // FIX: map propertyId → property.id for Elasticsearch filtering
      if (queryWithFilters.propertyId) {
        queryWithFilters['property.id'] = queryWithFilters.propertyId;
        delete queryWithFilters.propertyId;
      }

      // // Filter by user's organization (optional - can be enabled if needed)
      // if (user && !queryWithFilters.organizationId) {
      //   queryWithFilters.organizationId = user.organizationId;
      // }

      if (user) {
        this._logger.log(
          `[Tag.findAllFromElastic] User ${user.email} accessing tags for organization ${user.organizationId}`,
          this.constructor.name
        );
      } else {
        this._logger.log(`[Tag.findAllFromElastic] Public access to tags`, this.constructor.name);
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

      // Build the base query with filters (don't call .search() - we handle it manually)
      const features = (
        await new ElasticAPIFeatures(ModuleName.TAG, elasticQuery, this._elasticService).filter()
      )
        .sort()
        .limitFields();

      const esQuery = features.getQuery();

      // Handle search for tags with custom field prioritization
      if (elasticQuery.q) {
        // Ensure bool structure exists
        if (!esQuery.query.bool) {
          esQuery.query.bool = { must: [], filter: [], should: [] };
        }

        // Move existing must constraints to filter (these are for filtering, not scoring)
        if (esQuery.query.bool.must && esQuery.query.bool.must.length > 0) {
          esQuery.query.bool.filter = [
            ...(esQuery.query.bool.filter || []),
            ...esQuery.query.bool.must,
          ];
          esQuery.query.bool.must = [];
        }

        // Add custom search query with tag-specific field priorities
        esQuery.query.bool.must.push({
          multi_match: {
            query: elasticQuery.q,
            fields: [
              'name^3', // Highest priority for tag name
              'name.keyword^4', // Exact match on name gets highest priority
              'description^2', // Medium-high priority for description
              'slug^1', // Standard priority for slug
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
            operator: 'or', // Match any of the terms
          },
        });
      }

      const result = await this._elasticService.search(ModuleName.TAG, esQuery);
      const hits = result.hits.hits;

      const tags = hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TTagDocument),
      }));

      const lastHit = hits[hits.length - 1];
      const lastSortValues = lastHit ? lastHit.sort : null;

      return {
        data: tags,
        total: result.hits.total,
        lastId: lastHit?._id || null,
        lastSortValues: lastSortValues,
      };
    } catch (error) {
      console.error('Error in fetching tags in elasticsearch and fallback to mongodb:', error);
      const tags = await this.findAll(query);
      return {
        data: tags.data,
        total: tags.total,
        lastId: tags.lastId,
        lastSortValues: tags.lastSortValues,
      };
    }
  }

  async findOneFromElastic(entity: string, value: string): Promise<TTagDocument> {
    return this._elasticService.findOneByField(ModuleName.TAG, entity, value);
  }

  /**
   * Maps tag to WordPress REST API v2 format
   * Used by the /v2/tags endpoint
   * Returns data matching the standard WordPress REST API tag structure
   * @param tag The tag to map
   * @returns Mapped tag in WordPress REST API v2 format
   */
  mapTagToWordPressRestApiFormat(tag: any): any {
    return {
      id: tag.wpTagId || tag._id,
      count: 1, // This would need to be calculated by counting articles with this tag
      description: tag.description || '',
      name: tag.name || '',
      slug: tag.slug || '',
      taxonomy: 'post_tag',
      _links: {
        self: [
          {
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/tags/${tag.wpTagId || tag._id}`,
          },
        ],
        collection: [
          {
            href: ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/tags',
          },
        ],
        about: [
          {
            href: ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/taxonomies/post_tag',
          },
        ],
        'wp:post_type': [
          {
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/posts?tags=${tag.wpTagId || tag._id}`,
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
