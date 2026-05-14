import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APIFeatures } from '@core/utils/apiFeatures.utils';
import { ModuleName, STATUS, ACTIONS, BannerOpenIn } from '@core/constants/enums.constants';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { buildUserMetadata } from '@core/utils/utils';
import { SlugService } from '@cms/slug/slug.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AuditTrailService } from '@core/audit-trail/audit-trail.service';
import { Banner, TBannerDocument } from './entities/banner.schema';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { QueryBannerDto } from './dto/query-banner.dto';
import { BannerTypeService } from './banner-type/banner-type.service';
import { ElasticAPIFeatures } from '@core/utils/elasticApiFeatures.utils';
import { ElasticService } from '@core/elastic/elastic.service';
import { OnDeleteCascadeService } from '@core/on-delete-cascade/on-delete-cascade.service';
import { TagsService } from '@tags/tags.service';
import { SearchTotalHits } from 'node_modules/@elastic/elasticsearch/lib/api/types';
import { CategoryService } from 'src/category/category.service';
import { PropertyService } from '@property/property.service';
import { OrganizationService } from '@organization/organization.service';

@Injectable()
export class BannerService {
  constructor(
    @InjectModel(Banner.name)
    private readonly _bannerModel: Model<TBannerDocument>,
    private readonly _slugService: SlugService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _categoryService: CategoryService,
    private readonly _tagService: TagsService,
    private readonly _bannerTypeService: BannerTypeService,
    private readonly _elasticService: ElasticService,
    // private readonly _onDeleteCascadeService: OnDeleteCascadeService,
    private readonly _organizationService: OrganizationService,
    private readonly _propertyService: PropertyService
  ) { }

