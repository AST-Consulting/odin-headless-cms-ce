import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CreatePrintArticleDto, PRINT_MIGRATION_QUEUE } from './dto/create-print-article.dto';
import { Model, Types } from 'mongoose';
import { Article, TArticleDocument } from './schemas/article.schema';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { QueryArticleDto } from './dto/query-artilce.dto';
import { getFilters } from 'src/core/utils/getFilters';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ModuleName, POST_STATUS } from 'src/core/constants/enums.constants';
import { TagsService } from '@tags/tags.service';
import { CategoryService } from 'src/category/category.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '@utilities/redis/redis.service';
import { buildUserMetadata } from '@core/utils/utils';
import { ElasticAPIFeatures } from '@core/utils/elasticApiFeatures.utils';
import { ElasticService } from '@core/elastic/elastic.service';
import { SearchTotalHits } from 'node_modules/@elastic/elasticsearch/lib/api/types';
import { buildSeoObject } from '@core/utils/seo.utils';
import { SlugService } from '@cms/slug/slug.service';
import {
  convertBlocksToHTML,
  convertBlocksToLiveBlogEntries,
} from '@core/utils/blocknote-html-converter.util';
import { PropertyService } from '@property/property.service';
import { OrganizationService } from '@organization/organization.service';
import { ArticleRichBlocksService } from './article-rich-blocks/article-rich-blocks.service';
import { LiveBlogSseService } from './live-blog-sse.service';
import { RevalidationService } from '@core/revalidation/revalidation.service';
import * as he from 'he';
import e from 'express';
import { DEFAULT_HEADER } from '@core/constants/header.constant';

function stripHtml(value: string): string {
  if (!value) return '';
  return he.decode(value.replace(/<[^>]*>/g, '')).trim();
}

@Injectable()
export class ArticlesService {
  constructor(
    @InjectModel(Article.name) private articleModel: Model<TArticleDocument>,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly _logger: Logger,
    private readonly _categoryService: CategoryService,
    private readonly _tagsService: TagsService,
    private readonly httpService: HttpService,
    private readonly _elasticService: ElasticService,
    private readonly configService: ConfigService,
    private readonly _redisService: RedisService,
    @Inject(forwardRef(() => SlugService)) private readonly _slugService: SlugService,
    private readonly _propertyService: PropertyService,
    private readonly _orgainzationService: OrganizationService,
    private readonly _richBlocksService: ArticleRichBlocksService,
    private readonly _liveBlogSseService: LiveBlogSseService,
    private readonly _revalidation: RevalidationService,
    @InjectQueue(PRINT_MIGRATION_QUEUE) private readonly _printMigrationQueue: Queue,
  ) { }

  /**
   * Build the public reader path(s) whose Next.js cache should be busted
   * when this article changes. Returns an empty array if no reader URL can
   * be constructed (e.g. missing slug/category).
   */
  private _readerPathsForArticle(article: TArticleDocument): string[] {
    if (!article?.slug) return [];
    const paths = new Set<string>();
    const categorySlug = article.primaryCategory?.slug;
    if (categorySlug) {
      paths.add(`/${categorySlug}/${article.slug}`);
    }
    paths.add(`/${article.slug}`);
    return Array.from(paths);
  }

  async enqueuePrintMigration(dto: CreatePrintArticleDto): Promise<void> {
    await this._printMigrationQueue.add('migrate', dto, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async getPrintMigrationQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const counts = await this._printMigrationQueue.getJobCounts();
    return {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
    };
  }

  private isLiveArticle(type: string): boolean {
    return type === 'liveblog' || type === 'live_blog';
  }

  @Cron('0 3 * * *', { name: 'liveblog-auto-expire', timeZone: 'Asia/Kolkata' })
  async expireStaleLiveBlogs(): Promise<void> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.articleModel.updateMany(
      {
        type: { $in: ['liveblog', 'live_blog'] },
        status: 'published',
        updatedAt: { $lt: oneWeekAgo },
      },
      {
        $set: {
          status: 'draft',
          coverageEndTime: new Date(),
        },
      },
    );
    if (result.modifiedCount > 0) {
      this._logger.log(
        `[liveblog-auto-expire] Ended ${result.modifiedCount} stale live blog(s)`,
        this.constructor.name,
      );
    }
  }

  /**
   * Flattens parent-child grouped richBlocks back into a normal ordered sequence.
   * Timestamp blocks are returned without metadata.children; their children follow
   * as siblings. Used when sending blocks to Elasticsearch.
   */
  private _flattenGroupedBlocks(groupedBlocks: any[]): any[] {
    const flat: any[] = [];
    let order = 1;
    for (const block of groupedBlocks) {
      const children: any[] = block.metadata?.children ?? [];
      if (children.length > 0) {
        const { children: _omit, ...metadataWithoutChildren } = block.metadata ?? {};
        flat.push({ ...block, metadata: metadataWithoutChildren, order: order++ });
        for (const child of children) {
          flat.push({ ...child, order: order++ });
        }
      } else {
        flat.push({ ...block, order: order++ });
      }
    }
    return flat;
  }

  /**
   * Groups a flat richBlocks array into parent-child format for liveblog storage:
   * each timestamp block becomes the parent and all content blocks that follow it
   * (until the next timestamp) are embedded in metadata.children.
   */
  private _groupBlocksByTimestamp(richBlocks: any[]): any[] {
    const result: any[] = [];
    let currentParent: any | null = null;

    for (const block of richBlocks) {
      if (block.type === 'timestamp') {
        currentParent = {
          ...block,
          metadata: {
            ...(block.metadata ?? {}),
            children: [],
          },
        };
        result.push(currentParent);
      } else if (currentParent) {
        currentParent.metadata.children.push(block);
      } else {
        result.push(block);
      }
    }

    return result;
  }

  /**
   * For each category in the list, fetch all its ancestors and add them
   * to the list if they are not already present.
   */
  private async _inflateCategoriesWithAncestors(categories: any[]): Promise<any[]> {
    const allCategoriesMap = new Map();

    for (const cat of categories) {
      if (!cat.id) continue;
      allCategoriesMap.set(cat.id, cat);

      if (cat.fullSlug) {
        try {
          const ancestors = await this._categoryService.findAllAncestorsByFullSlug(cat.fullSlug);
          for (const ancestor of ancestors) {
            const ancestorId = ancestor._id.toString();
            if (!allCategoriesMap.has(ancestorId)) {
              allCategoriesMap.set(ancestorId, {
                id: ancestorId,
                title: ancestor.title,
                slug: ancestor.slug,
                fullSlug: ancestor.fullSlug,
              });
            }
          }
        } catch (error) {
          this._logger.warn(
            `Failed to fetch ancestors for category ${cat.fullSlug}: ${error.message}`
          );
        }
      }
    }

    return Array.from(allCategoriesMap.values());
  }

