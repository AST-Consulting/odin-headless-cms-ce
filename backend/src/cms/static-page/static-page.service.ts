import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StaticPage, TStaticPageDocument } from './entities/static-page.schema';
import { getFilters } from '@core/utils/getFilters';
import { CreateStaticPageDto } from './dto/static-page.create.dto';
import { UpdateStaticPageDto } from './dto/static-page.update.dto';
import { APIFeatures } from '@core/utils/apiFeatures.utils';
import { ElasticAPIFeatures } from '@core/utils/elasticApiFeatures.utils';
import { QueryStaticPageDto } from './dto/static-page.query.dto';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { ACTIONS, ModuleName, STATUS } from '@core/constants/enums.constants';
import { buildUserMetadata } from '@core/utils/utils';
import { SlugService } from '@cms/slug/slug.service';
import { TCurrentUserType } from '@auth/types/user.type';
import { buildSeoObject } from '@core/utils/seo.utils';
import { TagsService } from '../../tags/tags.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AuditTrailService } from '@core/audit-trail/audit-trail.service';
import { ElasticService } from '@core/elastic/elastic.service';
import { OnDeleteCascadeService } from '@core/on-delete-cascade/on-delete-cascade.service';
import { CategoryService } from 'src/category/category.service';
import { PropertyService } from '@property/property.service';
import { OrganizationService } from '@organization/organization.service';
import { SearchTotalHits } from 'node_modules/@elastic/elasticsearch/lib/api/types';

@Injectable()
export class StaticPageService {
  constructor(
    @InjectModel(StaticPage.name)
    private readonly _staticPageModel: Model<TStaticPageDocument>,
    private readonly _slugService: SlugService,
    private readonly _tagService: TagsService,
    private readonly _categoryService: CategoryService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly _logger: Logger,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _elasticService: ElasticService,
    // private readonly _onDeleteCascadeService: OnDeleteCascadeService,
    private readonly _propertyService: PropertyService,
    private readonly _organizationService: OrganizationService
  ) { }