  async create(createBannerDto: CreateBannerDto, user: any): Promise<TBannerDocument> {
    try {
      const {
        title,
        bannerType,
        banners,
        description,
        categories,
        tags,
        rank,
        startDate,
        endDate,
        status,
        propertyId,
      } = createBannerDto;
      const property = await this._propertyService.getById(propertyId);
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

      // Generate a unique slug for the banner
      const slug = await this._slugService.generateUniqueSlug(
        title,
        ModuleName.BANNER,
        user,
        null,
        propertyId
      );

      // Validate and retrieve the banner type
      const bannerTypeObj = await this._bannerTypeService.findOne(bannerType);

      /**
       * Utility to fetch and validate associated entities (e.g., categories, tags).
       * Ensures all IDs exist and maps them to the desired structure.
       */
      const fetchAndValidateEntities = async (ids, service, entityLabel, mapFn) => {
        if (!ids?.length) return [];
        const items = (await service.findAll({ _id: { $in: ids } })).data;
        if (items.length !== ids.length) {
          throw new NotFoundException(`${entityLabel} not found for some IDs.`);
        }
        return items.map(mapFn);
      };

      // Validate and fetch associated categories
      const validatedCategories = await fetchAndValidateEntities(
        categories,
        this._categoryService,
        'Category',
        (category) => ({
          id: category._id,
          name: category.title,
          displayName: category.title,
          slug: category.slug,
        })
      );

      // Validate and fetch associated tags
      const validatedTags = await fetchAndValidateEntities(
        tags,
        this._tagService,
        'Tag',
        (tag) => ({
          id: tag._id,
          name: tag.name,
          slug: tag.slug,
        })
      );

      // Validate and process banner images
      const processedImages = banners
        ? await Promise.all(
          banners.map(async (bannerDetail) => {
            return {
              slug: await this._slugService.generateUniqueSlug(
                bannerDetail.title,
                ModuleName.BANNER,
                user
              ),
              ...bannerDetail,
              status: bannerDetail.status || STATUS.ACTIVE,
              openIn: bannerDetail.openIn || BannerOpenIn.SAME,
            };
          })
        )
        : [];

      // Create the banner document
      const createdBanner: TBannerDocument = new this._bannerModel({
        title,
        slug,
        bannerType: {
          id: bannerTypeObj._id,
          name: bannerTypeObj.name,
          slug: bannerTypeObj.slug,
        },
        banners: processedImages,
        description,
        organization: organizationData,
        property: propertyData,
        categories: validatedCategories,
        tags: validatedTags,
        rank: rank || 0,
        startDate,
        endDate,
        status: status || STATUS.ACTIVE,
        createdBy: buildUserMetadata(user),
        updatedBy: buildUserMetadata(user),
      });

      // Save the banner document
      await createdBanner.save();

      // index into elastic search
      await this._indexBannerInElasticsearch(createdBanner);

      this._logger.log(
        `Banner "${createdBanner.title}" created successfully`,
        this.constructor.name
      );

      // Log audit trail for the banner creation
      await this._auditTrailService.logAuditTrail({
        action: ACTIONS.CREATE,
        collectionName: ModuleName.BANNER,
        user,
        objectId: createdBanner.id,
        existingData: null,
        newData: createdBanner,
      });

      return createdBanner;
    } catch (error) {
      this._logger.error(
        `Error creating banner: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      throw error;
    }
  }

  private async _indexBannerInElasticsearch(createdBanner: TBannerDocument): Promise<void> {
    const indexPayload = {
      id: createdBanner.id,
      title: createdBanner.title,
      slug: createdBanner.slug,
      bannerType: createdBanner.bannerType,
      banners: createdBanner.banners,
      description: createdBanner.description,
      categories: createdBanner.categories,
      organization: createdBanner.organization,
      property: createdBanner.property,
      tags: createdBanner.tags,
      rank: createdBanner.rank,
      status: createdBanner.status,
      createdBy: createdBanner.createdBy,
      updatedBy: createdBanner.updatedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await this._elasticService.indexDocument(ModuleName.BANNER, createdBanner.id, indexPayload);
    } catch (error) {
      console.error('Error indexing banner in Elasticsearch:', error);
    }
  }

  async findAll(query: QueryBannerDto): Promise<{ total: number; data: TBannerDocument[]; lastId?: string | null }> {
    if (!query.status) {
      query.status = STATUS.ACTIVE;
    }

    // Create a copy of query for APIFeatures
    const queryForFeatures = { ...query };

    if (queryForFeatures.propertyId) {
      queryForFeatures['property.id'] = queryForFeatures.propertyId;
      delete queryForFeatures.propertyId;
    }

    // Extract banners.status from query for special handling
    const nestedBannerStatus = query['banners.status'];
    delete queryForFeatures['banners.status'];

    // Use APIFeatures for all other filters
    const features = new APIFeatures(this._bannerModel, queryForFeatures)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();
    const baseQuery = features.getQuery();

    // If we have a nested banner status filter, modify the query
    if (nestedBannerStatus) {
      baseQuery.find({
        'banners.status': nestedBannerStatus,
      });
    }
    const total = await this._bannerModel.countDocuments(baseQuery.getQuery());

    // Execute the query
    const banners = await baseQuery.exec();

    // Sort nested banners by rank
    banners.forEach((banner) => {
      if (nestedBannerStatus) {
        banner.banners = banner.banners.filter((b) => b.status === nestedBannerStatus);
      }
      banner.banners.sort((a, b) => a.rank - b.rank);
    });
    return { total, data: banners, lastId: banners.length > 0 ? banners[banners.length - 1]._id.toString() : null };
  }

  async findOne(id: string): Promise<TBannerDocument> {
    const banner = await this._bannerModel.findById(id).exec();
    if (!banner || banner.status === STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.BANNER.NOT_FOUND);
    }
    banner.banners.sort((a, b) => a.rank - b.rank);
    return banner;
  }

  async update(id: string, updateBannerDto: UpdateBannerDto, user: any): Promise<TBannerDocument> {
    // Fetch the existing banner
    const existingBanner = await this.findOne(id);

    // Track the previous data for audit trail
    const previousData = existingBanner.toObject();

    // Update banner fields only if new values are provided
    existingBanner.title = updateBannerDto.title || existingBanner.title;
    existingBanner.description = updateBannerDto.description || existingBanner.description;
    existingBanner.rank = updateBannerDto.rank || existingBanner.rank;
    existingBanner.status = updateBannerDto.status || existingBanner.status;

    // Ensure top-level startDate and endDate exist
    existingBanner.startDate = updateBannerDto.startDate
      ? new Date(updateBannerDto.startDate)
      : existingBanner.startDate || new Date();
    existingBanner.endDate = updateBannerDto.endDate
      ? new Date(updateBannerDto.endDate)
      : existingBanner.endDate || new Date('9999-12-31');

    // Update bannerType if provided
    if (updateBannerDto.bannerType) {
      const bannerTypeObj = await this._bannerTypeService.findOne(updateBannerDto.bannerType);
      if (!bannerTypeObj) {
        throw new NotFoundException('Banner type not found');
      }
      existingBanner.bannerType = {
        id: bannerTypeObj._id.toString(),
        name: bannerTypeObj.name,
        slug: bannerTypeObj.slug,
      };
    }

    // Fetch categories and tags concurrently if provided
    const [categories, tags] = await Promise.all([
      updateBannerDto.categories?.length
        ? this._categoryService.findCategoryByIds(updateBannerDto.categories)
        : [],
      updateBannerDto.tags?.length ? this._tagService.findTagsByIds(updateBannerDto.tags) : [],
    ]);

    if (updateBannerDto.categories && categories.length !== updateBannerDto.categories.length) {
      throw new Error('Some categories were not found');
    }
    if (updateBannerDto.tags && tags.length !== updateBannerDto.tags.length) {
      throw new Error('Some tags were not found');
    }

    // Update categories and tags if provided
    existingBanner.categories = categories.map((category) => ({
      id: category._id as string,
      name: category.title,
      slug: category.slug,
    }));

    existingBanner.tags = tags.map((tag) => ({
      id: tag._id as string,
      name: tag.name,
      slug: tag.slug,
    }));

    // Update nested banners if provided
    if (updateBannerDto.banners) {
      // Process banner updates sequentially to avoid slug race conditions
      const updatedBanners = [];

      for (let index = 0; index < updateBannerDto.banners.length; index++) {
        const bannerDetail = updateBannerDto.banners[index];
        // Keep existing slug if available, otherwise generate new unique one
        const slugBase = bannerDetail.title || existingBanner.banners[index]?.title;
        const existingSlug = existingBanner.banners?.[index]?.slug;

        let slug;
        if (existingSlug) {
          slug = existingSlug;
        } else {
          // Process one slug at a time
          slug = await this._slugService.generateUniqueSlug(slugBase, ModuleName.BANNER, user);
        }

        updatedBanners.push({
          slug,
          title: bannerDetail.title || existingBanner.banners[index]?.title,
          ctaText: bannerDetail.ctaText || existingBanner.banners[index]?.ctaText,
          appLink: bannerDetail.appLink || existingBanner.banners[index]?.appLink,
          apiLink: bannerDetail.apiLink || existingBanner.banners[index]?.apiLink,
          webLink: bannerDetail.webLink || existingBanner.banners[index]?.webLink,
          image: bannerDetail.image || existingBanner.banners[index]?.image,
          description: bannerDetail.description || existingBanner.banners[index]?.description,
          openIn: bannerDetail.openIn || existingBanner.banners[index]?.openIn,
          runsOn: bannerDetail.runsOn || existingBanner.banners[index]?.runsOn,
          rank: bannerDetail.rank ?? existingBanner.banners[index]?.rank,
          startDate: bannerDetail.startDate || existingBanner.banners[index]?.startDate,
          endDate: bannerDetail.endDate || existingBanner.banners[index]?.endDate,
          status: bannerDetail.status || existingBanner.banners[index]?.status,
        });
      }

      // Set the updated banners
      existingBanner.banners = updatedBanners;
      existingBanner.markModified('banners');
    }

    // Update updatedBy field
    existingBanner.updatedBy = buildUserMetadata(user);

    // Save the updated banner
    const updatedBanner = await existingBanner.save();

    // Update banner in Elasticsearch
    await this._updateIndexedBannerInElasticsearch(updatedBanner);

    this._logger.log(`Banner updated successfully: ${updatedBanner.title}`, this.constructor.name);

    // await this._onDeleteCascadeService.cascadeUpdate({
    //   id: id,
    //   moduleName: ModuleName.BANNER,
    // });

    // Create audit trail for the update
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.BANNER,
      user,
      objectId: updatedBanner.id,
      existingData: previousData,
      newData: updatedBanner.toObject(), // Capture the updated object
    });

    return updatedBanner;
  }

  private async _updateIndexedBannerInElasticsearch(updatedBanner: TBannerDocument): Promise<void> {
    const indexPayload = {
      id: updatedBanner.id,
      title: updatedBanner.title,
      slug: updatedBanner.slug,
      banners: updatedBanner.banners,
      bannerType: updatedBanner.bannerType,
      description: updatedBanner.description,
      categories: updatedBanner.categories,
      tags: updatedBanner.tags,
      rank: updatedBanner.rank,
      status: updatedBanner.status,
      updatedBy: updatedBanner.updatedBy,
      updatedAt: new Date().toISOString(),
    };
    try {
      await this._elasticService.updateDocument(ModuleName.BANNER, updatedBanner.id, indexPayload);
    } catch (error) {
      console.error('Error updating banner in Elasticsearch:', error);
    }
  }
  async remove(id: string, user: any): Promise<TBannerDocument> {
    const banner = await this.findOne(id);

    if (banner.status === STATUS.DELETED || banner.status === STATUS.TO_BE_DELETED) {
      throw new NotFoundException(MESSAGE.BANNER.NOT_FOUND);
    }

    const deletedBanner = await this._bannerModel
      .findByIdAndUpdate(
        id,
        { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
        { new: true }
      )
      .exec();

    this._logger.log('Banner deleted successfully', this.constructor.name);

    // delete banner from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.BANNER, id);

    // await this._onDeleteCascadeService.cascadeDelete({
    //   id: id,
    //   moduleName: ModuleName.BANNER,
    // });

    // Create audit trail for delete
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.BANNER,
      user,
      objectId: banner.id,
      existingData: banner,
      newData: deletedBanner,
    });

    return deletedBanner;
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  async findAllFromElastic(
    query: QueryBannerDto,
    user: any
  ): Promise<{
    data: Partial<TBannerDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
  }> {
    try {
      // Handle property filter - convert to property.id for array field
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
          `[Banner.findAllFromElastic] User ${user.email} accessing banners for organization ${user.organizationId}`,
          this.constructor.name
        );
      } else {
        this._logger.log(
          `[Banner.findAllFromElastic] Public access to banners`,
          this.constructor.name
        );
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      const { searchTerm, ...restQuery } = queryWithFilters;
      const elasticQuery = {
        page: restQuery.page || 1,
        pageSize: restQuery.limit || 20,
        q: searchTerm,
        fields: restQuery.fields,
        ...restQuery, // Include all other query parameters directly
      };

      const features = (
        await new ElasticAPIFeatures(ModuleName.BANNER, elasticQuery, this._elasticService).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();

      // Modify search to handle nested fields for banners
      if (elasticQuery.q && esQuery.query?.bool) {
        // Remove existing must constraints for search and replace with should
        const nonSearchMust =
          esQuery.query.bool.must?.filter((clause: any) => !clause.multi_match) || [];

        esQuery.query.bool.must = nonSearchMust;
        esQuery.query.bool.should = esQuery.query.bool.should || [];

        // Regular fields search
        esQuery.query.bool.should.push({
          multi_match: {
            query: elasticQuery.q,
            fields: [
              'title^3',
              'description^2',
              'slug',
              'createdBy.name',
              'updatedBy.name',
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });

        // Nested categories search
        esQuery.query.bool.should.push({
          nested: {
            path: 'categories',
            query: {
              multi_match: {
                query: elasticQuery.q,
                fields: ['categories.name'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          },
        });

        // Nested tags search
        esQuery.query.bool.should.push({
          nested: {
            path: 'tags',
            query: {
              multi_match: {
                query: elasticQuery.q,
                fields: ['tags.name'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          },
        });

        // Banner type search (not nested, but included for completeness)
        esQuery.query.bool.should.push({
          multi_match: {
            query: elasticQuery.q,
            fields: ['bannerType.name'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });

        esQuery.query.bool.minimum_should_match = 1;
      }

      const result = await this._elasticService.search(ModuleName.BANNER, esQuery);

      const banners = result.hits.hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TBannerDocument),
      }));

      // Sort nested banners by rank
      banners.forEach((banner) => {
        banner.banners.sort((a, b) => a.rank - b.rank);
      });

      return {
        data: banners,
        total: result.hits.total,
        lastId: banners.length > 0 ? banners[banners.length - 1]._id.toString() : null,
      };
    } catch (error) {
      console.error('Error in fetching Banner From ElasticSearch and fallback to MongoDB:', error);
      const banners = await this.findAll(query);
      return {
        data: banners.data,
        total: banners.total,
        lastId: banners.lastId,
      };
    }
  }

  async findOneFromElastic(entity: string, value: string): Promise<TBannerDocument> {
    return this._elasticService.findOneByField(ModuleName.BANNER, entity, value);
  }

  // Get a specific nested banner by providing banner slug and nested banner slug
  async findNestedBannerBySlug(bannerSlug: string, nestedBannerSlug: string): Promise<any> {
    try {
      // First try to find the banner in MongoDB (fallback option)
      const mongoDbBanner = await this._bannerModel.findOne({ slug: bannerSlug }).exec();

      // Try to get from Elasticsearch first
      let banner;
      try {
        banner = await this._elasticService.findOneByField(ModuleName.BANNER, 'slug', bannerSlug);
      } catch (esError) {
        // If Elasticsearch fails, use MongoDB result if available
        if (mongoDbBanner) {
          banner = mongoDbBanner;
        } else {
          throw new NotFoundException(MESSAGE.BANNER.NOT_FOUND);
        }
      }

      // If banner is undefined or null after both attempts, throw error
      if (!banner) {
        throw new NotFoundException(MESSAGE.BANNER.NOT_FOUND);
      }

      // Find the specific nested banner
      if (!banner.banners || !Array.isArray(banner.banners)) {
        throw new NotFoundException(MESSAGE.BANNER.NESTED_BANNER_NOT_FOUND);
      }

      const nestedBanner = banner.banners.find((item) => item.slug === nestedBannerSlug);

      if (!nestedBanner) {
        throw new NotFoundException(MESSAGE.BANNER.NESTED_BANNER_NOT_FOUND);
      }

      return nestedBanner;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this._logger.error(
        `Error finding nested banner: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      throw new Error('Failed to retrieve the nested banner');
    }
  }
}
