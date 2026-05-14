import {
  Controller,
  Get,
  Param,
  Query,
  Sse,
  MessageEvent,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Version,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SkipThrottle } from '@nestjs/throttler';
import { ArticlesService } from './articles.service';
import { SectionService } from 'src/section/section.service';
import { CategoryService } from 'src/category/category.service';
import { LiveBlogSseService } from './live-blog-sse.service';
import { Public } from 'src/auth/common/decorators';
import { QueryArticleDto } from './dto/query-artilce.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { RedisService } from 'src/utilities/redis/redis.service';

const CACHE_TTL_FILTER = parseInt('900', 10);
const CACHE_TTL_BLOG = parseInt('900', 10);

const stableStringify = (obj: Record<string, any>): string => {
  const keys = Object.keys(obj || {}).sort();
  const sorted: Record<string, any> = {};
  for (const k of keys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
};

@SkipThrottle()
@Controller()
export class WpCompatibleController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly sectionService: SectionService,
    private readonly categoryService: CategoryService,
    private readonly _liveBlogSseService: LiveBlogSseService,
    private readonly _redisService: RedisService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

  @Public()
  @Sse('articles/:slug/live-stream')
  liveBlogStream(@Param('slug') slug: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let unsubscribe: (() => void) | null = null;

      subscriber.next({ data: { type: 'connected', slug } });

      this._liveBlogSseService
        .subscribe(slug, (message: string) => {
          try {
            subscriber.next({
              data: JSON.parse(message),
              type: 'live-update',
              id: String(Date.now()),
            });
          } catch {
            subscriber.next({ data: { raw: message }, type: 'live-update' });
          }
        })
        .then((unsub) => { unsubscribe = unsub; })
        .catch((err) => { subscriber.error(err); });

      return () => { if (unsubscribe) unsubscribe(); };
    });
  }

  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    } else if (error.name === 'ValidationError') {
      throw new BadRequestException(error.message);
    } else {
      // Security: Don't expose internal error details to clients
      throw new InternalServerErrorException(defaultMessage);
    }
  }

  /**
   * WordPress-compatible filter endpoint
   * Maps WordPress query params to internal format and returns articles
   */
  @Public()
  @Version('2')
  @Get('filter')
  async filterArticles(@Query() wpParams: any): Promise<any> {
    const start = Date.now();
    // const cacheKey = `wp:filter:v2:${stableStringify(wpParams || {})}`;

    const writeCache = (payload: any): Promise<any> => {
      // try {
      //   await this._redisService.setWithTTL(cacheKey, payload, 'EX', CACHE_TTL_FILTER);
      // } catch (err) {
      //   this._logger.warn(`filterArticles cache set failed: ${err.message}`);
      // }
      return payload;
    };

    // try {
    //   const cached = await this._redisService.get(cacheKey);
    //   if (cached) {
    //     return cached;
    //   }
    // } catch (err) {
    //   this._logger.warn(`filterArticles cache get failed: ${err.message}`);
    // }

    try {
      // If section is provided, fetch curated articles directly (Simpler approach)
      if (wpParams.section) {
        const t1 = Date.now();
        const section = await this.sectionService.findOneFromElastic('slug', wpParams.section);
        const sectionMs = Date.now() - t1;
        if (sectionMs > 100) {
          this._logger.log(
            `filterArticles: section lookup slow (${sectionMs}ms), query: slug="${wpParams.section}"`
          );
        }

        if (!section) {
          throw new NotFoundException(`Section "${wpParams.section}" not found`);
        }

        if (section.contentPriority && section.contentPriority.length > 0) {
          const ids = section.contentPriority
            .filter((item) => item.id)
            .sort((a, b) => (a.contentRank ?? 0) - (b.contentRank ?? 0))
            .map((item) => item.id);

          const t2 = Date.now();
          const articles = await this.articlesService.findByIds(ids);
          const findByIdsMs = Date.now() - t2;
          if (findByIdsMs > 100) {
            this._logger.log(
              `filterArticles: findByIds slow (${findByIdsMs}ms), fetched ${articles.length}/${ids.length} articles`
            );
          }

          const t3 = Date.now();
          const mappedData = articles.map((article) =>
            this.articlesService.mapArticleToFilterFormat(article)
          );
          const mappingMs = Date.now() - t3;
          if (mappingMs > 100) {
            this._logger.log(
              `filterArticles: mapping slow (${mappingMs}ms) for ${mappedData.length} articles`
            );
          }

          return writeCache({
            Status: 'success',
            StatusCode: 200,
            StatusMessage: 'Articles',
            Data: mappedData,
            total: mappedData.length,
          });
        }
      }

      // Map WordPress params to internal QueryArticleDto
      const query: Partial<QueryArticleDto> = {
        page: wpParams.page_number ? parseInt(wpParams.page_number) : 1,
        limit: wpParams.limit ? parseInt(wpParams.limit) : 10,
        lastSortValues: wpParams.last_sort_values,
        sort: wpParams.orderby === 'date' ? 'createdAt' : wpParams.orderby,
        sortOrder: wpParams.order || 'desc',
        fields:
          'richBlocks,body,property,wpId,slug,fullSlug,title,excerpt,type,seo,categories,tags,publishedAt,createdAt,updatedAt,authors,featuredMedia,featuredVideo,status,metaTitle,metaDescription,keyword,recipeData,movieReviewData',
      };

      // Handle webstory filter
      if (wpParams.webstory === 'true' || wpParams.webstory === true) {
        query.type = 'webstory';
      }

      // Handle tag_slug filter → maps to tags (service will route to tags.slug)
      if (wpParams.tag_slug) {
        query['tags.slug'] = wpParams.tag_slug;
      }

      // Handle author_slug filter → maps to authors.slug (service injects as nested match_phrase)
      if (wpParams.author_slug) {
        query['authors.slug'] = wpParams.author_slug;
      }

      // Handle category filter (supports both category_slug and category params)
      if (wpParams.category_slug || wpParams.category) {
        const categoryValue = wpParams.category_slug || wpParams.category;
        // If it looks like a MongoDB ID (24-char hex), treat as ID, otherwise treat as slug
        if (/^[0-9a-fA-F]{24}$/.test(categoryValue)) {
          query['primaryCategory.id'] = categoryValue;
        } else {
          // Fetch all descendant categories to support hierarchical filtering
          const descendantSlugs = await this.categoryService.findAllDescendantSlugs(categoryValue);
          if (descendantSlugs.length > 1) {
            query['$or'] = descendantSlugs.flatMap((slug) => [
              { 'primaryCategory.slug': slug },
              { 'categories.slug': slug },
            ]);
          } else {
            query['primaryCategory.slug'] = categoryValue;
          }
        }
      }

      // Handle status filter
      if (wpParams.status) {
        query.status = wpParams.status === 'publish' ? 'published' : wpParams.status;
      }

      // Handle search filter
      if (wpParams.search) {
        query['searchTerm'] = wpParams.search;
      }

      if (wpParams.post_format) {
        let formats: string[] = [];
        if (Array.isArray(wpParams.post_format)) {
          formats = wpParams.post_format;
        } else if (
          typeof wpParams.post_format === 'string' &&
          wpParams.post_format.startsWith('[')
        ) {
          try {
            formats = JSON.parse(wpParams.post_format);
          } catch {
            formats = [wpParams.post_format];
          }
        } else {
          formats = [wpParams.post_format];
        }
        if (formats.includes('post-format-video')) {
          query['type'] = 'video';
        }
        if (formats.includes('shorts')) {
          query['type'] = 'shorts';
        }
      }
      // Apply 30-day range filter on page 1 only, and only when no specific content filters are present
      const hasContentFilter =
        wpParams.category_slug ||
        wpParams.category ||
        wpParams.tag_slug ||
        wpParams.author_slug ||
        wpParams.search ||
        wpParams.webstory;
      const isRangeFilter =
        (!wpParams.page_number || parseInt(wpParams.page_number) <= 1) && !hasContentFilter;

      // Fetch articles from Elasticsearch
      const t1 = Date.now();
      if (query.lastSortValues) {
        this._logger.log(`[Pagination-Debug] filterArticles: Using cursor-based pagination. lastSortValues: ${query.lastSortValues}`);
      } else {
        this._logger.log(`[Pagination-Debug] filterArticles: Using offset-based pagination. Page: ${query.page || 1}`);
      }
      const result = await this.articlesService.findAllFromElastic(
        query as QueryArticleDto,
        { organizationId: '', sub: '', email: '', name: '' } as any,
        isRangeFilter ? [{ range: { createdAt: { gte: 'now-30d' } } }] : undefined
      );

      const elasticMs = Date.now() - t1;
      if (elasticMs > 100) {
        this._logger.log(
          `filterArticles: Elasticsearch slow (${elasticMs}ms), returned ${result.data.length} articles`
        );
      }

      // Map articles to WordPress format using service method
      const t2 = Date.now();
      const mappedData = result.data.map((article: any) =>
        this.articlesService.mapArticleToFilterFormat(article, wpParams._embed)
      );
      const mappingMs = Date.now() - t2;
      if (mappingMs > 100) {
        this._logger.log(
          `filterArticles: mapping slow (${mappingMs}ms) for ${mappedData.length} articles`
        );
      }

      return writeCache({
        Status: 'success',
        StatusCode: 200,
        StatusMessage: 'Articles',
        Data: mappedData,
        total: typeof result.total === 'number' ? result.total : result.total.value,
        last_sort_values: result.lastSortValues,
        last_id: result.lastId,
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        return {
          Status: 'error',
          StatusCode: error instanceof NotFoundException ? 404 : 400,
          StatusMessage: error.message,
          Data: [],
        };
      }
      this._handleError(error, 'Failed to fetch articles');
    } finally {
      const totalMs = Date.now() - start;
      if (totalMs > 100) {
        this._logger.log(`filterArticles completed in ${totalMs}ms`);
      }
    }
  }

  /**
   * WordPress-compatible endpoint to get a single blog post by slug
   * Returns article in WordPress format
   * From Elasticsearch
   */
  @Public()
  @Version('2')
  @Get('getblogbyslug')
  async getBlogBySlugV2(
    @Query('slug') slug: string,
    @Query('live_page') livePage?: string,
    @Query('live_limit') liveLimit?: string
  ): Promise<any> {
    const start = Date.now();
    // const cacheKey = `wp:blog:v2:${slug || ''}:${livePage || ''}:${liveLimit || ''}`;
    // if (slug) {
    //   try {
    //     const cached = await this._redisService.get(cacheKey);
    //     if (cached) {
    //       console.log('cache get');
    //       this._logger.log(`getBlogBySlugV2 cache HIT (${Date.now() - start}ms) key=${cacheKey}`);
    //       return cached;
    //     }
    //   } catch (err) {
    //     console.log('cache get failed');
    //     this._logger.warn(`getBlogBySlugV2 cache get failed: ${err.message}`);
    //   }
    // }

    try {
      if (!slug) {
        throw new BadRequestException('Slug parameter is required');
      }
      // Service returns already-mapped WordPress format data
      const mappedData = await this.articlesService.findOneBySlugFromElastic(
        slug,
        livePage,
        liveLimit
      );

      const response = {
        Status: 'success',
        StatusCode: 200,
        StatusMessage: 'Post Details',
        Data: [mappedData],
      };

      // try {
      //   await this._redisService.setWithTTL(cacheKey, response, 'EX', CACHE_TTL_BLOG);
      // } catch (err) {
      //   this._logger.warn(`getBlogBySlugV2 cache set failed: ${err.message}`);
      // }

      return response;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        return {
          Status: 'error',
          StatusCode: error instanceof NotFoundException ? 404 : 400,
          StatusMessage: error.message,
          Data: [],
        };
      }
      this._handleError(error, 'Failed to fetch blog by slug');
    } finally {
      this._logger.log(`getBlogBySlugV2 completed in ${Date.now() - start}ms`);
    }
  }

  /**
   * WordPress-compatible endpoint to get a single blog post by slug
   * Returns article in WordPress format with live blog support
   * From MongoDb
   */
  @Public()
  @Get('getblogbyslug')
  async getBlogBySlug(
    @Query('slug') slug: string,
    @Query('live_page') livePage?: string,
    @Query('live_limit') liveLimit?: string
  ): Promise<any> {
    const start = Date.now();
    try {
      if (!slug) {
        throw new BadRequestException('Slug parameter is required');
      }

      // Service returns already-mapped WordPress format data
      const mappedData = await this.articlesService.findOneBySlug(slug, livePage, liveLimit);

      return {
        Status: 'success',
        StatusCode: 200,
        StatusMessage: 'Post Details (MongoDB)',
        Data: [mappedData],
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        return {
          Status: 'error',
          StatusCode: error instanceof NotFoundException ? 404 : 400,
          StatusMessage: error.message,
          Data: [],
        };
      }
      this._handleError(error, 'Failed to fetch blog by slug from MongoDB');
    } finally {
      this._logger.log(`getBlogBySlug completed in ${Date.now() - start}ms`);
    }
  }

  /**
   * WordPress-compatible endpoint to get blogs by category
   * Filters by primaryCategory.id
   * From ElasticSearch
   */
  @Public()
  @Version('2')
  @Get('getblogbycategory')
  async getBlogByCategoryV2(@Query() wpParams: any): Promise<any> {
    const start = Date.now();
    try {
      // Map WordPress params to internal QueryArticleDto
      const query: Partial<QueryArticleDto> = {
        page: wpParams.page_number ? parseInt(wpParams.page_number) : 1,
        limit: wpParams.limit ? parseInt(wpParams.limit) : 10,
        lastSortValues: wpParams.last_sort_values,
        sort: wpParams.orderby === 'date' ? 'createdAt' : wpParams.orderby,
        sortOrder: wpParams.order || 'desc',
      };

      // Map category to primaryCategory.id or primaryCategory.wpCategoryId
      if (wpParams.category) {
        query['$or'] = [
          { 'primaryCategory.id': wpParams.category },
          { 'primaryCategory.wpCategoryId': wpParams.category },
        ];
      }

      // Fetch articles from Elasticsearch
      if (query.lastSortValues) {
        this._logger.log(`[Pagination-Debug] getBlogByCategoryV2: Using cursor-based pagination. lastSortValues: ${query.lastSortValues}`);
      } else {
        this._logger.log(`[Pagination-Debug] getBlogByCategoryV2: Using offset-based pagination. Page: ${query.page || 1}`);
      }
      const result = await this.articlesService.findAllFromElastic(
        query as QueryArticleDto,
        { organizationId: '', sub: '', email: '', name: '' } as any,
        undefined
      );

      // Map articles to WordPress format using service (without content)
      const mappedData = result.data.map((article: any) =>
        this.articlesService.mapArticleToPostByIdFormat(article, false)
      );
      console.log('mappedData.post_image', mappedData[0].post_image);
      return {
        Status: 'success',
        StatusCode: 200,
        StatusMessage: 'Post By Category',
        Data: mappedData,
        total: typeof result.total === 'number' ? result.total : result.total.value,
        last_sort_values: result.lastSortValues,
        last_id: result.lastId,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          Status: 'error',
          StatusCode: 404,
          StatusMessage: error.message,
          Data: [],
        };
      }
      this._handleError(error, 'Failed to fetch blogs by category');
    } finally {
      this._logger.log(`getBlogByCategoryV2 completed in ${Date.now() - start}ms`);
    }
  }

  /**
   * WordPress-compatible endpoint to get blogs by category
   * Filters by primaryCategory.id and fetches from MongoDB
   */
  @Public()
  @Get('getblogbycategory')
  async getBlogByCategory(@Query() wpParams: any): Promise<any> {
    const start = Date.now();
    try {
      // Map WordPress params to internal QueryArticleDto
      const query: Partial<QueryArticleDto> = {
        page: wpParams.page_number ? parseInt(wpParams.page_number) : 1,
        limit: wpParams.limit ? parseInt(wpParams.limit) : 10,
        sort: wpParams.orderby === 'date' ? 'createdAt' : wpParams.orderby,
        sortOrder: wpParams.order || 'desc',
      };

      // Map category to primaryCategory.id or primaryCategory.wpCategoryId
      if (wpParams.category) {
        query['$or'] = [
          { 'primaryCategory.id': wpParams.category },
          { 'primaryCategory.wpCategoryId': wpParams.category },
        ];
      }

      // Fetch articles from MongoDB
      const result = await this.articlesService.findAll(
        query as QueryArticleDto,
        { organizationId: '', sub: '', email: '', name: '' } as any
      );

      // Map articles to WordPress format using service (without content)
      const mappedData = result.data.map((article: any) =>
        this.articlesService.mapArticleToPostByIdFormat(article, false)
      );

      return {
        Status: 'success',
        StatusCode: 200,
        StatusMessage: 'Post By Category (MongoDB)',
        Data: mappedData,
        total: result.total,
      };
    } catch (error) {
      this._handleError(error, 'Failed to fetch blogs by category from MongoDB');
    } finally {
      this._logger.log(`getBlogByCategory completed in ${Date.now() - start}ms`);
    }
  }

  /**
   * WordPress-compatible endpoint to get blog by ID
   * Fetches article by wpPostId or _id
   * From ElasticSearch
   */
  @Public()
  @Get('getblogbyid')
  @Version('2')
  async getBlogByIdV2(@Query('post_id') postId: string): Promise<any> {
    const start = Date.now();
    try {
      if (!postId) {
        throw new BadRequestException('post_id parameter is required');
      }

      let article: any;

      // Check if it's a numeric ID (wpPostId) or MongoDB ObjectId
      if (/^\d+$/.test(postId)) {
        // Numeric - search by wpPostId using ElasticService directly
        const ElasticService = this.articlesService['_elasticService'];
        article = await ElasticService.findOneByField('article', 'wpPostId', postId);
      } else {
        // MongoDB ObjectId - fetch directly by document ID
        const ElasticService = this.articlesService['_elasticService'];
        try {
          const response = await ElasticService['_elasticsearchService'].get({
            index: 'article',
            id: postId,
          });
          article = {
            _id: response._id,
            ...(response._source as any),
          };
        } catch (error) {
          if (error.meta?.statusCode === 404) {
            article = null;
          } else {
            throw error;
          }
        }
      }

      if (!article) {
        return {
          Status: 'error',
          StatusCode: 404,
          StatusMessage: 'Post not found',
          Data: [],
        };
      }

      // Map to WordPress format using service method
      const mappedData = this.articlesService.mapArticleToPostByIdFormat(article);

      return {
        Status: 'success',
        StatusCode: 200,
        StatusMessage: 'Post By ID',
        Data: [mappedData],
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        return {
          Status: 'error',
          StatusCode: 400,
          StatusMessage: error.message,
          Data: [],
        };
      }
      this._handleError(error, 'Failed to fetch blog by ID');
    } finally {
      this._logger.log(`getBlogByIdV2 completed in ${Date.now() - start}ms`);
    }
  }

  /**
   * WordPress-compatible endpoint to get blog by MongoDB ID
   * Fetches article from MongoDB by _id only
   */
  @Public()
  @Get('getblogbyid')
  async getBlogById(@Query('post_id') postId: string): Promise<any> {
    const start = Date.now();
    try {
      if (!postId) {
        throw new BadRequestException('post_id parameter is required');
      }

      // Fetch article from MongoDB using existing findOne method
      const article: any = await this.articlesService.findOne(postId, null as any);

      // Map to WordPress format using service method
      const mappedData = this.articlesService.mapArticleToPostByIdFormat(article);

      return {
        Status: 'success',
        StatusCode: 200,
        StatusMessage: 'Post By ID (MongoDB)',
        Data: [mappedData],
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        return {
          Status: 'error',
          StatusCode: error instanceof NotFoundException ? 404 : 400,
          StatusMessage: error.message,
          Data: [],
        };
      }
      this._handleError(error, 'Failed to fetch blog by ID from MongoDB');
    } finally {
      this._logger.log(`getBlogById completed in ${Date.now() - start}ms`);
    }
  }

  /**
   * WordPress API endpoint - GET /articles/wp-json/api/v1/getnewsnap
   * Returns articles in WordPress API format matching the provided example
   * Query params: token (required), limit (optional, default: 20)
   * @Public - No authentication required
   */
  @Public()
  @Version('2')
  @Get('getnewsnap')
  async getNewsnapWpApi(@Query() wpParams: any): Promise<any> {
    const start = Date.now();
    try {
      // Map WordPress params to internal QueryArticleDto
      const query: Partial<QueryArticleDto> = {
        page: 1,
        limit: wpParams.limit ? parseInt(wpParams.limit) : 20,
        sort: 'createdAt',
        sortOrder: 'desc',
        fields: 'wpPostId,title,excerpt,slug,featuredMedia,featuredVideo,publishedAt,createdAt,updatedAt',
      };

      // Fetch articles from Elasticsearch
      const t1 = Date.now();
      const result = await this.articlesService.findAllFromElastic(
        query as QueryArticleDto,
        { organizationId: '', sub: '', email: '', name: '' } as any,
        [{ range: { createdAt: { gte: 'now-30d' } } }]
      );
      const elasticMs = Date.now() - t1;
      if (elasticMs > 100) {
        this._logger.log(
          `getNewsnapWpApi: Elasticsearch slow (${elasticMs}ms), returned ${result.data.length} articles`
        );
      }

      // Map articles to WordPress API format
      const t2 = Date.now();
      const mappedData = result.data.map((article: any) =>
        this.articlesService.mapArticleToWpApiFormat(article)
      );
      console.log('mappedData.image newssnap', mappedData[0].image);
      const mappingMs = Date.now() - t2;
      if (mappingMs > 100) {
        this._logger.log(
          `getNewsnapWpApi: mapping slow (${mappingMs}ms) for ${mappedData.length} articles`
        );
      }

      return {
        Status: true,
        StatusCode: 200,
        StatusMessage: '',
        Data: mappedData,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          Status: false,
          StatusCode: 404,
          StatusMessage: error.message,
          Data: [],
        };
      }
      this._handleError(error, 'Failed to fetch articles for WordPress API');
    } finally {
      const totalMs = Date.now() - start;
      if (totalMs > 100) {
        this._logger.log(`getNewsnapWpApi completed in ${totalMs}ms`);
      }
    }
  }

  /**
   * WordPress REST API v2 compatible endpoint
   * GET /articles/posts
   * Returns articles in standard WordPress REST API format
   * @Public - No authentication required
   */
  @Public()
  @Get('posts')
  async getPosts(@Query() wpParams: any): Promise<any> {
    const start = Date.now();
    try {
      // Map WordPress params to internal QueryArticleDto
      const query: Partial<QueryArticleDto> = {
        page: wpParams.page ? parseInt(wpParams.page) : 1,
        limit: wpParams.per_page ? parseInt(wpParams.per_page) : 10,
        sort: wpParams.orderby === 'date' ? 'createdAt' : wpParams.orderby || 'createdAt',
        sortOrder: wpParams.order || 'desc',
      };

      // Handle status filter
      if (wpParams.status) {
        query.status = wpParams.status === 'publish' ? 'published' : wpParams.status;
      }

      // Handle category filter
      if (wpParams.categories) {
        query['wpCategoryIds'] = wpParams.categories;
      }

      // Handle tag filter
      if (wpParams.tags) {
        query['wpTagIds'] = wpParams.tags;
      }

      // Handle author filter
      if (wpParams.author) {
        query['authors.wpAuthorId'] = wpParams.author;
      }

      // Handle search query (use title search)
      if (wpParams.search) {
        query.title = wpParams.search;
      }

      // Fetch articles from Elasticsearch
      const result = await this.articlesService.findAllFromElastic(
        query as QueryArticleDto,
        { organizationId: '', sub: '', email: '', name: '' } as any,
        undefined
      );

      // Map articles to WordPress REST API v2 format
      const mappedData = result.data.map((article: any) =>
        this.articlesService.mapArticleToWordPressRestApiFormat(article)
      );

      // Return as array (WordPress REST API returns array directly)
      return mappedData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this._handleError(error, 'Failed to fetch posts');
    } finally {
      this._logger.log(`getPosts completed in ${Date.now() - start}ms`);
    }
  }
}