  async create(
    createStaticPageDto: CreateStaticPageDto,
    user: TCurrentUserType
  ): Promise<TStaticPageDocument> {
    const property = await this._propertyService.getById(createStaticPageDto.propertyId);
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

    // Build SEO object
    const seoObj = buildSeoObject(
      createStaticPageDto.seo,
      createStaticPageDto.title,
      'default meta description'
    );

    // generate unique slug
    const slug = await this._slugService.generateUniqueSlug(
      createStaticPageDto.title,
      ModuleName.STATIC_PAGE,
      user,
      seoObj,
      createStaticPageDto.propertyId
    );

    const { tags, categories } = createStaticPageDto;

    const [tagsList, categoriesList] = await Promise.all([
      this._fetchAndValidate(tags, this._tagService, ModuleName.TAG, (tag) => ({
        id: tag._id,
        name: tag.name,
        slug: tag.slug ? tag.slug : tag.name,
      })),
      this._fetchAndValidate(
        categories,
        this._categoryService,
        ModuleName.CATEGORY,
        (category) => ({
          id: category._id,
          name: category.title,
          slug: category.slug ? category.slug : category.name,
        })
      ),
    ]);

    const newPage = await this._staticPageModel.create({
      slug,
      ...createStaticPageDto,
      seo: seoObj,
      tags: tagsList,
      property: propertyData,
      organization: organizationData,
      categories: categoriesList,
      updatedBy: buildUserMetadata(user),
      createdBy: buildUserMetadata(user),
    });

    // Log the creation
    this._logger.log(`Successfully created Page with ID: ${newPage._id}`);

    // Create audit trail for the hospital creation
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.STATIC_PAGE,
      user,
      objectId: newPage.id,
      existingData: null,
      newData: newPage,
    });

    // Index the static page in ElasticSearch
    await this._indexStaticPageInElasticsearch(newPage);

    return newPage;
  }

  // New function to handle indexing the static page in Elasticsearch
  private async _indexStaticPageInElasticsearch(newPage: TStaticPageDocument): Promise<void> {
    const indexPayload = {
      id: newPage.id,
      title: newPage.title,
      slug: newPage.slug,
      rank: newPage.rank,
      status: newPage.status,
      content: newPage.content,
      organization: newPage.organization,
      property: newPage.property,
      metaDescription: newPage.metaDescription,
      metaKeywords: newPage.metaKeywords,
      isPublished: newPage.isPublished,
      categories: newPage.categories.map((category) => ({
        id: category.id,
        name: category.title,
        slug: category.slug,
      })),
      tags: newPage.tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      })),
      seo: newPage.seo,
      createdBy: newPage.createdBy,
      updatedBy: newPage.updatedBy,
      createdAt: new Date().toISOString(), // Ensure date format
      updatedAt: new Date().toISOString(), // Ensure date format
    };

    try {
      await this._elasticService.indexDocument(
        ModuleName.STATIC_PAGE, // Use the correct module type
        newPage.id, // Use the ID from the created static page
        indexPayload
      );
    } catch (error) {
      console.error('Error indexing document in ElasticSearch:', error);
    }
  }

  async findAll(
    query: QueryStaticPageDto
  ): Promise<{ data: TStaticPageDocument[]; total: number; lastId?: string | null }> {
    if (!query.status) {
      query.status = STATUS.ACTIVE;
    }

    const queryForStaticPages = { ...query };

    //Filter by propertyId
    if (queryForStaticPages.propertyId) {
      queryForStaticPages['property.id'] = queryForStaticPages.propertyId;
      delete queryForStaticPages.propertyId;
    }

    const filters = getFilters(queryForStaticPages);
    const total = await this._staticPageModel.countDocuments(filters);

    const paginatedFeatures = new APIFeatures(this._staticPageModel, queryForStaticPages)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const pages = await paginatedFeatures.getQuery().exec();

    return {
      data: pages,
      total,
      lastId: pages.length > 0 ? pages[pages.length - 1]._id.toString() : null,
    };
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  async findAllFromElastic(query: QueryStaticPageDto): Promise<{
    data: Partial<TStaticPageDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
  }> {
    try {
      const queryForStaticPages = { ...query };

      // Filter by propertyId - map to property.id for Elasticsearch
      if (queryForStaticPages.propertyId) {
        queryForStaticPages['property.id'] = queryForStaticPages.propertyId;
        delete queryForStaticPages.propertyId;
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      const elasticQuery = {
        page: query.page || 1,
        pageSize: query.limit || 20,
        q: query.searchTerm,
        fields: query.fields,
        ...queryForStaticPages, // Include all other query parameters directly
      };

      const features = (
        await new ElasticAPIFeatures(ModuleName.STATIC_PAGE, elasticQuery, this._elasticService).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();
      const result = await this._elasticService.search(ModuleName.STATIC_PAGE, esQuery);

      const pages = result.hits.hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TStaticPageDocument),
      }));

      return {
        data: pages,
        total: result.hits.total,
        lastId: pages.length > 0 ? pages[pages.length - 1]._id.toString() : null,
      };
    } catch (error) {
      console.error('Error in fetching Static Pages from Elasticsearch and fallback to MongoDB:', error);
      const pages = await this.findAll(query);
      return {
        data: pages.data,
        total: pages.total,
        lastId: pages.lastId,
      };
    }
  }

  async findOne(id: string): Promise<TStaticPageDocument> {
    const page = await this._staticPageModel.findById(id);

    // // check if page is deleted
    // if (!page || page.status === STATUS.DELETED) {
    //   throw new NotFoundException(MESSAGE.STATIC_PAGE.NOT_FOUND);
    // }
    return page;
  }

  async update(
    id: string,
    updateStaticPageDto: UpdateStaticPageDto,
    user: TCurrentUserType
  ): Promise<TStaticPageDocument> {
    const existingPage = await this.findOne(id);
    const { tags, categories, seo, title, metaDescription } = updateStaticPageDto;

    const [tagsList, categoriesList] = await Promise.all([
      tags
        ? this._fetchAndValidate(tags, this._tagService, ModuleName.TAG, (tag) => ({
          id: tag._id,
          name: tag.name,
          slug: tag.slug || tag.name,
        }))
        : existingPage.tags,
      categories
        ? this._fetchAndValidate(
          categories,
          this._categoryService,
          ModuleName.CATEGORY,
          (category) => ({
            id: category._id,
            name: category.title,
            slug: category.slug || category.name,
          })
        )
        : existingPage.categories,
    ]);

    const seoObj = seo ? buildSeoObject(seo, title, metaDescription) : existingPage.seo;

    const updatedFields = {
      ...updateStaticPageDto,
      seo: seoObj,
      tags: tagsList,
      categories: categoriesList,
      updatedBy: buildUserMetadata(user),
    };

    const updatedPage = await this._staticPageModel.findByIdAndUpdate(id, updatedFields, {
      new: true,
    });

    if (!updatedPage) {
      throw new NotFoundException(MESSAGE.STATIC_PAGE.NOT_FOUND);
    }

    // await this._onDeleteCascadeService.cascadeUpdate({
    //   id: id,
    //   moduleName: ModuleName.STATIC_PAGE,
    // });

    this._logger.log(`Successfully updated Page with ID: ${id}`);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.STATIC_PAGE,
      user,
      objectId: updatedPage.id,
      existingData: existingPage,
      newData: updatedPage,
    });

    // Update the indexed document in Elasticsearch
    await this._updateIndexedStaticPageInElasticsearch(updatedPage);

    return updatedPage;
  }

  private async _updateIndexedStaticPageInElasticsearch(
    updatedStaticPage: TStaticPageDocument
  ): Promise<void> {
    const indexPayload = {
      id: updatedStaticPage.id,
      title: updatedStaticPage.title,
      slug: updatedStaticPage.slug,
      rank: updatedStaticPage.rank,
      status: updatedStaticPage.status,
      content: updatedStaticPage.content,
      metaDescription: updatedStaticPage.metaDescription,
      metaKeywords: updatedStaticPage.metaKeywords,
      isPublished: updatedStaticPage.isPublished,
      categories: updatedStaticPage.categories.map((category) => ({
        id: category.id,
        name: category.title,
        slug: category.slug,
      })),
      tags: updatedStaticPage.tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      })),
      seo: updatedStaticPage.seo,
      updatedBy: updatedStaticPage.updatedBy,
      updatedAt: new Date().toISOString(), // Use the current time for the updated timestamp
    };
    try {
      await this._elasticService.updateDocument(
        ModuleName.STATIC_PAGE, // Ensure you use the correct module name
        updatedStaticPage.id, // Use the ID from the updated static page
        indexPayload
      );
    } catch (error) {
      console.error('Error updating static page in Elasticsearch:', error);
    }
  }

  async remove(id: string, user: TCurrentUserType): Promise<TStaticPageDocument> {
    const existingPage = await this.findOne(id);
    // Soft delete by marking the status as deleted and updating the updatedBy field
    const deletedPage = await this._staticPageModel.findByIdAndUpdate(
      id,
      { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
      { new: true }
    );

    if (!deletedPage) {
      throw new NotFoundException(MESSAGE.STATIC_PAGE.NOT_FOUND);
    }

    // await this._onDeleteCascadeService.cascadeDelete({
    //   id: id,
    //   moduleName: ModuleName.STATIC_PAGE,
    // });
    // Create audit trail for delete action
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.STATIC_PAGE,
      user,
      objectId: deletedPage.id,
      existingData: existingPage,
      newData: deletedPage,
    });

    // Delete the indexed document from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.STATIC_PAGE, id);
    // Log the deletion action
    this._logger.log(`Static Page marked as deleted: ${deletedPage.title}`);

    return deletedPage;
  }

  private readonly _fetchAndValidate = async (ids, service, entityLabel, mapFn) => {
    if (!ids?.length) return [];
    const items = (await service.findAll({ _id: { $in: ids } })).data;
    if (items.length !== ids.length)
      throw new NotFoundException(MESSAGE.STATIC_PAGE.ERRORS.ITEM_NOT_FOUND(entityLabel));
    return items.map(mapFn);
  };

  /**
   * Maps static page to WordPress REST API v2 format
   * Used by the /v2/pages endpoint
   * Returns data matching the standard WordPress REST API page structure
   * @param page The static page to map
   * @returns Mapped page in WordPress REST API v2 format
   */
  mapPageToWordPressRestApiFormat(page: any): any {
    // Format dates
    const publishedDate = page.createdAt;
    const modifiedDate = page.updatedAt || page.createdAt;

    // Calculate GMT offset (assuming IST +5:30 for example.com)
    const formatDateGMT = (date: Date | string): string => {
      if (!date) return new Date().toISOString().replace('Z', '');
      const d = new Date(date);
      // Subtract 5:30 hours to get GMT
      d.setMinutes(d.getMinutes() - 330);
      return d.toISOString().replace('Z', '');
    };

    const formatDateLocal = (date: Date | string): string => {
      if (!date) return new Date().toISOString().replace('Z', '');
      return new Date(date).toISOString().replace('Z', '');
    };

    // Build page URL
    const pageUrl = page.slug
      ? `'${process.env.SITE || "https://example.com"}/${page.slug}`
      : `'${process.env.SITE || "https://example.com"}/?page_id=${page._id}`;

    return {
      id: page.wpPageId || page._id,
      date: formatDateLocal(publishedDate),
      date_gmt: formatDateGMT(publishedDate),
      guid: {
        rendered: pageUrl,
      },
      modified: formatDateLocal(modifiedDate),
      modified_gmt: formatDateGMT(modifiedDate),
      slug: page.slug || '',
      status: page.status === STATUS.ACTIVE ? 'publish' : page.status || 'publish',
      type: 'page',
      link: pageUrl,
      title: {
        rendered: page.title || '',
      },
      content: {
        rendered: page.content || '',
        protected: false,
      },
      excerpt: {
        rendered: page.metaDescription ? `<p>${page.metaDescription}</p>\n` : '',
        protected: false,
      },
      author: page.createdBy?.id || 1,
      featured_media: 0,
      parent: 0, // Static pages don't have parent in current schema
      menu_order: page.rank || 0,
      comment_status: 'closed',
      ping_status: 'closed',
      template: '',
      meta: {
        _stopmodifiedupdate: false,
        _modified_date: '',
        footnotes: '',
      },
      _links: {
        self: [
          {
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/pages/${page._id}`,
          },
        ],
        collection: [
          {
            href: ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/pages',
          },
        ],
        about: [
          {
            href: ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/types/page',
          },
        ],
        author: [
          {
            embeddable: true,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/users/${page.createdBy?.id || 1}`,
          },
        ],
        replies: [
          {
            embeddable: true,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/comments?post=${page._id}`,
          },
        ],
        'version-history': [
          {
            count: 0,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/pages/${page._id}/revisions`,
          },
        ],
        'wp:attachment': [
          {
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/media?parent=${page._id}`,
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
