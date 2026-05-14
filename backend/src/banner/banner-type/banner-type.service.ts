import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BannerType, TBannerTypeDocument } from './entities/banner-type.schema';
import { Model } from 'mongoose';
import { SlugService } from '@cms/slug/slug.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AuditTrailService } from '@core/audit-trail/audit-trail.service';
import { CreateBannerTypeDto } from './dto/create-banner-type.dto';
import { buildUserMetadata } from '@core/utils/utils';
import { ACTIONS, ModuleName, STATUS } from '@core/constants/enums.constants';
import { QueryBannerTypeDto } from './dto/query-banner-type.dto';
import { getFilters } from '@core/utils/getFilters';
import { APIFeatures } from '@core/utils/apiFeatures.utils';
import { UpdateBannerTypeDto } from './dto/update-banner-type.dto';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { ElasticService } from '@core/elastic/elastic.service';
import { OnDeleteCascadeService } from '@core/on-delete-cascade/on-delete-cascade.service';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
import { ElasticAPIFeatures } from '@core/utils/elasticApiFeatures.utils';
import { SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';

@Injectable()
export class BannerTypeService {
  constructor(
    @InjectModel(BannerType.name)
    private readonly _bannerTypeModel: Model<TBannerTypeDocument>,
    private readonly _slugService: SlugService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _elasticService: ElasticService,
    private readonly _onDeleteCascadeService: OnDeleteCascadeService,
    private readonly _organizationService: OrganizationService,
    private readonly _propertyService: PropertyService
  ) {}

  async create(createBannerTypeDto: CreateBannerTypeDto, user: any): Promise<TBannerTypeDocument> {
    const { name } = createBannerTypeDto;
    // Generate unique slug
    const slug = await this._slugService.generateUniqueSlug(name, ModuleName.BANNER_TYPE, user, null, createBannerTypeDto.propertyId);
    const property = await this._propertyService.getById(createBannerTypeDto.propertyId);
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

    const createdBannerType: TBannerTypeDocument = new this._bannerTypeModel({
      ...createBannerTypeDto,
      slug,
      organization: organizationData,
      property: propertyData,
      createdBy: buildUserMetadata(user),
      updatedBy: buildUserMetadata(user),
    });

    await createdBannerType.save();

    this._logger.log(
      `Banner type created successfully: ${createdBannerType.name}`,
      this.constructor.name
    );

    // Index the new banner type in Elasticsearch
    await this._indexBannerTypeInElasticsearch(createdBannerType);

    // Create audit trais
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.BANNER_TYPE,
      user,
      objectId: createdBannerType.id,
      existingData: null,
      newData: createdBannerType,
    });

    return createdBannerType;
  }

  private async _indexBannerTypeInElasticsearch(
    createdBannerType: TBannerTypeDocument
  ): Promise<void> {
    // Prepare the document to index in Elasticsearch
    const elasticBannerTypeDocument = {
      name: createdBannerType.name,
      slug: createdBannerType.slug,
      entity: createdBannerType.entity,
      organization: createdBannerType.organization,
      property: createdBannerType.property,
      status: createdBannerType.status,
      createdBy: createdBannerType.createdBy,
      updatedBy: createdBannerType.updatedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Indexing the document in Elasticsearch with error handling
    try {
      await this._elasticService.indexDocument(
        ModuleName.BANNER_TYPE, // Module type for the BannerType
        createdBannerType.id, // Unique ID for the BannerType
        elasticBannerTypeDocument // The document to be indexed
      );
    } catch (error) {
      console.error('Error indexing Banner type in Elasticsearch:', error);
    }
  }

  async findAll(
    query: QueryBannerTypeDto
  ): Promise<{ total: number; data: TBannerTypeDocument[]; lastId?: string | null }> {
    if (!query.status) {
      query.status = STATUS.ACTIVE;
    }
    const queryForFeatures = { ...query };

    if (queryForFeatures.propertyId) {
      queryForFeatures['property.id'] = queryForFeatures.propertyId;
      delete queryForFeatures.propertyId;
    }
    const filters = getFilters(queryForFeatures);
    const total = await this._bannerTypeModel.countDocuments(filters);

    const features = new APIFeatures(this._bannerTypeModel, queryForFeatures)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();
    const bannerTypes = await features.getQuery().exec();

    return { total, data: bannerTypes, lastId: bannerTypes.length > 0 ? bannerTypes[bannerTypes.length - 1]._id.toString() : null };
  }

  async findOne(id: string): Promise<TBannerTypeDocument> {
    const bannerType = await this._bannerTypeModel.findById(id).exec();

    // check if banner type is deleted
    if (!bannerType || bannerType.status === STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.BANNER_TYPE.NOT_FOUND);
    }
    return bannerType;
  }

  async update(
    id: string,
    updateBannerTypeDto: UpdateBannerTypeDto,
    user: any
  ): Promise<TBannerTypeDocument> {
    const existingBannerType = await this.findOne(id);
    const updateData: any = {
      ...updateBannerTypeDto,
      updatedBy: buildUserMetadata(user),
    };
    const updatedBannerType = await this._bannerTypeModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    this._logger.log(
      `Banner Type updated successfully: ${updatedBannerType.name}`,
      this.constructor.name
    );

    // Update the banner type in Elasticsearch
    await this._updateIndexedBannerTypeInElasticsearch(updatedBannerType);

    await this._onDeleteCascadeService.cascadeUpdate({
      id: id,
      moduleName: 'bannerType',
    });
    // Create audit trail for update
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.BANNER_TYPE,
      user,
      objectId: updatedBannerType.id,
      existingData: existingBannerType,
      newData: updatedBannerType,
    });

    return updatedBannerType;
  }

  private async _updateIndexedBannerTypeInElasticsearch(
    updatedBannerType: TBannerTypeDocument
  ): Promise<void> {
    const indexPayload = {
      name: updatedBannerType.name,
      slug: updatedBannerType.slug,
      entity: updatedBannerType.entity,
      status: updatedBannerType.status,
      updatedBy: updatedBannerType.updatedBy,
      updatedAt: new Date().toISOString(),
    };
    try {
      await this._elasticService.updateDocument(
        ModuleName.BANNER_TYPE,
        updatedBannerType.id,
        indexPayload
      );
    } catch (error) {
      console.error('Error updating Banner Type in Elasticsearch:', error);
    }
  }

  async remove(id: string, user: any): Promise<TBannerTypeDocument> {
    const bannerType = await this.findOne(id);

    if (bannerType.status === STATUS.DELETED || bannerType.status === STATUS.TO_BE_DELETED) {
      throw new NotFoundException(MESSAGE.BANNER.NOT_FOUND);
    }

    const deletedBannerType = await this._bannerTypeModel
      .findByIdAndUpdate(
        id,
        { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
        { new: true }
      )
      .exec();

    // delete the banner type from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.BANNER_TYPE, id);

    this._logger.log('Banner Type deleted successfully', this.constructor.name);

    await this._onDeleteCascadeService.cascadeDelete({
      id: id,
      moduleName: 'bannerType',
    });
    // Create audit trail for delete
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.BANNER_TYPE,
      user,
      objectId: bannerType.id,
      existingData: bannerType,
      newData: deletedBannerType,
    });

    return deletedBannerType;
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  async findAllFromElastic(
    query: QueryBannerTypeDto,
    user: any
  ): Promise<{
    data: Partial<TBannerTypeDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
  }> {
    try {
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
          `[BannerType.findAllFromElastic] User ${user.email} accessing banner types for organization ${user.organizationId}`,
          this.constructor.name
        );
      } else {
        this._logger.log(
          `[BannerType.findAllFromElastic] Public access to banner types`,
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
        await new ElasticAPIFeatures(ModuleName.BANNER_TYPE, elasticQuery, this._elasticService).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();

      // Modify search to handle enhanced search for banner types
      if (elasticQuery.q && esQuery.query?.bool) {
        // Remove existing must constraints for search and replace with should
        const nonSearchMust =
          esQuery.query.bool.must?.filter((clause: any) => !clause.multi_match) || [];

        esQuery.query.bool.must = nonSearchMust;
        esQuery.query.bool.should = esQuery.query.bool.should || [];

        // Enhanced multi-match search across relevant fields
        esQuery.query.bool.should.push({
          multi_match: {
            query: elasticQuery.q,
            fields: [
              'name^3',        // Highest priority
              'slug^2',        // Medium priority
              'entity',        // Standard priority
              'createdBy.name',
              'updatedBy.name',
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });

        esQuery.query.bool.minimum_should_match = 1;
      }

      const result = await this._elasticService.search(ModuleName.BANNER_TYPE, esQuery);

      const bannerTypes = result.hits.hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TBannerTypeDocument),
      }));

      return {
        data: bannerTypes,
        total: result.hits.total,
        lastId: bannerTypes.length > 0 ? bannerTypes[bannerTypes.length - 1]._id.toString() : null,
      };
    } catch (error) {
      console.error('Error in fetching Banner Type From ElasticSearch and fallback to MongoDB:', error);
      const bannerTypes = await this.findAll(query);
      return {
        data: bannerTypes.data,
        total: bannerTypes.total,
        lastId: bannerTypes.lastId,
      };
    }
  }

  async findOneFromElastic(entity: string, value: string): Promise<TBannerTypeDocument> {
    return this._elasticService.findOneByField(ModuleName.BANNER_TYPE, entity, value);
  }
}
