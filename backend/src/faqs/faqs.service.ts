import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateFAQDto, UpdateFAQDto } from './dtos/faq.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FAQ, TFaqDocument } from './schema/faq.schema';

import { FaqQueryDto } from './dtos/faq-query.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
// import { OnDeleteCascadeService } from '@on-delete-cascade/on-delete-cascade.service';
import { AuditTrailService } from 'src/core/audit-trail/audit-trail.service';
import { ElasticService } from 'src/core/elastic/elastic.service';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { ACTIONS, ModuleName, STATUS } from 'src/core/constants/enums.constants';
import { buildUserMetadata } from 'src/core/utils/utils';
import { getFilters } from 'src/core/utils/getFilters';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { TagsService } from 'src/tags/tags.service';
import { CategoryService } from 'src/category/category.service';
import { SlugService } from '@cms/slug/slug.service';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
import { ElasticAPIFeatures } from 'src/core/utils/elasticApiFeatures.utils';
import { SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';

@Injectable()
export class FAQService {
  constructor(
    @InjectModel(FAQ.name) private _faqModel: Model<TFaqDocument>,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    private readonly _categoryService: CategoryService,
    private readonly _tagService: TagsService,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _slugService: SlugService,
    private readonly _elasticService: ElasticService,
    private readonly _propertyService: PropertyService,
    private readonly _organizationService: OrganizationService
    // private readonly _onDeleteCascadeService: OnDeleteCascadeService
  ) { }

  public async createFAQ(faqData: CreateFAQDto, user: TCurrentUserType): Promise<TFaqDocument> {
    const property = await this._propertyService.getById(faqData.propertyId);
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

    const {
      question,
      answer,
      rank,
      entityType,
      entityId,
      entityValue,
      categories: categoryIds,
      tags: tagIds,
    } = faqData;

    // Find categories and tags simultaneously using Promise.all
    const [categories, tags] = await Promise.all([
      categoryIds?.length ? this._categoryService.findCategoryByIds(categoryIds) : [],
      tagIds?.length ? this._tagService.findTagsByIds(tagIds) : [],
    ]);

    // Check if all categories and tags were found
    if (categoryIds && categories.length !== categoryIds?.length) {
      throw new Error('Some categories were not found');
    }
    if (tagIds && tags.length !== tagIds?.length) {
      throw new Error('Some tags were not found');
    }

    // Construct arrays for categories and tags inline
    const categoryData = categories.map((category) => ({
      id: category._id,
      name: category.title,
      displayName: category.title,
      slug: category.slug,
    }));

    const tagsData = tags.map((tag) => ({
      id: tag._id,
      name: tag.name,
      slug: tag.slug,
    }));

    const slug = await this._slugService.generateUniqueSlug(question, ModuleName.FAQ, user, null, faqData.propertyId);

    // Create the FAQ document
    const createdFAQ: TFaqDocument = new this._faqModel({
      question,
      answer,
      slug,
      rank,
      entityType,
      property: propertyData,
      organization: organizationData,
      entityId,
      entityValue,
      categories: categoryData.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })),
      tags: tagsData.map((tagData) => ({
        id: tagData.id,
        name: tagData.name,
        slug: tagData.slug,
      })),
      updatedBy: buildUserMetadata(user),
      createdBy: buildUserMetadata(user),
    });
    // Save the FAQ document to the database
    await createdFAQ.save();
    this._logger.log(`FAQ created successfully: ${createdFAQ._id}`, this.constructor.name);

    // Create audit trail entry for creating FAQ
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.FAQ,
      user,
      objectId: createdFAQ.id,
      existingData: null,
      newData: createdFAQ,
    });

    // Index the FAQ in Elasticsearch
    await this._indexFaqInElasticsearch(createdFAQ);

    return createdFAQ;
  }

  private async _indexFaqInElasticsearch(createdFaq: TFaqDocument): Promise<void> {
    // add location into elastic search
    const elasticFaqDocument = {
      question: createdFaq.question,
      answer: createdFaq.answer,
      categories: createdFaq.categories,
      tags: createdFaq.tags,
      status: createdFaq.status,
      organization: createdFaq.organization,
      property: createdFaq.property,
      rank: createdFaq.rank,
      entityType: createdFaq.entityType,
      entityId: createdFaq.entityId,
      entityValue: createdFaq.entityValue,
      updatedBy: createdFaq.updatedBy,
      createdBy: createdFaq.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Indexing the elasticLocationDocument in Elasticsearch with error handling
    try {
      await this._elasticService.indexDocument(
        ModuleName.FAQ, // Module type for the slug
        createdFaq.id, // Unique ID for the slug
        elasticFaqDocument // The document to be indexed
      );
    } catch (error) {
      console.error('Error indexing Faq in Elasticsearch:', error);
    }
  }

  public async findAll(query: FaqQueryDto): Promise<{ total: number; data: TFaqDocument[]; lastId?: string | null }> {
    // If status filer is not provided, default to active else use the provided status

    if (!query.status) {
      query.status = STATUS.ACTIVE;
    }

    const queryForFAQs = { ...query };

    // Filter by propertyId if provided
    if (queryForFAQs.propertyId) {
      queryForFAQs['property.id'] = queryForFAQs.propertyId;
      delete queryForFAQs.propertyId;
    }

    // Filter by categoryId/category.id/category.name if provided
    if (queryForFAQs.categoryId) {
      queryForFAQs['categories.id'] = queryForFAQs.categoryId;
      delete queryForFAQs.categoryId;
    }

    if (queryForFAQs['category.id']) {
      queryForFAQs['categories.id'] = queryForFAQs['category.id'];
      delete queryForFAQs['category.id'];
    }

    if (queryForFAQs['category.name']) {
      queryForFAQs['categories.name'] = queryForFAQs['category.name'];
      delete queryForFAQs['category.name'];
    }

    const filters = getFilters(queryForFAQs);
    if (!queryForFAQs.entityId && !queryForFAQs.entityType) {
      filters.entityId = null;
      filters.entityType = null;
    }

    const total = await this._faqModel.countDocuments(filters);
    const features = new APIFeatures(this._faqModel, queryForFAQs)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();
    const doc = await features.getQuery().exec();

    return { total, data: doc, lastId: doc.length > 0 ? doc[doc.length - 1]._id.toString() : null };
  }

  public async getFAQById(id: string): Promise<TFaqDocument> {
    const faqData = await this._faqModel.findById(id);

    // check if faq is deleted
    if (faqData.status === STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.FAQ.NOT_FOUND);
    }

    if (!faqData) {
      throw new NotFoundException(MESSAGE.FAQ.NOT_FOUND);
    }

    return faqData;
  }

  public async deleteFAQ(id: string, user: TCurrentUserType): Promise<TFaqDocument> {
    const faqData: TFaqDocument = await this._faqModel.findById(id);
    if (!faqData) {
      throw new NotFoundException(MESSAGE.FAQ.NOT_FOUND);
    }
    if (faqData.status === STATUS.DELETED || faqData.status === STATUS.TO_BE_DELETED) {
      throw new NotFoundException(MESSAGE.FAQ.NOT_FOUND);
    }

    // Perform a soft delete by setting status to DELETED
    const deletedFaq = await this._faqModel.findByIdAndUpdate(
      id,
      { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
      { new: true }
    );
    // delete faq from elasticsearch
    await this._elasticService.deleteDocument(ModuleName.FAQ, id);

    // await this._onDeleteCascadeService.cascadeDelete({
    //   id: id,
    //   moduleName: ModuleName.FAQ,
    // });
    //Create audit trail entry for faq deletion
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.FAQ,
      user,
      objectId: faqData.id,
      existingData: faqData,
      newData: deletedFaq,
    });

    return deletedFaq;
  }

  public async updateFAQ(
    id: string,
    faqData: UpdateFAQDto,
    user: TCurrentUserType
  ): Promise<TFaqDocument> {
    if (!id) {
      throw new NotFoundException(MESSAGE.FAQ.ID_REQUIRED);
    }
    const existingFaq = await this.getFAQById(id);
    const { categories: categoryIds, tags: tagIds, ...rest } = faqData;
    const updatedFAQData: any = { ...rest, updatedBy: buildUserMetadata(user) };

    if (categoryIds) {
      const categoryData = await Promise.all(
        categoryIds.map((categoryId) => this._categoryService.findOne(categoryId))
      );
      if (!categoryData) {
        throw new NotFoundException(MESSAGE.CATEGORY.NOT_FOUND);
      }
      updatedFAQData.categories = categoryData.map((categoryData: any) => ({
        id: categoryData._id,
        name: categoryData.title,
        slug: categoryData.slug || '',
      }));
    }
    if (tagIds) {
      const tagsData = await Promise.all(tagIds.map((tagId) => this._tagService.findOne(tagId)));
      tagsData.forEach((tagData) => {
        if (!tagData) {
          throw new NotFoundException(MESSAGE.TAG.NOT_FOUND);
        }
      });
      updatedFAQData.tags = tagsData.map((tagData) => ({
        id: tagData._id,
        name: tagData.name,
        slug: tagData.slug,
      }));
    }

    const updatedFAQ = await this._faqModel.findByIdAndUpdate(
      id,
      { $set: updatedFAQData },
      { new: true }
    );

    if (!updatedFAQ) {
      throw new NotFoundException(MESSAGE.FAQ.NOT_FOUND);
    }
    this._logger.log(`FAQ updated successfully: ${id}`, this.constructor.name);

    // await this._onDeleteCascadeService.cascadeUpdate({
    //   id: id,
    //   moduleName: ModuleName.FAQ,
    // });
    // Create audit trail entry for updating FAQ
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.FAQ,
      user,
      objectId: updatedFAQ.id,
      existingData: existingFaq,
      newData: updatedFAQ,
    });

    // Update the FAQ in Elasticsearch
    await this.updateIdexedFaqInElasticsearch(updatedFAQ);

    return updatedFAQ;
  }

  private async updateIdexedFaqInElasticsearch(updatedFAQ: TFaqDocument): Promise<void> {
    const indexPayload = {
      question: updatedFAQ.question,
      answer: updatedFAQ.answer,
      rank: updatedFAQ.rank,
      categories: updatedFAQ.categories,
      tags: updatedFAQ.tags,
      entityType: updatedFAQ.entityType,
      entityId: updatedFAQ.entityId,
      entityValue: updatedFAQ.entityValue,
      status: updatedFAQ.status,
      updatedBy: updatedFAQ.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this._elasticService.updateDocument(ModuleName.FAQ, updatedFAQ.id, indexPayload);
    } catch (error) {
      console.error('Error updating FAQ in Elasticsearch:', error);
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  async findAllFromElastic(
    query: FaqQueryDto,
    user: any
  ): Promise<{
    data: Partial<TFaqDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
  }> {
    try {
      // If status filter is not provided, default to active
      // if (!query.status) {
      //   query.status = STATUS.ACTIVE;
      // }

      // Handle property filter - convert to property.id for Elasticsearch filtering
      const queryWithFilters = { ...query };

      // FIX: map propertyId → property.id for Elasticsearch filtering
      if (queryWithFilters.propertyId) {
        queryWithFilters['property.id'] = queryWithFilters.propertyId;
        delete queryWithFilters.propertyId;
      }

      // FIX: map category.id → categories.id for nested filtering
      if (queryWithFilters['category.id']) {
        queryWithFilters['categories.id'] = queryWithFilters['category.id'];
        delete queryWithFilters['category.id'];
      }

      // FIX: Also map categoryId → categories.id (frontend sends categoryId)
      if (queryWithFilters['categoryId']) {
        queryWithFilters['categories.id'] = queryWithFilters['categoryId'];
        delete queryWithFilters['categoryId'];
      }

      // FIX: map tags.id (if it exists as singular) to nested tags.id
      // Note: tags.id is already correct, but we keep this for consistency

      // Handle entity filtering
      if (queryWithFilters.entityId !== undefined) {
        queryWithFilters['entityId'] = queryWithFilters.entityId;
      }

      if (queryWithFilters.entityType !== undefined) {
        queryWithFilters['entityType'] = queryWithFilters.entityType;
      }

      // // Filter by user's organization (optional - can be enabled if needed)
      // if (user && !queryWithFilters.organizationId) {
      //   queryWithFilters.organizationId = user.organizationId;
      // }

      if (user) {
        this._logger.log(
          `[FAQ.findAllFromElastic] User ${user.email} accessing FAQs for organization ${user.organizationId}`,
          this.constructor.name
        );
      } else {
        this._logger.log(
          `[FAQ.findAllFromElastic] Public access to FAQs`,
          this.constructor.name
        );
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      // Priority: searchTerm > question > q
      // We strip trailing '*' which might come from older frontend implementations
      const queryAny = queryWithFilters as any;
      const searchVal = (queryAny.searchTerm || queryAny.question || queryAny.q || '')
        .toString()
        .replace(/\*$/, '');

      const { searchTerm, question, ...restQuery } = queryAny;

      const elasticQuery = {
        page: restQuery.page || 1,
        pageSize: restQuery.limit || 20,
        q: searchVal,
        fields: restQuery.fields,
        ...restQuery,
      };

      if (queryWithFilters.status) {
        elasticQuery.status = queryWithFilters.status;
      }

      const features = (
        await new ElasticAPIFeatures(
          ModuleName.FAQ,
          elasticQuery,
          this._elasticService
        ).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();

      // Modify search to handle enhanced search for FAQs
      if (elasticQuery.q && esQuery.query?.bool) {
        // Remove existing must constraints for search and replace with should
        const nonSearchMust =
          esQuery.query.bool.must?.filter((clause: any) => !clause.multi_match) || [];

        esQuery.query.bool.must = nonSearchMust;
        esQuery.query.bool.should = esQuery.query.bool.should || [];

        // Enhanced multi-match search across relevant fields
        // 🔥 Improved search (supports partial + phrase + flexible matching)

        // 1. Phrase prefix (MAIN FIX)
        esQuery.query.bool.should.push({
          match_phrase_prefix: {
            question: {
              query: elasticQuery.q,
              boost: 5, // highest priority
            },
          },
        });

        // 2. Multi-match for flexible matching
        esQuery.query.bool.should.push({
          multi_match: {
            query: elasticQuery.q,
            fields: [
              'question^3',
              'answer^2',
              'slug',
              'createdBy.name',
              'updatedBy.name',
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
            operator: 'and',
          },
        });

        // 3. Extra support for answer field prefix
        esQuery.query.bool.should.push({
          match_phrase_prefix: {
            answer: {
              query: elasticQuery.q,
              boost: 2,
            },
          },
        });

        // Nested categories search
        esQuery.query.bool.should.push({
          match_phrase_prefix: {
            'categories.id': {
              query: elasticQuery.q,
            },
          },
        });

        // Nested tags search
        esQuery.query.bool.should.push({
          match_phrase_prefix: {
            'tags.name': {
              query: elasticQuery.q,
            },
          },
        });

        esQuery.query.bool.minimum_should_match = 1;
      }

      const result = await this._elasticService.search(ModuleName.FAQ, esQuery);
      const faqs = result.hits.hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TFaqDocument),
      }));

      return {
        data: faqs,
        total: result.hits.total,
        lastId: faqs.length > 0 ? faqs[faqs.length - 1]._id.toString() : null,
      };
    } catch (error) {
      console.error('Error in fetching FAQs in elasticsearch and fallback to mongodb:', error);
      const faqs = await this.findAll(query);
      return {
        data: faqs.data,
        total: faqs.total,
        lastId: faqs.lastId,
      };
    }
  }

  async findOneFromElastic(entity: string, value: string): Promise<TFaqDocument> {
    return this._elasticService.findOneByField(ModuleName.FAQ, entity, value);
  }
}