  async create(createArticleDto: CreateArticleDto, user: TCurrentUserType): Promise<Article> {
    createArticleDto.organizationId = user.organizationId;

    // Validate content for published articles
    if (createArticleDto.status === 'published') {
      // Count total characters in richBlocks
      let totalCharacters = 0;
      let hasTimestamp = false;

      if (createArticleDto.richBlocks && createArticleDto.richBlocks.length > 0) {
        createArticleDto.richBlocks.forEach((block) => {
          // Check for timestamp block
          if (block.type === 'timestamp') {
            hasTimestamp = true;
          }

          // Count characters from content
          if (block.content && Array.isArray(block.content)) {
            block.content.forEach((item: any) => {
              if (item.text) {
                totalCharacters += item.text.length;
              }
            });
          }
        });
      }

      // Validate based on article type
      if (createArticleDto.type === 'liveblog') {
        if (!hasTimestamp) {
          throw new BadRequestException(
            'Live blog must contain at least one timestamp block to be published'
          );
        }
      }
    }

    // Save categories if provided
    const categories = [];
    if (createArticleDto.categories && createArticleDto.categories.length > 0) {
      for (const id of createArticleDto.categories) {
        if (typeof id === 'string') {
          try {
            const category = await this._categoryService.findOne(id);
            categories.push({
              id: category._id.toString(),
              title: category.title,
              slug: category.slug,
              fullSlug: category.fullSlug,
            });
          } catch (error) {
            console.log('Category creation error:', error.message);
          }
        }
      }
    }

    // Save tags if provided
    const tags = [];
    if (createArticleDto.tags && createArticleDto.tags.length > 0) {
      for (const tagName of createArticleDto.tags) {
        if (typeof tagName === 'string') {
          try {
            // First try to find existing tag by name and propertyId
            let tag = await this._tagsService.findByName(tagName, createArticleDto.propertyId);

            // If tag doesn't exist, create it
            if (!tag) {
              tag = await this._tagsService.create(
                {
                  propertyId: createArticleDto.propertyId,
                  name: tagName,
                  rank: 0,
                  description: tagName || '',
                } as any,
                user
              );
            }

            tags.push({
              id: tag._id.toString(),
              name: tag.name,
              slug: tag.slug,
              fullSlug: (tag as any).fullSlug,
            });
          } catch (error) {
            console.log('Tag processing error:', error.message);
          }
        }
      }
    }
    // Fetch primary category details
    let primaryCategory = createArticleDto.primaryCategory;
    if (typeof primaryCategory === 'string') {
      const primaryCategoryData = await this._categoryService.findOne(primaryCategory);
      primaryCategory = {
        id: primaryCategoryData._id.toString(),
        title: primaryCategoryData.title,
        slug: primaryCategoryData.slug,
        fullSlug: primaryCategoryData.fullSlug,
      };
    }

    // Ensure primaryCategory is included in categories and inflate with ancestors
    let finalCategories = [...categories];
    if (primaryCategory && typeof primaryCategory === 'object') {
      const exists = finalCategories.some((c) => c.id === (primaryCategory as any).id);
      if (!exists) {
        finalCategories.push(primaryCategory);
      }
    }
    finalCategories = await this._inflateCategoriesWithAncestors(finalCategories);

    // Check if currentArticleId is provided
    if (createArticleDto.currentArticleId) {
      // Update existing article
      this._logger.log('[Articles.create] Updating existing article', this.constructor.name);

      const existingArticle = await this.articleModel
        .findById(createArticleDto.currentArticleId)
        .exec();

      if (!existingArticle) {
        throw new NotFoundException(
          `Article with ID ${createArticleDto.currentArticleId} not found`
        );
      }

      // Handle slug generation/update only if a new slug is provided and different from existing
      let articleSlug = existingArticle.slug; // Keep existing slug by default
      
      // Recompute preliminaryFullSlug from category + slug (User Recommended)
      let preliminaryFullSlug = createArticleDto.slug || existingArticle.slug;
      if (primaryCategory && typeof primaryCategory === 'object' && (primaryCategory as any).fullSlug) {
        preliminaryFullSlug = `${(primaryCategory as any).fullSlug}/${preliminaryFullSlug}`;
      }

      if (createArticleDto.slug && createArticleDto.slug !== existingArticle.slug) {
        // New slug provided and it's different from existing - generate unique slug
        const seoObj = buildSeoObject(
          createArticleDto.seo,
          createArticleDto.title,
          createArticleDto.excerpt
        );
        articleSlug = await this._slugService.generateUniqueSlug(
          createArticleDto.title,
          ModuleName.ARTICLE,
          user,
          seoObj,
          createArticleDto.propertyId,
          createArticleDto.slug,
          preliminaryFullSlug
        );
      }

      // Recalculate fullSlug based on potentially new unique slug
      let articleFullSlug = articleSlug;
      if (primaryCategory && typeof primaryCategory === 'object' && (primaryCategory as any).fullSlug) {
        articleFullSlug = `${(primaryCategory as any).fullSlug}/${articleSlug}`;
      }

      // Remove currentArticleId and preserveUpdatedAt from the DTO before updating
      const { currentArticleId, preserveUpdatedAt, ...updateData } = {
        ...createArticleDto,
        slug: articleSlug, // Use the processed slug
        fullSlug: articleFullSlug,
        updatedBy: buildUserMetadata(user),
        ...(createArticleDto.preserveUpdatedAt ? {} : { updatedAt: new Date() }),
        // Set primaryCategory from fetched data
        primaryCategory: primaryCategory,
        // Set categories from fetched data
        categories: finalCategories,
        tags: tags,
      };

      // Update the article — skip Mongoose auto-timestamp when preserving updatedAt
      const updateOptions: Record<string, boolean> = { new: true };
      if (preserveUpdatedAt) {
        updateOptions.timestamps = false;
      }

      // For live articles: persist richBlocks to the external collection only.
      // The article document (MongoDB + ES) gets an empty array; ES is populated
      // with the full block set by _updateIndexedArticleInElasticsearch.
      let flatBlocksForEs: any[] | undefined;
      if (this.isLiveArticle(createArticleDto.type) && updateData.richBlocks?.length > 0) {
        const blockAuthor = {
          id: user.sub,
          name: user.name,
          slug: user.name?.toLowerCase().replace(/\s+/g, '-'),
        };
        const groupedBlocks = this._groupBlocksByTimestamp(updateData.richBlocks);
        await this._richBlocksService.bulkUpsert(
          currentArticleId,
          groupedBlocks,
          buildUserMetadata(user),
          blockAuthor
        );
        flatBlocksForEs = this._flattenGroupedBlocks(groupedBlocks);
        updateData.richBlocks = [];
      }

      // Update the article
      const updatedArticle = await this.articleModel
        .findByIdAndUpdate(currentArticleId, { $set: updateData }, updateOptions)
        .exec();

      // Always sync slug table (User Recommended)
      if (updatedArticle) {
        await this._slugService.updateSlugMetadata(
          updatedArticle.slug,
          ModuleName.ARTICLE,
          updatedArticle.property.id,
          { fullSlug: updatedArticle.fullSlug, status: updatedArticle.status },
          user
        );
      }

      // Update in Elasticsearch
      await this._updateIndexedArticleInElasticsearch(updatedArticle, flatBlocksForEs);

      // Notify SSE subscribers for live blog articles
      if (updatedArticle?.slug && this.isLiveArticle(updatedArticle.type)) {
        this._liveBlogSseService
          .publish(updatedArticle.slug, {
            type: 'live-update',
            articleId: updatedArticle._id.toString(),
            slug: updatedArticle.slug,
            updatedAt: new Date().toISOString(),
          })
          .catch((err) =>
            this._logger.error(`Failed to publish SSE for slug=${updatedArticle.slug}`, err),
          );

        // Bust Next.js cache on the reader so hard-refresh shows fresh content
        this._revalidation
          .emit(this._readerPathsForArticle(updatedArticle), 'liveblog.update')
          .catch(() => { }); // already logs internally, belt-and-braces
      }

      return updatedArticle;
    }

    // Create new article
    this._logger.log(
      `[Articles.create] Creating new article for user: ${user.email}`,
      this.constructor.name
    );
    const seoObj = buildSeoObject(
      createArticleDto.seo,
      createArticleDto.title,
      createArticleDto.excerpt
    );

    const { propertyId } = createArticleDto;

    const property = await this._propertyService.getById(propertyId);
    const organization = await this._orgainzationService.findOne(user.organizationId);

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

    // Generate unique slug only if slug is provided in the payload
    let articleSlug;
    let articleFullSlug;
    if (createArticleDto.slug) {
      // Pre-compute fullSlug from the input slug so the slug document is created correctly
      const preliminaryFullSlug =
        primaryCategory && typeof primaryCategory === 'object' && (primaryCategory as any).fullSlug
          ? `${(primaryCategory as any).fullSlug}/${createArticleDto.slug}`
          : createArticleDto.slug;

      articleSlug = await this._slugService.generateUniqueSlug(
        createArticleDto.title,
        ModuleName.ARTICLE,
        user,
        seoObj,
        propertyId,
        createArticleDto.slug,
        preliminaryFullSlug
      );

      // Recalculate fullSlug using the actual (possibly de-duped) slug
      articleFullSlug = articleSlug;
      if (primaryCategory && typeof primaryCategory === 'object' && (primaryCategory as any).fullSlug) {
        articleFullSlug = `${(primaryCategory as any).fullSlug}/${articleSlug}`;
      }
    }
    // Populate the required user field
    const articleData = {
      ...createArticleDto,
      primaryCategory: primaryCategory,
      slug: articleSlug,
      fullSlug: articleFullSlug,
      categories: finalCategories,
      tags: tags,
      user: {
        id: user.sub,
        name: user.name,
        email: user.email,
      },
      createdBy: buildUserMetadata(user),
      updatedBy: buildUserMetadata(user),
      property: propertyData,
      organization: organizationData,
    };

    // Remove currentArticleId from the data before saving
    delete articleData.currentArticleId;

    // For live articles: richBlocks are stored in the external collection and
    // Elasticsearch only — not in the MongoDB article document.
    const richBlocksFromDto: any[] = articleData.richBlocks ?? [];
    if (this.isLiveArticle(createArticleDto.type)) {
      articleData.richBlocks = [];
    }

    const createdArticle = new this.articleModel(articleData);
    const savedArticle = await createdArticle.save();

    // Always sync slug table (User Recommended)
    if (savedArticle) {
      await this._slugService.updateSlugMetadata(
        savedArticle.slug,
        ModuleName.ARTICLE,
        savedArticle.property.id,
        { fullSlug: savedArticle.fullSlug, status: savedArticle.status },
        user
      );
    }

    let flatBlocksForEs: any[] | undefined;
    if (this.isLiveArticle(createArticleDto.type) && richBlocksFromDto.length > 0) {
      const blockAuthor = {
        id: user.sub,
        name: user.name,
        slug: user.name?.toLowerCase().replace(/\s+/g, '-'),
      };
      const groupedBlocks = this._groupBlocksByTimestamp(richBlocksFromDto);
      await this._richBlocksService.bulkUpsert(
        savedArticle.id,
        groupedBlocks,
        buildUserMetadata(user),
        blockAuthor
      );
      flatBlocksForEs = this._flattenGroupedBlocks(groupedBlocks);
    }

    // Index into Elasticsearch — pass flat blocks directly for live articles
    await this._indexArticleInElasticsearch(savedArticle, flatBlocksForEs);

    return savedArticle;
  }

  async findAll(
    query: QueryArticleDto,
    user: TCurrentUserType
  ): Promise<{
    data: TArticleDocument[];
    total: number;
    lastId?: string | null;
    lastSortValues?: any[] | null;
  }> {
    // Build modified query with organization filter
    const queryWithOrgFilter = { ...query };

    // // Filter by user's organization
    // if (!queryWithOrgFilter.organizationId) {
    //   queryWithOrgFilter.organizationId = user.organizationId;
    // }

    // FIX: map propertyId → property.id or propertyId using OR logic
    if (queryWithOrgFilter.propertyId) {
      queryWithOrgFilter['$or'] = [
        { 'property.id': queryWithOrgFilter.propertyId },
        { propertyId: queryWithOrgFilter.propertyId },
      ];
      delete queryWithOrgFilter.propertyId;
    }

    // Handle author filter - convert to authors.id for array field
    if (queryWithOrgFilter.author) {
      queryWithOrgFilter['authors.id'] = queryWithOrgFilter.author;
      delete queryWithOrgFilter.author;
    }

    if (queryWithOrgFilter.tags) {
      queryWithOrgFilter['tags.id'] = queryWithOrgFilter.tags;
      delete queryWithOrgFilter.tags;
    }

    // Build base filters from query for counting (exclude lastId for stable total)
    const { lastId: _lastId, ...queryForCount } = queryWithOrgFilter;
    const filters = getFilters(queryForCount);
    const total = await this.articleModel.countDocuments(filters);

    // Build query with APIFeatures (will include property/org filter)
    const articlesQuery = new APIFeatures(this.articleModel as any, queryWithOrgFilter)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const articles = await articlesQuery.getQuery().exec();

    this._logger.log(
      `[Articles.findAll] Returning ${articles.length} articles out of ${total} total for user ${user.email}`,
      this.constructor.name
    );

    return {
      data: articles,
      total: total,
      lastId: articles.length > 0 ? articles[articles.length - 1]._id.toString() : null,
      lastSortValues: null,
    };
  }

  async getTopicsByAuthorScheduled(
    userId: string,
    siteSlug: string,
    author?: string
  ): Promise<any> {
    const currentTime = new Date();
    const findCriteria: any = {
      'user.id': userId,
      siteSlug,
      status: POST_STATUS.SCHEDULED,
      generatedAt: { $lte: currentTime },
    };
    if (author) {
      findCriteria.author = author;
    }
    const query = this.articleModel.find(findCriteria).sort({ generatedAt: -1 });

    const blogPosts = await query.exec();

    // Return empty array instead of throwing exception to allow iteration to continue
    if (!blogPosts || blogPosts.length === 0) {
      this._logger.warn(`No blog topics found with status "scheduled" for today`);
      return [];
    }

    return blogPosts;
  }

