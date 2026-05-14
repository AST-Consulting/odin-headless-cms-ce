/* eslint-disable @typescript-eslint/naming-convention */
import { Injectable, NotFoundException, Logger, Inject, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Cron } from '@nestjs/schedule';

import { STATUS, ACTIONS, ModuleName } from '@core/constants/enums.constants';
import { buildUserMetadata } from '@core/utils/utils';
import { AuditTrailService } from '@core/audit-trail/audit-trail.service';
import { TSectionDocument } from './entities/section.entity';
import { Section } from './entities/section.entity';
import {
  contentPriorityDtoKeys,
  CreateContentPriorityDto,
  CreateSectionDto,
  QuerySectionDto,
  UpdateSectionDto,
} from './dto/section.dto';
import { getFilters } from '@core/utils/getFilters';
import { APIFeatures } from '@core/utils/apiFeatures.utils';
import { buildSeoObject } from '@core/utils/seo.utils';
import { SlugService } from '@cms/slug/slug.service';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { Testimonial } from '@testimonials/schemas/testimonial.schema';
import { SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';
import { ElasticAPIFeatures } from '@core/utils/elasticApiFeatures.utils';
import { ElasticService } from '@core/elastic/elastic.service';
import { Article } from '@articles/schemas/article.schema';
import { PropertyService } from '@property/property.service';
import { OrganizationService } from '@organization/organization.service';

@Injectable()
export class SectionService {
  constructor(
    @InjectModel(Section.name)
    private readonly _sectionModel: Model<TSectionDocument>,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _slugService: SlugService,
    private readonly _elasticService: ElasticService,
    @InjectModel(Testimonial.name)
    private readonly _testimonialModel: Model<any>,
    @InjectModel(Article.name)
    private readonly _articleModel: Model<any>,
    private readonly _propertyService: PropertyService,
    private readonly _organizationService: OrganizationService
  ) { }

  async create(createSectionDto: CreateSectionDto, user: any): Promise<TSectionDocument> {
    // Build SEO object
    const seoObj = buildSeoObject(
      createSectionDto.seo,
      createSectionDto.title,
      createSectionDto.description
    );

    const slug = await this._slugService.generateUniqueSlug(
      createSectionDto.title,
      ModuleName.SECTION,
      user,
      seoObj,
      createSectionDto.propertyId
    );

    // Initialize contentPriority with articles from categories if categories are provided
    let initialContentPriority = createSectionDto.contentPriority || [];
    if (createSectionDto.category && createSectionDto.category.length > 0) {
      // Calculate how many articles to fetch (15 total - provided articles)
      const providedCount = initialContentPriority.length;
      const articlesToFetch = Math.max(0, 15 - providedCount);

      if (articlesToFetch > 0) {
        const articlesFromCategories = await this._fetchArticlesByCategory(
          createSectionDto.category,
          articlesToFetch
        );
        // Set proper ranks for articles from categories (starting after provided ones)
        articlesFromCategories.forEach((article, index) => {
          article.contentRank = providedCount + index;
        });
        // Merge with provided contentPriority, prioritizing provided ones
        initialContentPriority = [...initialContentPriority, ...articlesFromCategories];
      }
    }

    // Ensure contentRank is set for all items
    initialContentPriority.forEach((item, index) => {
      if (item.contentRank === undefined) {
        item.contentRank = index;
      }
    });

    const property = await this._propertyService.getById(createSectionDto.propertyId);
    const organization = await this._organizationService.findOne(user.organizationId);

    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    }

    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    }

    const createdSection = new this._sectionModel({
      ...createSectionDto,
      seo: seoObj,
      slug: slug,
      contentPriority: initialContentPriority,
      enablePeriodicUpdate: createSectionDto.enablePeriodicUpdate || false,
      fixedArticleIds: createSectionDto.fixedArticleIds || [],
      property: propertyData,
      organization: organizationData,
      createdBy: buildUserMetadata(user),
      updatedBy: buildUserMetadata(user),
    });

    await createdSection.save();

    this._logger.log(
      `Section "${createdSection.title}" created successfully`,
      this.constructor.name
    );

    await this._indexSectionInElasticsearch(createdSection);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.SECTION,
      user,
      objectId: createdSection.id,
      existingData: null,
      newData: createdSection,
    });

    return createdSection;
  }

  private async _indexSectionInElasticsearch(createdSection: TSectionDocument): Promise<void> {
    const elasticSectionDocument = this._buildElasticSectionDocument(createdSection);

    try {
      await this._elasticService.indexDocument(
        ModuleName.SECTION,
        createdSection.id,
        elasticSectionDocument
      );
    } catch (error) {
      this._logger.error(
        `Error indexing Section ${createdSection.id} in Elasticsearch:`,
        error.stack,
        this.constructor.name
      );
    }
  }

  private _buildElasticSectionDocument(section: TSectionDocument): Record<string, unknown> {
    return {
      title: section.title,
      titleHindi: section.titleHindi,
      description: section.description,
      slug: section.slug,
      status: section.status,
      link: section.link,
      widgetCode: section.widgetCode,
      displayType: section.displayType,
      image: section.image,
      count: section.count,
      rank: section.rank,
      startDate: section.startDate,
      endDate: section.endDate,
      category: section.category,
      sectionUrls: section.sectionUrls,
      contentPriority: section.contentPriority,
      seo: section.seo,
      organization: section.organization,
      property: section.property,
      createdBy: section.createdBy,
      updatedBy: section.updatedBy,
      enablePeriodicUpdate: section.enablePeriodicUpdate,
      fixedArticleIds: section.fixedArticleIds,
      createdAt: section['createdAt'] || new Date().toISOString(),
      updatedAt: section['updatedAt'] || new Date().toISOString(),
    };
  }

  async bulkIndexSectionsToElasticsearch(): Promise<{
    success: boolean;
    indexed: number;
    failed: number;
    message: string;
  }> {
    try {
      // Fetch all non-deleted sections from MongoDB
      const sections = await this._sectionModel
        .find({ status: { $ne: STATUS.DELETED } })
        .lean()
        .exec();

      if (!sections || sections.length === 0) {
        return {
          success: true,
          indexed: 0,
          failed: 0,
          message: 'No sections found to index',
        };
      }

      // Build documents for bulk indexing
      const documents = sections.map((section) => ({
        id: section._id.toString(),
        body: this._buildElasticSectionDocument(section as unknown as TSectionDocument),
      }));

      // Bulk index to Elasticsearch
      const result = await this._elasticService.bulkIndex(ModuleName.SECTION, documents);

      const failed = result.items?.filter((item) => item.index?.error).length || 0;
      const indexed = documents.length - failed;

      this._logger.log(
        `Bulk indexing sections completed: ${indexed} indexed, ${failed} failed`,
        this.constructor.name
      );

      return {
        success: true,
        indexed,
        failed,
        message: `Bulk indexing completed: ${indexed} sections indexed, ${failed} failed`,
      };
    } catch (error) {
      this._logger.error(
        `Error in bulk indexing sections to Elasticsearch: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      throw error;
    }
  }

  async findAll(query: QuerySectionDto): Promise<{ total: number; data: TSectionDocument[]; lastId?: string | null }> {
    // if (!query.status) {
    //   query.status = STATUS.ACTIVE;
    // }

    const queryForSections = { ...query, status: { $ne: STATUS.DELETED } };

    // Filter by propertyId if provided
    if (queryForSections.propertyId) {
      queryForSections['property.id'] = queryForSections.propertyId;
      delete queryForSections.propertyId;
    }

    const filters = getFilters(queryForSections);
    const total = await this._sectionModel.countDocuments(filters);

    const features = new APIFeatures(this._sectionModel, queryForSections)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();
    const sections = await features.getQuery().exec();

    sections.forEach((section) => {
      section.contentPriority.sort((a, b) => a.contentRank - b.contentRank);
    });

    return { total, data: sections, lastId: sections.length > 0 ? sections[sections.length - 1]._id.toString() : null };
  }

  async findOne(id: string): Promise<TSectionDocument> {
    const section = await this._sectionModel
      .findOne({
        _id: id,
        status: { $ne: 'deleted' },
      })
      .exec();
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    section.contentPriority.sort((a, b) => a.contentRank - b.contentRank);
    return section;
  }
  async update(
    id: string,
    updateSectionDto: UpdateSectionDto,
    user: any
  ): Promise<TSectionDocument> {
    // Fetch existing section
    const existingSection = await this._sectionModel
      .findOne({
        _id: id,
        status: { $ne: 'deleted' },
      })
      .exec();

    if (!existingSection) {
      throw new NotFoundException('Section not found');
    }

    // Map new values to the existing section
    if (updateSectionDto.title !== undefined) existingSection.title = updateSectionDto.title;
    if (updateSectionDto.titleHindi !== undefined) existingSection.titleHindi = updateSectionDto.titleHindi;
    if (updateSectionDto.description !== undefined) existingSection.description = updateSectionDto.description;
    if (updateSectionDto.status !== undefined) existingSection.status = updateSectionDto.status;
    if (updateSectionDto.link !== undefined) existingSection.link = updateSectionDto.link;
    if (updateSectionDto.widgetCode !== undefined) existingSection.widgetCode = updateSectionDto.widgetCode;
    if (updateSectionDto.displayType !== undefined) existingSection.displayType = updateSectionDto.displayType;
    if (updateSectionDto.image !== undefined) existingSection.image = updateSectionDto.image;
    if (updateSectionDto.count !== undefined) existingSection.count = updateSectionDto.count;
    if (updateSectionDto.rank !== undefined) existingSection.rank = updateSectionDto.rank;
    if (updateSectionDto.startDate !== undefined) existingSection.startDate = updateSectionDto.startDate;
    if (updateSectionDto.endDate !== undefined) existingSection.endDate = updateSectionDto.endDate;
    if (updateSectionDto.category !== undefined) existingSection.category = updateSectionDto.category;
    if (updateSectionDto.sectionUrls !== undefined) existingSection.sectionUrls = updateSectionDto.sectionUrls;
    if (updateSectionDto.contentPriority !== undefined) existingSection.contentPriority = updateSectionDto.contentPriority as any;
    if (updateSectionDto.enablePeriodicUpdate !== undefined) existingSection.enablePeriodicUpdate = updateSectionDto.enablePeriodicUpdate;
    if (updateSectionDto.fixedArticleIds !== undefined) existingSection.fixedArticleIds = updateSectionDto.fixedArticleIds;
    
    if (updateSectionDto.seo) {
      existingSection.seo = buildSeoObject(
        updateSectionDto.seo,
        updateSectionDto.title || existingSection.title,
        updateSectionDto.description || existingSection.description
      );
    }

    // Update user metadata
    existingSection.updatedBy = buildUserMetadata(user);

    // Save the updated section
    const updatedSection = await existingSection.save();

    await this._updateSectionInElasticsearch(updatedSection);
    // Log success
    this._logger.log(
      `Section updated successfully: ${updatedSection.title}`,
      this.constructor.name
    );

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.SECTION,
      user,
      objectId: updatedSection.id,
      existingData: existingSection,
      newData: updatedSection,
    });
    return updatedSection;
  }

  private async _updateSectionInElasticsearch(updatedSection: TSectionDocument): Promise<void> {
    const elasticSectionDocument = this._buildElasticSectionDocument(updatedSection);

    try {
      await this._elasticService.updateDocument(
        ModuleName.SECTION,
        updatedSection.id,
        elasticSectionDocument
      );
    } catch (error) {
      this._logger.error(
        `Error updating Section ${updatedSection.id} in Elasticsearch:`,
        error.stack,
        this.constructor.name
      );
    }
  }

  async remove(id: string, user: any): Promise<TSectionDocument> {
    const section = await this._sectionModel.findById(id);
    if (!section) {
      throw new NotFoundException(`Section with ID "${id}" not found`);
    }

    if (section.status === STATUS.DELETED) {
      throw new NotFoundException(`Section with ID "${id}" already deleted`);
    }

    const deletedSection = await this._sectionModel
      .findByIdAndUpdate(
        id,
        { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
        { new: true }
      )
      .exec();

    this._logger.log(
      `Section deleted successfully: ${deletedSection.title}`,
      this.constructor.name
    );

    // delete the section from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.SECTION, section.id);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.SECTION,
      user,
      objectId: deletedSection.id,
      existingData: section,
      newData: deletedSection,
    });

    return deletedSection;
  }

  async addContentPriority(createContentPriorityDto: CreateContentPriorityDto): Promise<Section> {
    const { sectionId, contentType, ids, propertyId, organizationId } = createContentPriorityDto;

    // Fetch the section
    const section = await this._sectionModel.findById(sectionId);
    if (!section) {
      throw new NotFoundException(MESSAGE.SECTION.NOT_FOUND);
    }

    // Backfill property if not present
    if (!section.property && propertyId) {
      const property = await this._propertyService.getById(propertyId);
      section.property = {
        id: property._id.toString(),
        name: property.name,
        domain: property.domain,
      };
    }

    // Backfill organization if not present
    if (!section.organization && organizationId) {
      const organization =
        await this._organizationService.findOne(organizationId);
      section.organization = {
        id: organization._id.toString(),
        name: organization.organization_name,
        slug: organization.organization_name,
        domain: organization.domain,
      };
    }

    // Fetch entity details based on contentType and ids
    const entities = await this._fetchEntities(contentType, ids);
    if (!entities.length) {
      throw new NotFoundException('Entities not found');
    }

    // Map entity details into contentPriority format by filtering keys present in CreateContentPriorityDto
    const contentPriority = entities.map((entity) => {
      const contentPriorityObj: any = {};

      // Loop through the CreateContentPriorityDto and map only valid keys from the entity to the result object
      contentPriorityDtoKeys.forEach((key) => {
        if (entity[key] !== undefined) {
          contentPriorityObj[key] = entity[key]; // Add the key from the entity if it exists
        }
      });

      // Add id and contentRank (assuming they are always required)
      contentPriorityObj.id = entity._id.toString();
      contentPriorityObj.slug = entity.slug;

      const index = ids.findIndex((id) => id === entity._id.toString());
      contentPriorityObj.contentRank = index !== -1 ? index : 1;
      return contentPriorityObj;
    });

    // Update the section's contentPriority with the new content
    section.contentPriority = [...contentPriority];
    await section.save();

    await this._updateSectionInElasticsearch(section);

    return section;
  }

  /**
   * Fetches articles by category and distributes them evenly
   * @param categoryIds Array of category IDs or slugs
   * @param totalArticles Total number of articles to fetch (default: 15)
   * @returns Array of articles formatted as ContentPriority
   */
  private async _fetchArticlesByCategory(
    categoryIds: string[],
    totalArticles: number = 15
  ): Promise<any[]> {
    if (!categoryIds || categoryIds.length === 0) {
      return [];
    }

    const articlesPerCategory = Math.floor(totalArticles / categoryIds.length);
    const remainder = totalArticles % categoryIds.length;
    const contentPriority: any[] = [];
    let currentRank = 0;

    for (let i = 0; i < categoryIds.length; i++) {
      const categoryId = categoryIds[i];
      // Calculate how many articles to fetch for this category
      const count = articlesPerCategory + (i < remainder ? 1 : 0);

      // Query articles by category - try both id and slug
      const articles = await this._articleModel
        .find({
          status: 'published',
          $or: [{ 'categories.id': categoryId }, { 'primaryCategory.id': categoryId }],
        })
        .sort({ publishedAt: -1 }) // Get latest articles first
        .limit(count)
        .exec();

      // Map articles to contentPriority format
      for (const article of articles) {
        const contentPriorityObj: any = {};

        // Map only valid keys from contentPriorityDtoKeys
        contentPriorityDtoKeys.forEach((key) => {
          if (article[key] !== undefined) {
            contentPriorityObj[key] = article[key];
          }
        });

        // Add required fields
        contentPriorityObj.id = article._id.toString();
        contentPriorityObj.slug = article.slug || '';
        contentPriorityObj.contentRank = currentRank++;
        contentPriorityObj.contentType = 'articles';

        // Map article-specific fields
        if (article.title) {
          contentPriorityObj.title = article.title;
        }
        if (article.authors && article.authors.length > 0) {
          contentPriorityObj.author = {
            id: article.authors[0].id?.toString() || '',
            name: article.authors[0].name || '',
            slug: article.authors[0].slug || '',
          };
        }
        if (article.featuredMedia) {
          contentPriorityObj.featureImage = article.featuredMedia;
        }
        if (article.publishedAt) {
          contentPriorityObj.lastPublishedAt = article.publishedAt;
        }
        if (article.dek) {
          contentPriorityObj.headline = article.dek;
        }

        if (article.primaryCategory) {
          contentPriorityObj.primaryCategory = {
            id: article.primaryCategory.id || '',
            name: article.primaryCategory.title || '',
            slug: article.primaryCategory.slug || '',
          };
        }

        if (article.categories && article.categories.length > 0) {
          contentPriorityObj.categories = article.categories.map((cat) => ({
            id: cat.id || '',
            name: cat.title || '',
            slug: cat.slug || '',
          }));
        }

        contentPriority.push(contentPriorityObj);
      }
    }

    return contentPriority;
  }

  // Helper to fetch entities based on contentType and ids

  private async _fetchEntities(contentType: string, ids: string[]): Promise<any[]> {
    const modelMap = {
      testimonials: this._testimonialModel,
      articles: this._articleModel,
      // hospitals: this._hospitalModel,
      // doctors: this._doctorModel,
      // procedures: this._procedureModel,
      // specialities: this._specialityModel,
      // events: this._eventModel,
    };

    if (contentType === 'accreditations') {
      // const data = await this._hospitalService.getAllAccreditations(ids);
      // return data;
      return [];
    }

    if (contentType === 'awardRecognition') {
      // const data = await this._hospitalService.getAllAwardRecognition(ids);
      // return data;
      return [];
    }

    const model = modelMap[contentType];

    if (!model) {
      throw new BadRequestException('Invalid content type');
    }

    const query = { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }; // Use Types.ObjectId
    const data = await model.find(query).exec(); // Use model's find method to get data
    return data;
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  async findOneFromElastic(entity: string, value: string): Promise<TSectionDocument> {
    return this._elasticService.findOneByField(ModuleName.SECTION, entity, value);
  }

  async findAllFromElastic(query: QuerySectionDto): Promise<{
    data: Partial<TSectionDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
  }> {
    try {
      // Handle propertyId filter - map to property.id for Elasticsearch
      const queryWithPropertyFilter = { ...query };
      if (queryWithPropertyFilter.propertyId) {
        queryWithPropertyFilter['property.id'] = queryWithPropertyFilter.propertyId;
        delete queryWithPropertyFilter.propertyId;
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      // If status is not provided in query, don't set a default - this allows fetching all non-deleted sections
      // If you want to filter by specific status (active/inactive), pass it in the query
      const elasticQuery: any = {
        ...queryWithPropertyFilter,
        page: queryWithPropertyFilter.page || 1,
        pageSize: queryWithPropertyFilter.limit || 15,
        q: queryWithPropertyFilter.searchTerm,
        fields: queryWithPropertyFilter.fields,
      };

      // Only set status if explicitly provided in query
      // This allows fetching both active and inactive sections when status is not specified
      if (queryWithPropertyFilter.status) {
        elasticQuery.status = queryWithPropertyFilter.status;
      }

      const features = (
        await new ElasticAPIFeatures(
          ModuleName.SECTION,
          elasticQuery,
          this._elasticService
        ).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();

      // Add a must_not clause to exclude deleted sections
      if (!esQuery.query.bool.must_not) {
        esQuery.query.bool.must_not = [];
      }
      esQuery.query.bool.must_not.push({
        term: { status: STATUS.DELETED }
      });

      console.log('Elasticsearch Query:', JSON.stringify(esQuery, null, 2));
      const result = await this._elasticService.search(ModuleName.SECTION, esQuery);
      console.log(`Found ${result.hits.total} sections (including active and inactive, excluding deleted)`);

      const sections = result.hits.hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TSectionDocument),
      }));

      return {
        data: sections,
        total: result.hits.total,
        lastId: sections.length > 0 ? sections[sections.length - 1]._id.toString() : null,
      };
    } catch (error) {
      this._logger.error(
        `Error in fetching sections from Elasticsearch and fallback to mongodb: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      const sections = await this.findAll(query);
      return {
        data: sections.data,
        total: sections.total,
      };
    }
  }

  /**
   * Cron job to periodically update sections with latest articles from categories
   * Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
   */
  @Cron('0 * * * *') // Runs every hour
  async updateSectionsWithLatestArticles(): Promise<void> {
    try {
      this._logger.log(
        'Starting periodic update of sections with latest articles',
        this.constructor.name
      );

      // Find all sections with periodic update enabled and active status
      const sectionsToUpdate = await this._sectionModel
        .find({
          enablePeriodicUpdate: true,
          status: { $ne: 'deleted' },
          category: { $exists: true, $ne: [] },
        })
        .exec();

      this._logger.log(
        `Found ${sectionsToUpdate.length} sections to update`,
        this.constructor.name
      );

      for (const section of sectionsToUpdate) {
        try {
          await this._updateSectionArticles(section);
        } catch (error) {
          this._logger.error(
            `Error updating section ${section.id}: ${error.message}`,
            error.stack,
            this.constructor.name
          );
        }
      }

      this._logger.log(
        'Completed periodic update of sections with latest articles',
        this.constructor.name
      );
    } catch (error) {
      this._logger.error(
        `Error in periodic section update cron job: ${error.message}`,
        error.stack,
        this.constructor.name
      );
    }
  }

  /**
   * Updates a section with latest articles from its categories
   * Preserves fixed articles in their positions
   */
  private async _updateSectionArticles(section: TSectionDocument): Promise<void> {
    if (!section.category || section.category.length === 0) {
      return;
    }

    // Get fixed article IDs
    const fixedArticleIds = section.fixedArticleIds || [];
    const fixedArticles = section.contentPriority.filter((cp) => fixedArticleIds.includes(cp.id));

    // Calculate how many new articles we need (15 total - fixed articles)
    const totalArticles = 15;
    const newArticlesNeeded = Math.max(0, totalArticles - fixedArticles.length);

    // Fetch latest articles from categories
    const latestArticles = await this._fetchArticlesByCategory(section.category, newArticlesNeeded);

    // Filter out articles that are already in fixedArticles
    const existingArticleIds = fixedArticles.map((fa) => fa.id);
    const newArticles = latestArticles.filter(
      (article) => !existingArticleIds.includes(article.id)
    );

    // Combine fixed articles with new articles
    // Fixed articles maintain their original ranks, new articles get ranks after them
    const updatedContentPriority: any[] = [...fixedArticles];
    let currentRank = fixedArticles.length;

    for (const article of newArticles) {
      if (updatedContentPriority.length >= totalArticles) {
        break;
      }
      article.contentRank = currentRank++;
      updatedContentPriority.push(article);
    }

    // Update the section
    section.contentPriority = updatedContentPriority;
    await section.save();

    // Update Elasticsearch
    await this._updateSectionInElasticsearch(section);

    this._logger.log(
      `Updated section "${section.title}" with ${newArticles.length} new articles`,
      this.constructor.name
    );
  }
}