  // function to get all topics for a specific date
  async getTopicsByDate(date: Date, siteSlug: any): Promise<any> {
    // Create start and end dates for the given date (start of day t end of day)
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0); // Set to beginning of the day

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999); // Set to end of the day

    const blogPosts = await this.articleModel
      .find({
        generatedAt: {
          $gte: startDate,
          $lte: endDate,
        },
        propertyId: siteSlug.propertyId,
        status: POST_STATUS.POSTED, // Ensure we only get posted posts
      })
      .sort({ generatedAt: -1 })
      .exec();

    if (!blogPosts || blogPosts.length === 0) {
      throw new NotFoundException('No blog topics found for this date');
    }

    return blogPosts;
  }

  async findByIds(ids: string[]): Promise<TArticleDocument[]> {
    if (!ids || ids.length === 0) return [];

    try {
      const result = await this._elasticService.search(ModuleName.ARTICLE, {
        size: ids.length,
        query: { ids: { values: ids } },
      });

      const hits = result.hits.hits;
      if (hits.length > 0) {
        const articleMap = new Map(
          hits.map((hit) => [hit._id, { _id: hit._id, ...(hit._source as any) }])
        );
        return ids.map((id) => articleMap.get(id)).filter(Boolean) as any[];
      }
    } catch (error) {
      this._logger.warn(
        `findByIds: Elasticsearch failed, falling back to MongoDB — ${error.message}`,
        this.constructor.name
      );
    }

    // MongoDB fallback
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const articles = await this.articleModel.find({ _id: { $in: objectIds } }).exec();
    return ids
      .map((id) => articles.find((article) => article._id.toString() === id))
      .filter(Boolean);
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  async findAllFromElastic(
    query: QueryArticleDto,
    user: TCurrentUserType,
    additionalFilters?: any[]
  ): Promise<{
    data: Partial<TArticleDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
    lastSortValues?: any[] | null;
  }> {
    try {
      const fnStart = Date.now();
      // Handle author filter - convert to authors.id for array field
      const queryWithAuthorFilter = { ...query };

      // FIX: map propertyId → property.id or propertyId for Elasticsearch filtering
      if (queryWithAuthorFilter.propertyId) {
        queryWithAuthorFilter['$or'] = [
          { 'property.id': queryWithAuthorFilter.propertyId },
          { propertyId: queryWithAuthorFilter.propertyId },
        ];
        delete queryWithAuthorFilter.propertyId;
      }

      if (queryWithAuthorFilter.author) {
        queryWithAuthorFilter['authors.id'] = queryWithAuthorFilter.author;
        delete queryWithAuthorFilter.author;
      }

      // Handle tags filter - smart routing based on value format:
      // 1. 24-char hex ObjectId  → filter by tags.id  (keyword, nested term)
      // 2. Slug (no spaces)      → filter by tags.slug (keyword, nested term) ← primary
      // 3. Name (has spaces)     → stored separately, injected as nested match after ES query is built
      let tagNameFilter: string | null = null;

      if (queryWithAuthorFilter.tags) {
        const tagValue = queryWithAuthorFilter.tags as string;
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(tagValue);
        const hasSpaces = tagValue.includes(' ');

        if (isObjectId) {
          queryWithAuthorFilter['tags.id'] = tagValue;
        } else if (hasSpaces) {
          // Name-based (e.g. old URL state or combobox edge case)
          // Don't pass to ElasticAPIFeatures — inject manually after query build
          tagNameFilter = tagValue;
        } else {
          queryWithAuthorFilter['tags.slug'] = tagValue;
        }
        delete queryWithAuthorFilter.tags;
      }

      // // Filter by user's organization
      // if (!queryWithAuthorFilter.organizationId) {
      //   queryWithAuthorFilter.organizationId = user.organizationId;
      // }

      this._logger.log(
        `[Articles.findAllFromElastic] User ${user.email} accessing articles for organization ${user.organizationId}`,
        this.constructor.name
      );

      // Convert the query parameters to match ElasticAPIFeatures format
      const { searchTerm, ...restQuery } = queryWithAuthorFilter;
      const elasticQuery = {
        page: restQuery.page || 1,
        pageSize: restQuery.limit || 20,
        q: searchTerm,
        fields: restQuery.fields,
        ...restQuery, // Include all other query parameters directly
      };

      // --- INCLUSIVE CATEGORY FILTERING ---
      // We want category filters (ID or Slug) to search both 'primaryCategory' AND the 'categories' list.
      // Editors often use 'primaryCategory.id' in the URL but expect it to find the article if TAGGED at all.
      const categoryIdFilter = elasticQuery['primaryCategory.id'] || elasticQuery['categories.id'];
      const categorySlugFilter =
        elasticQuery['primaryCategory.slug'] || elasticQuery['categories.slug'];

      if (categoryIdFilter) {
        delete elasticQuery['primaryCategory.id'];
        delete elasticQuery['categories.id'];
      }
      if (categorySlugFilter) {
        delete elasticQuery['primaryCategory.slug'];
        delete elasticQuery['categories.slug'];
      }

      // --- TAG SLUG FILTERING ---
      // tags.slug is a 'text' field (ngram_analyzer) in the article mapping — NOT keyword.
      // ElasticAPIFeatures falls into the nested fallback and generates multi_match with
      // type: bool_prefix + fuzziness: AUTO, which is an invalid combination in Elasticsearch.
      // Extract and inject manually as a nested match_phrase query for exact slug matching.
      const tagSlugFilter = elasticQuery['tags.slug'];
      if (tagSlugFilter) {
        delete elasticQuery['tags.slug'];
      }

      // --- AUTHOR SLUG FILTERING ---
      // authors.slug is also a 'text' field with ngram_analyzer — same problem as tags.slug.
      const authorSlugFilter = elasticQuery['authors.slug'];
      if (authorSlugFilter) {
        delete elasticQuery['authors.slug'];
      }

      const queryBuildStart = Date.now();
      const features = (
        await new ElasticAPIFeatures(
          ModuleName.ARTICLE,
          elasticQuery,
          this._elasticService
        ).filter()
      )
        .sort()
        .limitFields();

      const esQuery = features.getQuery();
      const queryBuildMs = Date.now() - queryBuildStart;

      // 2. Inclusive Category Filter Injection
      if (esQuery.query?.bool) {
        esQuery.query.bool.filter = esQuery.query.bool.filter || [];

        if (categoryIdFilter) {
          esQuery.query.bool.filter.push({
            bool: {
              should: [
                { term: { 'primaryCategory.id': categoryIdFilter } },
                {
                  nested: {
                    path: 'categories',
                    query: { term: { 'categories.id': categoryIdFilter } },
                  },
                },
              ],
              minimum_should_match: 1,
            },
          });
        }

        if (categorySlugFilter) {
          esQuery.query.bool.filter.push({
            bool: {
              should: [
                { term: { 'primaryCategory.slug': categorySlugFilter } },
                {
                  nested: {
                    path: 'categories',
                    query: { term: { 'categories.slug': categorySlugFilter } },
                  },
                },
              ],
              minimum_should_match: 1,
            },
          });
        }
      }

      // Inject tag slug filter as a nested match_phrase query (tags.slug is a text field, not keyword)
      if (tagSlugFilter && esQuery.query?.bool) {
        esQuery.query.bool.filter = esQuery.query.bool.filter || [];
        esQuery.query.bool.filter.push({
          nested: {
            path: 'tags',
            query: {
              match_phrase: { 'tags.slug': tagSlugFilter },
            },
          },
        });
      }

      // Inject author slug filter as a nested match_phrase query (authors.slug is a text field, not keyword)
      if (authorSlugFilter && esQuery.query?.bool) {
        esQuery.query.bool.filter = esQuery.query.bool.filter || [];
        esQuery.query.bool.filter.push({
          nested: {
            path: 'authors',
            query: {
              match_phrase: { 'authors.slug': authorSlugFilter },
            },
          },
        });
      }

      // Inject tag name filter directly as a nested match query (for name-with-spaces values)
      if (tagNameFilter && esQuery.query?.bool) {
        esQuery.query.bool.filter = esQuery.query.bool.filter || [];
        esQuery.query.bool.filter.push({
          nested: {
            path: 'tags',
            query: {
              match: {
                'tags.name': {
                  query: tagNameFilter,
                  operator: 'and', // all words must be present
                },
              },
            },
          },
        });
      }

      // Modify search to handle nested fields for articles
      if (elasticQuery.q && esQuery.query?.bool) {
        delete esQuery.query.bool.minimum_should_match;
        delete esQuery.query.bool.should;

        // 1. Decode and Normalize
        let rawQuery = (elasticQuery.q || '').replace(/^"|"$/g, '').trim();
        try {
          if (rawQuery.includes('%')) rawQuery = decodeURIComponent(rawQuery);
        } catch (e) { }

        const cleanQuery = rawQuery.normalize('NFC').trim();

        // 2. Extract strict terms (must-haves)
        const strictTerms = cleanQuery
          .split(/[\s,.\।:!?()\"\'\[\]{}<>]+/) // Removed hyphen (-) to allow slugs to match exactly against keyword fields
          .filter((word) => word.length >= 3);

        const strictQuery = strictTerms.join(' ') || cleanQuery;

        // Generate slug-compatible version of the query:
        const slugQuery = cleanQuery
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\-]/g, '');

        // Keep existing filters (like organizationId) that features.filter might have added to must
        esQuery.query.bool.must = esQuery.query.bool.must || [];

        /**
         * STRATEGY:
         * 1. MUST: For EVERY word in the strictQuery, it must exist in at least ONE field.
         *    This ensures "तकनीकी" AND "संस्थानों" are both present.
         * 2. SHOULD: Phrase match and boosts to control ranking.
         */

        //--- 1. GLOBAL CONSTRAINTS (Ensuring "Both not one") ---
        strictTerms.forEach((term) => {
          esQuery.query.bool.must.push({
            bool: {
              minimum_should_match: 1,
              should: [
                { match: { title: { query: term, boost: 3 } } },
                { match: { englishHeadline: { query: term, boost: 3 } } },
                { match: { metaTitle: { query: term, boost: 2 } } },
                { match: { 'seo.title': { query: term, boost: 2 } } },
                { match: { metaDescription: term } },
                { match: { 'seo.metaDescription': term } },
                { match: { 'seo.description': term } },
                { match: { keyword: { query: term, boost: 2 } } },
                { match: { 'seo.keywords': { query: term, boost: 2 } } },
                { match: { body: term } },
                { match: { slug: term } },
                { match: { fullSlug: term } },
                {
                  nested: {
                    path: 'authors',
                    query: {
                      bool: {
                        should: [
                          { match: { 'authors.name': term } },
                          { match: { 'authors.slug': term } },
                        ],
                      },
                    },
                  },
                },
                {
                  nested: {
                    path: 'tags',
                    query: {
                      bool: {
                        should: [
                          { match: { 'tags.name': term } },
                          { match: { 'tags.slug': term } },
                        ],
                      },
                    },
                  },
                },
                {
                  nested: {
                    path: 'categories',
                    query: {
                      bool: {
                        should: [
                          { match: { 'categories.name': term } },
                          { match: { 'categories.title': term } },
                          { match: { 'categories.slug': term } },
                          { match: { 'categories.fullSlug': term } },
                        ],
                      },
                    },
                  },
                },
                {
                  bool: {
                    should: [
                      { match: { 'primaryCategory.name': term } },
                      { match: { 'primaryCategory.title': term } },
                      { match: { 'primaryCategory.slug': term } },
                      { match: { 'primaryCategory.fullSlug': term } },
                    ],
                  },
                },
                {
                  nested: {
                    path: 'richBlocks',
                    query: {
                      nested: {
                        path: 'richBlocks.content',
                        query: {
                          match: { 'richBlocks.content.text': term },
                        },
                      },
                    },
                  },
                },
              ],
            },
          });
        });

        //--- 2. RANKING BOOSTS (Phrases and exactness) ---
        esQuery.query.bool.should = [
          // exact phrase gets massive boost (across all headline fields)
          { match_phrase: { title: { query: cleanQuery, boost: 200 } } },
          { match_phrase: { englishHeadline: { query: cleanQuery, boost: 150 } } },
          { match_phrase: { metaTitle: { query: cleanQuery, boost: 100 } } },
          { match_phrase: { 'seo.title': { query: cleanQuery, boost: 100 } } },
          // multi-word matching boost
          {
            match: {
              title: {
                query: strictQuery,
                operator: 'and',
                boost: 50,
              },
            },
          },
          // category name or title boost
          {
            nested: {
              path: 'categories',
              query: {
                bool: {
                  should: [
                    { match: { 'categories.name': { query: cleanQuery, boost: 40 } } },
                    { match: { 'categories.title': { query: cleanQuery, boost: 40 } } },
                  ],
                },
              },
            },
          },
          {
            bool: {
              should: [
                { match: { 'primaryCategory.name': { query: cleanQuery, boost: 40 } } },
                { match: { 'primaryCategory.title': { query: cleanQuery, boost: 40 } } },
              ],
            },
          },
          // tag boost
          {
            nested: {
              path: 'tags',
              query: { match: { 'tags.name': { query: cleanQuery, boost: 30 } } },
            },
          },
          // SEO Metadata boosts
          { match: { 'seo.metaDescription': { query: cleanQuery, boost: 20 } } },
          { match: { 'seo.keywords': { query: cleanQuery, boost: 20 } } },
          // Slug boosts (helps English search find Hindi categories)
          { match: { fullSlug: { query: cleanQuery, boost: 30 } } },
          {
            nested: {
              path: 'categories',
              query: {
                bool: {
                  should: [
                    { match: { 'categories.slug': { query: cleanQuery, boost: 25 } } },
                    { match: { 'categories.fullSlug': { query: cleanQuery, boost: 25 } } },
                  ],
                },
              },
            },
          },
          {
            bool: {
              should: [
                { match: { 'primaryCategory.slug': { query: cleanQuery, boost: 25 } } },
                { match: { 'primaryCategory.fullSlug': { query: cleanQuery, boost: 25 } } },
              ],
            },
          },
        ];

        // Ensure we handle slug matching in SHOULD too
        if (slugQuery) {
          esQuery.query.bool.should.push({
            match: { slug: { query: slugQuery, boost: 50 } },
          });
        }
      }

      // Inject any caller-supplied filters (e.g. date range)
      if (additionalFilters?.length) {
        esQuery.query = esQuery.query || { bool: {} };
        esQuery.query.bool = esQuery.query.bool || {};
        esQuery.query.bool.filter = esQuery.query.bool.filter || [];
        esQuery.query.bool.filter.push(...additionalFilters);
      }

      const esStart = Date.now();
      const result = await this._elasticService.search(ModuleName.ARTICLE, esQuery);
      const esMs = Date.now() - esStart;
      const esServerMs = result.took; // time inside ES engine (ms)
      const networkMs = esMs - esServerMs; // serialization + round-trip

      const mappingStart = Date.now();
      const hits = result.hits.hits;
      const articles = hits.map((hit: any) => {
        const source = hit._source as any;

        if (source.title) source.title = he.decode(source.title);
        if (source.excerpt) source.excerpt = he.decode(source.excerpt);

        let fullSlug = source.fullSlug;

        if (!fullSlug && source.slug) {
          if (
            source.primaryCategory &&
            typeof source.primaryCategory === 'object' &&
            source.primaryCategory.fullSlug
          ) {
            fullSlug = `${source.primaryCategory.fullSlug}/${source.slug}`;
          } else {
            fullSlug = source.slug;
          }
        }

        return {
          _id: hit._id,
          ...source,
          fullSlug,
        };
      });
      const mappingMs = Date.now() - mappingStart;

      const totalMs = Date.now() - fnStart;
      if (totalMs > 100) {
        this._logger.log(
          `[Articles.findAllFromElastic] slow (${totalMs}ms) breakdown — ` +
          `queryBuild: ${queryBuildMs}ms | ` +
          `esTotal: ${esMs}ms (server: ${esServerMs}ms, network: ${networkMs}ms) | ` +
          `mapping: ${mappingMs}ms | ` +
          `hits: ${hits.length}`,
          this.constructor.name
        );
        if (true) {
          this._logger.log(
            `[Articles.findAllFromElastic] full ES query: ${JSON.stringify(esQuery)}`,
            this.constructor.name
          );
        }
      }

      const lastHit = hits[hits.length - 1];
      const lastSortValues = lastHit ? lastHit.sort : null;

      return {
        data: articles,
        total: result.hits.total,
        lastId: lastHit?._id || null,
        lastSortValues: lastSortValues,
      };
    } catch (error) {
      this._logger.log('fallback to mongodb', error);
      console.error('Error in fetching Article from Elastic fallback to mongoDB:', error);
      // fallback to mongoDB
      const articles = await this.findAll(query, user);
      return {
        data: articles.data,
        total: articles.total,
        lastId: articles.lastId,
        lastSortValues: articles.lastSortValues,
      };
    }
  }

  /**
   * Retrieves an article by slug from Elasticsearch and returns it in WordPress format
   * @param slug The slug of the article to retrieve
   * @param livePage Page number for live blog pagination (optional)
   * @param liveLimit Limit for live blog entries (optional)
   * @returns The article mapped to WordPress format
   */
  async findOneBySlugFromElastic(
    slug: string,
    livePage?: string,
    liveLimit?: string
  ): Promise<any> {
    try {
      this._logger.log(
        `[Articles.findOneBySlugFromElastic] Fetching article with slug: ${slug}`,
        this.constructor.name
      );

      // check if slug is only numbers
      if (/^\d+$/.test(slug)) {
        slug = `${slug}-`;
      }
      let article = await this._elasticService.findOneByField(ModuleName.ARTICLE, 'slug', slug);

      if (!article) {
        throw new NotFoundException(`Article with slug '${slug}' not found`);
      }

      if (article.type === 'webstory') {
        console.log('type is webstory');
        const webStoryArticle = await this._elasticService.search(ModuleName.ARTICLE, {
          query: {
            bool: {
              filter: [{ term: { slug } }, { term: { type: 'web_story' } }],
            },
          },
          size: 1,
        });
        const hit = webStoryArticle?.hits?.hits?.[0];
        if (hit) article = { ...(hit._source as object), _id: hit._id };
      }
      // Map to WordPress format before returning
      return await this.mapArticleToBlogBySlugFormat(article, livePage, liveLimit);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching article by slug from Elasticsearch:', error);
      throw error;
    }
  }

  /**
   * Retrieves an article by slug from MongoDB and returns it in WordPress format
   * @param slug The slug of the article to retrieve
   * @param livePage Page number for live blog pagination (optional)
   * @param liveLimit Limit for live blog entries (optional)
   * @returns The article mapped to WordPress format
   */
  async findOneBySlug(slug: string, livePage?: string, liveLimit?: string): Promise<any> {
    try {
      this._logger.log(
        `[Articles.findOneBySlug] Fetching article with slug: ${slug}`,
        this.constructor.name
      );

      const article = await this.articleModel.findOne({ slug }).exec();

      if (!article) {
        throw new NotFoundException(`Article with slug '${slug}' not found`);
      }

      const articleObj: any = article.toObject ? article.toObject() : article;

      // For liveblog articles, richBlocks are empty in MongoDB — fetch from ES
      if (this.isLiveArticle(articleObj.type)) {
        const esArticle = await this._elasticService.findOneByField(
          ModuleName.ARTICLE,
          'slug',
          slug
        );
        articleObj.richBlocks = esArticle?.richBlocks ?? [];
      }

      // Map to WordPress format before returning
      return await this.mapArticleToBlogBySlugFormat(articleObj, livePage, liveLimit);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching article by slug from MongoDB:', error);
      throw error;
    }
  }

  /**
   * Retrieves a blog post by ID, ensuring it belongs to the current user
   * @param id The ID of the blog post to retrieve
   * @param userId The ID of the user making the request
   * @param user The current user object for property access checks
   * @returns The blog post with the specified ID
   */
  async findOne(id: string, user: TCurrentUserType): Promise<any> {
    const blogPost = await this.articleModel.findOne({ _id: id }).exec();

    if (!blogPost) {
      throw new NotFoundException("Blog topic not found or you don't have permission to access it");
    }

    // Check access if user object is provided (property-based access)
    // if (user) {
    //   const isOwner = blogPost.user?.id === user.sub;
    //   if (!isOwner) {
    //     throw new NotFoundException(
    //       "Blog topic not found or you don't have permission to access it"
    //     );
    //   }
    // }
    // Backward compatibility: if only userId provided, check ownership
    else {
      this._logger.warn(
        'getById called  internally without user object, using userId for ownership check'
      );
    }

    const blogPostObj = blogPost.toObject();

    // For live articles, the MongoDB document has no richBlocks — fetch the
    // full authoritative set from the external collection.
    if (this.isLiveArticle(blogPostObj.type)) {
      const externalBlocks = await this._richBlocksService.findByArticleId(
        (blogPostObj._id as any).toString()
      );
      blogPostObj.richBlocks = [
        ...(blogPostObj.richBlocks ?? []),
        ...externalBlocks,
      ];
    }

    if (blogPostObj.richBlocks && Array.isArray(blogPostObj.richBlocks)) {
      try {
        const html = convertBlocksToHTML(blogPostObj.richBlocks);
        blogPostObj['html'] = html;
      } catch (error) {
        console.error(
          'Error converting blocks to HTML:',
          JSON.stringify(error, Object.getOwnPropertyNames(error))
        );
        blogPostObj['html'] = '';
      }
    }
    return blogPostObj;
  }

  async getById(id: string): Promise<Article> {
    return this.articleModel.findById(id).exec();
  }

  async update(id: string, updateArticleDto: UpdateArticleDto): Promise<Article> {
    // For live articles: persist richBlocks to the external collection only.
    // Clear them from the DTO so MongoDB stays empty; ES is populated with the
    // full block set by _updateIndexedArticleInElasticsearch.
    let flatBlocksForEs: any[] | undefined;
    if (updateArticleDto.richBlocks && updateArticleDto.richBlocks.length > 0) {
      const existing = await this.articleModel.findById(id).select('type').lean();
      if (existing && this.isLiveArticle(existing.type)) {
        const groupedBlocks = this._groupBlocksByTimestamp(updateArticleDto.richBlocks);
        await this._richBlocksService.bulkUpsert(id, groupedBlocks);
        flatBlocksForEs = this._flattenGroupedBlocks(groupedBlocks);
        updateArticleDto.richBlocks = [] as any;
      }
    }

    const updatedArticle = await this.articleModel
      .findByIdAndUpdate(id, updateArticleDto, { new: true })
      .exec();

    // Recalculate fullSlug and sync with Slug service (User Recommended flow)
    if (updatedArticle) {
      const articleSlug = updatedArticle.slug;
      const primaryCategory = updatedArticle.primaryCategory;
      
      let articleFullSlug = articleSlug;
      if (primaryCategory && primaryCategory.fullSlug) {
        articleFullSlug = `${primaryCategory.fullSlug}/${articleSlug}`;
      }
      
      // Update the article's own fullSlug if it changed
      if (articleFullSlug !== updatedArticle.fullSlug) {
        await this.articleModel.findByIdAndUpdate(id, { fullSlug: articleFullSlug });
        updatedArticle.fullSlug = articleFullSlug;
      }

      // Sync the slug collection record
      const userStub = {
        organizationId: updatedArticle.organization.id,
        sub: updatedArticle.updatedBy.id,
        name: updatedArticle.updatedBy.name,
      };

      await this._slugService.updateSlugMetadata(
        updatedArticle.slug,
        ModuleName.ARTICLE,
        updatedArticle.property.id,
        { fullSlug: articleFullSlug, status: updatedArticle.status },
        userStub
      );
    }

    // Update in Elasticsearch — pass flat blocks directly for live articles
    await this._updateIndexedArticleInElasticsearch(updatedArticle, flatBlocksForEs);

    // Notify SSE subscribers for live blog articles
    if (updatedArticle?.slug && this.isLiveArticle(updatedArticle.type)) {
      this._liveBlogSseService
        .publish(updatedArticle.slug, {
          type: 'live-update',
          articleId: updatedArticle._id.toString(),
          slug: updatedArticle.slug,
          updatedAt: new Date().toISOString(),
        })
        .catch((err) =>
          this._logger.error(`Failed to publish SSE for slug=${updatedArticle.slug}`, err),
        );

      // Bust Next.js cache on the reader so hard-refresh shows fresh content
      this._revalidation
        .emit(this._readerPathsForArticle(updatedArticle), 'liveblog.update')
        .catch(() => { });
    }

    return updatedArticle;
  }

  async updateArticle(id: string, wpMetaData: any) {
    try {
      const updatedBlog = await this.articleModel.findOneAndUpdate(
        { _id: id },
        { $set: wpMetaData },
        { new: true }
      );

      return updatedBlog;
    } catch (error) {
      this._logger.error(
        `Error updating blog topic for`,
        {
          error: error.message,
          stack: error.stack,
          wpMetaData: JSON.stringify(wpMetaData),
        },
        this.constructor.name
      );
    }
  }

  async remove(id: string): Promise<Article> {
    const deletedArticle = await this.articleModel.findByIdAndDelete(id).exec();

    if (deletedArticle && this.isLiveArticle(deletedArticle.type)) {
      await this._richBlocksService.deleteByArticleId(id);
    }

    // Delete from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.ARTICLE, id);

    return deletedArticle;
  }

  async deleteRichBlock(articleId: string, blockId: string): Promise<void> {
    await this._richBlocksService.softDeleteBlock(blockId);
    await this.articleModel.findByIdAndUpdate(articleId, {
      $pull: { richBlocks: { id: blockId } },
    });
  }

  /**
   * Private method to index article in Elasticsearch
   */
  private async _indexArticleInElasticsearch(article: TArticleDocument, richBlocksOverride?: any[]): Promise<void> {
    const richBlocks = richBlocksOverride ?? (
      this.isLiveArticle(article.type)
        ? await this._richBlocksService.findByArticleId(article.id)
        : article.richBlocks
    );

    const indexPayload = {
      id: article.id,
      // user: article.user,
      organization: article.organization,
      // pubBucket: article.pubBucket,
      type: article.type,
      status: article.status,
      lang: article.lang,
      slug: article.slug,
      fullSlug: article.fullSlug,
      englishHeadline: article.englishHeadline,
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      // dek: article.dek,
      body: article.body,
      richBlocks,
      images: article.images,
      videos: article.videos,
      authors: article.authors,
      // beats: article.beats,
      // geo: article.geo,
      entities: article.entities,
      channels: article.channels,
      seo: article.seo,
      discoverHealth: article.discoverHealth,
      // counters: article.counters,
      metricsLatest: article.metricsLatest,
      embeddings: article.embeddings,
      tags: article.tags,
      publishedAt: article.publishedAt,
      embargoAt: article.embargoAt,
      scheduledAt: article.scheduledAt,
      currentVersion: article.currentVersion,
      // revisionsLite: article.revisionsLite,
      moderation: article.moderation,
      // softDeleted: article.softDeleted,
      articlePostId: article.articlePostId,
      categories: article.categories,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      ogTitle: article.ogTitle,
      ogDescription: article.ogDescription,
      excerpt: article.excerpt,
      keyword: article.keyword,
      property: article.property,
      featuredMedia: article.featuredMedia,
      featuredVideo: article.featuredVideo,
      wpPostId: article.wpId,
      primaryCategory: article.primaryCategory,
      createdBy: article.createdBy,
      updatedBy: article.updatedBy,
      recipeData: article.recipeData,
      movieReviewData: article.movieReviewData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await this._elasticService.indexDocument(ModuleName.ARTICLE, article.id, indexPayload);
      this._logger.log(`Article ${article.id} indexed in Elasticsearch`, this.constructor.name);
    } catch (error) {
      this._logger.error(
        `Error indexing article ${article.id} in Elasticsearch:`,
        error,
        this.constructor.name
      );
    }
  }

  /**
   * Private method to update article in Elasticsearch
   */
  private async _updateIndexedArticleInElasticsearch(article: TArticleDocument, richBlocksOverride?: any[]): Promise<void> {
    const richBlocks = richBlocksOverride ?? (
      this.isLiveArticle(article.type)
        ? await this._richBlocksService.findByArticleId(article.id)
        : article.richBlocks
    );

    const indexPayload = {
      id: article.id,
      // user: article.user,
      organization: article.organization,
      // pubBucket: article.pubBucket,
      type: article.type,
      status: article.status,
      lang: article.lang,
      slug: article.slug,
      fullSlug: article.fullSlug,
      englishHeadline: article.englishHeadline,
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      // dek: article.dek,
      body: article.body,
      richBlocks,
      images: article.images,
      videos: article.videos,
      authors: article.authors,
      // beats: article.beats,
      // geo: article.geo,
      entities: article.entities,
      channels: article.channels,
      seo: article.seo,
      discoverHealth: article.discoverHealth,
      // counters: article.counters,
      metricsLatest: article.metricsLatest,
      embeddings: article.embeddings,
      tags: article.tags,
      publishedAt: article.publishedAt,
      embargoAt: article.embargoAt,
      scheduledAt: article.scheduledAt,
      currentVersion: article.currentVersion,
      // revisionsLite: article.revisionsLite,
      moderation: article.moderation,
      // softDeleted: article.softDeleted,
      articlePostId: article.articlePostId,
      categories: article.categories,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      ogTitle: article.ogTitle,
      ogDescription: article.ogDescription,
      excerpt: article.excerpt,
      keyword: article.keyword,
      property: article.property,
      featuredMedia: article.featuredMedia,
      featuredVideo: article.featuredVideo,
      // featured_media: article.featured_media,
      // wpCategoryIds: article.wpCategoryIds,
      // wpTagIds: article.wpTagIds,
      wpId: article.wpId,
      primaryCategory: article.primaryCategory,
      updatedBy: article.updatedBy,
      recipeData: article.recipeData,
      movieReviewData: article.movieReviewData,
      updatedAt: article.updatedAt || new Date().toISOString(),
    };

    try {
      await this._elasticService.updateDocument(ModuleName.ARTICLE, article.id, indexPayload);
      this._logger.log(`Article ${article.id} updated in Elasticsearch`, this.constructor.name);
    } catch (error) {
      this._logger.error(
        `Error updating article ${article.id} in Elasticsearch:`,
        error,
        this.constructor.name
      );
    }
  }

  /**
   * Fetches articles from WordPress API and saves them to local database
   * @param user The current user making the request
   * @param propertyId The property ID to associate with the articles
   * @param limit Number of articles to fetch (default: 10)
   * @returns Object with success status and imported articles count
   */
  // async fetchAndSaveWordPressArticles(
  //   user: TCurrentUserType,
  //   propertyId: string
  // ): Promise<{
  //   success: boolean;
  //   imported: number;
  //   errors: any[];
  //   duration: number;
  //   avgTimePerArticle: number;
  // }> {
  //   const startTime = Date.now();

  //   // Validate user object
  //   if (!user || !user.email || !user.sub || !user.organizationId) {
  //     this._logger.error('[Articles.fetchAndSaveWordPressArticles] Invalid user context');
  //     throw new Error(
  //       'User authentication required. Please ensure you are logged in and have a valid JWT token.'
  //     );
  //   }

  //   const wpAdmin = this.configService.get<string>('WP_ADMIN');
  //   const wpPassword = this.configService.get<string>('WP_PASSWORD');
  //   const wpApiUrl = ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/posts';

  //   if (!wpAdmin || !wpPassword) {
  //     this._logger.error(
  //       '[Articles.fetchAndSaveWordPressArticles] WP_ADMIN or WP_PASSWORD not configured'
  //     );
  //     throw new Error('WordPress credentials not configured');
  //   }

  //   const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  //   const imported = [];
  //   const errors = [];
  //   const perPage = 50;
  //   let hasMore = true;
  //   let totalFetched = 0;

  //   // Redis key for resume functionality
  //   const resumeKey = `wp_article_import_resume_${propertyId}`;

  //   // Check if there's a previous incomplete import
  //   let currentPage = 1;
  //   const savedPage = await this._redisService.get(resumeKey);
  //   if (savedPage) {
  //     currentPage = parseInt(savedPage);
  //     this._logger.log(
  //       `[Articles.fetchAndSaveWordPressArticles] Resuming from page ${currentPage}`,
  //       this.constructor.name
  //     );
  //   } else {
  //     this._logger.log(
  //       `[Articles.fetchAndSaveWordPressArticles] Starting fresh import for user: ${user.email}`,
  //       this.constructor.name
  //     );
  //   }

  //   try {
  //     while (hasMore) {
  //       // Save current page to Redis before processing
  //       await this._redisService.setWithTTL(resumeKey, currentPage.toString(), 'EX', 86400);

  //       this._logger.log(
  //         `[Articles.fetchAndSaveWordPressArticles] Fetching page ${currentPage}`,
  //         this.constructor.name
  //       );

  //       // Fetch articles from WordPress with authentication
  //       const response = await firstValueFrom(
  //         this.httpService.get(wpApiUrl, {
  //           params: {
  //             per_page: perPage,
  //             page: currentPage,
  //             status: 'publish',
  //           },
  //           auth: {
  //             username: wpAdmin,
  //             password: wpPassword,
  //           },
  //         })
  //       );

  //       const wpPosts = response.data;
  //       totalFetched += wpPosts.length;

  //       this._logger.log(
  //         `[Articles.fetchAndSaveWordPressArticles] Fetched ${wpPosts.length} posts from page ${currentPage}`,
  //         this.constructor.name
  //       );

  //       if (wpPosts.length === 0 || wpPosts.length < perPage) {
  //         hasMore = false;
  //       }

  //       for (const wpPost of wpPosts) {
  //         const articleStartTime = Date.now();
  //         try {
  //           // Check if article already exists by wpPostId
  //           const existingArticle = await this.articleModel
  //             .findOne({
  //               wpPostId: wpPost.id,
  //               organizationId: user.organizationId,
  //             })
  //             .exec();

  //           if (existingArticle) {
  //             this._logger.log(
  //               `[Articles.fetchAndSaveWordPressArticles] Article with wpPostId ${wpPost.id} already exists, skipping`,
  //               this.constructor.name
  //             );
  //             continue;
  //           }

  //           // Fetch categories from DB by wpCategoryId using service
  //           const categoryNames = [];
  //           if (wpPost.categories && wpPost.categories.length > 0) {
  //             const dbCategories = await this._categoryService.findCategoriesByWpIds(
  //               wpPost.categories
  //             );
  //             categoryNames.push(...dbCategories.map((cat) => cat.title));
  //           }

  //           // Fetch tags from DB by wpTagId using service
  //           const tagNames = [];
  //           if (wpPost.tags && wpPost.tags.length > 0) {
  //             const dbTags = await this._tagsService.findTagsByWpIds(wpPost.tags);
  //             tagNames.push(...dbTags.map((tag) => tag.name));
  //           }

  //           // Fetch author from DB by wpAuthorId
  //           let authors = [];
  //           if (wpPost.author) {
  //             const dbAuthor = await this._authorService.findByWpAuthorId(wpPost.author);
  //             if (dbAuthor) {
  //               authors = [
  //                 {
  //                   id: (dbAuthor as any).id || (dbAuthor as any)._id.toString(),
  //                   name: dbAuthor.name,
  //                 },
  //               ];
  //             }
  //           }

  //           // Map WordPress post to Article schema
  //           const articleData: any = {
  //             // User and organization info
  //             user: {
  //               id: user.sub,
  //               name: user.name,
  //               email: user.email,
  //             },
  //             organizationId: user.organizationId,
  //             propertyId: propertyId,

  //             // WordPress field mappings
  //             wpPostId: wpPost.id,
  //             title: wpPost.title?.rendered || 'Untitled',
  //             excerpt: wpPost.excerpt?.rendered || '',
  //             slug: wpPost.slug || '',
  //             status: this.mapWordPressStatus(wpPost.status),
  //             type: wpPost.type || 'article',
  //             link: wpPost.link || '',
  //             body: wpPost.content?.rendered || '',

  //             // Category and Tag IDs from WordPress
  //             wpCategoryIds: wpPost.categories || [],
  //             wpTagIds: wpPost.tags || [],

  //             // Category and Tag names from DB
  //             categories: categoryNames,
  //             tags: tagNames,

  //             // Convert HTML content to richBlocks
  //             richBlocks: this.convertHtmlToRichBlocks(wpPost.content?.rendered || ''),

  //             // Featured media
  //             featured_media: wpPost.featured_media || null,

  //             // Language (you can customize this based on your needs)
  //             lang: 'hi', // Assuming Hindi based on the example content

  //             // Dates
  //             publishedAt: wpPost.date ? new Date(wpPost.date) : null,

  //             // Authors from fetched author
  //             authors:
  //               authors.length > 0
  //                 ? authors
  //                 : [
  //                     {
  //                       id: user.sub,
  //                       name: user.name,
  //                     },
  //                   ],
  //             beats: [],
  //             geo: [],
  //             entities: [],
  //             images: [],
  //             videos: [],
  //             softDeleted: false,
  //           };

  //           // Create the article
  //           const createdArticle = new this.articleModel(articleData);
  //           await createdArticle.save();

  //           imported.push(createdArticle);

  //           const articleDuration = Date.now() - articleStartTime;
  //           this._logger.log(
  //             `[Articles.fetchAndSaveWordPressArticles] Successfully imported article: ${wpPost.id} - ${wpPost.title?.rendered} (${articleDuration}ms)`,
  //             this.constructor.name
  //           );
  //         } catch (error) {
  //           this._logger.error(
  //             `[Articles.fetchAndSaveWordPressArticles] Error importing article ${wpPost.id}:`,
  //             {
  //               error: error.message,
  //               stack: error.stack,
  //               wpPostId: wpPost.id,
  //             },
  //             this.constructor.name
  //           );
  //           errors.push({
  //             wpPostId: wpPost.id,
  //             error: error.message,
  //           });
  //         }
  //       }

  //       if (hasMore) {
  //         currentPage++;
  //         this._logger.log(
  //           `[Articles.fetchAndSaveWordPressArticles] Waiting 2 seconds before next page...`,
  //           this.constructor.name
  //         );
  //         await delay(2000);
  //       }
  //     }

  //     // Clear Redis key after successful completion
  //     await this._redisService.del(resumeKey);
  //     this._logger.log(
  //       `[Articles.fetchAndSaveWordPressArticles] Cleared resume key from Redis`,
  //       this.constructor.name
  //     );

  //     const totalDuration = Date.now() - startTime;
  //     const avgTimePerArticle =
  //       imported.length > 0 ? Math.round(totalDuration / imported.length) : 0;

  //     this._logger.log(
  //       `[Articles.fetchAndSaveWordPressArticles] Import completed. Total Fetched: ${totalFetched}, Imported: ${imported.length}, Errors: ${errors.length}, Total Duration: ${totalDuration}ms, Avg per article: ${avgTimePerArticle}ms`,
  //       this.constructor.name
  //     );

  //     return {
  //       success: true,
  //       imported: imported.length,
  //       errors,
  //       duration: totalDuration,
  //       avgTimePerArticle,
  //     };
  //   } catch (error) {
  //     this._logger.error(
  //       '[Articles.fetchAndSaveWordPressArticles] Failed to fetch from WordPress:',
  //       {
  //         error: error.message,
  //         stack: error.stack,
  //         currentPage,
  //       },
  //       this.constructor.name
  //     );

  //     this._logger.log(
  //       `[Articles.fetchAndSaveWordPressArticles] Import state saved to Redis. Will resume from page ${currentPage} on next run.`,
  //       this.constructor.name
  //     );

  //     throw new Error(`Failed to fetch WordPress articles: ${error.message}`);
  //   }
  // }

  /**
   * Maps WordPress post status to our article status
   */
  private mapWordPressStatus(wpStatus: string): string {
    const statusMap = {
      publish: 'published',
      draft: 'draft',
      pending: 'review',
      future: 'scheduled',
      private: 'draft',
    };
    return statusMap[wpStatus] || 'draft';
  }

  /**
   * Converts HTML content to BlockNote-compatible richBlocks structure
   * Parses HTML tags and creates proper BlockNote blocks
   */
  private convertHtmlToRichBlocks(htmlContent: string): any[] {
    if (!htmlContent) {
      return [];
    }

    const blocks: any[] = [];
    let blockIdCounter = 0;

    // Generate unique block ID
    const generateBlockId = () => {
      return `block-${Date.now()}-${blockIdCounter++}`;
    };

    // Remove script tags and other potentially harmful content
    const cleanHtml = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Simple HTML parser - split by major block elements
    const htmlLines = cleanHtml.split(/(?=<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div)[\s>])/i);

    for (const line of htmlLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Extract text content from HTML, removing all tags
      const getTextContent = (html: string): string => {
        return html
          .replace(/<[^>]+>/g, '') // Remove all HTML tags
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .trim();
      };

      // Check for strong/bold text
      const hasStrong = /<(strong|b)[\s>]/i.test(trimmedLine);
      const hasItalic = /<(em|i)[\s>]/i.test(trimmedLine);

      const textContent = getTextContent(trimmedLine);
      if (!textContent) continue;

      // Heading blocks (h1-h6)
      if (/^<h([1-6])[\s>]/i.test(trimmedLine)) {
        const level = parseInt(trimmedLine.match(/^<h([1-6])/i)?.[1] || '1');
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          props: {
            textColor: 'default',
            backgroundColor: 'default',
            textAlignment: 'left',
            level: level,
          },
          content: [
            {
              type: 'text',
              text: textContent,
              styles: {
                ...(hasStrong && { bold: true }),
                ...(hasItalic && { italic: true }),
              },
            },
          ],
          children: [],
        });
      }
      // Unordered list items
      else if (
        /^<li[\s>]/i.test(trimmedLine) &&
        /<ul/i.test(cleanHtml.substring(0, cleanHtml.indexOf(trimmedLine)))
      ) {
        blocks.push({
          id: generateBlockId(),
          type: 'bulletListItem',
          props: {
            textColor: 'default',
            backgroundColor: 'default',
            textAlignment: 'left',
          },
          content: [
            {
              type: 'text',
              text: textContent,
              styles: {
                ...(hasStrong && { bold: true }),
                ...(hasItalic && { italic: true }),
              },
            },
          ],
          children: [],
        });
      }
      // Ordered list items
      else if (
        /^<li[\s>]/i.test(trimmedLine) &&
        /<ol/i.test(cleanHtml.substring(0, cleanHtml.indexOf(trimmedLine)))
      ) {
        blocks.push({
          id: generateBlockId(),
          type: 'numberedListItem',
          props: {
            textColor: 'default',
            backgroundColor: 'default',
            textAlignment: 'left',
          },
          content: [
            {
              type: 'text',
              text: textContent,
              styles: {
                ...(hasStrong && { bold: true }),
                ...(hasItalic && { italic: true }),
              },
            },
          ],
          children: [],
        });
      }
      // Blockquote
      else if (/^<blockquote[\s>]/i.test(trimmedLine)) {
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          props: {
            textColor: 'default',
            backgroundColor: 'default',
            textAlignment: 'left',
          },
          content: [
            {
              type: 'text',
              text: textContent,
              styles: {
                ...(hasStrong && { bold: true }),
                ...(hasItalic && { italic: true }),
              },
            },
          ],
          children: [],
        });
      }
      // Paragraph or default
      else if (/^<p[\s>]/i.test(trimmedLine) || textContent.length > 0) {
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          props: {
            textColor: 'default',
            backgroundColor: 'default',
            textAlignment: 'left',
          },
          content: [
            {
              type: 'text',
              text: textContent,
              styles: {
                ...(hasStrong && { bold: true }),
                ...(hasItalic && { italic: true }),
              },
            },
          ],
          children: [],
        });
      }
    }

    // If no blocks were created, create a single paragraph with the text content
    if (blocks.length === 0 && cleanHtml) {
      const textContent = cleanHtml.replace(/<[^>]+>/g, '').trim();
      if (textContent) {
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          props: {
            textColor: 'default',
            backgroundColor: 'default',
            textAlignment: 'left',
          },
          content: [
            {
              type: 'text',
              text: textContent,
              styles: {},
            },
          ],
          children: [],
        });
      }
    }

    return blocks;
  }

  /**
   * Maps article to "Post By ID" WordPress format
   * Used by getBlogById and getBlogByCategory endpoints
   * @param article The article to map
   * @param includeContent Whether to include HTML content (default: true)
   * @returns Mapped article in WordPress format
   */
  mapArticleToPostByIdFormat(article: any, includeContent: boolean = true): any {
    // Convert rich blocks to HTML if content is requested
    let htmlContent = '';
    if (includeContent && article.richBlocks && Array.isArray(article.richBlocks)) {
      try {
        htmlContent = convertBlocksToHTML(article.richBlocks);
      } catch (error) {
        this._logger.error(
          `Error converting blocks to HTML for article ${article._id}:`,
          JSON.stringify(error, Object.getOwnPropertyNames(error)),
          this.constructor.name
        );
        htmlContent = '';
      }
    }

    return {
      post_id: article.wpId || article._id,
      post_title: he.decode(article.title || ''),
      post_url: article.fullSlug ? `'${process.env.SITE || "https://example.com"}/${article.slug}` : '',
      post_format: article.type || 'standard',
      published_by: {
        name: ' ',
        id: '',
        username: '',
      },
      post_categories: (article.categories || []).map((cat: any) => ({
        name: cat.title || '',
        id: cat.id || '',
        slug: cat.slug || '',
        // hindi_name: cat.titleHindi || "",
        // fullslug: cat.fullSlug || "",
        // status: cat.status,
        // isFeatured: cat.isFeatured,
        // link: cat.link || "",
        // rank: cat.rank || "",
        // wpCategoryId: cat.wpCategoryId || "",
        // count: cat.count
      })),
      post_tags: (article.tags || []).map((tag: any) => ({
        name: tag.title || '',
        id: tag.id || '',
        slug: tag.slug || '',
      })),
      posted_on: article.createdAt ? new Date(article.createdAt).toISOString().split('T')[0] : '',
      post_author: article.authors?.[0]
        ? {
          name: article.authors[0].name || '',
          id: article.authors[0].id || '',
          username: article.authors[0].name || '',
        }
        : {
          name: '',
          id: '',
          username: '',
        },
      post_content: htmlContent,
      post_image: article.featuredMedia ? this._toCdnUrl(article.featuredMedia) : '',
      recipeData: article.recipeData,
      movieReviewData: article.movieReviewData,
    };
  }

  /**
   * Maps article to "Blog By Slug" WordPress format
   * Includes full HTML content, SEO metadata, and optional live blog data
   * @param article The article to map
   * @param livePage Page number for live blog pagination (optional)
   * @param liveLimit Limit for live blog entries (optional)
   * @returns Mapped article in WordPress format with live blog support
   */
  async mapArticleToBlogBySlugFormat(
    article: any,
    livePage?: string,
    liveLimit?: string
  ): Promise<any> {
    const isLiveBlog = this.isLiveArticle(article.type);

    // richBlocks are sourced from the ES document for all article types.
    // For liveblog articles fetched from MongoDB (richBlocks: []), the caller
    // is expected to have populated richBlocks from ES before calling this method.
    const richBlocks: any[] = article.richBlocks ?? [];

    // Skip the first block if it is an h1 heading (the article title),
    // since the title is already returned as a separate field.
    const contentBlocks =
      richBlocks.length > 0 &&
        richBlocks[0]?.type === 'heading' &&
        (richBlocks[0]?.metadata?.props?.level === 1 || richBlocks[0]?.props?.level === 1)
        ? richBlocks.slice(1)
        : richBlocks;

    // Convert rich blocks to HTML
    let htmlContent = '';
    if (contentBlocks.length > 0) {
      try {
        htmlContent = convertBlocksToHTML(contentBlocks);
      } catch (error) {
        this._logger.error(
          `Error converting blocks to HTML for article ${article._id}:`,
          JSON.stringify(error, Object.getOwnPropertyNames(error)),
          this.constructor.name
        );
        htmlContent = '';
      }
    }
    // Process live blog data: always for liveblog type (default page=1, limit=6),
    // or when explicit live_page and live_limit params are provided
    let liveData: any[] = [];
    this._logger.log(
      `[mapArticleToBlogBySlugFormat] slug=${article.slug} type=${article.type} isLiveBlog=${isLiveBlog} livePage=${livePage} liveLimit=${liveLimit} richBlocks.length=${richBlocks.length}`,
      this.constructor.name
    );
    if (isLiveBlog || (livePage && liveLimit)) {
      const page = parseInt(livePage) || 1;
      const limit = parseInt(liveLimit) || 6;

      if (richBlocks.length > 0) {
        try {
          liveData = convertBlocksToLiveBlogEntries(richBlocks, page, limit);
          this._logger.log(
            `[mapArticleToBlogBySlugFormat] convertBlocksToLiveBlogEntries returned ${liveData.length} entries`,
            this.constructor.name
          );
        } catch (error) {
          this._logger.error(
            `Error converting blocks to live blog entries for article ${article._id}:`,
            JSON.stringify(error, Object.getOwnPropertyNames(error)),
            this.constructor.name
          );
        }
      } else {
        this._logger.log(
          `[mapArticleToBlogBySlugFormat] richBlocks empty — no live_data entries`,
          this.constructor.name
        );
      }
    }

    // Map to WordPress format
    const domain = article.property?.domain || process.env.SITE || 'https://example.com';
    const post_id = article.wpId || article._id;
    const itemUrl = article.slug
      ? `${domain}/${article.fullSlug || article.slug}`
      : `${domain}/?p=${post_id}`;
    let featured_media: any = null;
    if (article.featuredMedia?.path) {
      featured_media = await this._elasticService.findOneByField(
        ModuleName.MEDIA,
        'path',
        article.featuredMedia?.path
      );
    }
    let post_format = article.type;
    if (article.type === 'web_story') {
      post_format = 'webstory';
    }
    const mappedData = {
      post_id: post_id,
      post_format: post_format || 'standard',
      title: he.decode(article.title || ''),
      excerpt: stripHtml(article.excerpt),
      slug: article.slug || '',
      url: itemUrl,
      publish_date: article.publishedAt || article.createdAt || '',
      modified_date: article.updatedAt || article.createdAt || '',
      ...(article.type === 'video' && { video: article.featuredVideo?.url || '' }),
      audio: '',
      video_url: article?.featuredVideo?.url || '',
      video_time: article.featuredVideo?.duration || '',
      publish_by: article.authors[0].name,
      image: article.featuredMedia ? this._toCdnUrl(article.featuredMedia) : '',
      author: article.authors?.[0]
        ? {
          id: article.authors[0].id || article.authors[0]._id || '',
          name: article.authors[0].name || '',
          username: article.authors[0].username || article.authors[0].name || '',
          slug: `author/${article.authors[0].slug || article.authors[0].name?.toLowerCase().replace(/\s+/g, '-')}`,
        }
        : {
          id: '',
          name: '',
          username: '',
          slug: '',
        },
      categories: (article.categories || []).map((cat: any) => ({
        id: cat.wpCategoryId || cat.id || cat._id || '',
        name: cat.title || '',
        slug: cat.slug || '',
      })),
      featured_media: featured_media
        ? {
          url: featured_media?.url || '',
          caption: featured_media?.caption || article.title || '',
          alt: featured_media?.alt || article.title || '',
          title: featured_media?.name || article.title || '',
        }
        : article.featuredMedia
          ? {
            url: this._toCdnUrl(article.featuredMedia),
            caption: article.featuredMedia.caption || article.title || '',
            alt: article.featuredMedia.alt || article.title || '',
            title: article.featuredMedia.fileName || article.title || '',
          }
          : null,
      tags: (article.tags || []).map((tag: any) => ({
        id: tag.wpTagId || tag.id || tag._id || '',
        name: tag.name || tag.title || '',
        slug: tag.slug || '',
      })),
      content: article.type != 'web_story' ? htmlContent : article.body,
      seo_meta: {
        rank_math_title: article.metaTitle || article.seo?.title || article.title || '',
        rank_math_description:
          article.metaDescription || article.seo?.description || article.excerpt || '',
        rank_math_focus_keyword: article.keyword || (article.seo?.tags || []).join(', ') || '',
        rank_math_seo_score: '',
        liveblog: article.type === 'liveblog' ? 'archive' : '',
        youtube_video_id: article.seo?.youtube_video_id || '',
        youtube_channel: article.seo?.youtube_channel || '',
        youtube_video_type: article.seo?.youtube_video_type || '',
        featured_video: article.seo?.featured_video || '',
        pk_published_by: article.seo?.pk_published_by || '',
        pk_video_time: article.seo?.pk_video_time || '',
        td_post_video: article.seo?.td_post_video || '',
        td_gallery: article.seo?.td_gallery || '',
        td_post_audio: article.seo?.td_post_audio || '',
        td_post_image: article.seo?.td_post_image || '',
        td_post_gallery: article.seo?.td_post_gallery || '',
      },
      post_status: article.status === 'published' ? 'publish' : article.status || 'draft',
      recipeData: article.recipeData,
      movieReviewData: article.movieReviewData,
    };
    console.log('mappedData.image', mappedData.image);
    // Add coverage times for live blogs
    if (isLiveBlog) {
      if (article.coverageStartTime) {
        mappedData['coverageStartTime'] = article.coverageStartTime;
      }
      if (article.coverageEndTime) {
        mappedData['coverageEndTime'] = article.coverageEndTime;
      }
    }

    // Add live_data field if live blog data exists
    if (liveData.length > 0) {
      mappedData['live_data'] = liveData;
    } else if (isLiveBlog) {
      this._logger.log(
        `[mapArticleToBlogBySlugFormat] live_data is empty for liveblog slug=${article.slug} — no timestamp-type richBlocks found`,
        this.constructor.name
      );
    }

    return mappedData;
  }

  /**
   * Maps article to filter WordPress format
   * Used by the filter endpoint with a simpler structure
   * @param article The article to map
   * @returns Mapped article in simplified WordPress filter format
   */
  mapArticleToFilterFormat(article: any, _embed?: any): any {
    // Convert rich blocks to HTML
    let htmlContent = '';
    if (article.richBlocks && Array.isArray(article.richBlocks)) {
      try {
        htmlContent = convertBlocksToHTML(article.richBlocks);
      } catch (error) {
        this._logger.error(
          `Error converting blocks to HTML for article ${article._id}:`,
          JSON.stringify(error, Object.getOwnPropertyNames(error)),
          this.constructor.name
        );
        htmlContent = '';
      }
    } else if (article.body) {
      htmlContent = article.body;
    }

    const domain = article.property?.domain || process.env.SITE || 'https://example.com';
    const post_id = article.wpId || article._id?.toString() || '';
    const itemUrl = article.slug
      ? `${domain}/${article.fullSlug || article.slug}`
      : `${domain}/?p=${post_id}`;

    return {
      post_id: post_id,
      post_title: article.title || '',
      excerpt: stripHtml(article.excerpt),
      post_url: itemUrl,
      url: itemUrl,
      post_format: article.type || 'standard',
      video_url: article?.featuredVideo?.url || '',
      audio_url: '',
      video_time: article.featuredVideo?.duration || '',
      published_by: article.authors[0]?.name,
      post_categories: (article.categories || []).map((cat: any) => ({
        name: cat.title || '',
        id: cat.wpCategoryId || cat.id || cat._id || '',
        slug: cat.slug || '',
      })),
      post_tags: (article.tags || []).map((tag: any) => ({
        name: tag.name || tag.title || '',
        id: tag.wpTagId || tag.id || tag._id || '',
        slug: tag.slug || '',
      })),
      posted_on: article.publishedAt
        ? new Date(article.publishedAt).toISOString().split('T')[0]
        : article.createdAt
          ? new Date(article.createdAt).toISOString().split('T')[0]
          : '',
      post_author: article.authors?.[0]
        ? {
          name: article.authors[0].name || '',
          id: article.authors[0].id || article.authors[0]._id || '',
          username: article.authors[0].username || article.authors[0].name || '',
        }
        : { name: '', id: '', username: '' },
      post_content: _embed ? article.htmlContent : '',
      post_image: article.featuredMedia ? this._toCdnUrl(article.featuredMedia) : '',
      image: article.featuredMedia ? this._toCdnUrl(article.featuredMedia) : '',
      live_content: [],
      publish_date: article.publishedAt || article.createdAt || '',
      modified_date: article.updatedAt || '',
      post_status: article.status || 'draft',
      seo_meta: {
        rank_math_title: article.metaTitle || article.seo?.title || article.title || '',
        rank_math_description:
          article.metaDescription || article.seo?.description || article.excerpt || '',
        rank_math_focus_keyword: article.keyword || (article.seo?.tags || []).join(', ') || '',
        rank_math_seo_score: '',
        liveblog: '',
        youtube_video_id: article.seo?.youtube_video_id || '',
        youtube_channel: article.seo?.youtube_channel || '',
        youtube_published_at: article.seo?.youtube_published_at || '',
        youtube_watch_url: article.seo?.youtube_watch_url || '',
        youtube_duration: article.seo?.youtube_duration || '',
        youtube_video_type: article.seo?.youtube_video_type || '',
        youtube_duration_seconds: article.seo?.youtube_duration_seconds || '',
        featured_video: article.seo?.featured_video || '',
        pk_published_by: article.seo?.pk_published_by || '',
        pk_video_time: article.seo?.pk_video_time || '',
        td_post_video: article.seo?.td_post_video || '',
        td_gallery: article.seo?.td_gallery || '',
        td_post_audio: article.seo?.td_post_audio || '',
        td_post_image: article.seo?.td_post_image || '',
        td_post_gallery: article.seo?.td_post_gallery || '',
      },
      recipeData: article.recipeData,
      movieReviewData: article.movieReviewData,
    };
  }

  /**
   * Maps article to WordPress API format
   * Matches the format from the provided example with post_id, title, excerpt, url, image, publish_date, modified_date
   * @param article The article to map
   * @returns Mapped article in WordPress API format
   */
  private _toCdnUrl(media: { path?: string; url?: string }): string {
    const cdnBase = (process.env.CDN_URL || '').replace(/\/$/, '');
    if (media.url && media.url.indexOf('/uploads') === -1) return media.url;
    if (media.path) return `${cdnBase}/${media.path.replace(/^\//, '')}`;
    if (!media.url) return '';
    const idx = media.url.indexOf('/uploads');
    return `${cdnBase}${media.url.slice(idx)}`;
  }

  mapArticleToWpApiFormat(article: any): any {
    return {
      post_id: article.wpPostId || article._id,
      title: article.title || '',
      excerpt: stripHtml(article.excerpt),
      url: article.slug ? `'${process.env.SITE || "https://example.com"}/${article.slug}` : '',
      image: article.featuredMedia ? this._toCdnUrl(article.featuredMedia) : '',
      publish_date: article.publishedAt || article.createdAt,
      modified_date: article.updatedAt,
      recipeData: article.recipeData,
      movieReviewData: article.movieReviewData,
    };
  }

  /**
   * Maps article to WordPress REST API v2 format
   * Used by the /articles/posts endpoint
   * Returns data matching the standard WordPress REST API structure
   * @param article The article to map
   * @returns Mapped article in WordPress REST API v2 format
   */
  mapArticleToWordPressRestApiFormat(article: any): any {
    // Convert rich blocks to HTML
    let htmlContent = '';
    if (article.richBlocks && Array.isArray(article.richBlocks)) {
      try {
        htmlContent = convertBlocksToHTML(article.richBlocks);
      } catch (error) {
        this._logger.error(
          `Error converting blocks to HTML for article ${article._id}:`,
          JSON.stringify(error, Object.getOwnPropertyNames(error)),
          this.constructor.name
        );
        htmlContent = '';
      }
    }

    // Format dates
    const publishedDate = article.publishedAt || article.createdAt;
    const modifiedDate = article.updatedAt || article.createdAt;

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

    // Build article URL
    const articleUrl = article.slug
      ? `'${process.env.SITE || "https://example.com"}/${article.slug}`
      : `'${process.env.SITE || "https://example.com"}/?p=${article.wpPostId || article._id}`;

    return {
      id: article.wpPostId || parseInt(article._id, 36) || Math.floor(Math.random() * 10000000),
      date: formatDateLocal(publishedDate),
      date_gmt: formatDateGMT(publishedDate),
      guid: {
        rendered: articleUrl,
      },
      modified: formatDateLocal(modifiedDate),
      modified_gmt: formatDateGMT(modifiedDate),
      slug: article.slug || '',
      status: article.status === 'published' ? 'publish' : article.status || 'publish',
      type: article.type || 'post',
      link: articleUrl,
      title: {
        rendered: article.title || '',
      },
      content: {
        rendered: htmlContent,
        protected: false,
      },
      excerpt: {
        rendered: article.excerpt ? `<p>${article.excerpt}</p>\n` : '',
        protected: false,
      },
      author: article.authors?.[0]?.wpAuthorId || article.authors?.[0]?.id || 1,
      featured_media: article.featured_media || article.featuredMedia?.id || 0,
      comment_status: 'closed',
      ping_status: 'closed',
      sticky: false,
      template: '',
      format: 'standard',
      meta: {
        _stopmodifiedupdate: false,
        _modified_date: '',
        footnotes: '',
      },
      categories:
        article.wpCategoryIds || article.categories?.map((cat: any) => cat.id || cat) || [],
      tags: article.wpTagIds || article.tags?.map((tag: any) => tag.id || tag) || [],
      amp_enabled: true,
      _links: {
        self: [
          {
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/posts/${article.wpPostId || article._id}`,
          },
        ],
        collection: [
          {
            href: ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/posts',
          },
        ],
        about: [
          {
            href: ''${process.env.SITE || "https://example.com"}/wp-json/wp/v2/types/post',
          },
        ],
        author: [
          {
            embeddable: true,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/users/${article.authors?.[0]?.wpAuthorId || article.authors?.[0]?.id || 1}`,
          },
        ],
        replies: [
          {
            embeddable: true,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/comments?post=${article.wpPostId || article._id}`,
          },
        ],
        'version-history': [
          {
            count: 0,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/posts/${article.wpPostId || article._id}/revisions`,
          },
        ],
        'wp:featuredmedia': [
          {
            embeddable: true,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/media/${article.featured_media || article.featuredMedia?.id || 0}`,
          },
        ],
        'wp:attachment': [
          {
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/media?parent=${article.wpPostId || article._id}`,
          },
        ],
        'wp:term': [
          {
            taxonomy: 'category',
            embeddable: true,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/categories?post=${article.wpPostId || article._id}`,
          },
          {
            taxonomy: 'post_tag',
            embeddable: true,
            href: `'${process.env.SITE || "https://example.com"}/wp-json/wp/v2/tags?post=${article.wpPostId || article._id}`,
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
      recipeData: article.recipeData,
      movieReviewData: article.movieReviewData,
    };
  }

  /**
   * Retrieves the `header` field for an article identified by its URL.
   * Searches Elasticsearch first by slug; falls back to MongoDB if not found or header is missing.
   * @param url Full URL e.g. '${process.env.SITE || "https://example.com"}/some-article-slug
   * @returns The header string or null if not set
   */
  async rankmathGetHead(url: string): Promise<string | null> {
    if (url === ''${process.env.SITE || "https://example.com"}/' || url === process.env.SITE || 'https://example.com') {
      return DEFAULT_HEADER;
    }
    const parsedUrl = new URL(url);
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const slug = pathSegments[pathSegments.length - 1];

    if (!slug) {
      throw new BadRequestException('Could not extract slug from URL');
    }

    this._logger.log(
      `[Articles.rankmathGetHead] Fetching header for slug: ${slug}`,
      this.constructor.name
    );

    const decodeUnicode = (str: string): string =>
      str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Try Elasticsearch first
    try {
      const esSlug = await this._elasticService.findOneByFieldKeyword(
        ModuleName.SLUG,
        'slug',
        slug
      );
      const type = esSlug.type;

      if (type === ModuleName.ARTICLE) {
        const esArticle = await this._elasticService.findOneByField(
          ModuleName.ARTICLE,
          'slug',
          slug
        );
        if (esArticle?.header) {
          return decodeUnicode(esArticle.header);
        }
      } else if (type === ModuleName.USER) {
        const esUser = await this._elasticService.findOneByField(ModuleName.USER, 'slug', slug);
        if (esUser?.header) {
          return esUser.header;
        }
      } else if (type === ModuleName.CATEGORY) {
        const esCategory = await this._elasticService.findOneByField(
          ModuleName.CATEGORY,
          'slug',
          slug
        );
        if (esCategory?.header) {
          return esCategory.header;
        }
      }
    } catch (error) {
      this._logger.warn(
        `[Articles.rankmathGetHead] Elasticsearch query failed, falling back to MongoDB: ${error.message}`,
        this.constructor.name
      );
    }

    // Fall back to MongoDB with dynamic type-based routing
    const { content, moduleType } = await this._slugService.getContentBySlug(slug);

    if (!content?.header) {
      return null;
    }

    if (moduleType === ModuleName.ARTICLE) {
      return decodeUnicode(content.header);
    } else if (moduleType === ModuleName.USER) {
      return content.header;
    } else if (moduleType === ModuleName.CATEGORY) {
      return content.header;
    }

    return null;
  }
}
