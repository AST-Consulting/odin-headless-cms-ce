import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

import { MigratorProvider, MigrationResult } from '../migrator-provider.interface';
import { RICH_BLOCKS_QUEUE } from '../processors/rich-blocks.processor';
import { TCurrentUserType } from '@auth/types/user.type';
import { Tag, TTagDocument } from '@tags/entities/tags.schema';
import { Category, TCategoryDocument } from '../../category/entities/category.schema';
import { Article, TArticleDocument } from '@articles/schemas/article.schema';
import { CategoryService } from '../../category/category.service';
import { TagsService } from '@tags/tags.service';
import { ArticlesService } from '@articles/articles.service';
import { RedisService } from '@utilities/redis/redis.service';
import { ModuleName, STATUS, UserType } from '@core/constants/enums.constants';
import { FileUploadService } from '@utilities/file-upload/fileUpload.service';
import { IFile } from '@utilities/file-upload/entities/file.interface';
import { FileUpload, TFileUploadDocument } from '@utilities/file-upload/entities/fileUpload.schema';
import { SlugService } from '@cms/slug/slug.service';
import { buildUserMetadata } from '@core/utils/utils';
import { buildSeoObject } from '@core/utils/seo.utils';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
import { ElasticService } from '@core/elastic/elastic.service';
import { MenuService } from '@cms/menu/menu.service';
import { Menu, TMenuDocument } from '@cms/menu/schema/menu.schema';
import { User, TUserDocument } from '@user/entities/user.schema';
import { Slug, TSlugDocument } from '@cms/slug/entities/slug.schema';
import { StaticPage, TStaticPageDocument } from '@cms/static-page/entities/static-page.schema';
import { MissingSlug, TMissingSlugDocument } from '../entities/missing-slug.schema';

@Injectable()
export class WordPressProvider implements MigratorProvider {
  private readonly logger: Logger;
  // Create HTTPS agent for direct axios calls (SSL validation enabled for security)
  private readonly httpsAgent = new https.Agent({
    rejectUnauthorized: true,
  });

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly winstonLogger: Logger,
    private readonly configService: ConfigService,
    @InjectModel(Tag.name) private readonly tagModel: Model<TTagDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<TCategoryDocument>,
    @InjectModel(Article.name) private readonly articleModel: Model<TArticleDocument>,
    private readonly categoryService: CategoryService,
    private readonly tagsService: TagsService,
    private readonly articlesService: ArticlesService,
    private readonly slugService: SlugService,
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly fileUploadService: FileUploadService,
    private readonly _organizationService: OrganizationService,
    private readonly _propertyService: PropertyService,
    @InjectQueue('create-user') private readonly createUserQueue: Queue,
    @InjectQueue(RICH_BLOCKS_QUEUE) private readonly richBlocksQueue: Queue,
    private readonly elasticService: ElasticService,
    private readonly menuService: MenuService,
    @InjectModel(Menu.name) private readonly menuModel: Model<TMenuDocument>,
    @InjectModel(User.name) private readonly userModel: Model<TUserDocument>,
    @InjectModel(Slug.name) private readonly slugModel: Model<TSlugDocument>,
    @InjectModel(FileUpload.name) private readonly fileUploadModel: Model<TFileUploadDocument>,
    @InjectModel(StaticPage.name) private readonly staticPageModel: Model<TStaticPageDocument>,
    @InjectModel(MissingSlug.name) private readonly missingSlugModel: Model<TMissingSlugDocument>
  ) {
    this.logger = new Logger(WordPressProvider.name);
  }

  async migrateTags(user: TCurrentUserType): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting tags migration', this.constructor.name);

    if (!user || !user.email || !user.sub || !user.organizationId) {
      this.logger.error('[WordPressProvider] Invalid user context');
      throw new Error('User authentication required.');
    }

    const propertyId = '6926b8f59a288ddf06a28884';
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpApiUrl = `${wpBaseUrl}/wp-json/wp/v2/tags`;

    if (!wpAdmin || !wpPassword) {
      this.logger.error('[WordPressProvider] WP_ADMIN or WP_PASSWORD not configured');
      throw new Error('WordPress credentials not configured');
    }

    const PAGE_CONCURRENCY = 5;
    const TAG_CONCURRENCY = 10;
    const perPage = 100;
    let created = 0;
    let total = 0;
    const errors = [];

    const axiosConfig = {
      headers: { Host: this.wpHost },
      auth: { username: wpAdmin, password: wpPassword },
      httpsAgent: this.httpsAgent,
    };

    const processTag = async (wpTag: any) => {
      try {
        const existingTag = await this.tagModel.findOne({ wpTagId: wpTag.id }).exec();
        if (existingTag) {
          return;
        }

        const tagDto: any = {
          name: wpTag.name,
          description: wpTag.description || '',
          propertyId: propertyId,
          rank: 0,
          count: wpTag.count,
          status: STATUS.ACTIVE,
          wpTagId: wpTag.id,
          slug: wpTag.slug,
        };

        await this.tagsService.create(tagDto, user);
        created++;
      } catch (error) {
        this.logger.error(
          `[WordPressProvider] Error processing tag ${wpTag.name}:`,
          { error: error.message, wpTagId: wpTag.id },
          this.constructor.name
        );
        errors.push({ name: wpTag.name, wpTagId: wpTag.id, error: error.message });
      }
    };

    const processPageBatch = async (pageBatch: number[]) => {
      const pages = await Promise.all(
        pageBatch.map((page) =>
          axios
            .get(wpApiUrl, { params: { per_page: perPage, page }, ...axiosConfig })
            .then((res) => res.data as any[])
        )
      );
      const tags = pages.flat();
      total += tags.length;

      for (let i = 0; i < tags.length; i += TAG_CONCURRENCY) {
        await Promise.all(tags.slice(i, i + TAG_CONCURRENCY).map(processTag));
      }

      return pageBatch;
    };

    try {
      // Step 1: Fetch first page to discover total page count
      const firstResponse = await axios.get(wpApiUrl, {
        params: { per_page: perPage, page: 1 },
        ...axiosConfig,
      });

      const totalPages = parseInt(firstResponse.headers['x-wp-totalpages'] || '1', 10);
      const totalTagCount = parseInt(firstResponse.headers['x-wp-total'] || '0', 10);

      this.logger.log(
        `[WordPressProvider] Found ${totalTagCount} tags across ${totalPages} pages`,
        this.constructor.name
      );

      // Process first page tags immediately
      const firstPageTags: any[] = firstResponse.data;
      total += firstPageTags.length;
      for (let i = 0; i < firstPageTags.length; i += TAG_CONCURRENCY) {
        await Promise.all(firstPageTags.slice(i, i + TAG_CONCURRENCY).map(processTag));
      }

      // Step 2: Stream remaining pages — fetch PAGE_CONCURRENCY pages, process immediately, discard
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

      for (let i = 0; i < remainingPages.length; i += PAGE_CONCURRENCY) {
        const batch = remainingPages.slice(i, i + PAGE_CONCURRENCY);
        await processPageBatch(batch);
        this.logger.log(
          `[WordPressProvider] Processed pages ${batch[0]}-${batch[batch.length - 1]} of ${totalPages} | created: ${created} errors: ${errors.length}`,
          this.constructor.name
        );
      }

      this.logger.log(
        `[WordPressProvider] Tags migration completed. Total: ${total}, Created: ${created}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return { success: true, created, total, errors };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Tags migration failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to sync WordPress tags: ${error.message}`);
    }
  }

  async migrateTagsAfter(user: TCurrentUserType, after: string): Promise<MigrationResult> {
    // NOTE: The WP REST API for tags does not support modified_after/date filtering.
    // Instead we use an ID-based incremental approach:
    //   • Fetch WP tags ordered by id DESC (newest first)
    //   • Stop as soon as we reach tags whose wpTagId is already in our DB
    this.logger.log(
      `[WordPressProvider] Starting incremental tags migration (since date hint: ${after})`,
      this.constructor.name
    );

    if (!user || !user.email || !user.sub || !user.organizationId) {
      this.logger.error('[WordPressProvider] Invalid user context');
      throw new Error('User authentication required.');
    }

    const propertyId = '6926b8f59a288ddf06a28884';
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpApiUrl = `${wpBaseUrl}/wp-json/wp/v2/tags`;

    if (!wpAdmin || !wpPassword) {
      this.logger.error('[WordPressProvider] WP_ADMIN or WP_PASSWORD not configured');
      throw new Error('WordPress credentials not configured');
    }

    // Find the highest wpTagId already stored — anything above this is new
    const lastStoredTag = await this.tagModel
      .findOne({})
      .sort({ wpTagId: -1 })
      .select('wpTagId')
      .lean()
      .exec();
    const maxKnownWpId: number = (lastStoredTag as any)?.wpTagId || 0;

    this.logger.log(
      `[WordPressProvider] Max known wpTagId in DB: ${maxKnownWpId}. Fetching newer tags from WP.`,
      this.constructor.name
    );

    const TAG_CONCURRENCY = 10;
    const perPage = 100;
    let created = 0;
    let total = 0;
    const errors = [];

    const axiosConfig = {
      headers: { Host: this.wpHost },
      auth: { username: wpAdmin, password: wpPassword },
      httpsAgent: this.httpsAgent,
    };

    let updated = 0;

    const processTag = async (wpTag: any) => {
      try {
        // Look up by slug so tags created by migrateArticlesV2 are matched
        const existingTag = await this.tagModel.findOne({ slug: wpTag.slug }).exec();
        if (existingTag) {
          // If found but missing wpTagId, update it
          if (!existingTag.wpTagId) {
            await this.tagModel.updateOne(
              { _id: existingTag._id },
              { $set: { wpTagId: wpTag.id } }
            );
            updated++;
            this.logger.log(
              `[WordPressProvider] Updated wpTagId for existing tag: ${wpTag.name} (slug: ${wpTag.slug}, wpTagId: ${wpTag.id})`,
              this.constructor.name
            );
          }
          return;
        }

        const tagDto: any = {
          name: wpTag.name,
          description: wpTag.description || '',
          propertyId: propertyId,
          rank: 0,
          count: wpTag.count,
          status: STATUS.ACTIVE,
          wpTagId: wpTag.id,
          slug: wpTag.slug,
        };

        await this.tagsService.create(tagDto, user);
        created++;
      } catch (error) {
        this.logger.error(
          `[WordPressProvider] Error processing tag ${wpTag.name}:`,
          { error: error.message, wpTagId: wpTag.id },
          this.constructor.name
        );
        errors.push({ name: wpTag.name, wpTagId: wpTag.id, error: error.message });
      }
    };

    try {
      let currentPage = 1;
      let done = false;

      while (!done) {
        const response = await axios.get(wpApiUrl, {
          params: { per_page: perPage, page: currentPage, orderby: 'id', order: 'desc' },
          ...axiosConfig,
        });

        const wpTags: any[] = response.data;
        if (!wpTags || wpTags.length === 0) break;

        total += wpTags.length;

        // Process all tags — match by slug to catch tags created without wpTagId
        for (let i = 0; i < wpTags.length; i += TAG_CONCURRENCY) {
          await Promise.all(wpTags.slice(i, i + TAG_CONCURRENCY).map(processTag));
        }

        this.logger.log(
          `[WordPressProvider] Page ${currentPage}: fetched ${wpTags.length} | created: ${created}, updated: ${updated}`,
          this.constructor.name
        );

        // If the smallest ID on this page is already below our known max, we're done
        const minIdOnPage = Math.min(...wpTags.map((t) => t.id));
        if (minIdOnPage <= maxKnownWpId || wpTags.length < perPage) {
          done = true;
        } else {
          currentPage++;
        }
      }

      this.logger.log(
        `[WordPressProvider] Incremental tags migration completed. Pages fetched: ${currentPage}, Total fetched: ${total}, Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return { success: true, created, updated, total, errors };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Incremental tags migration failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to sync WordPress tags: ${error.message}`);
    }
  }

  async migrateCategories(user: TCurrentUserType): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting categories migration', this.constructor.name);

    const propertyId = '6926b8f59a288ddf06a28884';
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpApiUrl = `${wpBaseUrl}/wp-json/wp/v2/categories`;

    if (!wpAdmin || !wpPassword) {
      this.logger.error('[WordPressProvider] WP_ADMIN or WP_PASSWORD not configured');
      throw new Error('WordPress credentials not configured');
    }

    // const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let created = 0;
    let total = 0;
    const errors = [];
    const perPage = 50;
    let currentPage = 1;
    let hasMore = true;

    try {
      while (hasMore) {
        this.logger.log(
          `[WordPressProvider] Fetching categories page ${currentPage}`,
          this.constructor.name
        );

        const response = await axios.get(wpApiUrl, {
          params: {
            per_page: perPage,
            page: currentPage,
          },
          headers: {
            Host: this.wpHost,
          },
          auth: {
            username: wpAdmin,
            password: wpPassword,
          },
          httpsAgent: this.httpsAgent,
        });

        const wpCategories = response.data;
        total += wpCategories.length;

        if (wpCategories.length === 0 || wpCategories.length < perPage) {
          hasMore = false;
        }

        for (const wpCategory of wpCategories) {
          try {
            const existingCategory = await this.categoryModel
              .findOne({ wpCategoryId: wpCategory.id })
              .exec();
            // if (existingCategory) {
            //   this.logger.log(
            //     `[WordPressProvider] Category with wpCategoryId ${wpCategory.id} already exists, skipping`,
            //     this.constructor.name
            //   );
            //   continue;
            // }
            // Fetch category detail from custom API for fullSlug, SEO, and header
            let fullSlug: string | undefined;
            let seoDto: any | undefined;
            let header: string | undefined;
            try {
              const wpApiToken = this.configService.get<string>('WP_TOKEN');
              const categoryDetailResponse = await axios.get(
                `${wpBaseUrl}/wp-json/api/v1/getcategorybyslug`,
                {
                  params: { token: wpApiToken, slug: wpCategory.slug },
                  headers: { Host: this.wpHost },
                  httpsAgent: this.httpsAgent,
                }
              );
              const categoryDetail = categoryDetailResponse.data?.Data;
              if (categoryDetail) {
                fullSlug = new URL(categoryDetail.url).pathname.replace(/^\/+/, '');
                const customMeta = categoryDetail.custom_meta;
                if (customMeta) {
                  seoDto = {
                    title: customMeta.rank_math_title || wpCategory.name,
                    metaDescription:
                      customMeta.rank_math_description || wpCategory.description || '',
                    keywords: customMeta.rank_math_focus_keyword
                      ? [customMeta.rank_math_focus_keyword]
                      : [],
                    og: {
                      title: customMeta.rank_math_title || wpCategory.name,
                      description: customMeta.rank_math_description || wpCategory.description || '',
                      url: categoryDetail.url || '',
                      image: '',
                    },
                  };
                }

                // Fetch header meta tags from RankMath API using the category URL
                try {
                  const rankMathApiUrl = `${wpBaseUrl}/wp-json/rankmath/v1/getHead?url=${encodeURIComponent(categoryDetail.url)}`;
                  const headerResponse = await firstValueFrom(
                    this.httpService.get(rankMathApiUrl, {
                      timeout: 15000,
                      headers: { Host: this.wpHost },
                    })
                  );
                  header = headerResponse.data?.head;
                } catch (err) {
                  this.logger.warn(
                    `[WordPressProvider] Could not fetch RankMath header for category slug ${wpCategory.slug}: ${err.message}`,
                    this.constructor.name
                  );
                }
              }
            } catch (err) {
              this.logger.warn(
                `[WordPressProvider] Could not fetch category detail for slug ${wpCategory.slug}: ${err.message}`,
                this.constructor.name
              );
            }

            // Use CategoryService.create() to create the category
            const categoryDto = {
              title: wpCategory.name,
              description: wpCategory.description || '',
              parentId: wpCategory.parent,
              propertyId: propertyId,
              status: STATUS.ACTIVE,
              isPublic: true,
              wpCategoryId: wpCategory.id,
              count: wpCategory.count,
              slug: wpCategory.slug,
              fullSlug,
              seo: seoDto,
            };
            if (!existingCategory) {
              await this.categoryService.create(categoryDto, user);
            } else {
              await this.categoryService.update(existingCategory._id.toString(), categoryDto, user);
            }

            if (header) {
              await this.categoryModel.updateOne(
                { wpCategoryId: wpCategory.id },
                { $set: { header } }
              );
            }

            created++;

            this.logger.log(
              `[WordPressProvider] Created category: ${wpCategory.name} with wpCategoryId: ${wpCategory.id}`,
              this.constructor.name
            );
          } catch (error) {
            this.logger.error(
              `[WordPressProvider] Error processing category ${wpCategory.name}:`,
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
          // await delay(2000);
        }
      }

      this.logger.log(
        `[WordPressProvider] Categories migration completed. Total: ${total}, Created: ${created}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return {
        success: true,
        created,
        total,
        errors,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Categories migration failed:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );
      throw new Error(`Failed to sync WordPress categories: ${error.message}`);
    }
  }

  async migrateCategoriesAfter(user: TCurrentUserType, after: string): Promise<MigrationResult> {
    // NOTE: The WP REST API for categories does not support modified_after/date filtering.
    // Instead we use an ID-based incremental approach:
    //   • Fetch WP categories ordered by id DESC (newest first)
    //   • Stop as soon as we reach categories whose wpCategoryId is already in our DB
    this.logger.log(
      `[WordPressProvider] Starting incremental categories migration (since date hint: ${after})`,
      this.constructor.name
    );

    const propertyId = '6926b8f59a288ddf06a28884';
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpApiUrl = `${wpBaseUrl}/wp-json/wp/v2/categories`;

    if (!wpAdmin || !wpPassword) {
      this.logger.error('[WordPressProvider] WP_ADMIN or WP_PASSWORD not configured');
      throw new Error('WordPress credentials not configured');
    }

    // Find the highest wpCategoryId already stored — anything above this is new
    const lastStoredCategory = await this.categoryModel
      .findOne({})
      .sort({ wpCategoryId: -1 })
      .select('wpCategoryId')
      .lean()
      .exec();
    const maxKnownWpId: number = (lastStoredCategory as any)?.wpCategoryId || 0;

    this.logger.log(
      `[WordPressProvider] Max known wpCategoryId in DB: ${maxKnownWpId}. Fetching newer categories from WP.`,
      this.constructor.name
    );

    let created = 0;
    let total = 0;
    const errors = [];
    const perPage = 50;
    let currentPage = 1;
    let done = false;

    try {
      while (!done) {
        this.logger.log(
          `[WordPressProvider] Fetching categories page ${currentPage} (orderby=id desc)`,
          this.constructor.name
        );

        const response = await axios.get(wpApiUrl, {
          params: { per_page: perPage, page: currentPage, orderby: 'id', order: 'desc' },
          headers: { Host: this.wpHost },
          auth: { username: wpAdmin, password: wpPassword },
          httpsAgent: this.httpsAgent,
        });

        const wpCategories: any[] = response.data;
        if (!wpCategories || wpCategories.length === 0) break;

        total += wpCategories.length;

        // Only process categories newer than our max known ID
        const newCategories = wpCategories.filter((c) => c.id > maxKnownWpId);

        for (const wpCategory of newCategories) {
          try {
            let fullSlug: string | undefined;
            let seoDto: any | undefined;
            let header: string | undefined;
            try {
              const wpApiToken = this.configService.get<string>('WP_TOKEN');
              const categoryDetailResponse = await axios.get(
                `${wpBaseUrl}/wp-json/api/v1/getcategorybyslug`,
                {
                  params: { token: wpApiToken, slug: wpCategory.slug },
                  headers: { Host: this.wpHost },
                  httpsAgent: this.httpsAgent,
                }
              );
              const categoryDetail = categoryDetailResponse.data?.Data;
              if (categoryDetail) {
                fullSlug = new URL(categoryDetail.url).pathname.replace(/^\/+/, '');
                const customMeta = categoryDetail.custom_meta;
                if (customMeta) {
                  seoDto = {
                    title: customMeta.rank_math_title || wpCategory.name,
                    metaDescription:
                      customMeta.rank_math_description || wpCategory.description || '',
                    keywords: customMeta.rank_math_focus_keyword
                      ? [customMeta.rank_math_focus_keyword]
                      : [],
                    og: {
                      title: customMeta.rank_math_title || wpCategory.name,
                      description: customMeta.rank_math_description || wpCategory.description || '',
                      url: categoryDetail.url || '',
                      image: '',
                    },
                  };
                }

                try {
                  const rankMathApiUrl = `${wpBaseUrl}/wp-json/rankmath/v1/getHead?url=${encodeURIComponent(categoryDetail.url)}`;
                  const headerResponse = await firstValueFrom(
                    this.httpService.get(rankMathApiUrl, {
                      timeout: 15000,
                      headers: { Host: this.wpHost },
                    })
                  );
                  header = headerResponse.data?.head;
                } catch (err) {
                  this.logger.warn(
                    `[WordPressProvider] Could not fetch RankMath header for category slug ${wpCategory.slug}: ${err.message}`,
                    this.constructor.name
                  );
                }
              }
            } catch (err) {
              this.logger.warn(
                `[WordPressProvider] Could not fetch category detail for slug ${wpCategory.slug}: ${err.message}`,
                this.constructor.name
              );
            }

            const categoryDto = {
              title: wpCategory.name,
              description: wpCategory.description || '',
              parentId: wpCategory.parent,
              propertyId: propertyId,
              status: STATUS.ACTIVE,
              isPublic: true,
              wpCategoryId: wpCategory.id,
              count: wpCategory.count,
              slug: wpCategory.slug,
              fullSlug,
              seo: seoDto,
            };

            await this.categoryService.create(categoryDto, user);

            if (header) {
              await this.categoryModel.updateOne(
                { wpCategoryId: wpCategory.id },
                { $set: { header } }
              );
            }

            created++;
            this.logger.log(
              `[WordPressProvider] Created category: ${wpCategory.name} (wpCategoryId: ${wpCategory.id})`,
              this.constructor.name
            );
          } catch (error) {
            this.logger.error(
              `[WordPressProvider] Error processing category ${wpCategory.name}:`,
              { error: error.message, wpCategoryId: wpCategory.id },
              this.constructor.name
            );
            errors.push({
              name: wpCategory.name,
              wpCategoryId: wpCategory.id,
              error: error.message,
            });
          }
        }

        this.logger.log(
          `[WordPressProvider] Page ${currentPage}: fetched ${wpCategories.length}, new ${newCategories.length} | created so far: ${created}`,
          this.constructor.name
        );

        const minIdOnPage = Math.min(...wpCategories.map((c) => c.id));
        if (minIdOnPage <= maxKnownWpId || wpCategories.length < perPage) {
          done = true;
        } else {
          currentPage++;
        }
      }

      this.logger.log(
        `[WordPressProvider] Incremental categories migration completed. Pages fetched: ${currentPage}, Total fetched: ${total}, Created: ${created}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return { success: true, created, total, errors };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Incremental categories migration failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to sync WordPress categories: ${error.message}`);
    }
  }

  async migrateUsers(user: TCurrentUserType): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting users migration', this.constructor.name);

    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpApiUrl = `${wpBaseUrl}/wp-json/wp/v2/users?context=edit`;
    const totalUsers = 2250;
    const limit = 100;
    const pages = Math.ceil(totalUsers / limit);

    if (!wpAdmin || !wpPassword) {
      this.logger.error('[WordPressProvider] WP_ADMIN or WP_PASSWORD not configured');
      throw new Error('WordPress credentials not configured');
    }

    const AUTH = `Basic ${Buffer.from(`${wpAdmin}:${wpPassword}`).toString('base64')}`;
    // Function with retry support for fetching users
    const fetchUsers = async (page: number, retries = 3): Promise<any[] | null> => {
      try {
        const res = await axios.get(`${wpApiUrl}&page=${page}&per_page=${limit}`, {
          headers: {
            Authorization: AUTH,
            'Cache-Control': 'no-cache',
            Host: this.wpHost,
          },
          timeout: 15000,
          httpsAgent: this.httpsAgent,
        });
        return res.data;
      } catch (err) {
        this.logger.warn(`Page ${page} failed. Retries left: ${retries}`);
        if (retries > 0) {
          // await delay(2000);
          return fetchUsers(page, retries - 1);
        }
        this.logger.error(`Page ${page} failed permanently: ${err.message}`);
        return null;
      }
    };

    let imported = 0;
    const errors = [];
    const jobPromises = [];

    try {
      const organization = await this._organizationService.findOne(user.organizationId);
      const organizationData = {
        id: organization._id.toString(),
        name: organization.organization_name,
        slug: organization.organization_name,
        domain: organization.domain,
      };

      const defaultPropertyId = '6926b8f59a288ddf06a28884';
      const property = await this._propertyService.getById(defaultPropertyId);
      const propertyData = {
        id: property._id.toString(),
        name: property.name,
        domain: property.domain,
      };

      for (let page = 1; page <= pages; page++) {
        this.logger.log(`[WordPressProvider] Fetching users page ${page}/${pages}...`);

        const users = await fetchUsers(page);
        if (!users) {
          errors.push({ page, error: 'Failed to fetch users' });
          continue;
        }

        for (const u of users) {
          try {
            const existingUser = await this.userModel.find({ email: u.email });
            if (existingUser) {
              continue;
            }
            let profilePicture:
              | { id: string; url?: string; path: string; fileName?: string }
              | undefined;
            if (u.avatar_urls && Object.keys(u.avatar_urls).length > 0) {
              try {
                const highestSizeKey = String(
                  Object.keys(u.avatar_urls)
                    .map(Number)
                    .sort((a, b) => b - a)[0]
                );
                const avatarUrl = (u.avatar_urls[highestSizeKey] as string).replace(
                  /([?&]s=)\d+/,
                  '$12048'
                );
                const avatarPath = `/uploads/avatars/${u.slug}`;
                const fileObj: IFile = {
                  fileName: u.slug,
                  url: avatarUrl,
                  folderPath: avatarPath,
                  mimeType: 'image/jpeg',
                  organization: organizationData,
                  property: propertyData,
                  path: avatarPath,
                  isPrivate: false,
                  createdBy: {
                    userId: user.sub,
                    userName: user.name,
                  },
                };
                const { data: savedFile } = await this.fileUploadService.saveFileToDB(fileObj);
                profilePicture = {
                  id: savedFile.id,
                  url: savedFile.url,
                  path: savedFile.path,
                  fileName: savedFile.fileName,
                };
              } catch (avatarError) {
                this.logger.warn(
                  `[WordPressProvider] Failed to save avatar for user ${u.slug}: ${avatarError.message}`
                );
              }
            }

            const userData = {
              name: u.name,
              email: u.email,
              username: u.username,
              description: u.description,
              slug: u.slug,
              userType: UserType.ADMIN,
              wpId: u.id,
              roles: u.roles,
              ...(profilePicture && { profilePicture }),
            };

            const job = await this.createUserQueue.add(
              { userData, currentUser: user },
              {
                removeOnComplete: 100, // Keep last 100 completed jobs for tracking
                removeOnFail: 100,
                attempts: 3,
              }
            );

            // Wait for job to complete
            jobPromises.push(
              job
                .finished()
                .then(() => {
                  this.logger.log(
                    `[WordPressProvider] User ${u.email} processed successfully`,
                    this.constructor.name
                  );
                  imported++;
                })
                .catch((error) => {
                  this.logger.error(
                    `[WordPressProvider] Error processing user ${u.email}:`,
                    error.message,
                    this.constructor.name
                  );
                  errors.push({ email: u.email, error: error.message });
                })
            );
          } catch (error) {
            this.logger.error(`[WordPressProvider] Error queuing user ${u.email}:`, error.message);
            errors.push({ email: u.email, error: error.message });
          }
        }

        // await delay(500);
      }

      // Wait for all queued jobs to complete
      this.logger.log(
        `[WordPressProvider] All ${jobPromises.length} users queued. Waiting for all jobs to complete...`,
        this.constructor.name
      );

      // Wait for all job promises to resolve
      await Promise.allSettled(jobPromises);

      this.logger.log(
        `[WordPressProvider] All jobs finished. Successfully processed: ${imported}, Errors: ${errors.length}`,
        this.constructor.name
      );

      this.logger.log(
        `[WordPressProvider] Users migration completed. Imported: ${imported}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return {
        success: true,
        imported,
        errors,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Users migration failed:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );
      throw new Error(`Failed to migrate WordPress users: ${error.message}`);
    }
  }

  async migrateArticles(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting articles migration', this.constructor.name);

    const defaultPropertyId = propertyId || '6926b8f59a288ddf06a28884';
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpApiUrl = `${wpBaseUrl}/wp-json/wp/v2/posts`;
    const wpMediaApiUrl = `${wpBaseUrl}/wp-json/wp/v2/media`;
    if (!wpAdmin || !wpPassword) {
      this.logger.error('[WordPressProvider] WP_ADMIN or WP_PASSWORD not configured');
      throw new Error('WordPress credentials not configured');
    }

    const startTime = Date.now();

    const imported = [];
    const errors = [];
    const perPage = 100;
    let totalFetched = 0;

    let totalTagTime = 0;
    let totalCategoryTime = 0;
    let totalMediaTime = 0;
    let totalAuthorTime = 0;
    let totalConversionTime = 0;

    const resumeKey = `wp_article_import_resume_date_${defaultPropertyId}`;

    const formatDateForWP = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day} 00:00:00`;
    };

    const getNextDay = (date: Date): Date => {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      return next;
    };

    const startDate = new Date(2025, 10, 11, 0, 0, 0, 0);
    const endDate = new Date(2025, 10, 14, 23, 59, 59, 999);

    this.logger.log(
      `[WordPressProvider] Import from ${startDate.toString()} to ${endDate.toString()}`,
      this.constructor.name
    );

    // Bulk operation variant: process a single day's worth of articles using batch insert
    const processDay = async (day: Date) => {
      const modifiedAfter = formatDateForWP(day);
      const modifiedBefore = formatDateForWP(getNextDay(day));

      // Save current date to Redis before processing
      await this.redisService.setWithTTL(resumeKey, day.toISOString(), 'EX', 86400);

      this.logger.log(
        `[WordPressProvider] Processing articles for date: ${modifiedAfter} to ${modifiedBefore}`,
        this.constructor.name
      );

      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        try {
          // Fetch articles from WordPress for this day(page)
          const response = await firstValueFrom(
            this.httpService.get(wpApiUrl, {
              params: {
                per_page: perPage,
                page: currentPage,
                modified_after: modifiedAfter,
                modified_before: modifiedBefore,
              },
              headers: {
                Host: this.wpHost,
              },
              auth: {
                username: wpAdmin,
                password: wpPassword,
              },
            })
          );
          const wpPosts: any[] = response.data;
          totalFetched += wpPosts.length;

          this.logger.log(
            `[WordPressProvider] Fetched ${wpPosts.length} posts from page ${currentPage} for date ${modifiedAfter}`,
            this.constructor.name
          );

          if (wpPosts.length === 0 || wpPosts.length < perPage) {
            hasMorePages = false;
          }

          // 1. Filter out posts that already exist so we don't try to insert duplicates
          const wpPostIds = wpPosts.map((post) => post.id);
          const existingIdsSet = new Set(
            (
              await this.articleModel
                .find(
                  { wpPostId: { $in: wpPostIds }, organizationId: user.organizationId },
                  { wpPostId: 1 }
                )
                .lean()
                .exec()
            ).map((a) => a.wpId)
          );
          const newWpPosts = wpPosts.filter((wpPost) => !existingIdsSet.has(wpPost.id));

          if (newWpPosts.length === 0) {
            if (hasMorePages) {
              currentPage++;
            }
            continue;
          }

          const buildResults = await Promise.all(
            newWpPosts.map(async (wpPost) => {
              try {
                const articleStartTime = Date.now();

                let primaryCategory: any = null;
                let categories: any[] = [];

                // Fetch categories
                const categoryStartTime = Date.now();
                const fetchedCategories: any[] = [];
                if (wpPost.categories && wpPost.categories.length > 0) {
                  for (const wpCategoryId of wpPost.categories) {
                    let cat = null;
                    try {
                      const redisKey = `wp-category-${wpCategoryId}`;
                      const redisCategory = await this.redisService.get(redisKey);
                      if (redisCategory) {
                        cat = {
                          id: redisCategory.id,
                          name: redisCategory.title,
                          slug: redisCategory.slug,
                        };
                      }
                    } catch (error) {
                      this.logger.warn(
                        `[WordPressProvider] Error fetching category ${wpCategoryId} from Redis/DB:`,
                        error.message,
                        this.constructor.name
                      );
                    }
                    if (cat) fetchedCategories.push(cat);
                  }
                }
                totalCategoryTime += Date.now() - categoryStartTime;
                if (fetchedCategories.length === 1) {
                  primaryCategory = fetchedCategories[0];
                  categories = [];
                } else if (fetchedCategories.length > 1) {
                  primaryCategory = fetchedCategories[0];
                  categories = fetchedCategories.slice(1);
                }

                // Fetch tags
                const tags: any[] = [];
                const tagStartTime = Date.now();
                if (wpPost.tags && wpPost.tags.length > 0) {
                  for (const wpTagId of wpPost.tags) {
                    try {
                      // First try to get tag name from DB to use as Redis key
                      const dbTag = await this.tagModel.findOne({ wpTagId: wpTagId }).exec();
                      if (dbTag) {
                        const redisKey = `wp-tag-${dbTag.name}`;
                        const redisTag = await this.redisService.get(redisKey);
                        if (redisTag) {
                          tags.push({
                            id: redisTag.id,
                            name: redisTag.name,
                            slug: redisTag.slug,
                          });
                        } else {
                          tags.push({
                            id: dbTag.id,
                            name: dbTag.name,
                            slug: dbTag.slug,
                          });
                        }
                      }
                    } catch (error) {
                      this.logger.warn(
                        `[WordPressProvider] Error fetching tag ${wpTagId} from Redis/DB:`,
                        error.message,
                        this.constructor.name
                      );
                    }
                  }
                }
                totalTagTime += Date.now() - tagStartTime;

                // Fetch author(s)
                let authors: any[] = [];
                const authorStartTime = Date.now();
                if (wpPost.author) {
                  try {
                    const redisKey = `wp-user-${wpPost.author}`;
                    const redisUser = await this.redisService.get(redisKey);
                    if (redisUser) {
                      authors = [
                        {
                          id: redisUser.id,
                          name: redisUser.name,
                        },
                      ];
                    }
                  } catch (error) {
                    this.logger.warn(
                      `[WordPressProvider] Error fetching author ${wpPost.author} from Redis/DB:`,
                      error.message,
                      this.constructor.name
                    );
                  }
                }
                totalAuthorTime += Date.now() - authorStartTime;

                // Fetch featuredMedia
                let featuredMedia: any = null;
                if (wpPost.featured_media) {
                  const mediaStartTime = Date.now();
                  const redisKey = `wp-media-${wpPost.featured_media}`;
                  const redisMedia = await this.redisService.get(redisKey);
                  if (redisMedia) {
                    featuredMedia = {
                      id: redisMedia.id,
                      url: redisMedia.url,
                      path: redisMedia.path,
                    };
                  } else {
                    const response = await firstValueFrom(
                      this.httpService.get(`${wpMediaApiUrl}/${wpPost.featured_media}`, {
                        headers: {
                          Host: this.wpHost,
                        },
                        auth: {
                          username: wpAdmin,
                          password: wpPassword,
                        },
                      })
                    );
                    const media = response.data;

                    const relativePath = `/uploads/${media.media_details.file}`;

                    const organization = await this._organizationService.findOne(
                      user.organizationId
                    );
                    const organizationData = {
                      id: organization._id.toString(),
                      name: organization.organization_name,
                      slug: organization.organization_name,
                      domain: organization.domain,
                    };

                    const fileObj: IFile = {
                      fileName: media.title.rendered || media.slug || media.media_details.file,
                      url: media.source_url,
                      folderPath: relativePath,
                      mimeType: media.mime_type,
                      organization: organizationData,
                      path: relativePath,
                      size: media.media_details.filesize,
                      isPrivate: false,
                      caption: media.caption,
                      wpId: media.id,
                      createdBy: {
                        userId: user.sub,
                        userName: user.name,
                      },
                    };
                    const { data: savedFile } = await this.fileUploadService.saveFileToDB(fileObj);
                    featuredMedia = {
                      id: savedFile.id,
                      url: savedFile.url,
                      path: savedFile.path,
                    };
                    await this.redisService.set(redisKey, featuredMedia);
                  }
                  totalMediaTime += Date.now() - mediaStartTime;
                }

                // Convert content to richBlocks
                const conversionStartTime = Date.now();
                // const richBlocks = await this.convertHtmlToRichBlocks(
                //   wpPost.title?.rendered,
                //   wpPost.content?.rendered || '',
                //   user
                // );
                totalConversionTime += Date.now() - conversionStartTime;

                // Generate + persist unique slug (Slug collection) once per article
                const title = wpPost.title?.rendered || 'Untitled';
                const excerpt = wpPost.excerpt?.rendered || '';
                const seo = {
                  title: wpPost.seo_meta?.rank_math_title,
                  description: wpPost.seo_meta?.rank_math_description,
                  keywords: (wpPost.seo_meta?.rank_math_focus_keyword || '')
                    .split(',')
                    .map((k) => k.trim())
                    .filter(Boolean),
                };
                const seoObj = buildSeoObject(seo, title, excerpt, featuredMedia?.url);
                const articleSlug = await this.slugService.generateUniqueSlug(
                  title,
                  ModuleName.ARTICLE,
                  user,
                  seoObj,
                  defaultPropertyId,
                  wpPost.slug
                );

                // Build document for Mongo insert
                const articleDoc: any = {
                  organization: {
                    id: '6915d0490f0319baabaea793',
                    name: process.env.BRAND_NAME || 'Default Organization',
                    slug: process.env.BRAND_NAME?.toLowerCase().replace(/ /g, '-') || 'default-org',
                  },
                  property: {
                    id: '6926b8f59a288ddf06a28884',
                    domain: this.wpBaseUrl,
                    name: process.env.BRAND_NAME || 'Default Organization',
                  },
                  title: title,
                  slug: articleSlug,
                  excerpt: excerpt,
                  body: wpPost.content?.rendered || '',
                  status: this.mapWordPressStatus(wpPost.status),
                  type: wpPost.post_format || 'article',
                  lang: 'hi',
                  categories: categories.length > 0 ? categories : [],
                  tags: tags.length > 0 ? tags : [],
                  authors: authors.length > 0 ? authors : [],
                  publishedAt: wpPost.date ? new Date(wpPost.date) : null,
                  // richBlocks,
                  featuredMedia: featuredMedia,
                  primaryCategory: primaryCategory,
                  wpId: wpPost.id,
                  softDeleted: false,
                  seo: {
                    title: wpPost.seo_meta?.rank_math_title,
                    description: wpPost.seo_meta?.rank_math_description,
                    keywords: (wpPost.seo_meta?.rank_math_focus_keyword || '')
                      .split(',')
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                  createdBy: buildUserMetadata(user),
                  updatedBy: buildUserMetadata(user),
                };

                const articleDuration = Date.now() - articleStartTime;
                return {
                  ok: true,
                  wpPostId: wpPost.id,
                  doc: articleDoc,
                  durationMs: articleDuration,
                };
              } catch (err: any) {
                const msg = err?.message || String(err);
                this.logger.error(
                  `[WordPressProvider] Failed building article for wpPostId ${wpPost.id}: ${msg}`,
                  err?.stack,
                  this.constructor.name
                );
                return { ok: false, wpPostId: wpPost.id, error: msg };
              }
            })
          );

          const docsToInsert: any[] = [];
          for (const res of buildResults) {
            if (res.ok) {
              docsToInsert.push(res.doc);
            } else {
              errors.push({
                wpPostId: res.wpPostId,
                error: res.error,
              });
            }
          }

          if (docsToInsert.length > 0) {
            const insertStart = Date.now();
            try {
              const inserted = await this.articleModel.insertMany(docsToInsert, { ordered: false });
              imported.push(...inserted);
              this.logger.log(
                `[WordPressProvider] Bulk inserted ${inserted.length}/${docsToInsert.length} articles for page ${currentPage} (${Date.now() - insertStart}ms)`,
                this.constructor.name
              );
            } catch (err: any) {
              // Mongoose may throw but still include partial inserts
              const insertedDocs = err?.insertedDocs || err?.result?.insertedDocs;
              if (Array.isArray(insertedDocs) && insertedDocs.length > 0) {
                imported.push(...insertedDocs);
              }

              const writeErrors = err?.writeErrors || err?.result?.result?.writeErrors;
              if (Array.isArray(writeErrors) && writeErrors.length > 0) {
                for (const we of writeErrors) {
                  this.logger.warn(
                    `[WordPressProvider] Bulk insert failed for wpPostId ${we?.op?.wpPostId ?? 'unknown'}: ${
                      we?.errmsg || we?.message || 'Bulk insert write error'
                    }`,
                    this.constructor.name
                  );
                  errors.push({
                    wpPostId: we?.op?.wpPostId ?? null,
                    error: we?.errmsg || we?.message || 'Bulk insert write error',
                  });
                }
              } else {
                errors.push({
                  wpPostId: null,
                  error: err?.message || 'Bulk insert failed',
                });
              }

              this.logger.error(
                `[WordPressProvider] Bulk insert error on page ${currentPage} (${Date.now() - insertStart}ms):`,
                err?.message || err,
                this.constructor.name
              );
            }
          }
          if (hasMorePages) {
            currentPage++;
          }
        } catch (error) {
          this.logger.error(
            `[WordPressProvider] Error fetching page ${currentPage} for date ${modifiedAfter}:`,
            error.message,
            this.constructor.name
          );
          hasMorePages = false; // Move to next day on error
        }
      }
    };

    try {
      // Build list of days to process
      const days: Date[] = [];
      for (let d = new Date(startDate); d <= endDate; d = getNextDay(d)) {
        days.push(new Date(d));
      }

      // Simple worker-pool concurrency over days
      const WORKER_COUNT = 1; // logical workers; can be tuned or made configurable
      let dayIndex = 0;

      const runWorker = async (workerId: number) => {
        while (true) {
          const index = dayIndex++;
          if (index >= days.length) {
            break;
          }
          const day = days[index];
          this.logger.log(
            `[WordPressProvider] Worker ${workerId} processing date ${formatDateForWP(day)}`,
            this.constructor.name
          );
          await processDay(day);
        }
      };

      const workerPromises: Promise<void>[] = [];
      for (let i = 0; i < WORKER_COUNT; i++) {
        workerPromises.push(runWorker(i + 1));
      }

      await Promise.all(workerPromises);

      // Clear Redis key after successful completion
      await this.redisService.del(resumeKey);
      this.logger.log(`[WordPressProvider] Cleared resume key from Redis`, this.constructor.name);

      const totalDuration = Date.now() - startTime;
      const avgTimePerArticle =
        imported.length > 0 ? Math.round(totalDuration / imported.length) : 0;
      const avgTagTime = totalTagTime / imported.length;
      const avgCategoryTime = totalCategoryTime / imported.length;
      const avgMediaTime = totalMediaTime / imported.length;
      const avgAuthorTime = totalAuthorTime / imported.length;
      const avgConversionTime = totalConversionTime / imported.length;
      this.logger.log(
        `[WordPressProvider] Articles import completed. Total Fetched: ${totalFetched}, Imported: ${imported.length}, Errors: ${errors.length}, Total Duration: ${totalDuration}ms, Avg per article: ${avgTimePerArticle}ms, Avg Tag Time: ${avgTagTime}ms, Avg Category Time: ${avgCategoryTime}ms, Avg Media Time: ${avgMediaTime}ms, Avg Author Time: ${avgAuthorTime}ms, Avg Conversion Time: ${avgConversionTime}ms`,
        this.constructor.name
      );
      this.logger.log(
        `[WordPressProvider] Average Tag Time: ${avgTagTime}ms, Average Category Time: ${avgCategoryTime}ms, Average Media Time: ${avgMediaTime}ms, Average Author Time: ${avgAuthorTime}ms, Average Conversion Time: ${avgConversionTime}ms`,
        this.constructor.name
      );
      return {
        success: true,
        imported: imported.length,
        errors,
        duration: totalDuration,
        avgTimePerArticle,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Failed to fetch from WordPress:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );

      this.logger.log(
        '[WordPressProvider] Import state saved to Redis. Will resume from last processed date on next run.',
        this.constructor.name
      );

      throw new Error(`Failed to fetch WordPress articles: ${error.message}`);
    }
  }

  async migrateArticlesV2(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult> {
    this.logger.log(
      `[WordPressProvider] Starting articles migration V2 (Elasticsearch source: wp_posts_prod)${limit ? ` [LIMIT: ${limit}]` : ''}${dateFrom || dateTo ? ` [DATE RANGE: ${dateFrom || '*'} to ${dateTo || '*'}]` : ''}`,
      this.constructor.name
    );

    const defaultPropertyId = propertyId || '6926b8f59a288ddf06a28884';
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const startTime = Date.now();
    let importedCount = 0;
    const errors = [];
    const batchSize = limit ? Math.min(limit, 500) : 500;
    let totalFetched = 0;

    let totalTagTime = 0;
    let totalCategoryTime = 0;
    let totalMediaTime = 0;
    let totalAuthorTime = 0;

    const ES_INDEX = 'wp_posts_prod';

    // Fetch organization and property data once before the loop
    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const property = await this._propertyService.getById(defaultPropertyId);
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    try {
      let searchAfter: any[] | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const filters: any[] = [
          { term: { status: 'publish' } },
          { term: { type: 'post' } },
          // { exists: { field: 'header' } },
        ];

        // Add date range filter if dateFrom or dateTo is provided (dd-mm-yyyy)
        if (dateFrom || dateTo) {
          const parseDate = (d: string): string => {
            const [day, month, year] = d.split('-');
            return `${year}-${month}-${day}`;
          };
          const rangeFilter: any = { range: { modified: {} } };
          if (dateFrom) {
            rangeFilter.range.modified.gte = parseDate(dateFrom);
          }
          if (dateTo) {
            rangeFilter.range.modified.lte = parseDate(dateTo);
          }
          filters.push(rangeFilter);
        }

        const searchQuery: any = {
          size: batchSize,
          sort: [{ modified: { order: 'asc' } }],
          query: {
            bool: {
              filter: filters,
            },
          },
        };

        if (searchAfter) {
          searchQuery.search_after = searchAfter;
        }

        const response = await this.elasticService.search(ES_INDEX, searchQuery);
        const hits = response.hits?.hits;

        if (!hits || hits.length === 0) {
          hasMore = false;
          break;
        }

        totalFetched += hits.length;
        this.logger.log(
          `[WordPressProvider] Fetched ${hits.length} posts from ES (total: ${totalFetched})`,
          this.constructor.name
        );

        // 1. Deduplicate: filter out posts that already exist in MongoDB
        const wpPostIds = hits.map((hit: any) => hit._source?.id).filter((id: any) => id != null);

        const existingIdsSet = new Set(
          (
            await this.articleModel
              .find({ wpId: { $in: wpPostIds } }, { wpId: 1 })
              .lean()
              .exec()
          ).map((a) => a.wpId)
        );

        const newHits = hits.filter(
          (hit: any) => hit._source?.id && !existingIdsSet.has(hit._source.id)
        );

        this.logger.log(
          `[WordPressProvider V2] Dedup: ${existingIdsSet.size}/${wpPostIds.length} already exist → ${newHits.length} new to process`,
          this.constructor.name
        );

        if (newHits.length === 0) {
          if (hits.length < batchSize || (limit && totalFetched >= limit)) {
            hasMore = false;
          } else {
            searchAfter = hits[hits.length - 1].sort;
          }
          continue;
        }

        // 2. Build article documents from ES data (process sequentially to limit memory)
        const buildResults: any[] = [];
        for (const hit of newHits) {
          const result = await (async (hit: any) => {
            try {
              const source = hit._source;
              const articleStartTime = Date.now();

              // --- Resolve categories from Redis/DB using WP category IDs ---
              let primaryCategory: any = null;
              let categories: any[] = [];
              const categoryStartTime = Date.now();

              if (source.categories && source.categories.length > 0) {
                const fetchedCategories: any[] = [];
                for (const esCat of source.categories) {
                  let cat = null;
                  try {
                    const redisKey = `wp-category-${esCat.id}`;
                    const redisCategory = await this.redisService.get(redisKey);
                    if (redisCategory) {
                      cat = {
                        id: redisCategory._id?.toString() || redisCategory.id,
                        title: redisCategory.title,
                        titleHn: redisCategory.titleHn,
                        slug: redisCategory.slug,
                        fullSlug: redisCategory.fullSlug,
                        status: redisCategory.status,
                        isFeatured: redisCategory.isFeatured,
                        isPublic: redisCategory.isPublic,
                        link: redisCategory.link,
                        rank: redisCategory.rank,
                        wpCategoryId: redisCategory.wpCategoryId,
                        count: redisCategory.count,
                      };
                    } else {
                      // Fallback: use category data from ES response directly
                      const dbCat = await this.categoryModel
                        .findOne({ wpCategoryId: esCat.id })
                        .lean()
                        .exec();
                      if (dbCat) {
                        cat = {
                          id: dbCat._id.toString(),
                          title: dbCat.title,
                          titleHn: dbCat.titleHn,
                          slug: dbCat.slug,
                          fullSlug: dbCat.fullSlug,
                          status: dbCat.status,
                          isFeatured: dbCat.isFeatured,
                          isPublic: dbCat.isPublic,
                          link: dbCat.link,
                          rank: dbCat.rank,
                          wpCategoryId: dbCat.wpCategoryId,
                          count: dbCat.count,
                        };
                      }
                    }
                  } catch (error) {
                    this.logger.warn(
                      `[WordPressProvider V2] Error fetching category ${esCat.id}: ${error.message}`,
                      this.constructor.name
                    );
                  }
                  if (cat) fetchedCategories.push(cat);
                }

                if (fetchedCategories.length > 0) {
                  primaryCategory = fetchedCategories[0];
                  categories = fetchedCategories;
                }
              }
              totalCategoryTime += Date.now() - categoryStartTime;

              // --- Resolve tags from Redis/DB using WP tag IDs ---
              const tags: any[] = [];
              const tagStartTime = Date.now();
              const buildTagSub = (t: any) => ({
                id: t._id?.toString() || t.id,
                name: t.name,
                slug: t.slug,
                description: t.description,
                rank: t.rank,
                status: t.status,
                isFeatured: t.isFeatured,
                link: t.link,
                wpTagId: t.wpTagId,
                count: t.count,
              });
              if (source.tags && source.tags.length > 0) {
                for (const esTag of source.tags) {
                  try {
                    let dbTag: any = await this.tagModel.findOne({ wpTagId: esTag.id }).exec();
                    if (!dbTag) {
                      // Tag not in DB — fetch from WP API and create it
                      try {
                        const wpTagRes = await axios.get(
                          `${wpBaseUrl}/wp-json/wp/v2/tags/${esTag.id}`,
                          {
                            headers: { Host: this.wpHost },
                            auth: { username: wpAdmin, password: wpPassword },
                            httpsAgent: this.httpsAgent,
                          }
                        );
                        const wpTag = wpTagRes.data;
                        const tagDto: any = {
                          name: wpTag.name,
                          description: wpTag.description || '',
                          propertyId: defaultPropertyId,
                          rank: 0,
                          count: wpTag.count,
                          status: STATUS.ACTIVE,
                          wpTagId: wpTag.id,
                          slug: wpTag.slug,
                        };
                        dbTag = await this.tagsService.create(tagDto, user);
                        this.logger.log(
                          `[WordPressProvider V2] Created missing tag: ${wpTag.name} (wpTagId: ${wpTag.id})`,
                          this.constructor.name
                        );
                      } catch (createErr) {
                        this.logger.warn(
                          `[WordPressProvider V2] Failed to create tag wpTagId=${esTag.id}: ${createErr.message}`,
                          this.constructor.name
                        );
                      }
                    }
                    if (dbTag) {
                      const redisKey = `wp-tag-${dbTag.name}`;
                      const redisTag = await this.redisService.get(redisKey);
                      tags.push(buildTagSub(redisTag ?? dbTag));
                    }
                  } catch (error) {
                    this.logger.warn(
                      `[WordPressProvider V2] Error fetching tag ${esTag.id}: ${error.message}`,
                      this.constructor.name
                    );
                  }
                }
              }
              totalTagTime += Date.now() - tagStartTime;

              // --- Resolve author from Redis using WP author ID ---
              let authors: any[] = [];
              let authorForMetadata: any = null;
              const authorStartTime = Date.now();
              if (source.author && source.author.id) {
                try {
                  const redisKey = `wp-user-${source.author.id}`;
                  const redisUser = await this.redisService.get(redisKey);
                  if (redisUser) {
                    authorForMetadata = redisUser;
                    authors = [
                      {
                        id: redisUser._id?.toString() || redisUser.id,
                        name: redisUser.name,
                        username: redisUser.username,
                        slug: redisUser.slug,
                        profilePicture: redisUser.profilePicture,
                      },
                    ];
                  }
                } catch (error) {
                  this.logger.warn(
                    `[WordPressProvider V2] Error fetching author ${source.author.id}: ${error.message}`,
                    this.constructor.name
                  );
                }
              }
              totalAuthorTime += Date.now() - authorStartTime;

              // --- Resolve featured media via WP REST API ---
              let featuredMedia: any = null;
              if (source.featured_media && source.featured_media.id) {
                const mediaStartTime = Date.now();
                const redisKey = `wp-media-key-${source.featured_media.id}`;
                try {
                  const redisMedia = await this.redisService.get(redisKey);
                  if (redisMedia) {
                    featuredMedia = {
                      id: redisMedia.id,
                      fileName: redisMedia.fileName,
                      url: redisMedia.url,
                      path: redisMedia.path,
                    };
                  } else {
                    const response = await firstValueFrom(
                      this.httpService.get(
                        `${wpBaseUrl}/wp-json/wp/v2/media/${source.featured_media.id}`,
                        {
                          headers: { Host: this.wpHost },
                          auth: { username: wpAdmin, password: wpPassword },
                        }
                      )
                    );
                    const media = response.data;
                    const filePath = media.media_details?.file
                      ? `/uploads/${media.media_details.file}`
                      : undefined;
                    const mediaUrl = media.source_url || media.guid?.rendered;
                    const fileObj: any = {
                      wpId: media.id,
                      fileName:
                        media.title?.rendered || media.slug || media.media_details?.file || 'image',
                      mimeType: media.mime_type || '',
                      size: media.media_details?.filesize || 0,
                      source_url: mediaUrl,
                      caption: media.caption?.rendered
                        ? media.caption.rendered.replace(/<[^>]*>/g, '').trim()
                        : '',
                      url: mediaUrl,
                      path: filePath || mediaUrl,
                      folderPath: filePath || mediaUrl,
                      type: media.media_type || '',
                      isPrivate: false,
                      alt_text: media.alt_text || '',
                      featured_media: media.featured_media,
                      media_details: media.media_details,
                      postId: media.post || '',
                      organization: organizationData,
                      property: propertyData,
                      createdAt: media.date ? new Date(media.date) : new Date(),
                      updatedAt: media.modified ? new Date(media.modified) : new Date(),
                      createdBy: {
                        userId: authors[0].id,
                        userName: authors[0].username,
                        slug: authors[0].slug,
                      },
                      updatedBy: {
                        userId: authors[0].id,
                        userName: authors[0].username,
                        slug: authors[0].slug,
                      },
                    };
                    const { data: savedFile } = await this.fileUploadService.saveFileToDB(fileObj);
                    featuredMedia = {
                      id: savedFile.id,
                      fileName: savedFile.fileName,
                      url: savedFile.url,
                      path: savedFile.path,
                    };
                    await this.redisService.set(redisKey, savedFile);
                  }
                } catch (error) {
                  this.logger.warn(
                    `[WordPressProvider V2] Error fetching media ${source.featured_media.id}: ${error.message}`,
                    this.constructor.name
                  );
                }
                totalMediaTime += Date.now() - mediaStartTime;
              }

              // --- Generate unique slug ---
              const title = source.title || 'Untitled';
              const excerpt = source.excerpt || '';
              const rawFullSlug = source.link.replace(this.wpBaseUrl + '/', '');
              const fullSlugLastSegment = rawFullSlug.split('/').pop() ?? '';
              const fullSlug = /^\d+$/.test(fullSlugLastSegment) ? `${rawFullSlug}-` : rawFullSlug;
              const seo = {
                title: source.seo_meta?.rank_math_title,
                description: source.seo_meta?.rank_math_description,
                keywords: (source.seo_meta?.rank_math_focus_keyword || '')
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean),
              };
              const seoObj = buildSeoObject(seo, title, excerpt, featuredMedia?.url);
              let rawSlug = source.slug;
              const articleSlug = /^\d+$/.test(rawSlug) ? `${rawSlug}-` : rawSlug;
              rawSlug = await this.slugService.generateUniqueSlug(
                title,
                ModuleName.ARTICLE,
                user,
                seoObj,
                defaultPropertyId,
                articleSlug,
                fullSlug
              );
              let header = source.header || null;
              if (!source.header) {
                try {
                  const rankMathUrl = `${wpBaseUrl}/wp-json/rankmath/v1/getHead?url=${encodeURIComponent(source.link)}`;
                  const rankMathRes = await firstValueFrom(
                    this.httpService.get(rankMathUrl, {
                      timeout: 10000,
                    })
                  );
                  header = rankMathRes.data?.success ? rankMathRes.data.head || null : null;
                } catch (err) {
                  this.logger.warn(
                    `[WordPressProvider V2] Failed to fetch RankMath header for post ${source.id}: ${err.message}`,
                    this.constructor.name
                  );
                }
              }
              // --- Build article document ---
              const buildAuthorMetadata = (author: any) =>
                author
                  ? {
                      id: author._id?.toString() || author.id,
                      name: author.name,
                      email: author.email || '',
                      userType: UserType.AUTHOR,
                    }
                  : buildUserMetadata(user);

              const articleDoc: any = {
                organization: organizationData,
                property: propertyData,
                title,
                slug: articleSlug,
                fullSlug,
                excerpt,
                body: source.content || '',
                status: this.mapWordPressStatus(source.status),
                type: source.post_format || 'article',
                lang: 'hi',
                categories: categories.length > 0 ? categories : [],
                tags: tags.length > 0 ? tags : [],
                authors: authors.length > 0 ? authors : [],
                publishedAt: source.date ? new Date(source.date) : null,
                featuredMedia,
                featured_media: source.featured_media?.id || null,
                primaryCategory,
                wpId: source.id,
                // seo sub-document intentionally omitted: Mongoose 8 crashes on applyDefaults
                // when Seo.keywords uses @Prop() without explicit type:[String].
                // SEO data stored in flat fields below until schema is fixed on the server.
                metaTitle: source.seo_meta?.rank_math_title || '',
                metaDescription: source.seo_meta?.rank_math_description || '',
                keyword: source.seo_meta?.rank_math_focus_keyword || '',
                wpCategoryIds: source.categories ? source.categories.map((c: any) => c.id) : [],
                wpTagIds: source.tags ? source.tags.map((t: any) => t.id) : [],
                header,
                createdBy: buildAuthorMetadata(authorForMetadata),
                updatedBy: buildAuthorMetadata(authorForMetadata),
                createdAt: source.date ? new Date(source.date) : undefined,
                updatedAt: source.modified ? new Date(source.modified) : undefined,
              };
              return {
                ok: true,
                wpPostId: source.id,
                doc: articleDoc,
                durationMs: Date.now() - articleStartTime,
              };
            } catch (err: any) {
              const msg = err?.message || String(err);
              this.logger.error(
                `[WordPressProvider V2] Failed building article for wpPostId ${hit._source?.id}: ${msg}`,
                err?.stack,
                this.constructor.name
              );
              return { ok: false, wpPostId: hit._source?.id, error: msg };
            }
          })(hit);
          buildResults.push(result);
        }

        // 3. Separate successes and failures
        const docsToInsert: any[] = [];
        for (const res of buildResults) {
          if (res.ok) {
            docsToInsert.push(res.doc);
          } else {
            errors.push({
              wpPostId: res.wpPostId,
              error: res.error,
            });
          }
        }

        // 4. Bulk insert into MongoDB
        if (docsToInsert.length > 0) {
          const insertStart = Date.now();
          try {
            // Use raw collection driver to bypass Mongoose timestamp middleware,
            // preserving explicit createdAt/updatedAt values from the source data.
            const result = await this.articleModel.collection.insertMany(docsToInsert, {
              ordered: false,
            });
            const insertedCount = result.insertedCount;
            importedCount += insertedCount;
            this.logger.log(
              `[WordPressProvider V2] Bulk inserted ${insertedCount}/${docsToInsert.length} articles (${Date.now() - insertStart}ms) [Total imported: ${importedCount}]`,
              this.constructor.name
            );

            // Mongoose 8 + ordered:false silently returns 0 when all docs fail — diagnose it
            if (insertedCount === 0 && docsToInsert.length > 0) {
              this.logger.warn(
                `[WordPressProvider V2] insertMany returned 0/${docsToInsert.length} — probing first doc (wpId=${docsToInsert[0]?.wpId}) to surface error`,
                this.constructor.name
              );
              try {
                await this.articleModel.create(docsToInsert[0]);
              } catch (diagErr: any) {
                this.logger.error(
                  `[WordPressProvider V2] Probe error for wpId=${docsToInsert[0]?.wpId}: ${diagErr?.message}`,
                  diagErr?.stack,
                  this.constructor.name
                );
              }
            }

            // Enqueue rich block conversion for each inserted article
            const insertedIds = Object.values(result.insertedIds);
            await this.richBlocksQueue.addBulk(
              insertedIds.map((id) => ({
                data: { articleId: id.toString(), user },
                opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
              }))
            );
            this.logger.log(
              `[WordPressProvider V2] Enqueued ${insertedCount} articles for rich block conversion`,
              this.constructor.name
            );
          } catch (err: any) {
            const insertedDocs = err?.insertedDocs || err?.result?.insertedDocs;
            if (Array.isArray(insertedDocs) && insertedDocs.length > 0) {
              importedCount += insertedDocs.length;

              // Enqueue partially inserted docs too
              await this.richBlocksQueue.addBulk(
                insertedDocs.map((doc: any) => ({
                  data: { articleId: doc._id.toString(), user },
                  opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
                }))
              );
            }

            const writeErrors = err?.writeErrors || err?.result?.result?.writeErrors;
            if (Array.isArray(writeErrors) && writeErrors.length > 0) {
              for (const we of writeErrors) {
                this.logger.warn(
                  `[WordPressProvider V2] Bulk insert failed for wpPostId ${we?.op?.wpPostId ?? 'unknown'}: ${
                    we?.errmsg || we?.message || 'Bulk insert write error'
                  }`,
                  this.constructor.name
                );
                errors.push({
                  wpPostId: we?.op?.wpPostId ?? null,
                  error: we?.errmsg || we?.message || 'Bulk insert write error',
                });
              }
            } else {
              errors.push({
                wpPostId: null,
                error: err?.message || 'Bulk insert failed',
              });
            }

            this.logger.error(
              `[WordPressProvider V2] Bulk insert error (${Date.now() - insertStart}ms):`,
              err?.message || err,
              this.constructor.name
            );
          }
        }

        // 5. Check limit and advance search_after cursor
        if (limit && totalFetched >= limit) {
          this.logger.log(
            `[WordPressProvider V2] Reached limit of ${limit} articles, stopping.`,
            this.constructor.name
          );
          hasMore = false;
        } else if (hits.length < batchSize) {
          hasMore = false;
        } else {
          searchAfter = hits[hits.length - 1].sort;
        }
      }

      const totalDuration = Date.now() - startTime;
      const avgTimePerArticle = importedCount > 0 ? Math.round(totalDuration / importedCount) : 0;

      this.logger.log(
        `[WordPressProvider V2] Import completed. Fetched: ${totalFetched}, Imported: ${importedCount}, Errors: ${errors.length}, Duration: ${totalDuration}ms, Avg: ${avgTimePerArticle}ms`,
        this.constructor.name
      );
      this.logger.log(
        `[WordPressProvider V2] Avg Tag: ${importedCount ? Math.round(totalTagTime / importedCount) : 0}ms, Avg Category: ${importedCount ? Math.round(totalCategoryTime / importedCount) : 0}ms, Avg Media: ${importedCount ? Math.round(totalMediaTime / importedCount) : 0}ms, Avg Author: ${importedCount ? Math.round(totalAuthorTime / importedCount) : 0}ms`,
        this.constructor.name
      );

      return {
        success: true,
        imported: importedCount,
        errors,
        duration: totalDuration,
        avgTimePerArticle,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider V2] Failed to fetch from Elasticsearch:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );

      throw new Error(`Failed to fetch Elasticsearch articles: ${error.message}`);
    }
  }
  async syncTags(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult> {
    this.logger.log(
      `[WordPressProvider] Starting articles migration V2 (Elasticsearch source: wp_posts_prod)${limit ? ` [LIMIT: ${limit}]` : ''}${dateFrom || dateTo ? ` [DATE RANGE: ${dateFrom || '*'} to ${dateTo || '*'}]` : ''}`,
      this.constructor.name
    );

    const defaultPropertyId = propertyId || '6926b8f59a288ddf06a28884';
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const startTime = Date.now();
    let importedCount = 0;
    const errors = [];
    const batchSize = limit ? Math.min(limit, 500) : 500;
    let totalFetched = 0;

    let totalTagTime = 0;
    let totalCategoryTime = 0;
    let totalMediaTime = 0;
    let totalAuthorTime = 0;

    const ES_INDEX = 'wp_posts_prod';

    // Fetch organization and property data once before the loop
    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const property = await this._propertyService.getById(defaultPropertyId);
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    try {
      let searchAfter: any[] | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const filters: any[] = [
          { term: { status: 'publish' } },
          { term: { type: 'post' } },
          { exists: { field: 'header' } },
        ];

        // Add date range filter if dateFrom or dateTo is provided (dd-mm-yyyy)
        if (dateFrom || dateTo) {
          const parseDate = (d: string): string => {
            const [day, month, year] = d.split('-');
            return `${year}-${month}-${day}`;
          };
          const rangeFilter: any = { range: { modified: {} } };
          if (dateFrom) {
            rangeFilter.range.modified.gte = parseDate(dateFrom);
          }
          if (dateTo) {
            rangeFilter.range.modified.lte = parseDate(dateTo);
          }
          filters.push(rangeFilter);
        }

        const searchQuery: any = {
          size: batchSize,
          sort: [{ modified: { order: 'asc' } }],
          query: {
            bool: {
              filter: filters,
            },
          },
        };

        if (searchAfter) {
          searchQuery.search_after = searchAfter;
        }

        const response = await this.elasticService.search(ES_INDEX, searchQuery);
        const hits = response.hits?.hits;

        if (!hits || hits.length === 0) {
          hasMore = false;
          break;
        }

        totalFetched += hits.length;
        this.logger.log(
          `[WordPressProvider] Fetched ${hits.length} posts from ES (total: ${totalFetched})`,
          this.constructor.name
        );

        // 1. Deduplicate: filter out posts that already exist in MongoDB
        // const wpPostIds = hits.map((hit: any) => hit._source?.id).filter((id: any) => id != null);

        // const existingIdsSet = new Set(
        //   (
        //     await this.articleModel
        //       .find({ wpId: { $in: wpPostIds } }, { wpId: 1 })
        //       .lean()
        //       .exec()
        //   ).map((a) => a.wpId)
        // );

        // const newHits = hits.filter(
        //   (hit: any) => hit._source?.id && !existingIdsSet.has(hit._source.id)
        // );

        // this.logger.log(
        //   `[WordPressProvider V2] Dedup: ${existingIdsSet.size}/${wpPostIds.length} already exist → ${newHits.length} new to process`,
        //   this.constructor.name
        // );

        if (hits.length === 0) {
          if (hits.length < batchSize || (limit && totalFetched >= limit)) {
            hasMore = false;
          } else {
            searchAfter = hits[hits.length - 1].sort;
          }
          continue;
        }

        // 2. Build article documents from ES data (process sequentially to limit memory)
        const buildResults: any[] = [];
        for (const hit of hits) {
          const result = await (async (hit: any) => {
            try {
              const source = hit._source;
              const articleStartTime = Date.now();

              // --- Resolve categories from Redis/DB using WP category IDs ---
              let primaryCategory: any = null;
              let categories: any[] = [];
              const categoryStartTime = Date.now();

              if (source.categories && source.categories.length > 0) {
                const fetchedCategories: any[] = [];
                for (const esCat of source.categories) {
                  let cat = null;
                  try {
                    const redisKey = `wp-category-${esCat.id}`;
                    const redisCategory = await this.redisService.get(redisKey);
                    if (redisCategory) {
                      cat = {
                        id: redisCategory._id?.toString() || redisCategory.id,
                        title: redisCategory.title,
                        titleHn: redisCategory.titleHn,
                        slug: redisCategory.slug,
                        fullSlug: redisCategory.fullSlug,
                        status: redisCategory.status,
                        isFeatured: redisCategory.isFeatured,
                        isPublic: redisCategory.isPublic,
                        link: redisCategory.link,
                        rank: redisCategory.rank,
                        wpCategoryId: redisCategory.wpCategoryId,
                        count: redisCategory.count,
                      };
                    } else {
                      // Fallback: use category data from ES response directly
                      const dbCat = await this.categoryModel
                        .findOne({ wpCategoryId: esCat.id })
                        .lean()
                        .exec();
                      if (dbCat) {
                        cat = {
                          id: dbCat._id.toString(),
                          title: dbCat.title,
                          titleHn: dbCat.titleHn,
                          slug: dbCat.slug,
                          fullSlug: dbCat.fullSlug,
                          status: dbCat.status,
                          isFeatured: dbCat.isFeatured,
                          isPublic: dbCat.isPublic,
                          link: dbCat.link,
                          rank: dbCat.rank,
                          wpCategoryId: dbCat.wpCategoryId,
                          count: dbCat.count,
                        };
                      }
                    }
                  } catch (error) {
                    this.logger.warn(
                      `[WordPressProvider V2] Error fetching category ${esCat.id}: ${error.message}`,
                      this.constructor.name
                    );
                  }
                  if (cat) fetchedCategories.push(cat);
                }

                if (fetchedCategories.length > 0) {
                  primaryCategory = fetchedCategories[0];
                  categories = fetchedCategories;
                }
              }
              totalCategoryTime += Date.now() - categoryStartTime;

              // --- Resolve tags from Redis/DB using WP tag IDs ---
              const tags: any[] = [];
              const tagStartTime = Date.now();
              if (source.tags && source.tags.length > 0) {
                for (const esTag of source.tags) {
                  try {
                    const dbTag = await this.tagModel.findOne({ wpTagId: esTag.id }).exec();
                    if (dbTag) {
                      const buildTagSub = (t: any) => ({
                        id: t._id?.toString() || t.id,
                        name: t.name,
                        slug: t.slug,
                        description: t.description,
                        rank: t.rank,
                        status: t.status,
                        isFeatured: t.isFeatured,
                        link: t.link,
                        wpTagId: t.wpTagId,
                        count: t.count,
                      });
                      const redisKey = `wp-tag-${dbTag.name}`;
                      const redisTag = await this.redisService.get(redisKey);
                      tags.push(buildTagSub(redisTag ?? dbTag));
                    }
                  } catch (error) {
                    this.logger.warn(
                      `[WordPressProvider V2] Error fetching tag ${esTag.id}: ${error.message}`,
                      this.constructor.name
                    );
                  }
                }
              }
              totalTagTime += Date.now() - tagStartTime;

              // --- Resolve author from Redis using WP author ID ---
              let authors: any[] = [];
              let authorForMetadata: any = null;
              const authorStartTime = Date.now();
              if (source.author && source.author.id) {
                try {
                  const redisKey = `wp-user-${source.author.id}`;
                  const redisUser = await this.redisService.get(redisKey);
                  if (redisUser) {
                    authorForMetadata = redisUser;
                    authors = [
                      {
                        id: redisUser._id?.toString() || redisUser.id,
                        name: redisUser.name,
                        username: redisUser.username,
                        slug: redisUser.slug,
                        profilePicture: redisUser.profilePicture,
                      },
                    ];
                  }
                } catch (error) {
                  this.logger.warn(
                    `[WordPressProvider V2] Error fetching author ${source.author.id}: ${error.message}`,
                    this.constructor.name
                  );
                }
              }
              totalAuthorTime += Date.now() - authorStartTime;

              // --- Resolve featured media via WP REST API ---
              let featuredMedia: any = null;
              if (source.featured_media && source.featured_media.id) {
                const mediaStartTime = Date.now();
                const redisKey = `wp-media-key-${source.featured_media.id}`;
                try {
                  const redisMedia = await this.redisService.get(redisKey);
                  const imagePath = source.featured_media.url;
                  const dbMedia = await this.fileUploadModel
                    .findOne({ path: imagePath })
                    .lean()
                    .exec();
                  if (dbMedia) {
                    featuredMedia = {
                      id: (dbMedia as any)._id?.toString(),
                      fileName: (dbMedia as any).fileName,
                      url: (dbMedia as any).url,
                      path: (dbMedia as any).path,
                    };
                  } else if (redisMedia) {
                    featuredMedia = {
                      id: redisMedia.id,
                      fileName: redisMedia.fileName,
                      url: redisMedia.url,
                      path: redisMedia.path,
                    };
                  } else {
                    const response = await firstValueFrom(
                      this.httpService.get(
                        `${wpBaseUrl}/wp-json/wp/v2/media/${source.featured_media.id}`,
                        {
                          headers: { Host: this.wpHost },
                          auth: { username: wpAdmin, password: wpPassword },
                        }
                      )
                    );
                    const media = response.data;
                    const filePath = media.media_details?.file
                      ? `/uploads/${media.media_details.file}`
                      : undefined;
                    const mediaUrl = media.source_url || media.guid?.rendered;
                    const fileObj: any = {
                      wpId: media.id,
                      fileName:
                        media.title?.rendered || media.slug || media.media_details?.file || 'image',
                      mimeType: media.mime_type || '',
                      size: media.media_details?.filesize || 0,
                      source_url: mediaUrl,
                      caption: media.caption?.rendered
                        ? media.caption.rendered.replace(/<[^>]*>/g, '').trim()
                        : '',
                      url: mediaUrl,
                      path: filePath || mediaUrl,
                      folderPath: filePath || mediaUrl,
                      type: media.media_type || '',
                      isPrivate: false,
                      alt_text: media.alt_text || '',
                      featured_media: media.featured_media,
                      media_details: media.media_details,
                      postId: media.post || '',
                      organization: organizationData,
                      property: propertyData,
                      createdAt: media.date ? new Date(media.date) : new Date(),
                      updatedAt: media.modified ? new Date(media.modified) : new Date(),
                      createdBy: { userId: user.sub, userName: user.name },
                      updatedBy: { userId: user.sub, userName: user.name },
                    };
                    const { data: savedFile } = await this.fileUploadService.saveFileToDB(fileObj);
                    featuredMedia = {
                      id: savedFile.id,
                      fileName: savedFile.fileName,
                      url: savedFile.url,
                      path: savedFile.path,
                    };
                    await this.redisService.set(redisKey, savedFile);
                  }
                } catch (error) {
                  this.logger.warn(
                    `[WordPressProvider V2] Error fetching media ${source.featured_media.id}: ${error.message}`,
                    this.constructor.name
                  );
                }
                totalMediaTime += Date.now() - mediaStartTime;
              }

              // --- Generate unique slug ---
              const title = source.title || 'Untitled';
              const excerpt = source.excerpt || '';
              const rawFullSlug = source.link.replace(this.wpBaseUrl + '/', '');
              const fullSlugLastSegment = rawFullSlug.split('/').pop() ?? '';
              const fullSlug = /^\d+$/.test(fullSlugLastSegment) ? `${rawFullSlug}-` : rawFullSlug;
              const seo = {
                title: source.seo_meta?.rank_math_title,
                description: source.seo_meta?.rank_math_description,
                keywords: (source.seo_meta?.rank_math_focus_keyword || '')
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean),
              };
              const seoObj = buildSeoObject(seo, title, excerpt, featuredMedia?.url);

              if (limit) {
                this.logger.log(
                  `[WordPressProvider] syncTags: processing slug="${source.slug}" fullSlug="${fullSlug}" wpId=${source.id}`,
                  this.constructor.name
                );
              }
              const rawSlug = source.slug;
              const articleSlug = /^\d+$/.test(rawSlug) ? `${rawSlug}-` : rawSlug;
              // rawSlug = await this.slugService.generateUniqueSlug(
              //   title,
              //   ModuleName.ARTICLE,
              //   user,
              //   seoObj,
              //   defaultPropertyId,
              //   articleSlug,
              //   fullSlug
              // );

              // --- Build article document ---
              const buildAuthorMetadata = (author: any) =>
                author
                  ? {
                      id: author._id?.toString() || author.id,
                      name: author.name,
                      email: author.email || '',
                      userType: UserType.AUTHOR,
                    }
                  : buildUserMetadata(user);
              const articleDoc: any = {
                organization: organizationData,
                property: propertyData,
                title,
                slug: articleSlug,
                fullSlug,
                excerpt,
                body: source.content || '',
                status: this.mapWordPressStatus(source.status),
                type: source.post_format || 'article',
                lang: 'hi',
                categories: categories.length > 0 ? categories : [],
                tags: tags.length > 0 ? tags : [],
                authors: authors.length > 0 ? authors : [],
                publishedAt: source.date ? new Date(source.date) : null,
                featuredMedia,
                featured_media: source.featured_media?.id || null,
                primaryCategory,
                wpId: source.id,
                // seo sub-document intentionally omitted: Mongoose 8 crashes on applyDefaults
                // when Seo.keywords uses @Prop() without explicit type:[String].
                // SEO data stored in flat fields below until schema is fixed on the server.
                metaTitle: source.seo_meta?.rank_math_title || '',
                metaDescription: source.seo_meta?.rank_math_description || '',
                keyword: source.seo_meta?.rank_math_focus_keyword || '',
                wpCategoryIds: source.categories ? source.categories.map((c: any) => c.id) : [],
                wpTagIds: source.tags ? source.tags.map((t: any) => t.id) : [],
                header: source.header || null,
                createdBy: buildAuthorMetadata(authorForMetadata),
                updatedBy: buildAuthorMetadata(authorForMetadata),
                createdAt: source.date ? new Date(source.date) : undefined,
                updatedAt: source.modified ? new Date(source.modified) : undefined,
              };
              return {
                ok: true,
                wpPostId: source.id,
                doc: articleDoc,
                durationMs: Date.now() - articleStartTime,
              };
            } catch (err: any) {
              const msg = err?.message || String(err);
              this.logger.error(
                `[WordPressProvider V2] Failed building article for wpPostId ${hit._source?.id}: ${msg}`,
                err?.stack,
                this.constructor.name
              );
              return { ok: false, wpPostId: hit._source?.id, error: msg };
            }
          })(hit);
          buildResults.push(result);
        }

        // 3. Separate successes and failures
        const docsToUpdate: any[] = [];
        for (const res of buildResults) {
          if (res.ok) {
            docsToUpdate.push(res.doc);
          } else {
            errors.push({
              wpPostId: res.wpPostId,
              error: res.error,
            });
          }
        }

        // 4. Bulk update existing articles: set tags, categories and related fields
        if (docsToUpdate.length > 0) {
          const updateStart = Date.now();
          try {
            const bulkOps = docsToUpdate.map((doc) => ({
              updateOne: {
                filter: { wpId: doc.wpId },
                update: {
                  $set: {
                    tags: doc.tags,
                    categories: doc.categories,
                    primaryCategory: doc.primaryCategory,
                    wpTagIds: doc.wpTagIds,
                    wpCategoryIds: doc.wpCategoryIds,
                    authors: doc.authors,
                    featuredMedia: doc.featuredMedia,
                  },
                },
              },
            }));
            const result = await this.articleModel.collection.bulkWrite(bulkOps, {
              ordered: false,
            });
            const updatedCount = result.modifiedCount || 0;
            importedCount += updatedCount;
            this.logger.log(
              `[WordPressProvider syncTags] Bulk updated ${updatedCount}/${docsToUpdate.length} articles (${Date.now() - updateStart}ms) [Total updated: ${importedCount}]`,
              this.constructor.name
            );
          } catch (err: any) {
            this.logger.error(
              `[WordPressProvider syncTags] Bulk update error: ${err?.message || err}`,
              err?.stack,
              this.constructor.name
            );
            errors.push({ error: err?.message || 'Bulk update failed' });
          }
        }

        // 5. Check limit and advance search_after cursor
        if (limit && totalFetched >= limit) {
          this.logger.log(
            `[WordPressProvider V2] Reached limit of ${limit} articles, stopping.`,
            this.constructor.name
          );
          hasMore = false;
        } else if (hits.length < batchSize) {
          hasMore = false;
        } else {
          searchAfter = hits[hits.length - 1].sort;
        }
      }

      const totalDuration = Date.now() - startTime;
      const avgTimePerArticle = importedCount > 0 ? Math.round(totalDuration / importedCount) : 0;

      this.logger.log(
        `[WordPressProvider V2] Import completed. Fetched: ${totalFetched}, Imported: ${importedCount}, Errors: ${errors.length}, Duration: ${totalDuration}ms, Avg: ${avgTimePerArticle}ms`,
        this.constructor.name
      );
      this.logger.log(
        `[WordPressProvider V2] Avg Tag: ${importedCount ? Math.round(totalTagTime / importedCount) : 0}ms, Avg Category: ${importedCount ? Math.round(totalCategoryTime / importedCount) : 0}ms, Avg Media: ${importedCount ? Math.round(totalMediaTime / importedCount) : 0}ms, Avg Author: ${importedCount ? Math.round(totalAuthorTime / importedCount) : 0}ms`,
        this.constructor.name
      );

      return {
        success: true,
        imported: importedCount,
        errors,
        duration: totalDuration,
        avgTimePerArticle,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider V2] Failed to fetch from Elasticsearch:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );

      throw new Error(`Failed to fetch Elasticsearch articles: ${error.message}`);
    }
  }
  async migrateArticlesV3(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult> {
    this.logger.log(
      `[WordPressProvider] Starting articles migration V3 (Elasticsearch source: wp_posts_prod_v2)${limit ? ` [LIMIT: ${limit}]` : ''}${dateFrom || dateTo ? ` [DATE RANGE: ${dateFrom || '*'} to ${dateTo || '*'}]` : ''}`,
      this.constructor.name
    );

    const defaultPropertyId = propertyId || '6926b8f59a288ddf06a28884';
    const startTime = Date.now();
    let importedCount = 0;
    const errors = [];
    const batchSize = limit ? Math.min(limit, 500) : 500;
    let totalFetched = 0;

    let totalTagTime = 0;
    let totalCategoryTime = 0;
    let totalMediaTime = 0;
    let totalAuthorTime = 0;

    const ES_INDEX = 'wp_posts_prod_v2';

    // Fetch organization and property data once before the loop
    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const property = await this._propertyService.getById(defaultPropertyId);
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    try {
      let searchAfter: any[] | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const filters: any[] = [
          { term: { status: 'publish' } },
          { term: { type: 'post' } },
          { exists: { field: 'header' } },
        ];

        // Add date range filter if dateFrom or dateTo is provided (dd-mm-yyyy)
        if (dateFrom || dateTo) {
          const parseDate = (d: string): string => {
            const [day, month, year] = d.split('-');
            return `${year}-${month}-${day}`;
          };
          const rangeFilter: any = { range: { modified: {} } };
          if (dateFrom) {
            rangeFilter.range.modified.gte = parseDate(dateFrom);
          }
          if (dateTo) {
            rangeFilter.range.modified.lte = parseDate(dateTo);
          }
          filters.push(rangeFilter);
        }

        const searchQuery: any = {
          size: batchSize,
          sort: [{ modified: { order: 'asc' } }, { id: { order: 'asc' } }],
          query: {
            bool: {
              filter: filters,
            },
          },
        };

        if (searchAfter) {
          searchQuery.search_after = searchAfter;
        }

        const response = await this.elasticService.search(ES_INDEX, searchQuery);
        const hits = response.hits?.hits;

        if (!hits || hits.length === 0) {
          hasMore = false;
          break;
        }

        totalFetched += hits.length;
        this.logger.log(
          `[WordPressProvider V3] Fetched ${hits.length} posts from ES (total: ${totalFetched})`,
          this.constructor.name
        );

        // 1. Deduplicate: filter out posts already in articles collection or slugs collection
        const slugs = hits.map((hit: any) => hit._source?.slug).filter((s: any) => s != null);
        const fullSlugs = hits
          .map((hit: any) => {
            const link = hit._source?.link || '';
            const raw = link.replace(this.wpBaseUrl + '/', '');
            const lastSeg = raw.split('/').pop() ?? '';
            return /^\d+$/.test(lastSeg) ? `${raw}-` : raw;
          })
          .filter(Boolean);

        const [existingArticleSlugs, existingFullSlugs] = await Promise.all([
          this.articleModel
            .find({ slug: { $in: slugs } }, { slug: 1 })
            .lean()
            .exec()
            .then((docs) => new Set(docs.map((a) => a.slug))),
          this.slugModel
            .find({ fullSlug: { $in: fullSlugs } }, { fullSlug: 1 })
            .lean()
            .exec()
            .then((docs) => new Set(docs.map((s: any) => s.fullSlug))),
        ]);

        const newHits = hits.filter((hit: any) => {
          const slug = hit._source?.slug;
          const raw = (hit._source?.link || '').replace(this.wpBaseUrl + '/', '');
          const lastSeg = raw.split('/').pop() ?? '';
          const fullSlug = /^\d+$/.test(lastSeg) ? `${raw}-` : raw;
          return slug && !existingArticleSlugs.has(slug) && !existingFullSlugs.has(fullSlug);
        });

        this.logger.log(
          `[WordPressProvider V3] Dedup: ${existingArticleSlugs.size} by slug + ${existingFullSlugs.size} by fullSlug already exist → ${newHits.length} new to process`,
          this.constructor.name
        );

        if (newHits.length === 0) {
          if (hits.length < batchSize || (limit && totalFetched >= limit)) {
            hasMore = false;
          } else {
            searchAfter = hits[hits.length - 1].sort;
          }
          continue;
        }

        // 2. Build article documents from ES data (process sequentially to limit memory)
        // Collect pending media files for bulk insert (keyed by wpPostId)
        const pendingMediaFiles: Map<
          number,
          { fileObj: IFile; redisKey: string; wpMediaId: number }
        > = new Map();
        const buildResults: any[] = [];
        for (const hit of newHits) {
          const result = await (async (hit: any) => {
            try {
              const source = hit._source;
              const articleStartTime = Date.now();

              // --- Resolve categories from Redis/DB using WP category IDs ---
              let primaryCategory: any = null;
              let categories: any[] = [];
              const categoryStartTime = Date.now();

              if (source.categories && source.categories.length > 0) {
                const fetchedCategories: any[] = [];
                for (const esCat of source.categories) {
                  let cat = null;
                  try {
                    const redisKey = `wp-category-${esCat.id}`;
                    const redisCategory = await this.redisService.get(redisKey);
                    if (redisCategory) {
                      cat = {
                        id: redisCategory._id?.toString() || redisCategory.id,
                        title: redisCategory.title,
                        titleHn: redisCategory.titleHn,
                        slug: redisCategory.slug,
                        fullSlug: redisCategory.fullSlug,
                        status: redisCategory.status,
                        isFeatured: redisCategory.isFeatured,
                        isPublic: redisCategory.isPublic,
                        link: redisCategory.link,
                        rank: redisCategory.rank,
                        wpCategoryId: redisCategory.wpCategoryId,
                        count: redisCategory.count,
                      };
                    } else {
                      // Fallback: use category data from ES response directly
                      const dbCat = await this.categoryModel
                        .findOne({ wpCategoryId: esCat.id })
                        .lean()
                        .exec();
                      if (dbCat) {
                        cat = {
                          id: dbCat._id.toString(),
                          title: dbCat.title,
                          titleHn: dbCat.titleHn,
                          slug: dbCat.slug,
                          fullSlug: dbCat.fullSlug,
                          status: dbCat.status,
                          isFeatured: dbCat.isFeatured,
                          isPublic: dbCat.isPublic,
                          link: dbCat.link,
                          rank: dbCat.rank,
                          wpCategoryId: dbCat.wpCategoryId,
                          count: dbCat.count,
                        };
                      }
                    }
                  } catch (error) {
                    this.logger.warn(
                      `[WordPressProvider V2] Error fetching category ${esCat.id}: ${error.message}`,
                      this.constructor.name
                    );
                  }
                  if (cat) fetchedCategories.push(cat);
                }

                if (fetchedCategories.length > 0) {
                  primaryCategory = fetchedCategories[0];
                  categories = fetchedCategories;
                }
              }
              totalCategoryTime += Date.now() - categoryStartTime;

              // --- Resolve tags from Redis/DB using WP tag IDs ---
              const tags: any[] = [];
              const tagStartTime = Date.now();
              if (source.tags && source.tags.length > 0) {
                for (const esTag of source.tags) {
                  try {
                    const dbTag = await this.tagModel.findOne({ wpTagId: esTag.id }).exec();
                    if (dbTag) {
                      const buildTagSub = (t: any) => ({
                        id: t._id?.toString() || t.id,
                        name: t.name,
                        slug: t.slug,
                        description: t.description,
                        rank: t.rank,
                        status: t.status,
                        isFeatured: t.isFeatured,
                        link: t.link,
                        wpTagId: t.wpTagId,
                        count: t.count,
                      });
                      const redisKey = `wp-tag-${dbTag.name}`;
                      const redisTag = await this.redisService.get(redisKey);
                      tags.push(buildTagSub(redisTag ?? dbTag));
                    }
                  } catch (error) {
                    this.logger.warn(
                      `[WordPressProvider V2] Error fetching tag ${esTag.id}: ${error.message}`,
                      this.constructor.name
                    );
                  }
                }
              }
              totalTagTime += Date.now() - tagStartTime;

              // --- Resolve author from Redis using WP author ID ---
              let authors: any[] = [];
              let authorForMetadata: any = null;
              const authorStartTime = Date.now();
              if (source.author && source.author.id) {
                try {
                  const redisKey = `wp-user-${source.author.id}`;
                  const redisUser = await this.redisService.get(redisKey);
                  if (redisUser) {
                    authorForMetadata = redisUser;
                    authors = [
                      {
                        id: redisUser._id?.toString() || redisUser.id,
                        name: redisUser.name,
                        username: redisUser.username,
                        slug: redisUser.slug,
                        profilePicture: redisUser.profilePicture,
                      },
                    ];
                  }
                } catch (error) {
                  this.logger.warn(
                    `[WordPressProvider V2] Error fetching author ${source.author.id}: ${error.message}`,
                    this.constructor.name
                  );
                }
              }
              totalAuthorTime += Date.now() - authorStartTime;

              // --- Resolve featured media from ES response data ---
              let featuredMedia: any = null;
              if (source.featured_media && source.featured_media.url) {
                const mediaStartTime = Date.now();
                const redisKey = `wp-media-key-${source.featured_media.id}`;
                const redisMedia = await this.redisService.get(redisKey);
                if (redisMedia) {
                  featuredMedia = {
                    id: redisMedia.id,
                    fileName:
                      redisMedia.fileName ||
                      source.featured_media.title ||
                      source.featured_media.slug ||
                      'image',
                    url: redisMedia.url,
                    path: redisMedia.path,
                  };
                } else {
                  // Collect for bulk insert instead of saving individually
                  const relativePath = source.featured_media.url;
                  const fileObj: IFile = {
                    fileName:
                      source.featured_media.title ||
                      source.featured_media.slug ||
                      relativePath.split('/').pop() ||
                      'image',
                    url: source.featured_media.url,
                    folderPath: relativePath,
                    mimeType:
                      relativePath
                        .match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)?.[0]
                        ?.replace('.', 'image/') || 'image/jpeg',
                    organization: {
                      id: organizationData.id,
                      name: organizationData.name,
                      slug: organizationData.slug,
                      domain: organizationData.domain,
                    },
                    property: {
                      id: propertyData.id,
                      name: propertyData.name,
                      domain: propertyData.domain,
                    },
                    path: relativePath,
                    caption: source.featured_media.caption,
                    wpId: source.featured_media.id,
                    isPrivate: false,
                    createdBy: {
                      userId: user.sub,
                      userName: user.name,
                    },
                  };
                  pendingMediaFiles.set(source.id, {
                    fileObj,
                    redisKey,
                    wpMediaId: source.featured_media.id,
                  });
                }
                totalMediaTime += Date.now() - mediaStartTime;
              }

              // --- Generate unique slug ---
              const title = source.title || 'Untitled';
              const excerpt = source.excerpt || '';
              const rawFullSlug = source.link.replace(this.wpBaseUrl + '/', '');
              const fullSlugLastSegment = rawFullSlug.split('/').pop() ?? '';
              const fullSlug = /^\d+$/.test(fullSlugLastSegment) ? `${rawFullSlug}-` : rawFullSlug;
              const seo = {
                title: source.seo_meta?.rank_math_title,
                description: source.seo_meta?.rank_math_description,
                keywords: (source.seo_meta?.rank_math_focus_keyword || '')
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean),
              };
              const seoObj = buildSeoObject(seo, title, excerpt, featuredMedia?.url);
              let rawSlug = source.slug;
              const articleSlug = /^\d+$/.test(rawSlug) ? `${rawSlug}-` : rawSlug;
              rawSlug = await this.slugService.generateUniqueSlug(
                title,
                ModuleName.ARTICLE,
                user,
                seoObj,
                defaultPropertyId,
                articleSlug,
                fullSlug
              );

              // --- Build article document ---
              const buildAuthorMetadata = (author: any) =>
                author
                  ? {
                      id: author._id?.toString() || author.id,
                      name: author.name,
                      email: author.email || '',
                      userType: UserType.AUTHOR,
                    }
                  : buildUserMetadata(user);

              const articleDoc: any = {
                organization: organizationData,
                property: propertyData,
                title,
                slug: articleSlug,
                fullSlug,
                excerpt,
                body: source.content || '',
                status: this.mapWordPressStatus(source.status),
                type: source.post_format || 'article',
                lang: 'hi',
                categories: categories.length > 0 ? categories : [],
                tags: tags.length > 0 ? tags : [],
                authors: authors.length > 0 ? authors : [],
                publishedAt: source.date ? new Date(source.date) : null,
                featuredMedia,
                featured_media: source.featured_media?.id || null,
                primaryCategory,
                wpId: source.id,
                // seo sub-document intentionally omitted: Mongoose 8 crashes on applyDefaults
                // when Seo.keywords uses @Prop() without explicit type:[String].
                // SEO data stored in flat fields below until schema is fixed on the server.
                metaTitle: source.seo_meta?.rank_math_title || '',
                metaDescription: source.seo_meta?.rank_math_description || '',
                keyword: source.seo_meta?.rank_math_focus_keyword || '',
                wpCategoryIds: source.categories ? source.categories.map((c: any) => c.id) : [],
                wpTagIds: source.tags ? source.tags.map((t: any) => t.id) : [],
                header: source.header || null,
                createdBy: buildAuthorMetadata(authorForMetadata),
                updatedBy: buildAuthorMetadata(authorForMetadata),
                createdAt: source.date ? new Date(source.date) : undefined,
                updatedAt: source.modified ? new Date(source.modified) : undefined,
              };
              return {
                ok: true,
                wpPostId: source.id,
                doc: articleDoc,
                durationMs: Date.now() - articleStartTime,
              };
            } catch (err: any) {
              const msg = err?.message || String(err);
              this.logger.error(
                `[WordPressProvider V2] Failed building article for wpPostId ${hit._source?.id}: ${msg}`,
                err?.stack,
                this.constructor.name
              );
              return { ok: false, wpPostId: hit._source?.id, error: msg };
            }
          })(hit);
          buildResults.push(result);
        }

        // 2b. Bulk insert pending media files into MongoDB
        if (pendingMediaFiles.size > 0) {
          const mediaStartTime = Date.now();
          const pendingEntries = Array.from(pendingMediaFiles.entries());
          const fileObjs = pendingEntries.map(([, entry]) => entry.fileObj);

          try {
            const { data: savedFiles } = await this.fileUploadService.saveFilesToDB(fileObjs);

            // Map saved files back to their articles by URL (robust against partial failures and reordering)
            for (const savedFile of savedFiles) {
              const matchingEntry = pendingEntries.find(
                ([, entry]) => entry.fileObj.url === savedFile.url
              );
              if (!matchingEntry) continue;
              const [wpPostId, entry] = matchingEntry;
              const mediaData = {
                id: savedFile.id,
                fileName: savedFile.fileName,
                url: savedFile.url,
                path: savedFile.path,
              };

              // Cache in Redis
              await this.redisService.set(entry.redisKey, mediaData);

              // Update the article doc's featuredMedia
              const buildResult = buildResults.find((r) => r.ok && r.wpPostId === wpPostId);
              if (buildResult) {
                buildResult.doc.featuredMedia = mediaData;
              }
            }

            this.logger.log(
              `[WordPressProvider V2] Bulk inserted ${savedFiles.length} media files (${Date.now() - mediaStartTime}ms)`,
              this.constructor.name
            );
          } catch (err: any) {
            this.logger.error(
              `[WordPressProvider V2] Bulk media insert error: ${err?.message || err}`,
              err?.stack,
              this.constructor.name
            );
            // Media insert failure is non-fatal; articles will have null featuredMedia
            for (const [wpPostId] of pendingEntries) {
              errors.push({ wpPostId, error: `Media bulk insert failed: ${err?.message || err}` });
            }
          }
          totalMediaTime += Date.now() - mediaStartTime;
        }

        // 3. Separate successes and failures
        const docsToInsert: any[] = [];
        for (const res of buildResults) {
          if (res.ok) {
            docsToInsert.push(res.doc);
          } else {
            errors.push({
              wpPostId: res.wpPostId,
              error: res.error,
            });
          }
        }

        // 4. Bulk insert into MongoDB
        if (docsToInsert.length > 0) {
          const insertStart = Date.now();
          try {
            // Use raw collection driver to bypass Mongoose timestamp middleware,
            // preserving explicit createdAt/updatedAt values from the source data.
            const result = await this.articleModel.collection.insertMany(docsToInsert, {
              ordered: false,
            });
            const insertedCount = result.insertedCount;
            importedCount += insertedCount;
            this.logger.log(
              `[WordPressProvider V2] Bulk inserted ${insertedCount}/${docsToInsert.length} articles (${Date.now() - insertStart}ms) [Total imported: ${importedCount}]`,
              this.constructor.name
            );

            // Mongoose 8 + ordered:false silently returns 0 when all docs fail — diagnose it
            if (insertedCount === 0 && docsToInsert.length > 0) {
              this.logger.warn(
                `[WordPressProvider V2] insertMany returned 0/${docsToInsert.length} — probing first doc (wpId=${docsToInsert[0]?.wpId}) to surface error`,
                this.constructor.name
              );
              try {
                await this.articleModel.create(docsToInsert[0]);
              } catch (diagErr: any) {
                this.logger.error(
                  `[WordPressProvider V2] Probe error for wpId=${docsToInsert[0]?.wpId}: ${diagErr?.message}`,
                  diagErr?.stack,
                  this.constructor.name
                );
              }
            }

            // Enqueue rich block conversion for each inserted article
            const insertedIds = Object.values(result.insertedIds);
            await this.richBlocksQueue.addBulk(
              insertedIds.map((id) => ({
                data: { articleId: id.toString(), user },
                opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
              }))
            );
            this.logger.log(
              `[WordPressProvider V2] Enqueued ${insertedCount} articles for rich block conversion`,
              this.constructor.name
            );
          } catch (err: any) {
            const insertedDocs = err?.insertedDocs || err?.result?.insertedDocs;
            if (Array.isArray(insertedDocs) && insertedDocs.length > 0) {
              importedCount += insertedDocs.length;

              // Enqueue partially inserted docs too
              await this.richBlocksQueue.addBulk(
                insertedDocs.map((doc: any) => ({
                  data: { articleId: doc._id.toString(), user },
                  opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
                }))
              );
            }

            const writeErrors = err?.writeErrors || err?.result?.result?.writeErrors;
            if (Array.isArray(writeErrors) && writeErrors.length > 0) {
              for (const we of writeErrors) {
                this.logger.warn(
                  `[WordPressProvider V2] Bulk insert failed for wpPostId ${we?.op?.wpPostId ?? 'unknown'}: ${
                    we?.errmsg || we?.message || 'Bulk insert write error'
                  }`,
                  this.constructor.name
                );
                errors.push({
                  wpPostId: we?.op?.wpPostId ?? null,
                  error: we?.errmsg || we?.message || 'Bulk insert write error',
                });
              }
            } else {
              errors.push({
                wpPostId: null,
                error: err?.message || 'Bulk insert failed',
              });
            }

            this.logger.error(
              `[WordPressProvider V2] Bulk insert error (${Date.now() - insertStart}ms):`,
              err?.message || err,
              this.constructor.name
            );
          }
        }

        // 5. Check limit and advance search_after cursor
        if (limit && totalFetched >= limit) {
          this.logger.log(
            `[WordPressProvider V2] Reached limit of ${limit} articles, stopping.`,
            this.constructor.name
          );
          hasMore = false;
        } else if (hits.length < batchSize) {
          hasMore = false;
        } else {
          searchAfter = hits[hits.length - 1].sort;
        }
      }

      const totalDuration = Date.now() - startTime;
      const avgTimePerArticle = importedCount > 0 ? Math.round(totalDuration / importedCount) : 0;

      this.logger.log(
        `[WordPressProvider V2] Import completed. Fetched: ${totalFetched}, Imported: ${importedCount}, Errors: ${errors.length}, Duration: ${totalDuration}ms, Avg: ${avgTimePerArticle}ms`,
        this.constructor.name
      );
      this.logger.log(
        `[WordPressProvider V2] Avg Tag: ${importedCount ? Math.round(totalTagTime / importedCount) : 0}ms, Avg Category: ${importedCount ? Math.round(totalCategoryTime / importedCount) : 0}ms, Avg Media: ${importedCount ? Math.round(totalMediaTime / importedCount) : 0}ms, Avg Author: ${importedCount ? Math.round(totalAuthorTime / importedCount) : 0}ms`,
        this.constructor.name
      );

      return {
        success: true,
        imported: importedCount,
        errors,
        duration: totalDuration,
        avgTimePerArticle,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider V2] Failed to fetch from Elasticsearch:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );

      throw new Error(`Failed to fetch Elasticsearch articles: ${error.message}`);
    }
  }
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
   */
  /**
   * Converts HTML content to BlockNote-compatible richBlocks structure,
   * handling bold/strong tags and mapping inline styles to BlockNote marks.
   */
  private async convertHtmlToRichBlocks(
    title: string,
    htmlContent: string,
    user?: any
  ): Promise<any[]> {
    if (!htmlContent && !title) {
      return [];
    }

    const blocks: any[] = [];
    let blockIdCounter = 0;
    const generateBlockId = () => {
      return `block-${Date.now()}-${blockIdCounter++}`;
    };
    let blockOrder = 0;

    // Utility: Create content inline span objects from text & entity runs
    // Handles <b>, <strong>, <i>, <em>, <u>
    const parseInlineFormatting = (html: string): Array<any> => {
      // We parse HTML into tokens, handling only allowed tags (<b>, <strong>, <i>, <em>, <u>, <a>)
      // This simple parser does not recurse arbitrarily but handles most common cases
      const content: Array<any> = [];
      // Use a DOM parser if we're in a browser; otherwise, fallback to regex-based tokenization
      // For Node environments, a simple regexp-based walk suffices for basic styling
      const tagRegex = /<(\/?)(b|strong|i|em|u|a)(?:\s+href="([^"]*)")?\s*>/gi;
      let match: RegExpExecArray | null;
      const stylesStack: any[] = [];
      let lastIndex = 0;

      while ((match = tagRegex.exec(html))) {
        if (match.index > lastIndex) {
          // Plain text up to tag
          const text = html.substring(lastIndex, match.index);
          if (text) {
            const styles = styleObjFromStack(stylesStack);
            content.push({
              type: 'text',
              text: decodeHtmlEntities(text),
              ...(Object.keys(styles).length > 0 ? { styles } : {}),
            });
          }
        }
        const [, closing, tag, href] = match;
        if (!closing) {
          // opening tag
          if (tag === 'b' || tag === 'strong') {
            stylesStack.push('bold');
          } else if (tag === 'i' || tag === 'em') {
            stylesStack.push('italic');
          } else if (tag === 'u') {
            stylesStack.push('underline');
          } else if (tag === 'a') {
            stylesStack.push({ link: href });
          }
        } else {
          // closing
          if (tag === 'b' || tag === 'strong') {
            removeLastFromStack(stylesStack, 'bold');
          } else if (tag === 'i' || tag === 'em') {
            removeLastFromStack(stylesStack, 'italic');
          } else if (tag === 'u') {
            removeLastFromStack(stylesStack, 'underline');
          } else if (tag === 'a') {
            removeLastLinkFromStack(stylesStack);
          }
        }
        lastIndex = tagRegex.lastIndex;
      }
      // After all tags, anything left to the end
      if (lastIndex < html.length) {
        const text = html.substr(lastIndex);
        if (text) {
          const styles = styleObjFromStack(stylesStack);
          content.push({
            type: 'text',
            text: decodeHtmlEntities(text),
            ...(Object.keys(styles).length > 0 ? { styles } : {}),
          });
        }
      }
      // Filter out empty text fragments
      return content.filter((span) => span.text && span.text.length > 0);
    };

    // Utility: Decodes typical html entities to their corresponding characters
    const decodeHtmlEntities = (str: string): string => {
      return str
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/<br\s*\/?>/gi, '\n');
    };

    // This now returns just the style flags, to embed under a "styles" key if present
    const styleObjFromStack = (stack: any[]): any => {
      const styles: any = {};
      for (const item of stack) {
        if (item === 'bold') styles.bold = true;
        if (item === 'italic') styles.italic = true;
        if (item === 'underline') styles.underline = true;
        if (typeof item === 'object' && item.link) styles.href = item.link;
      }
      return styles;
    };

    function removeLastFromStack(stack: any[], marker: string) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === marker) {
          stack.splice(i, 1);
          break;
        }
      }
    }
    function removeLastLinkFromStack(stack: any[]) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (typeof stack[i] === 'object' && stack[i].link) {
          stack.splice(i, 1);
          break;
        }
      }
    }

    // Helper for image tag parser
    const parseImageTag = (html: string) => {
      const imgTag = html.match(/<img\b[^>]*>/i);
      if (!imgTag) return null;
      const tag = imgTag[0];
      const getAttr = (name: string) => {
        const r = new RegExp(`${name}\\s*=\\s*"(.*?)"`, 'i').exec(tag);
        return r ? r[1] : '';
      };
      return {
        url: getAttr('src'),
        alt: getAttr('alt'),
        caption: getAttr('title'),
      };
    };

    // Extract image path (same as original version)
    const extractPathFromUrl = (url: string): string => {
      try {
        try {
          const u = new URL(url);
          return u.pathname + (u.search || '');
        } catch {
          // fallback if not a valid absolute URL
          const match =
            url.match(/\.com(\/.*)/i) || url.match(/\.org(\/.*)/i) || url.match(/\.net(\/.*)/i);
          return match ? match[1] : url;
        }
      } catch {
        return url;
      }
    };

    // Remove script and style tags
    const cleanHtml = (htmlContent || '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // 1. Add title as first heading (with blocknote text marks support)
    if (title && title.trim()) {
      blocks.push({
        id: generateBlockId(),
        type: 'heading',
        content: [
          {
            type: 'text',
            text: title.trim(),
          },
        ],
        metadata: {
          props: {
            backgroundColor: 'default',
            textColor: 'default',
            textAlignment: 'left',
            level: 1,
            isToggleable: false,
          },
          children: [],
        },
        order: blockOrder++,
      });
    }

    // 2. Parse and convert htmlContent into blocks (now supporting bold/italic/underline/link)
    const htmlLines = cleanHtml.split(/(?=<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div|img)[\s>])/i);

    for (const rawLine of htmlLines) {
      const trimmedLine = rawLine.trim();
      if (!trimmedLine) continue;

      // Headings (h1-h6)
      const headingMatch = trimmedLine.match(/^<h([1-6])[\s>]/i);
      if (headingMatch) {
        const level = parseInt(headingMatch[1], 10);
        // Clean tags except inline
        const lineContentHtml = trimmedLine.replace(/^<h[1-6][^>]*>|<\/h[1-6]>/gi, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
              level,
              isToggleable: false,
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Images
      if (/^<img[\s>]/i.test(trimmedLine)) {
        const imgInfo = parseImageTag(trimmedLine);
        if (imgInfo && imgInfo.url && !imgInfo.url.startsWith('data:')) {
          const imagePath = extractPathFromUrl(imgInfo.url);

          let mongoId = undefined;
          if (this.fileUploadService && user && user.organizationId && user.sub) {
            const fileObj = {
              fileName: imgInfo.alt || imgInfo.caption || imagePath.split('/').pop() || 'image',
              url: imgInfo.url,
              folderPath: imagePath,
              mimeType: imgInfo.url.split('.').pop() || '',
              organization: { id: user.organizationId },
              path: imagePath,
              size: 0,
              isPrivate: false,
              createdBy: {
                userId: user.sub,
                userName: user.name,
              },
            };
            try {
              const { data: savedFile } = await this.fileUploadService.saveFileToDB(fileObj);
              mongoId = savedFile.id;
            } catch (err) {
              mongoId = undefined;
            }
          }

          blocks.push({
            id: generateBlockId(),
            type: 'image',
            metadata: {
              props: {
                textAlignment: 'left',
                backgroundColor: 'default',
                name: imgInfo.alt || '',
                url: imgInfo.url,
                path: imagePath,
                caption: imgInfo.caption || '',
                showPreview: true,
                id: mongoId,
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // Unordered list item (within <ul>)
      if (
        /^<li[\s>]/i.test(trimmedLine) &&
        /<ul/i.test(cleanHtml.substring(0, cleanHtml.indexOf(trimmedLine)))
      ) {
        // Remove <li> and </li>, preserve inline tags
        const lineContentHtml = trimmedLine.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'bulletListItem',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Ordered list item (within <ol>)
      if (
        /^<li[\s>]/i.test(trimmedLine) &&
        /<ol/i.test(cleanHtml.substring(0, cleanHtml.indexOf(trimmedLine)))
      ) {
        const lineContentHtml = trimmedLine.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'numberedListItem',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Blockquote (render as paragraph with formatting)
      if (/^<blockquote[\s>]/i.test(trimmedLine)) {
        const lineContentHtml = trimmedLine
          .replace(/^<blockquote[^>]*>/i, '')
          .replace(/<\/blockquote>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Paragraph or plain line with text or inline mark tags present
      if (
        /^<p[\s>]/i.test(trimmedLine) ||
        /<(b|strong|i|em|u|a)[\s>]/i.test(trimmedLine) ||
        /<\/(b|strong|i|em|u|a)>/i.test(trimmedLine) ||
        parseInlineFormatting(trimmedLine).length > 0
      ) {
        let lineContentHtml = trimmedLine;
        // Remove paragraph tags but preserve inline formatting
        if (/^<p[\s>]/i.test(trimmedLine)) {
          lineContentHtml = trimmedLine.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '');
        }
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }
    }

    // Fallback: If still no blocks and we have some raw text, render as a paragraph with marks
    if (blocks.length === 0 && cleanHtml) {
      const content = parseInlineFormatting(cleanHtml);
      if (content.length) {
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
      }
    }
    return blocks;
  }
  async migrateLiveArticles(
    user: TCurrentUserType,
    _propertyId?: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting Live Articles migration', this.constructor.name);

    const token = process.env.WP_API_TOKEN || 'dummy_token';
    const baseURL = this.configService.get<string>('WP_BASE_URL');

    const startTime = Date.now();
    const updated = [];
    const errors = [];

    // Helper to generate unique block ID
    const generateBlockId = (): string => {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
    };

    // Helper to parse timestamp string like "6:51 pm, December 24, 2025" to ISO string
    const parseTimestamp = (timestampStr: string): string => {
      try {
        const parts = timestampStr.split(',');
        if (parts.length < 3) {
          throw new Error(`Invalid timestamp format: ${timestampStr}`);
        }
        const timePart = parts[0].trim();
        const datePart = parts[1].trim();
        const yearPart = parts[2].trim();
        const normalizedDateStr = `${datePart}, ${yearPart} ${timePart}`;
        const date = new Date(normalizedDateStr);

        if (isNaN(date.getTime())) {
          throw new Error(`Could not parse date from input: ${timestampStr}`);
        }

        return date.toISOString();
      } catch (error) {
        this.logger.warn(
          `[WordPressProvider] Error parsing timestamp "${timestampStr}": ${error.message}`,
          this.constructor.name
        );
        return new Date().toISOString();
      }
    };

    // Helper to convert live_content to richBlocks
    const convertLiveContentToRichBlocks = async (liveContent: any[]) => {
      const blocks: any[] = [];
      let order = 1;

      for (const item of liveContent) {
        // Timestamp block from data field
        if (item.time) {
          const timestamp = parseTimestamp(item.time);
          blocks.push({
            id: generateBlockId(),
            type: 'timestamp',
            metadata: {
              props: {
                timestamp: timestamp,
                authorName: item.author.name,
                authorId: item.author.id,
                authorSlug: item.author.slug,
              },
              children: [],
            },
            order: order++,
          });
        }

        // Paragraph block from content field
        if (item.content && item.content.trim()) {
          // blocks.push({
          //   id: generateBlockId(),
          //   type: 'paragraph',
          //   content: [{ type: 'text', text: item.content.trim() }],
          //   metadata: {
          //     props: {
          //       backgroundColor: 'default',
          //       textColor: 'default',
          //       textAlignment: 'left',
          //     },
          //     children: [],
          //   },
          //   order: order++,
          // });
          const block = await this._convertHtmlToRichBlocks(undefined, item.content.trim(), user);
          console.log('block', block);
          blocks.push(...block);
        }
      }

      return blocks;
    };

    try {
      // Step 1: Fetch live articles list using the paginated API with last id mechanism
      let lastId = '';
      let hasMore = true;
      let allLiveArticles: any[] = [];
      let pageNumber = 1;
      const pageLimit = 1;

      do {
        const liveListUrl = `${baseURL}/wp-json/api/v1/livebloglist`;
        const params: Record<string, any> = {
          page_number: pageNumber,
          limit: pageLimit,
          token: token,
          orderby: 'id',
          order: 'desc',
        };
        // For first call, do not send 'id', for subsequent calls, send as 'id: lastId'
        if (lastId) {
          params['id'] = lastId;
        }

        const response = await firstValueFrom(
          this.httpService.get(liveListUrl, {
            params,
            headers: { Host: this.wpHost },
          })
        );
        const data = response.data;
        console.log(data);

        if (data.Status !== 'success' || !Array.isArray(data.Data)) {
          this.logger.error(
            `[WordPressProvider] Invalid livebloglist API response: ${JSON.stringify(data)}`,
            this.constructor.name
          );
          throw new Error('Invalid livebloglist API response format');
        }

        if (data.Data.length === 0) {
          hasMore = false;
        } else {
          allLiveArticles = allLiveArticles.concat(data.Data);
          // Update lastId for pagination; this will be used as 'id' in the next call
          lastId = data.Data[data.Data.length - 1]?.id?.toString() || '';
          // WordPress APIs usually stop when less than limit records returned
          hasMore = data.Data.length === pageLimit;
          pageNumber += 1;
        }
        break;
      } while (hasMore);

      this.logger.log(
        `[WordPressProvider] Fetched ${allLiveArticles.length} live article records from list.`,
        this.constructor.name
      );

      // Step 2: For each article, use its slug to fetch live_content via getblogbyslug API
      // Build map: wpPostId/slug pairs for found live articles
      const articlesWithSlug: { post_id: string; slug: string }[] = [];
      allLiveArticles.forEach((rec) => {
        console.log(rec);
        if (rec.post_id) {
          articlesWithSlug.push({
            post_id: rec.post_id.toString(),
            slug: rec.url.split('/').pop(),
          });
        }
      });

      // Step 3: For each found post/slug, update with live_content from getblogbyslug
      console.log(articlesWithSlug);
      for (const item of articlesWithSlug) {
        const wpPostId = item.post_id;
        const slug = item.slug;

        try {
          // Find article by wpPostId
          const article = await this.articleModel
            .findOne({
              wpPostId: wpPostId,
            })
            .exec();

          if (!article) {
            this.logger.warn(
              `[WordPressProvider] Article not found for wpPostId: ${wpPostId}`,
              this.constructor.name
            );
            errors.push({
              wpPostId: wpPostId,
              error: 'Article not found in database',
            });
            continue;
          }

          // Now, fetch the live_content using the slug
          const getBlogBySlugUrl = `${baseURL}/wp-json/api/v1/getblogbyslug`;
          const slugParams = {
            token: token,
            id: '',
            orderby: 'id',
            order: 'desc',
            slug: slug,
            live_limit: 500,
            live_page: 1,
          };

          const blogBySlugResp = await firstValueFrom(
            this.httpService.get(getBlogBySlugUrl, {
              params: slugParams,
              headers: { Host: this.wpHost },
            })
          );
          const blogBySlugData = blogBySlugResp.data;
          console.log(blogBySlugData);
          if (blogBySlugData.Status !== 'success') {
            this.logger.error(
              `[WordPressProvider] Invalid getblogbyslug API response for slug "${slug}": ${JSON.stringify(blogBySlugData)}`,
              this.constructor.name
            );
            errors.push({
              wpPostId: wpPostId,
              slug,
              error: 'Invalid getblogbyslug API response format or missing live_content',
            });
            continue;
          }

          const liveContents = blogBySlugData.Data[0].live_data;

          // Use the single unified live_content array from getblogbyslug
          const newRichBlocks = await convertLiveContentToRichBlocks(liveContents);

          // Get existing richBlocks or initialize empty array
          const existingRichBlocks = article.richBlocks || [];
          const updatedRichBlocks = [...existingRichBlocks, ...newRichBlocks];

          // Update article with appended richBlocks
          await this.articleModel
            .findByIdAndUpdate(
              article._id,
              {
                $set: {
                  richBlocks: updatedRichBlocks,
                  updatedBy: buildUserMetadata(user),
                  updatedAt: new Date(),
                },
              },
              { new: true }
            )
            .exec();

          updated.push({
            wpPostId: wpPostId,
            articleId: article._id.toString(),
            blocksAdded: newRichBlocks.length,
          });

          this.logger.log(
            `[WordPressProvider] Updated article ${wpPostId} with ${newRichBlocks.length} new richBlocks`,
            this.constructor.name
          );
        } catch (error) {
          this.logger.error(
            `[WordPressProvider] Error processing live article ${wpPostId}:`,
            {
              error: error.message,
              stack: error.stack,
              wpPostId: wpPostId,
            },
            this.constructor.name
          );
          errors.push({
            wpPostId: wpPostId,
            error: error.message,
          });
        }
      }

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `[WordPressProvider] Live Articles migration completed. Updated: ${updated.length}, Errors: ${errors.length}, Total Duration: ${totalDuration}ms`,
        this.constructor.name
      );

      return {
        success: true,
        imported: updated.length,
        errors,
        duration: totalDuration,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Failed to migrate live articles:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );

      throw new Error(`Failed to migrate live articles: ${error.message}`);
    }
  }
  async migrateLiveArticlesV2(
    user: TCurrentUserType,
    slug?: string,
    limit?: number
  ): Promise<MigrationResult> {
    this.logger.log(
      '[WordPressProvider] Starting Live Articles V2 migration (via Elasticsearch)',
      this.constructor.name
    );

    const ES_INDEX = 'wp_posts_prod';
    const PAGE_SIZE = 100;
    const startTime = Date.now();
    const updated: any[] = [];
    const errors: any[] = [];

    // Generate unique block ID
    const generateBlockId = (): string =>
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;

    // Parse "2024-08-09 16:48:26" (GMT) → ISO string
    const parseGmtTimestamp = (timeGmt: string): string => {
      try {
        const iso = new Date(timeGmt.replace(' ', 'T') + 'Z').toISOString();
        return isNaN(new Date(iso).getTime()) ? new Date().toISOString() : iso;
      } catch {
        return new Date().toISOString();
      }
    };

    // Convert a single live_data entry array to richBlocks (replaces, not appends)
    const convertLiveDataToRichBlocks = async (liveData: any[]): Promise<any[]> => {
      const blocks: any[] = [];
      let order = 1;

      for (const item of liveData) {
        // Convert all item content (HTML, images, videos, embeds) using the same logic
        // as convertToRichBlocks — _convertHtmlToRichBlocks already handles all block types
        const contentBlocks = item.content?.trim()
          ? await this._convertHtmlToRichBlocks(undefined, item.content.trim(), user)
          : [];

        if (item.time_gmt || item.time) {
          // Timestamp block first, then content blocks follow at the same level (no nesting)
          blocks.push({
            id: generateBlockId(),
            type: 'timestamp',
            metadata: {
              props: {
                timestamp: parseGmtTimestamp(item.time_gmt || item.time),
                authorName: item.author?.name ?? '',
                authorId: item.author?.id ?? '',
                authorSlug: item.author?.slug ?? '',
              },
            },
            order: order++,
          });
          blocks.push(...contentBlocks);
        } else {
          // No timestamp — push content blocks directly
          blocks.push(...contentBlocks);
        }
      }

      return blocks;
    };

    try {
      let from = 0;
      let totalHits = Infinity;
      let totalProcessed = 0;

      while (from < totalHits) {
        const response = await this.elasticService.search(ES_INDEX, {
          from,
          size: PAGE_SIZE,
          query: slug
            ? {
                bool: {
                  must: [
                    {
                      nested: {
                        path: 'live_data',
                        query: { exists: { field: 'live_data.id' } },
                      },
                    },
                    { term: { slug } },
                  ],
                },
              }
            : {
                nested: {
                  path: 'live_data',
                  query: { exists: { field: 'live_data.id' } },
                },
              },
          _source: ['live_data', 'slug'],
        });

        const hits = response.hits?.hits ?? [];
        const total = response.hits?.total;
        totalHits = typeof total === 'object' ? total.value : (total ?? 0);

        if (hits.length === 0) break;

        this.logger.log(
          `[WordPressProvider V2] Fetched page from=${from}, got ${hits.length}/${totalHits} live-blog posts`,
          this.constructor.name
        );

        for (const hit of hits) {
          if (limit !== undefined && totalProcessed >= limit) break;

          const wpPostId = hit._id;
          const slug = (hit._source as any)?.slug;
          const liveData: any[] = (hit._source as any)?.live_data ?? [];
          totalProcessed++;

          if (!liveData.length) {
            this.logger.log(
              `[WordPressProvider V2] Skipping wpPostId=${wpPostId} — no live_data entries`,
              this.constructor.name
            );
            continue;
          }

          this.logger.log(
            `[WordPressProvider V2] Processing wpPostId=${wpPostId} slug=${slug} with ${liveData.length} live_data entries`,
            this.constructor.name
          );

          try {
            const article = await this.articleModel.findOne({ slug }).exec();

            if (!article) {
              this.logger.warn(
                `[WordPressProvider V2] Article not found for slug=${slug} (wpPostId=${wpPostId})`,
                this.constructor.name
              );
              errors.push({ wpPostId, slug, error: 'Article not found in database' });
              continue;
            }

            const richBlocks = await convertLiveDataToRichBlocks(liveData);

            // Use raw collection driver to bypass Mongoose timestamps middleware,
            // so updatedAt and updatedBy are preserved from the original article.
            await this.articleModel.collection.updateOne(
              { _id: article._id },
              { $set: { richBlocks } }
            );

            updated.push({
              wpPostId,
              articleId: article._id.toString(),
              blocksAdded: richBlocks.length,
            });

            this.logger.log(
              `[WordPressProvider V2] Replaced richBlocks for wpPostId=${wpPostId} with ${richBlocks.length} blocks`,
              this.constructor.name
            );
          } catch (err) {
            this.logger.error(
              `[WordPressProvider V2] Error processing wpPostId=${wpPostId}: ${err.message}`,
              { stack: err.stack },
              this.constructor.name
            );
            errors.push({ wpPostId, error: err.message });
          }
        }

        from += hits.length;

        if (limit !== undefined && totalProcessed >= limit) break;
      }

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `[WordPressProvider V2] Live Articles migration completed. Updated: ${updated.length}, Errors: ${errors.length}, Duration: ${totalDuration}ms`,
        this.constructor.name
      );

      return { success: true, imported: updated.length, errors, duration: totalDuration };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider V2] Failed to migrate live articles:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to migrate live articles (V2): ${error.message}`);
    }
  }

  async revertLiveArticlesV2(slug?: string, limit?: number): Promise<MigrationResult> {
    this.logger.log(
      '[WordPressProvider] Reverting Live Articles V2 updatedAt/updatedBy from Elasticsearch',
      this.constructor.name
    );

    const ES_INDEX = 'wp_posts_prod';
    const PAGE_SIZE = 100;
    const startTime = Date.now();
    const updated: any[] = [];
    const errors: any[] = [];

    try {
      let from = 0;
      let totalHits = Infinity;
      let totalProcessed = 0;

      while (from < totalHits) {
        const response = await this.elasticService.search(ES_INDEX, {
          from,
          size: PAGE_SIZE,
          query: slug
            ? {
                bool: {
                  must: [
                    {
                      nested: {
                        path: 'live_data',
                        query: { exists: { field: 'live_data.id' } },
                      },
                    },
                    { term: { slug } },
                  ],
                },
              }
            : {
                nested: {
                  path: 'live_data',
                  query: { exists: { field: 'live_data.id' } },
                },
              },
          _source: ['slug', 'modified'],
        });

        const hits = response.hits?.hits ?? [];
        const total = response.hits?.total;
        totalHits = typeof total === 'object' ? total.value : (total ?? 0);

        if (hits.length === 0) break;

        this.logger.log(
          `[WordPressProvider Revert] Fetched page from=${from}, got ${hits.length}/${totalHits} live-blog posts`,
          this.constructor.name
        );

        for (const hit of hits) {
          if (limit !== undefined && totalProcessed >= limit) break;

          const wpPostId = hit._id;
          const source = hit._source as any;
          const hitSlug = source?.slug;
          totalProcessed++;

          try {
            const article = await this.articleModel.findOne({ slug: hitSlug }).exec();

            if (!article) {
              this.logger.warn(
                `[WordPressProvider Revert] Article not found for slug=${hitSlug} (wpPostId=${wpPostId})`,
                this.constructor.name
              );
              errors.push({ wpPostId, slug: hitSlug, error: 'Article not found in database' });
              continue;
            }

            const revertFields: Record<string, any> = {
              updatedBy: (article as any).createdBy,
            };

            if (source.modified) {
              revertFields.updatedAt = new Date(source.modified);
            }

            await this.articleModel.collection.updateOne(
              { _id: article._id },
              { $set: revertFields }
            );

            updated.push({ wpPostId, slug: hitSlug, articleId: article._id.toString() });

            this.logger.log(
              `[WordPressProvider Revert] Restored updatedAt/updatedBy for slug=${hitSlug}`,
              this.constructor.name
            );
          } catch (err) {
            this.logger.error(
              `[WordPressProvider Revert] Error processing wpPostId=${wpPostId}: ${err.message}`,
              { stack: err.stack },
              this.constructor.name
            );
            errors.push({ wpPostId, slug: hitSlug, error: err.message });
          }
        }

        from += hits.length;

        if (limit !== undefined && totalProcessed >= limit) break;
      }

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `[WordPressProvider Revert] Completed. Reverted: ${updated.length}, Errors: ${errors.length}, Duration: ${totalDuration}ms`,
        this.constructor.name
      );

      return { success: true, imported: updated.length, errors, duration: totalDuration };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider Revert] Failed to revert live articles V2:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to revert live articles V2: ${error.message}`);
    }
  }

  /**
   * Map a WP menu-item object (which may carry inline children as numeric-keyed
   * sibling entries) into the CMS Item shape, recursing into children.
   * subMenuSlug is preserved only as a legacy fallback when WP marks an item
   * as `child: true` but provides no embedded children.
   */
  private _mapWpMenuItemToCmsItem(wpItem: any, menuSlug: string): any {
    const childEntries: any[] = [];
    for (const [key, value] of Object.entries(wpItem || {})) {
      if (/^\d+$/.test(key) && value && typeof value === 'object') {
        childEntries.push(value);
      }
    }

    const item: any = {
      titles: wpItem.title || '',
      link: wpItem.link || '',
      status: 'active',
      type: wpItem.object === 'custom' ? 'custom' : 'same-page',
      rank: wpItem.sort_index || 0,
      object: wpItem.object || 'custom',
      object_id: wpItem.object_id?.toString() || '',
      subMenuSlug:
        wpItem.child && childEntries.length === 0 ? `${menuSlug}-child-${wpItem.id}` : '',
    };

    if (childEntries.length > 0) {
      item.children = childEntries.map((child) => this._mapWpMenuItemToCmsItem(child, menuSlug));
    }

    return item;
  }

  private _mapWpMenuItemsToCmsItems(wpItems: Record<string, any>, menuSlug: string): any[] {
    return Object.values(wpItems || {}).map((wpItem: any) =>
      this._mapWpMenuItemToCmsItem(wpItem, menuSlug)
    );
  }

  async migrateMenus(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting menus migration', this.constructor.name);

    if (!user || !user.email || !user.sub || !user.organizationId) {
      this.logger.error('[WordPressProvider] Invalid user context');
      throw new Error('User authentication required.');
    }

    const effectivePropertyId = propertyId || '6926b8f59a288ddf06a28884';
    const wpApiBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const menuToken = process.env.WP_API_TOKEN || 'dummy_token';

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let created = 0;
    let total = 0;
    const errors = [];
    const startTime = Date.now();

    // Map of wpMenuId -> created menu document (for parent linking)
    const wpMenuIdToMenuDoc: Map<number, TMenuDocument> = new Map();

    try {
      // Step 1: Fetch the list of all menus
      this.logger.log('[WordPressProvider] Fetching menu list', this.constructor.name);

      const menuListResponse = await axios.get(`${wpApiBaseUrl}/wp-json/api/v1/getmenu`, {
        params: { token: menuToken },
        headers: {
          Host: this.wpHost,
        },
        httpsAgent: this.httpsAgent,
        timeout: 30000,
      });

      const menuListData = menuListResponse.data;
      if (menuListData.Status !== 'success' || !menuListData.Data) {
        throw new Error(
          `Failed to fetch menu list: ${menuListData.StatusMessage || 'Unknown error'}`
        );
      }

      const wpMenus = menuListData.Data;
      total = wpMenus.length;

      this.logger.log(`[WordPressProvider] Found ${total} menus to migrate`, this.constructor.name);

      // Step 2: Process each menu - fetch details and create
      for (const wpMenu of wpMenus) {
        try {
          const wpMenuId = wpMenu.menu_id;
          const menuName = wpMenu.menu_name;
          const menuSlug = wpMenu.menu_slug;

          // Check if menu already exists
          const existingMenu = await this.menuModel.findOne({ wpMenuId: wpMenuId }).exec();

          // Fetch menu items/details
          this.logger.log(
            `[WordPressProvider] Fetching details for menu "${menuName}"`,
            this.constructor.name
          );

          const menuDetailResponse = await axios.get(`${wpApiBaseUrl}/wp-json/api/v1/getmenubyid`, {
            params: {
              token: menuToken,
              menu_name: menuSlug,
            },
            headers: {
              Host: this.wpHost,
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          });

          const menuDetailData = menuDetailResponse.data;
          if (menuDetailData.Status !== 'success') {
            this.logger.warn(
              `[WordPressProvider] Failed to fetch details for menu "${menuName}": ${menuDetailData.StatusMessage}`,
              this.constructor.name
            );
            errors.push({
              menuName,
              wpMenuId,
              error: `Failed to fetch menu details: ${menuDetailData.StatusMessage}`,
            });
            continue;
          }

          // Map WP menu items to CMS Item format
          const wpItems = menuDetailData.Data || {};
          const items = this._mapWpMenuItemsToCmsItems(wpItems, menuSlug);

          if (existingMenu) {
            // Update existing menu with fresh content
            const updateMenuDto = {
              title: menuName,
              slug: menuSlug,
              propertyId: effectivePropertyId,
              status: 'active',
              items: items,
              rank: existingMenu.rank ?? 0,
            };

            const updatedMenu = await this.menuService.update(
              existingMenu._id.toString(),
              updateMenuDto as any,
              user
            );

            wpMenuIdToMenuDoc.set(wpMenuId, updatedMenu);
            created++;

            this.logger.log(
              `[WordPressProvider] Menu "${menuName}" updated successfully (${created}/${total})`,
              this.constructor.name
            );
          } else {
            // Create the menu via MenuService
            const createMenuDto = {
              title: menuName,
              slug: menuSlug,
              propertyId: effectivePropertyId,
              status: 'active',
              items: items,
              rank: 0,
            };

            const createdMenu = await this.menuService.create(createMenuDto as any, user);

            // Store wpMenuId on the created document
            await this.menuModel
              .findByIdAndUpdate(createdMenu._id, { wpMenuId: wpMenuId }, { new: true })
              .exec();

            wpMenuIdToMenuDoc.set(wpMenuId, createdMenu);
            created++;

            this.logger.log(
              `[WordPressProvider] Menu "${menuName}" created successfully (${created}/${total})`,
              this.constructor.name
            );
          }
        } catch (error) {
          this.logger.error(
            `[WordPressProvider] Error migrating menu "${wpMenu.menu_name}":`,
            {
              error: error.message,
              wpMenuId: wpMenu.menu_id,
            },
            this.constructor.name
          );
          errors.push({
            menuName: wpMenu.menu_name,
            wpMenuId: wpMenu.menu_id,
            error: error.message,
          });
        }
      }

      // Step 3: Second pass - link parent menus
      this.logger.log('[WordPressProvider] Linking parent menus...', this.constructor.name);

      for (const wpMenu of wpMenus) {
        const menuParent = wpMenu.menu_parent;
        if (menuParent && menuParent !== 0) {
          const childMenu = wpMenuIdToMenuDoc.get(wpMenu.menu_id);
          const parentMenu = wpMenuIdToMenuDoc.get(menuParent);

          if (childMenu && parentMenu) {
            try {
              await this.menuModel
                .findByIdAndUpdate(
                  childMenu._id,
                  {
                    parentMenu: {
                      id: parentMenu._id.toString(),
                      name: parentMenu.title,
                      slug: parentMenu.slug,
                    },
                  },
                  { new: true }
                )
                .exec();

              this.logger.log(
                `[WordPressProvider] Linked menu "${wpMenu.menu_name}" to parent "${parentMenu.title}"`,
                this.constructor.name
              );
            } catch (error) {
              this.logger.error(
                `[WordPressProvider] Error linking parent for menu "${wpMenu.menu_name}":`,
                error.message,
                this.constructor.name
              );
              errors.push({
                menuName: wpMenu.menu_name,
                error: `Failed to link parent: ${error.message}`,
              });
            }
          }
        }
      }

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `[WordPressProvider] Menus migration completed. Created: ${created}, Total: ${total}, Errors: ${errors.length}, Duration: ${totalDuration}ms`,
        this.constructor.name
      );

      return {
        success: true,
        created,
        total,
        errors,
        duration: totalDuration,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Failed to migrate menus:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );

      throw new Error(`Failed to migrate menus: ${error.message}`);
    }
  }

  async migrateMenusAfter(
    user: TCurrentUserType,
    after: string,
    propertyId?: string
  ): Promise<MigrationResult> {
    // The custom menu API has no date/ID filter, so we fetch all menus from WP and
    // skip any whose wpMenuId already exists in our DB — only new menus are created.
    this.logger.log(
      `[WordPressProvider] Starting incremental menus migration (since date hint: ${after})`,
      this.constructor.name
    );

    if (!user || !user.email || !user.sub || !user.organizationId) {
      this.logger.error('[WordPressProvider] Invalid user context');
      throw new Error('User authentication required.');
    }

    const effectivePropertyId = propertyId || '6926b8f59a288ddf06a28884';
    const wpApiBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const menuToken = process.env.WP_API_TOKEN || 'dummy_token';
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Build set of wpMenuIds already in DB so we can skip them cheaply
    const existingMenuDocs = await this.menuModel
      .find({ wpMenuId: { $exists: true, $ne: null } })
      .select('wpMenuId')
      .lean()
      .exec();
    const existingWpMenuIds = new Set<number>(
      existingMenuDocs.map((m: any) => m.wpMenuId).filter(Boolean)
    );

    this.logger.log(
      `[WordPressProvider] ${existingWpMenuIds.size} menus already in DB — will skip these.`,
      this.constructor.name
    );

    let created = 0;
    let total = 0;
    const errors = [];
    const startTime = Date.now();

    try {
      const menuListResponse = await axios.get(`${wpApiBaseUrl}/wp-json/api/v1/getmenu`, {
        params: { token: menuToken },
        headers: { Host: this.wpHost },
        httpsAgent: this.httpsAgent,
        timeout: 30000,
      });

      const menuListData = menuListResponse.data;
      if (menuListData.Status !== 'success' || !menuListData.Data) {
        throw new Error(
          `Failed to fetch menu list: ${menuListData.StatusMessage || 'Unknown error'}`
        );
      }

      const wpMenus = menuListData.Data;
      total = wpMenus.length;

      // Filter to only menus not yet in our DB
      const newWpMenus = wpMenus.filter((m: any) => !existingWpMenuIds.has(m.menu_id));

      this.logger.log(
        `[WordPressProvider] WP has ${total} menus total, ${newWpMenus.length} are new.`,
        this.constructor.name
      );

      for (const wpMenu of newWpMenus) {
        try {
          const wpMenuId = wpMenu.menu_id;
          const menuName = wpMenu.menu_name;
          const menuSlug = wpMenu.menu_slug;

          const menuDetailResponse = await axios.get(`${wpApiBaseUrl}/wp-json/api/v1/getmenubyid`, {
            params: { token: menuToken, menu_name: menuSlug },
            headers: { Host: this.wpHost },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          });

          const menuDetailData = menuDetailResponse.data;
          if (menuDetailData.Status !== 'success') {
            errors.push({
              menuName,
              wpMenuId,
              error: `Failed to fetch menu details: ${menuDetailData.StatusMessage}`,
            });
            continue;
          }

          const wpItems = menuDetailData.Data || {};
          const items = this._mapWpMenuItemsToCmsItems(wpItems, menuSlug);

          const createMenuDto = {
            title: menuName,
            slug: menuSlug,
            propertyId: effectivePropertyId,
            status: 'active',
            items,
            rank: 0,
          };

          const createdMenu = await this.menuService.create(createMenuDto as any, user);

          await this.menuModel
            .findByIdAndUpdate(createdMenu._id, { wpMenuId }, { new: true })
            .exec();

          created++;
          this.logger.log(
            `[WordPressProvider] Created menu "${menuName}" (${created}/${newWpMenus.length})`,
            this.constructor.name
          );

          await delay(200);
        } catch (error) {
          this.logger.error(
            `[WordPressProvider] Error migrating menu "${wpMenu.menu_name}":`,
            { error: error.message, wpMenuId: wpMenu.menu_id },
            this.constructor.name
          );
          errors.push({
            menuName: wpMenu.menu_name,
            wpMenuId: wpMenu.menu_id,
            error: error.message,
          });
        }
      }

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `[WordPressProvider] Incremental menus migration completed. New: ${created}/${newWpMenus.length}, Total WP: ${total}, Errors: ${errors.length}, Duration: ${totalDuration}ms`,
        this.constructor.name
      );

      return { success: true, created, total, errors, duration: totalDuration };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Incremental menus migration failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to migrate menus: ${error.message}`);
    }
  }

  async migrateUserHeaders(): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting user headers migration', this.constructor.name);

    const wpBaseUrl =
      this.configService.get<string>('WP_BASE_URL') || this.wpBaseUrl;

    let total = 0;
    let imported = 0;
    const errors = [];

    try {
      const users = await this.userModel.find().exec();
      total = users.length;

      this.logger.log(
        `[WordPressProvider] Found ${total} users with slugs to process`,
        this.constructor.name
      );

      for (const user of users) {
        try {
          const authorUrl = `this.wpBaseUrl + '/author/'${user.slug}`;
          const apiUrl = `${wpBaseUrl}/wp-json/rankmath/v1/getHead?url=${encodeURIComponent(authorUrl)}`;
          const response = await firstValueFrom(
            this.httpService.get(apiUrl, {
              timeout: 15000,
              headers: { Host: this.wpHost },
            })
          );

          const head = response.data?.head;

          if (!head) {
            this.logger.warn(
              `[WordPressProvider] No head content returned for user slug: ${user.slug}`,
              this.constructor.name
            );
            errors.push({
              slug: user.slug,
              userId: user._id.toString(),
              error: 'No head content in response',
            });
            continue;
          }

          await this.userModel.updateOne({ _id: user._id }, { $set: { header: head } });
          imported++;

          this.logger.log(
            `[WordPressProvider] Updated header for user: ${user.slug}`,
            this.constructor.name
          );
        } catch (error) {
          this.logger.error(
            `[WordPressProvider] Error fetching header for user ${user.slug}:`,
            error.message,
            this.constructor.name
          );
          errors.push({
            slug: user.slug,
            userId: user._id.toString(),
            error: error.message,
          });
        }
      }

      this.logger.log(
        `[WordPressProvider] User headers migration completed. Total: ${total}, Imported: ${imported}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return {
        success: true,
        imported,
        total,
        errors,
      };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] User headers migration failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to migrate user headers: ${error.message}`);
    }
  }

  async parseUserHeaders(): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting user headers parsing', this.constructor.name);

    let total = 0;
    let imported = 0;
    const errors = [];
    const unknownSocialLinks: { userSlug: string; url: string }[] = [];

    try {
      const users = await this.userModel
        .find({ header: { $exists: true, $nin: [null, ''] } })
        .exec();
      total = users.length;

      this.logger.log(
        `[WordPressProvider] Found ${total} users with headers to parse`,
        this.constructor.name
      );

      for (const user of users) {
        try {
          const header = user.header;

          // Extract OG title
          const ogTitleMatch = header.match(/<meta property="og:title" content="([^"]+)"/i);
          const ogTitle = ogTitleMatch ? ogTitleMatch[1] : user.name;

          // Extract OG URL
          const ogUrlMatch = header.match(/<meta property="og:url" content="([^"]+)"/i);
          const ogUrl = ogUrlMatch ? ogUrlMatch[1] : '';

          // Extract OG image
          const ogImageMatch = header.match(/<meta property="og:image" content="([^"]+)"/i);
          const ogImage = ogImageMatch ? ogImageMatch[1] : '';

          // Extract canonical URL
          const canonicalMatch = header.match(/<link rel="canonical" href="([^"]+)"/i);
          const canonicalUrl = canonicalMatch ? canonicalMatch[1] : '';

          // Extract meta description
          const metaDescMatch = header.match(/<meta name="description" content="([^"]+)"/i);
          const metaDescription = metaDescMatch ? metaDescMatch[1] : ogTitle;

          // Extract social links from JSON-LD sameAs on a Person node
          const socialLinks = { twitter: '', facebook: '', linkedin: '', instagram: '' };
          const jsonLdMatch = header.match(
            /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
          );
          if (jsonLdMatch) {
            try {
              const jsonLd = JSON.parse(jsonLdMatch[1]);
              const graph: any[] = jsonLd['@graph'] ? jsonLd['@graph'] : [jsonLd];
              for (const node of graph) {
                if (node['@type'] === 'Person' && Array.isArray(node.sameAs)) {
                  for (const url of node.sameAs) {
                    if (/twitter\.com|x\.com/i.test(url)) {
                      socialLinks.twitter = url;
                    } else if (/facebook\.com/i.test(url)) {
                      socialLinks.facebook = url;
                    } else if (/linkedin\.com/i.test(url)) {
                      socialLinks.linkedin = url;
                    } else if (/instagram\.com/i.test(url)) {
                      socialLinks.instagram = url;
                    } else {
                      unknownSocialLinks.push({ userSlug: user.slug, url });
                    }
                  }
                }
              }
            } catch (parseError) {
              this.logger.warn(
                `[WordPressProvider] Failed to parse JSON-LD for user ${user.slug}: ${parseError.message}`,
                this.constructor.name
              );
            }
          }

          // Update user with social links
          await this.userModel.updateOne({ _id: user._id }, { $set: { socialLinks } });

          // Build SEO object and update slug document
          const seoObj = {
            title: ogTitle,
            metaDescription,
            og: {
              title: ogTitle,
              description: metaDescription,
              url: ogUrl,
              image: ogImage,
            },
          };

          await this.slugModel.updateOne(
            { slug: user.slug, type: ModuleName.USER },
            { $set: { seo: seoObj, canonicalUrl } }
          );

          imported++;

          this.logger.log(
            `[WordPressProvider] Parsed headers for user: ${user.slug}`,
            this.constructor.name
          );
        } catch (error) {
          this.logger.error(
            `[WordPressProvider] Error parsing header for user ${user.slug}:`,
            error.message,
            this.constructor.name
          );
          errors.push({
            slug: user.slug,
            userId: user._id.toString(),
            error: error.message,
          });
        }
      }

      if (unknownSocialLinks.length > 0) {
        this.logger.warn(
          `[WordPressProvider] Found ${unknownSocialLinks.length} unrecognized social links (not twitter/facebook/linkedin/instagram):`,
          this.constructor.name
        );
        for (const entry of unknownSocialLinks) {
          this.logger.warn(`  user: ${entry.userSlug} → ${entry.url}`, this.constructor.name);
        }
      }

      this.logger.log(
        `[WordPressProvider] User headers parsing completed. Total: ${total}, Imported: ${imported}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return { success: true, imported, total, errors };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] User headers parsing failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to parse user headers: ${error.message}`);
    }
  }
  // async parseCategoryHeaders(): Promise<MigrationResult> {
  //   this.logger.log('[WordPressProvider] Starting category headers parsing', this.constructor.name);

  //   let total = 0;
  //   let imported = 0;
  //   const errors = [];
  //   const unknownSocialLinks: { userSlug: string; url: string }[] = [];

  //   try {
  //     const users = await this.userModel
  //       .find({ header: { $exists: true, $nin: [null, ''] } })
  //       .exec();
  //     total = users.length;

  //     this.logger.log(
  //       `[WordPressProvider] Found ${total} users with headers to parse`,
  //       this.constructor.name
  //     );

  //     for (const user of users) {
  //       try {
  //         const header = user.header;

  //         // Extract OG title
  //         const ogTitleMatch = header.match(/<meta property="og:title" content="([^"]+)"/i);
  //         const ogTitle = ogTitleMatch ? ogTitleMatch[1] : user.name;

  //         // Extract OG URL
  //         const ogUrlMatch = header.match(/<meta property="og:url" content="([^"]+)"/i);
  //         const ogUrl = ogUrlMatch ? ogUrlMatch[1] : '';

  //         // Extract OG image
  //         const ogImageMatch = header.match(/<meta property="og:image" content="([^"]+)"/i);
  //         const ogImage = ogImageMatch ? ogImageMatch[1] : '';

  //         // Extract canonical URL
  //         const canonicalMatch = header.match(/<link rel="canonical" href="([^"]+)"/i);
  //         const canonicalUrl = canonicalMatch ? canonicalMatch[1] : '';

  //         // Extract meta description
  //         const metaDescMatch = header.match(/<meta name="description" content="([^"]+)"/i);
  //         const metaDescription = metaDescMatch ? metaDescMatch[1] : ogTitle;

  //         // Extract social links from JSON-LD sameAs on a Person node
  //         const socialLinks = { twitter: '', facebook: '', linkedin: '', instagram: '' };
  //         const jsonLdMatch = header.match(
  //           /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
  //         );
  //         if (jsonLdMatch) {
  //           try {
  //             const jsonLd = JSON.parse(jsonLdMatch[1]);
  //             const graph: any[] = jsonLd['@graph'] ? jsonLd['@graph'] : [jsonLd];
  //             for (const node of graph) {
  //               if (node['@type'] === 'Person' && Array.isArray(node.sameAs)) {
  //                 for (const url of node.sameAs) {
  //                   if (/twitter\.com|x\.com/i.test(url)) {
  //                     socialLinks.twitter = url;
  //                   } else if (/facebook\.com/i.test(url)) {
  //                     socialLinks.facebook = url;
  //                   } else if (/linkedin\.com/i.test(url)) {
  //                     socialLinks.linkedin = url;
  //                   } else if (/instagram\.com/i.test(url)) {
  //                     socialLinks.instagram = url;
  //                   } else {
  //                     unknownSocialLinks.push({ userSlug: user.slug, url });
  //                   }
  //                 }
  //               }
  //             }
  //           } catch (parseError) {
  //             this.logger.warn(
  //               `[WordPressProvider] Failed to parse JSON-LD for user ${user.slug}: ${parseError.message}`,
  //               this.constructor.name
  //             );
  //           }
  //         }

  //         // Update user with social links
  //         await this.userModel.updateOne({ _id: user._id }, { $set: { socialLinks } });

  //         // Build SEO object and update slug document
  //         const seoObj = {
  //           title: ogTitle,
  //           metaDescription,
  //           og: {
  //             title: ogTitle,
  //             description: metaDescription,
  //             url: ogUrl,
  //             image: ogImage,
  //           },
  //         };

  //         await this.slugModel.updateOne(
  //           { slug: user.slug, type: ModuleName.USER },
  //           { $set: { seo: seoObj, canonicalUrl } }
  //         );

  //         imported++;

  //         this.logger.log(
  //           `[WordPressProvider] Parsed headers for user: ${user.slug}`,
  //           this.constructor.name
  //         );
  //       } catch (error) {
  //         this.logger.error(
  //           `[WordPressProvider] Error parsing header for user ${user.slug}:`,
  //           error.message,
  //           this.constructor.name
  //         );
  //         errors.push({
  //           slug: user.slug,
  //           userId: user._id.toString(),
  //           error: error.message,
  //         });
  //       }
  //     }

  //     if (unknownSocialLinks.length > 0) {
  //       this.logger.warn(
  //         `[WordPressProvider] Found ${unknownSocialLinks.length} unrecognized social links (not twitter/facebook/linkedin/instagram):`,
  //         this.constructor.name
  //       );
  //       for (const entry of unknownSocialLinks) {
  //         this.logger.warn(`  user: ${entry.userSlug} → ${entry.url}`, this.constructor.name);
  //       }
  //     }

  //     this.logger.log(
  //       `[WordPressProvider] User headers parsing completed. Total: ${total}, Imported: ${imported}, Errors: ${errors.length}`,
  //       this.constructor.name
  //     );

  //     return { success: true, imported, total, errors };
  //   } catch (error) {
  //     this.logger.error(
  //       '[WordPressProvider] User headers parsing failed:',
  //       { error: error.message, stack: error.stack },
  //       this.constructor.name
  //     );
  //     throw new Error(`Failed to parse user headers: ${error.message}`);
  //   }
  // }

  async migrateMedia(days?: number): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting media migration', this.constructor.name);

    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpApiUrl = `${wpBaseUrl}/wp-json/wp/v2/media`;

    if (!wpAdmin || !wpPassword || !wpBaseUrl) {
      throw new Error('WordPress credentials not configured');
    }

    const defaultOrgId =
      this.configService.get<string>('DEFAULT_ORGANIZATION_ID') || '6915d0490f0319baabaea793';
    const defaultPropertyId = '6926b8f59a288ddf06a28884';

    const organization = await this._organizationService.findOne(defaultOrgId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const property = await this._propertyService.getById(defaultPropertyId);
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    const stripHtml = (html: string): string => (html ? html.replace(/<[^>]*>/g, '').trim() : '');

    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}T00:00:00`;
    };

    const getNextDay = (date: Date): Date => {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      return next;
    };

    // Resume key tracks the last date successfully queued for processing
    const resumeKey = 'wp_media_migration_resume_date';
    const resumeDateStr = await this.redisService.get(resumeKey);
    const baseDate = new Date('2023-12-11T00:00:00');
    const currentDay = resumeDateStr ? new Date(resumeDateStr) : new Date(baseDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Determine how many days to process this run
    const daysToProcess = days ?? Infinity;

    this.logger.log(
      `[WordPressProvider] Media migration starting from ${formatDate(currentDay)}, processing ${days ? `${days} day(s)` : 'all remaining days'} up to today`,
      this.constructor.name
    );

    let created = 0;
    let updated = 0;
    let total = 0;
    const errors: any[] = [];
    const perPage = 50;
    let daysProcessed = 0;
    let day = new Date(currentDay);

    try {
      while (day < today && daysProcessed < daysToProcess) {
        const dateFrom = formatDate(day);
        const nextDay = getNextDay(day);
        const dateTo = formatDate(nextDay);

        // Persist resume point before processing so a crash mid-day retries the same day
        await this.redisService.set(resumeKey, day.toISOString());

        this.logger.log(
          `[WordPressProvider] Fetching media for ${dateFrom} → ${dateTo}`,
          this.constructor.name
        );

        let currentPage = 1;
        let hasMorePages = true;

        while (hasMorePages) {
          let wpMedia: any[];
          try {
            const response = await axios.get(wpApiUrl, {
              params: {
                modified_after: dateFrom,
                modified_before: dateTo,
                per_page: perPage,
                page: currentPage,
              },
              headers: { Host: this.wpHost },
              auth: { username: wpAdmin, password: wpPassword },
              httpsAgent: this.httpsAgent,
            });
            wpMedia = response.data;
          } catch (fetchError) {
            // WP REST API returns 400 when the requested page exceeds total results
            if (fetchError.response?.status === 400) {
              hasMorePages = false;
              break;
            }
            throw fetchError;
          }

          if (!wpMedia || wpMedia.length === 0) {
            hasMorePages = false;
            break;
          }

          total += wpMedia.length;
          console.log(`Fetched ${wpMedia.length} documents`);
          const bulkOps = await Promise.all(
            wpMedia.map(async (media) => {
              // const sizes: { [key: string]: string } = {};
              // if (media.media_details?.sizes) {
              //   for (const [sizeName, sizeData] of Object.entries(
              //     media.media_details.sizes as Record<string, any>
              //   )) {
              //     if (sizeData?.source_url) {
              //       sizes[sizeName] = sizeData.source_url;
              //     }
              //   }
              // }

              const filePath = media.media_details?.file
                ? `/uploads/${media.media_details.file}`
                : undefined;

              let authorInfo: { userId: string; userName: string; slug: string } | undefined;
              if (media.author) {
                const redisUser = await this.redisService.get(`wp-user-${media.author}`);
                if (redisUser) {
                  authorInfo = {
                    userId: redisUser.id,
                    userName: redisUser.name,
                    slug: redisUser.slug,
                  };
                }
              }

              const doc: Record<string, any> = {
                wpId: media.id,
                fileName: media.title?.rendered,
                mimeType: media.mime_type || '',
                size: media.media_details?.filesize || 0,
                source_url: media.source_url || media.guid?.rendered,
                caption: stripHtml(media.caption?.rendered || ''),
                url: media.source_url || media.guid?.rendered,
                path: filePath || media.source_url,
                folderPath: filePath || media.source_url,
                type: media.media_type || '',
                isPrivate: false,
                alt_text: media.alt_text || '',
                featured_media: media.featured_media,
                media_details: media.media_details,
                // sizes,
                postId: media.post || '',
                organization: organizationData,
                property: propertyData,
                createdAt: media.date ? new Date(media.date) : new Date(),
                updatedAt: media.modified ? new Date(media.modified) : new Date(),
                ...(authorInfo && {
                  createdBy: authorInfo,
                  updatedBy: authorInfo,
                }),
              };

              return {
                updateOne: {
                  filter: { wpId: media.id },
                  update: { $set: doc },
                  upsert: true,
                },
              };
            })
          );

          if (bulkOps.length > 0) {
            // Use raw collection driver to preserve explicit createdAt/updatedAt from
            // the WP API response — Mongoose's timestamps:true middleware would otherwise
            // overwrite them with the current time.
            const result = await this.fileUploadModel.collection.bulkWrite(bulkOps, {
              ordered: false,
            });
            created += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
          }

          if (wpMedia.length < perPage) {
            hasMorePages = false;
          } else {
            currentPage++;
          }
        }

        day = nextDay;
        daysProcessed++;
      }

      // Advance resume pointer to the next unprocessed day
      await this.redisService.set(resumeKey, day.toISOString());

      this.logger.log(
        `[WordPressProvider] Media migration completed. Days: ${daysProcessed}, Total: ${total}, Created: ${created}, Updated: ${updated}, Errors: ${errors.length}. Next run resumes from ${formatDate(day)}`,
        this.constructor.name
      );

      return { success: true, created, updated, total, errors };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Media migration failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to migrate WordPress media: ${error.message}`);
    }
  }

  async migrateMediaAfter(after: string, days?: number): Promise<MigrationResult> {
    // Date-based incremental approach:
    //   • Fetch WP media ordered by id DESC (newest first)
    //   • Stop as soon as the last entry on a page has a date <= yesterday
    this.logger.log(
      `[WordPressProvider] Starting incremental media migration (since date hint: ${after})`,
      this.constructor.name
    );

    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpApiUrl = `${wpBaseUrl}/wp-json/wp/v2/media`;

    if (!wpAdmin || !wpPassword || !wpBaseUrl) {
      throw new Error('WordPress credentials not configured');
    }

    const defaultOrgId =
      this.configService.get<string>('DEFAULT_ORGANIZATION_ID') || '6915d0490f0319baabaea793';
    const defaultPropertyId = '6926b8f59a288ddf06a28884';

    const organization = await this._organizationService.findOne(defaultOrgId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const property = await this._propertyService.getById(defaultPropertyId);
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    const stripHtml = (html: string): string => (html ? html.replace(/<[^>]*>/g, '').trim() : '');

    // Use the `after` param as the cutoff date; falls back to yesterday
    const cutoffDate = new Date(after);
    if (isNaN(cutoffDate.getTime())) {
      throw new Error(`Invalid date: ${after}`);
    }
    cutoffDate.setHours(0, 0, 0, 0);

    this.logger.log(
      `[WordPressProvider] Fetching media from WP. Will stop when last entry date <= ${cutoffDate.toISOString()}.`,
      this.constructor.name
    );

    let created = 0;
    let updated = 0;
    let total = 0;
    const errors: any[] = [];
    const perPage = 100;
    let currentPage = 1;
    let done = false;

    const buildDoc = async (media: any): Promise<Record<string, any>> => {
      const filePath = media.media_details?.file
        ? `/uploads/${media.media_details.file}`
        : undefined;

      let authorInfo: { userId: string; userName: string; slug: string } | undefined;
      if (media.author) {
        const redisUser = await this.redisService.get(`wp-user-${media.author}`);
        if (redisUser) {
          authorInfo = { userId: redisUser.id, userName: redisUser.name, slug: redisUser.slug };
        }
      }

      return {
        wpId: media.id,
        fileName: media.title?.rendered,
        mimeType: media.mime_type || '',
        size: media.media_details?.filesize || 0,
        source_url: media.source_url || media.guid?.rendered,
        caption: stripHtml(media.caption?.rendered || ''),
        url: media.source_url || media.guid?.rendered,
        path: filePath || media.source_url,
        folderPath: filePath || media.source_url,
        type: media.media_type || '',
        isPrivate: false,
        alt_text: media.alt_text || '',
        featured_media: media.featured_media,
        media_details: media.media_details,
        postId: media.post || '',
        organization: organizationData,
        property: propertyData,
        createdAt: media.date ? new Date(media.date) : new Date(),
        updatedAt: media.modified ? new Date(media.modified) : new Date(),
        ...(authorInfo && { createdBy: authorInfo, updatedBy: authorInfo }),
      };
    };

    try {
      while (!done) {
        let wpMedia: any[];
        try {
          const response = await axios.get(wpApiUrl, {
            params: { per_page: perPage, page: currentPage, orderby: 'id', order: 'desc' },
            headers: { Host: this.wpHost },
            auth: { username: wpAdmin, password: wpPassword },
            httpsAgent: this.httpsAgent,
          });
          wpMedia = response.data;
        } catch (fetchError) {
          if (fetchError.response?.status === 400) break;
          throw fetchError;
        }

        if (!wpMedia || wpMedia.length === 0) break;

        total += wpMedia.length;

        const bulkOps = await Promise.all(
          wpMedia.map(async (media) => ({
            updateOne: {
              filter: { wpId: media.id },
              update: { $set: await buildDoc(media) },
              upsert: true,
            },
          }))
        );

        if (bulkOps.length > 0) {
          const result = await this.fileUploadModel.collection.bulkWrite(bulkOps, {
            ordered: false,
          });
          created += result.upsertedCount || 0;
          updated += result.modifiedCount || 0;
        }

        // Check the last entry's date — since results are ordered by id DESC,
        // the last item is the oldest on the page.
        const lastEntry = wpMedia[wpMedia.length - 1];
        const lastEntryDate = new Date(lastEntry.date);

        this.logger.log(
          `[WordPressProvider] Page ${currentPage}: fetched ${wpMedia.length}, last entry date: ${lastEntry.date} | created: ${created}, updated: ${updated}`,
          this.constructor.name
        );

        if (lastEntryDate <= cutoffDate || wpMedia.length < perPage) {
          done = true;
        } else {
          currentPage++;
        }
      }

      this.logger.log(
        `[WordPressProvider] Incremental media migration completed. Pages fetched: ${currentPage}, Total fetched: ${total}, Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return { success: true, created, updated, total, errors };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Incremental media migration failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Failed to migrate WordPress media: ${error.message}`);
    }
  }

  private async _convertHtmlToRichBlocks(
    title?: string,
    htmlContent?: string,
    user?: any,
    articleMeta?: any
  ): Promise<any[]> {
    if (!htmlContent && !title) {
      return [];
    }

    const blocks: any[] = [];
    let blockIdCounter = 0;
    const generateBlockId = () => {
      return `block-${Date.now()}-${blockIdCounter++}`;
    };
    let blockOrder = 0;

    // Utility: Check if a URL is a Twitter, YouTube, or Instagram post and extract the ID
    const getEmbedInfo = (url: string) => {
      // Try common patterns
      // Instagram
      const ig = url.match(/(?:instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+))/i);
      if (ig) {
        return {
          type: 'instagramEmbed',
          url,
          postId: ig[1],
        };
      }
      // YouTube (watch, share/shorts, and embed links)
      let yt = url.match(/youtube\.com\/watch\?v=([A-Za-z0-9_\-]+)/i);
      if (!yt) yt = url.match(/youtu\.be\/([A-Za-z0-9_\-]+)/i);
      if (!yt) yt = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_\-]+)/i);
      if (!yt) yt = url.match(/youtube\.com\/embed\/([A-Za-z0-9_\-]+)/i);
      if (yt) {
        return {
          type: 'youtubeEmbed',
          url,
          videoId: yt[1],
        };
      }
      // Twitter/X (new and old formats)
      const tw = url.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/i);
      if (tw) {
        return {
          type: 'twitterEmbed',
          url,
          tweetId: tw[1],
        };
      }
      return null;
    };

    // Utility: Extract embed info from blockquote tags
    const getEmbedFromBlockquote = (html: string) => {
      // Instagram blockquote
      const igBlockquote = html.match(/<blockquote[^>]*class="[^"]*instagram-media[^"]*"[^>]*>/i);
      if (igBlockquote) {
        // Extract the permalink URL
        const permalinkMatch = html.match(/data-instgrm-permalink="([^"]+)"/i);
        if (permalinkMatch) {
          const url = permalinkMatch[1].replace(/&amp;/g, '&');
          const embedInfo = getEmbedInfo(url);
          if (embedInfo) {
            return embedInfo;
          }
        }
        // Also try to extract from href inside the blockquote
        const hrefMatch = html.match(/<a\s+href="([^"]+)"[^>]*>/i);
        if (hrefMatch) {
          const url = hrefMatch[1].replace(/&amp;/g, '&');
          const embedInfo = getEmbedInfo(url);
          if (embedInfo) {
            return embedInfo;
          }
        }
      }

      // Twitter blockquote
      const twBlockquote = html.match(/<blockquote[^>]*class="[^"]*twitter-tweet[^"]*"[^>]*>/i);
      if (twBlockquote) {
        // Extract the tweet URL from the anchor tag
        const hrefMatch = html.match(
          /<a\s+href="([^"]+(?:twitter\.com|x\.com)[^"]+status\/\d+[^"]*)"[^>]*>/i
        );
        if (hrefMatch) {
          const url = hrefMatch[1].replace(/&amp;/g, '&');
          const embedInfo = getEmbedInfo(url);
          if (embedInfo) {
            return embedInfo;
          }
        }
      }

      // WordPress Gutenberg embed block: <figure class="wp-block-embed ...">
      const wpEmbedFigure = html.match(/<figure[^>]*class="[^"]*wp-block-embed[^"]*"[^>]*>/i);
      if (wpEmbedFigure) {
        // 1. Plain URL in the wrapper div (Twitter, Instagram, YouTube watch URL)
        const wrapperUrl = html.match(
          /<div[^>]*class="[^"]*wp-block-embed__wrapper[^"]*"[^>]*>\s*(https?:\/\/[^\s<"]+)/i
        );
        if (wrapperUrl) {
          const embedInfo = getEmbedInfo(wrapperUrl[1].trim());
          if (embedInfo) return embedInfo;
        }
        // 2. iframe src (YouTube embed URL)
        const iframeSrc = html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
        if (iframeSrc) {
          const embedInfo = getEmbedInfo(iframeSrc[1]);
          if (embedInfo) return embedInfo;
        }
        // 3. Any anchor href inside the figure
        const anchorHref = html.match(/<a\s+href="(https?:\/\/[^"]+)"/i);
        if (anchorHref) {
          const url = anchorHref[1].replace(/&amp;/g, '&');
          const embedInfo = getEmbedInfo(url);
          if (embedInfo) return embedInfo;
        }
      }

      return null;
    };

    // Utility: Remove all non-inline HTML tags from a string, but preserve text content
    // Only allow <b>, <strong>, <i>, <em>, <u>, <a href="..."> as inline, strip everything else
    const stripNonInlineTags = (input: string): string => {
      let output = input.replace(/<\s*br\s*\/?>/gi, '\n');

      output = output.replace(
        /<\/?(?!b\s*>|strong\s*>|i\s*>|em\s*>|u\s*>|a(\s+href="[^"]*")?\s*>)[^>]+>/gi,
        ''
      );
      output = output.replace(/<a\s*>(.*?)<\/a>/gi, '$1');
      output = output.replace(/<\/?p[^>]*>/gi, '');
      output = output.replace(/<\/?div[^>]*>/gi, '');
      output = output.replace(/<\/?h[1-6][^>]*>/gi, '');
      output = output.replace(/<\/?ul[^>]*>/gi, '');
      output = output.replace(/<\/?ol[^>]*>/gi, '');
      output = output.replace(/<\/?li[^>]*>/gi, '');
      output = output.replace(/<\/?blockquote[^>]*>/gi, '');
      output = output.replace(/<\/?pre[^>]*>/gi, '');
      output = output.replace(/<!--[\s\S]*?-->/g, '');

      return output;
    };

    // Utility: Create content inline span/link/run objects from text & entity runs
    // Handles <b>, <strong>, <i>, <em>, <u>, <a>
    const parseInlineFormatting = (html: string): Array<any> => {
      html = stripNonInlineTags(html);

      const content: Array<any> = [];
      const tagRegex = /<(\/?)(b|strong|i|em|u|a)(?:\s+href="([^"]*)")?\s*>/gi;
      let match: RegExpExecArray | null;
      const stylesStack: any[] = [];
      let lastIndex = 0;

      while ((match = tagRegex.exec(html))) {
        if (match.index > lastIndex) {
          const text = html.substring(lastIndex, match.index);
          if (text) {
            let curHref: string | undefined;
            for (let i = stylesStack.length - 1; i >= 0; --i) {
              if (typeof stylesStack[i] === 'object' && stylesStack[i].link) {
                curHref = stylesStack[i].link;
                break;
              }
            }
            if (curHref) {
              const displayText = decodeHtmlEntities(text);
              const styles = styleObjFromStack(stylesStack);
              content.push({
                type: 'link',
                text: displayText,
                href: curHref,
                ...(Object.keys(styles).length > 0 ? { styles } : {}),
              });
            } else {
              const styles = styleObjFromStack(stylesStack);
              content.push({
                type: 'text',
                text: decodeHtmlEntities(text),
                ...(Object.keys(styles).length > 0 ? { styles } : {}),
              });
            }
          }
        }
        const [, closing, tag, href] = match;
        if (!closing) {
          if (tag === 'b' || tag === 'strong') {
            stylesStack.push('bold');
          } else if (tag === 'i' || tag === 'em') {
            stylesStack.push('italic');
          } else if (tag === 'u') {
            stylesStack.push('underline');
          } else if (tag === 'a') {
            stylesStack.push({ link: href });
          }
        } else {
          if (tag === 'b' || tag === 'strong') {
            removeLastFromStack(stylesStack, 'bold');
          } else if (tag === 'i' || tag === 'em') {
            removeLastFromStack(stylesStack, 'italic');
          } else if (tag === 'u') {
            removeLastFromStack(stylesStack, 'underline');
          } else if (tag === 'a') {
            removeLastLinkFromStack(stylesStack);
          }
        }
        lastIndex = tagRegex.lastIndex;
      }
      if (lastIndex < html.length) {
        const text = html.substr(lastIndex);
        if (text) {
          let curHref: string | undefined;
          for (let i = stylesStack.length - 1; i >= 0; --i) {
            if (typeof stylesStack[i] === 'object' && stylesStack[i].link) {
              curHref = stylesStack[i].link;
              break;
            }
          }
          if (curHref) {
            const displayText = decodeHtmlEntities(text);
            const styles = styleObjFromStack(stylesStack);
            content.push({
              type: 'link',
              text: displayText,
              href: curHref,
              ...(Object.keys(styles).length > 0 ? { styles } : {}),
            });
          } else {
            const styles = styleObjFromStack(stylesStack);
            content.push({
              type: 'text',
              text: decodeHtmlEntities(text),
              ...(Object.keys(styles).length > 0 ? { styles } : {}),
            });
          }
        }
      }
      // Collapse adjacent link fragments with the same href
      for (let i = 0; i < content.length - 1; i++) {
        if (
          content[i].type === 'link' &&
          content[i + 1].type === 'link' &&
          content[i].href === content[i + 1].href
        ) {
          content[i].text += content[i + 1].text;
          content.splice(i + 1, 1);
          i--;
        }
      }
      // Filter out empty text or link fragments
      return content.filter(
        (span) =>
          (span.type === 'text' && span.text && span.text.length > 0) ||
          (span.type === 'link' && span.text && span.text.length > 0 && span.href)
      );
    };

    // Utility: Decodes typical html entities to their corresponding characters
    const decodeHtmlEntities = (str: string): string => {
      return str
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/<br\s*\/?>/gi, '\n');
    };

    // Style object builder
    const styleObjFromStack = (stack: any[]): any => {
      const styles: any = {};
      for (const item of stack) {
        if (item === 'bold') styles.bold = true;
        if (item === 'italic') styles.italic = true;
        if (item === 'underline') styles.underline = true;
      }
      return styles;
    };

    function removeLastFromStack(stack: any[], marker: string) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === marker) {
          stack.splice(i, 1);
          break;
        }
      }
    }
    function removeLastLinkFromStack(stack: any[]) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (typeof stack[i] === 'object' && stack[i].link) {
          stack.splice(i, 1);
          break;
        }
      }
    }

    // Helper for image tag parser
    const parseImageTag = (html: string) => {
      const imgTag = html.match(/<img\b[^>]*>/i);
      if (!imgTag) return null;
      const tag = imgTag[0];
      const getAttr = (name: string) => {
        const r = new RegExp(`${name}\\s*=\\s*"(.*?)"`, 'i').exec(tag);
        return r ? r[1] : '';
      };
      return {
        url: getAttr('src'),
        alt: getAttr('alt'),
        caption: getAttr('title'),
      };
    };

    // Helper function to split content by bold tags preserving other formatting
    // --- REWRITE: Track "a" surrounded by bold/strong and preserve both styles & link! ---
    const splitByBoldTags = (originalHtml: string): Array<any> => {
      const boldRegex = /<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi;

      // If no bold tags, use normal inline parser
      if (!boldRegex.test(originalHtml)) {
        return parseInlineFormatting(originalHtml);
      }

      boldRegex.lastIndex = 0;

      let segments: Array<any> = [];
      let lastIndex = 0;
      let m;

      while ((m = boldRegex.exec(originalHtml))) {
        // Text before this bold tag (not bold)
        if (m.index > lastIndex) {
          const notBoldHtml = originalHtml.substring(lastIndex, m.index);
          const notBoldText = stripNonInlineTags(notBoldHtml);
          if (notBoldText && notBoldText.trim().length > 0) {
            const parsed = parseInlineFormatting(notBoldHtml);
            // Remove bold from these spans if incorrectly applied
            segments = segments.concat(
              parsed.map((span) => {
                if (span.type === 'text' && span.styles && span.styles.bold) {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { bold, ...restStyles } = span.styles;
                  return {
                    ...span,
                    ...(Object.keys(restStyles).length > 0 ? { styles: restStyles } : {}),
                  };
                }
                return span;
              })
            );
          }
        }

        // The bold text segment, which may wrap a link. We want to recognize and preserve both.
        const boldHtml = m[2];
        if (boldHtml && stripNonInlineTags(boldHtml).trim().length > 0) {
          // --- Custom: Check for single link wrapped in bold ---
          // If the whole boldHtml is exactly a single <a href...>...</a> (or just one link),
          // convert to link with bold style
          const onlyLinkRegex = /^\s*<a\s+href="([^"]+)"(?:\s+[^>]*)?>([\s\S]+)<\/a>\s*$/i;
          const linkMatch = onlyLinkRegex.exec(boldHtml);
          if (linkMatch) {
            const href = linkMatch[1];
            // Get visible text: must decode possible html entities
            const linkText = decodeHtmlEntities(stripNonInlineTags(linkMatch[2]));
            if (linkText && href) {
              segments.push({
                type: 'link',
                text: linkText,
                href: href,
                styles: { bold: true }, // << THIS is key!
              });
            }
          } else {
            // Else, parse normally, but force bold on both link/text fragments
            const insideBold = parseInlineFormatting(boldHtml).map((span) => {
              if (span.type === 'link') {
                return {
                  ...span,
                  styles: { ...(span.styles || {}), bold: true },
                };
              }
              if (span.type === 'text') {
                return { ...span, styles: { ...(span.styles || {}), bold: true } };
              }
              return span;
            });
            segments = segments.concat(insideBold);
          }
        }

        lastIndex = boldRegex.lastIndex;
      }

      // Text after the last bold tag (not bold)
      if (lastIndex < originalHtml.length) {
        const tailHtml = originalHtml.substring(lastIndex);
        const tailText = stripNonInlineTags(tailHtml);
        if (tailText && tailText.trim().length > 0) {
          const parsed = parseInlineFormatting(tailHtml);
          segments = segments.concat(
            parsed.map((span) => {
              if (span.type === 'text' && span.styles && span.styles.bold) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { bold, ...restStyles } = span.styles;
                return {
                  ...span,
                  ...(Object.keys(restStyles).length > 0 ? { styles: restStyles } : {}),
                };
              }
              return span;
            })
          );
        }
      }

      // Filter and clean up
      return segments
        .filter(
          (s) =>
            (s.type === 'text' && s.text && s.text.trim().length > 0) ||
            (s.type === 'link' && s.text)
        )
        .map((span) => {
          // Clean up empty styles objects ONLY for text, not links
          if (span.type === 'text' && span.styles && Object.keys(span.styles).length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { styles, ...rest } = span;
            return rest;
          }
          return span;
        });
    };
    // --- END splitByBoldTags rewrite ---

    // Remove script and style tags
    let cleanHtml = (htmlContent || '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Pre-process: Extract complete social media embed blocks (figure/blockquote pairs)
    // and replace them with markers to keep them intact during line splitting
    const embedMarkers: Map<string, string> = new Map();
    let embedCounter = 0;

    // Match figure blocks containing blockquotes (WordPress style)
    cleanHtml = cleanHtml.replace(
      /<figure[^>]*class="[^"]*wp-block-embed[^"]*"[^>]*>[\s\S]*?<\/figure>/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // Match wp-block-video figure blocks
    cleanHtml = cleanHtml.replace(
      /<figure[^>]*class="[^"]*wp-block-video[^"]*"[^>]*>[\s\S]*?<\/figure>/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // Match wp-block-audio figure blocks
    cleanHtml = cleanHtml.replace(
      /<figure[^>]*class="[^"]*wp-block-audio[^"]*"[^>]*>[\s\S]*?<\/figure>/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // Match wp-block-file div blocks
    cleanHtml = cleanHtml.replace(/<div[^>]*wp-block-file[^>]*>[\s\S]*?<\/div>/gi, (match) => {
      const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
      embedMarkers.set(marker.trim(), match);
      return marker;
    });

    // Match standalone blockquote embeds (Instagram, Twitter)
    cleanHtml = cleanHtml.replace(
      /<blockquote[^>]*class="[^"]*(instagram-media|twitter-tweet)[^"]*"[^>]*>[\s\S]*?<\/blockquote>(?:\s*<script[^>]*>[\s\S]*?<\/script>)?/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // 1. Add title as first heading (with blocknote text marks support)
    if (title && title.trim()) {
      blocks.push({
        id: generateBlockId(),
        type: 'heading',
        content: [
          {
            type: 'text',
            text: title.trim(),
          },
        ],
        metadata: {
          props: {
            backgroundColor: 'default',
            textColor: 'default',
            textAlignment: 'left',
            level: 1,
            isToggleable: false,
          },
          children: [],
        },
        order: blockOrder++,
      });
    }

    const htmlLines = cleanHtml.split(
      /(?=<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div|img|figure)[\s>])|(?=__EMBED_MARKER_\d+__)/i
    );

    for (const rawLine of htmlLines) {
      let trimmedLine = rawLine.trim();
      if (!trimmedLine) continue;

      // Check if this line contains an embed marker and restore the original HTML
      if (/^__EMBED_MARKER_\d+__/.test(trimmedLine)) {
        const marker = trimmedLine.match(/^__EMBED_MARKER_\d+__/)?.[0];
        if (marker && embedMarkers.has(marker)) {
          trimmedLine = embedMarkers.get(marker)!;
        }
      }

      // Video blocks (wp-block-video)
      if (/^<figure[^>]*class="[^"]*wp-block-video[^"]*"/i.test(trimmedLine)) {
        const videoSrcMatch = trimmedLine.match(/<video[^>]*\ssrc="([^"]+)"/i);
        const captionMatch = trimmedLine.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
        const caption = captionMatch
          ? decodeHtmlEntities(captionMatch[1].replace(/<[^>]+>/g, '').trim())
          : '';

        if (videoSrcMatch) {
          const rawSrc = videoSrcMatch[1];
          const videoPath = rawSrc.startsWith('/uploads')
            ? rawSrc
            : (rawSrc.match(/(\/uploads\/.+)/)?.[1] ?? null);

          let videoUrl = rawSrc;
          let mediaId: string | undefined;
          let mediaPath: string | undefined;

          const mediaDoc = videoPath
            ? await this.fileUploadModel.findOne({ path: videoPath }).lean().exec()
            : null;
          if (mediaDoc) {
            videoUrl = (mediaDoc as any).url || rawSrc;
            mediaId = (mediaDoc as any)._id?.toString();
            mediaPath = (mediaDoc as any).path;
          }

          blocks.push({
            id: generateBlockId(),
            type: 'videoEmbed',
            metadata: {
              props: {
                url: videoUrl,
                caption,
                path: mediaPath || videoPath,
                id: mediaId,
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // Audio blocks (wp-block-audio)
      if (/^<figure[^>]*class="[^"]*wp-block-audio[^"]*"/i.test(trimmedLine)) {
        const audioSrcMatch = trimmedLine.match(/<audio[^>]*\ssrc="([^"]+)"/i);
        const captionMatch = trimmedLine.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
        const caption = captionMatch
          ? decodeHtmlEntities(captionMatch[1].replace(/<[^>]+>/g, '').trim())
          : '';

        if (audioSrcMatch) {
          const rawSrc = audioSrcMatch[1];
          const audioPath = rawSrc.startsWith('/uploads')
            ? rawSrc
            : (rawSrc.match(/(\/uploads\/.+)/)?.[1] ?? null);

          let audioUrl = rawSrc;
          let mediaPath: string | undefined = audioPath || undefined;

          const mediaDoc = audioPath
            ? await this.fileUploadModel.findOne({ path: audioPath }).lean().exec()
            : null;
          if (mediaDoc) {
            audioUrl = (mediaDoc as any).url || rawSrc;
            mediaPath = (mediaDoc as any).path || audioPath;
          }

          const fileName = (mediaPath || audioPath || rawSrc).split('/').pop() || '';

          blocks.push({
            id: generateBlockId(),
            type: 'audio',
            metadata: {
              props: {
                backgroundColor: 'default',
                name: fileName,
                url: audioUrl,
                path: mediaPath,
                caption,
                showPreview: true,
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // File blocks (wp-block-file)
      if (/^<div[^>]*wp-block-file/i.test(trimmedLine)) {
        // Collect all anchors; all typically point to the same file
        const allAnchors = [...trimmedLine.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi)];
        const rawHref =
          allAnchors[0]?.[1] || trimmedLine.match(/<object[^>]*\sdata="([^"]+)"/i)?.[1];
        // Use the first anchor whose text isn't "Download" as the display name
        const nameFromAnchor = allAnchors
          .find((a) => a[2]?.trim() && a[2].trim().toLowerCase() !== 'download')?.[2]
          ?.trim();

        if (rawHref) {
          const filePath = rawHref.startsWith('/uploads')
            ? rawHref
            : (rawHref.match(/(\/uploads\/.+)/)?.[1] ?? null);

          let resolvedPath = filePath || rawHref;
          let resolvedUrl: string = rawHref;

          const mediaDoc = filePath
            ? await this.fileUploadModel.findOne({ path: filePath }).lean().exec()
            : null;
          if (mediaDoc) {
            resolvedPath = (mediaDoc as any).path || filePath;
            resolvedUrl = (mediaDoc as any).url || rawHref;
          }

          const fileName = nameFromAnchor || (filePath || rawHref).split('/').pop() || '';

          blocks.push({
            id: generateBlockId(),
            type: 'file',
            metadata: {
              props: {
                backgroundColor: 'default',
                name: fileName,
                path: resolvedPath,
                url: resolvedUrl,
                caption: '',
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // Check for social media embeds in blockquote format first
      if (
        /^<blockquote/i.test(trimmedLine) ||
        /^<figure[^>]*class="[^"]*wp-block-embed[^"]*"/i.test(trimmedLine)
      ) {
        const embedInfo = getEmbedFromBlockquote(trimmedLine);
        if (embedInfo) {
          const { type, url } = embedInfo;
          const embedProps: any = { url };
          if (type === 'instagramEmbed') embedProps.postId = embedInfo.postId;
          if (type === 'youtubeEmbed') embedProps.videoId = embedInfo.videoId;
          if (type === 'twitterEmbed') embedProps.tweetId = embedInfo.tweetId;

          blocks.push({
            id: generateBlockId(),
            type,
            metadata: {
              props: embedProps,
              children: [],
            },
            order: blockOrder++,
          });
          continue;
        }
      }

      // Headings (h1-h6)
      const headingMatch = trimmedLine.match(/^<h([1-6])[\s>]/i);
      if (headingMatch) {
        const level = parseInt(headingMatch[1], 10);
        const lineContentHtml = trimmedLine.replace(/^<h[1-6][^>]*>|<\/h[1-6]>/gi, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
              level,
              isToggleable: false,
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Images
      if (/^<img[\s>]/i.test(trimmedLine)) {
        const imgInfo = parseImageTag(trimmedLine);
        if (imgInfo && imgInfo.url) {
          // Always extract /uploads path — never use full URL as the path
          const imagePath = imgInfo.url.startsWith('/uploads')
            ? imgInfo.url
            : (imgInfo.url.match(/(\/uploads\/.+)/)?.[1] ?? null);

          let mongoId: string | undefined;

          // 1. Check DB by path (only when we have a /uploads path)
          if (imagePath) {
            const existing = await this.fileUploadModel.findOne({ path: imagePath }).lean().exec();
            if (existing) {
              mongoId = (existing as any)._id?.toString();
            }
          }

          // 2. If not found, save to DB (only when we have a /uploads path)
          if (!mongoId && imagePath && user && user.organizationId && user.sub) {
            const cleanUrl = imgInfo.url.split('?')[0];
            const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
            const mimeTypeMap: Record<string, string> = {
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              png: 'image/png',
              gif: 'image/gif',
              webp: 'image/webp',
              svg: 'image/svg+xml',
            };
            const mimeType = mimeTypeMap[ext] || 'image/jpeg';
            try {
              const meta = articleMeta || {};
              // Article createdBy/updatedBy shape: { id, name } — remap to media schema shape: { userId, userName }
              const toMediaUser = (u: any) =>
                u ? { userId: u.id || u.userId, userName: u.name || u.userName } : undefined;
              const fileCreatedBy = toMediaUser(meta.createdBy) || {
                userId: user.sub,
                userName: user.name,
              };
              const fileUpdatedBy = toMediaUser(meta.updatedBy);
              const { data: savedFile } = await this.fileUploadService.saveFileToDB({
                fileName: imagePath.split('/').pop() || 'image',
                url: imgInfo.url,
                folderPath: imagePath,
                mimeType,
                organization: meta.organization || { id: user.organizationId },
                property: meta.property,
                path: imagePath,
                size: 0,
                isPrivate: false,
                createdBy: fileCreatedBy,
                ...(fileUpdatedBy ? { updatedBy: fileUpdatedBy } : {}),
                ...(meta.createdAt ? { createdAt: meta.createdAt } : {}),
                ...(meta.updatedAt ? { updatedAt: meta.updatedAt } : {}),
              } as any);
              mongoId = savedFile.id;
            } catch (err) {
              this.logger.error(
                `[convertHtmlToRichBlocks] Failed to save file for url ${imgInfo.url}: ${err?.message}`,
                err?.stack,
                this.constructor.name
              );
            }
          }

          blocks.push({
            id: generateBlockId(),
            type: 'image',
            metadata: {
              props: {
                textAlignment: 'left',
                backgroundColor: 'default',
                name: imgInfo.alt || '',
                url: imgInfo.url,
                path: imagePath,
                caption: imgInfo.caption || '',
                showPreview: true,
                id: mongoId,
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // Social embed pure links (anchor that contains only social media url)
      if (/^<a\s+href="([^"]+)"\s*>([^<]*)<\/a>\s*$/i.test(trimmedLine)) {
        const linkMatch = trimmedLine.match(/^<a\s+href="([^"]+)"\s*>([^<]*)<\/a>\s*$/i);
        if (linkMatch) {
          const href = linkMatch[1];
          const displayText = linkMatch[2]?.trim() || '';
          const maybeEmbed = getEmbedInfo(href);
          if (maybeEmbed) {
            const { type, url } = maybeEmbed;
            const embedId = maybeEmbed.postId || maybeEmbed.videoId || maybeEmbed.tweetId || '';
            const embedProps: any = { url };
            if (type === 'instagramEmbed') embedProps.postId = maybeEmbed.postId;
            if (type === 'youtubeEmbed') embedProps.videoId = maybeEmbed.videoId;
            if (type === 'twitterEmbed') embedProps.tweetId = maybeEmbed.tweetId;
            blocks.push({
              id: generateBlockId(),
              type,
              metadata: {
                props: embedProps,
                children: [],
              },
              order: blockOrder++,
            });
            continue;
          }
          blocks.push({
            id: generateBlockId(),
            type: 'paragraph',
            content: [
              {
                type: 'link',
                text: displayText || href,
                href: href,
              },
            ],
            metadata: {
              props: {
                backgroundColor: 'default',
                textColor: 'default',
                textAlignment: 'left',
              },
              children: [],
            },
            order: blockOrder++,
          });
          continue;
        }
      }

      // Unordered list item (within <ul>)
      if (
        /^<li[\s>]/i.test(trimmedLine) &&
        /<ul/i.test(cleanHtml.substring(0, cleanHtml.indexOf(trimmedLine)))
      ) {
        const lineContentHtml = trimmedLine.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'bulletListItem',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Ordered list item (within <ol>)
      if (
        /^<li[\s>]/i.test(trimmedLine) &&
        /<ol/i.test(cleanHtml.substring(0, cleanHtml.indexOf(trimmedLine)))
      ) {
        const lineContentHtml = trimmedLine.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'numberedListItem',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Blockquote (render as paragraph with formatting) - but not social embeds
      if (/^<blockquote[\s>]/i.test(trimmedLine)) {
        // Skip if it's a social media embed blockquote
        if (
          /<blockquote[^>]*class="[^"]*(instagram-media|twitter-tweet)[^"]*"/i.test(trimmedLine)
        ) {
          continue;
        }

        const lineContentHtml = trimmedLine
          .replace(/^<blockquote[^>]*>/i, '')
          .replace(/<\/blockquote>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Paragraph or plain line with text or inline mark tags present
      if (
        /^<p[\s>]/i.test(trimmedLine) ||
        /<(b|strong|i|em|u|a)[\s>]/i.test(trimmedLine) ||
        /<\/(b|strong|i|em|u|a)>/i.test(trimmedLine) ||
        parseInlineFormatting(trimmedLine).length > 0
      ) {
        let lineContentHtml = trimmedLine;
        // Remove paragraph tags but preserve inline formatting
        if (/^<p[\s>]/i.test(trimmedLine)) {
          lineContentHtml = trimmedLine.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '');
        }

        // Get the original HTML before stripping
        const originalHtml = lineContentHtml;

        // Parse with fine-grained bold handling
        let content = splitByBoldTags(originalHtml);

        // Check for pure social links in the content (entire paragraph is a social link)
        if (
          content.length === 1 &&
          content[0].type === 'link' &&
          typeof content[0].href === 'string'
        ) {
          const maybeEmbed = getEmbedInfo(content[0].href);
          if (maybeEmbed) {
            const { type, url } = maybeEmbed;
            const embedProps: any = { url };
            if (type === 'instagramEmbed') embedProps.postId = maybeEmbed.postId;
            if (type === 'youtubeEmbed') embedProps.videoId = maybeEmbed.videoId;
            if (type === 'twitterEmbed') embedProps.tweetId = maybeEmbed.tweetId;
            blocks.push({
              id: generateBlockId(),
              type,
              metadata: {
                props: embedProps,
                children: [],
              },
              order: blockOrder++,
            });
            continue;
          }
        }

        content = content.map((span: any) => {
          if (span.href) {
            return {
              type: 'link',
              text: span.text,
              href: span.href,
              ...(span.styles && Object.keys(span.styles).length > 0
                ? { styles: span.styles }
                : {}),
            };
          }
          return span;
        });

        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }
    }

    if (blocks.length === 0 && cleanHtml) {
      // Parse with fine-grained bold handling
      let content = splitByBoldTags(cleanHtml);

      // Pure social link?
      if (
        content.length === 1 &&
        content[0].type === 'link' &&
        typeof content[0].href === 'string'
      ) {
        const maybeEmbed = getEmbedInfo(content[0].href);
        if (maybeEmbed) {
          const { type, url } = maybeEmbed;
          const embedProps: any = { url };
          if (type === 'instagramEmbed') embedProps.postId = maybeEmbed.postId;
          if (type === 'youtubeEmbed') embedProps.videoId = maybeEmbed.videoId;
          if (type === 'twitterEmbed') embedProps.tweetId = maybeEmbed.tweetId;
          blocks.push({
            id: generateBlockId(),
            type,
            metadata: {
              props: embedProps,
              children: [],
            },
            order: blockOrder++,
          });
          return blocks;
        }
      }

      content = content.map((span: any) => {
        if (span.href) {
          return {
            type: 'link',
            text: span.text,
            href: span.href,
            ...(span.styles && Object.keys(span.styles).length > 0 ? { styles: span.styles } : {}),
          };
        }
        return span;
      });

      if (content.length) {
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
      }
    }
    return blocks;
  }

  async migrateStaticPages(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult> {
    this.logger.log('[WordPressProvider] Starting static pages migration', this.constructor.name);

    if (!user || !user.email || !user.sub || !user.organizationId) {
      throw new Error('User authentication required.');
    }

    const effectivePropertyId = propertyId || '6926b8f59a288ddf06a28884';
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');

    if (!wpAdmin || !wpPassword) {
      throw new Error('WordPress credentials not configured');
    }

    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const property = await this._propertyService.getById(effectivePropertyId);
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    const systemUserMeta = buildUserMetadata(user); // fallback when WP author not found in Redis

    let created = 0;
    let skipped = 0;
    let total = 0;
    const errors = [];
    const perPage = 100;
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await firstValueFrom(
        this.httpService.get(`${wpBaseUrl}/wp-json/wp/v2/pages`, {
          params: { per_page: perPage, page: currentPage, status: 'publish' },
          headers: {
            Host: this.wpHost,
          },
          auth: {
            username: wpAdmin,
            password: wpPassword,
          },
        })
      );

      const pages: any[] = response.data;

      if (!pages || pages.length === 0) {
        hasMore = false;
        break;
      }

      total += pages.length;

      // Deduplicate: skip pages already in MongoDB by wpId
      const wpIds = pages.map((p) => p.id);
      const existingWpIds = new Set(
        (
          await this.staticPageModel
            .find({ wpId: { $in: wpIds } }, { wpId: 1 })
            .lean()
            .exec()
        ).map((doc) => doc.wpId)
      );

      for (const page of pages) {
        if (existingWpIds.has(page.id)) {
          skipped++;
          continue;
        }

        try {
          // Resolve author from Redis using WP author ID, fall back to system user
          let authorMeta = systemUserMeta;
          if (page.author) {
            try {
              const redisUser = await this.redisService.get(`wp-user-${page.author}`);
              if (redisUser) {
                authorMeta = {
                  id: redisUser._id?.toString() || redisUser.id,
                  name: redisUser.name,
                  email: redisUser.email || '',
                  userType: UserType.AUTHOR,
                };
              }
            } catch (err) {
              this.logger.warn(
                `[WordPressProvider] Could not resolve author wpId=${page.author} for page "${page.slug}": ${err.message}`,
                this.constructor.name
              );
            }
          }

          await this.staticPageModel.create({
            title: page.title?.rendered || '',
            slug: page.slug,
            content: page.content?.rendered || '',
            excerpt: page.excerpt?.rendered
              ? page.excerpt.rendered.replace(/<[^>]*>/g, '').trim()
              : '',
            status: STATUS.ACTIVE,
            isPublished: true,
            menuOrder: page.menu_order ?? 0,
            rank: page.menu_order ?? Number.MAX_SAFE_INTEGER,
            template: page.template || '',
            organization: organizationData,
            property: propertyData,
            createdBy: authorMeta,
            updatedBy: authorMeta,
            seo: buildSeoObject(null, page.title?.rendered || '', ''),
            // WordPress-specific fields
            wpId: page.id,
            wpParentId: page.parent ?? 0,
            wpAuthorId: page.author ?? 0,
            wpFeaturedMediaId: page.featured_media ?? 0,
            wpLink: page.link || '',
            wpCreatedAt: page.date_gmt ? new Date(`${page.date_gmt}Z`) : new Date(page.date),
            wpModifiedAt: page.modified_gmt
              ? new Date(`${page.modified_gmt}Z`)
              : new Date(page.modified),
          });

          created++;
          this.logger.log(
            `[WordPressProvider] Imported page "${page.slug}" (wpId: ${page.id})`,
            this.constructor.name
          );
        } catch (err) {
          this.logger.error(
            `[WordPressProvider] Failed to import page wpId=${page.id}: ${err.message}`,
            this.constructor.name
          );
          errors.push({ wpId: page.id, slug: page.slug, error: err.message });
        }
      }

      // Check if there are more pages
      const totalPagesHeader = response.headers['x-wp-totalpages'];
      if (totalPagesHeader && currentPage >= parseInt(totalPagesHeader, 10)) {
        hasMore = false;
      } else if (pages.length < perPage) {
        hasMore = false;
      } else {
        currentPage++;
      }

      this.logger.log(
        `[WordPressProvider] Pages batch ${currentPage - 1}: total=${total}, created=${created}, skipped=${skipped}`,
        this.constructor.name
      );
    }

    this.logger.log(
      `[WordPressProvider] Static pages migration complete. Total: ${total}, Created: ${created}, Skipped: ${skipped}, Errors: ${errors.length}`,
      this.constructor.name
    );

    return {
      success: errors.length === 0,
      total,
      imported: created,
      errors,
    };
  }

  async auditSlugDiff(): Promise<MigrationResult> {
    this.logger.log(
      '[WordPressProvider] Starting ES ↔ MongoDB slug diff audit',
      this.constructor.name
    );

    const ES_INDEX = 'wp_posts_prod_v2';
    const BATCH_SIZE = 1000;

    let totalScanned = 0;
    let totalMissing = 0;
    const errors = [];
    let searchAfter: any[] | undefined;

    try {
      while (true) {
        const query: any = {
          size: BATCH_SIZE,
          _source: ['slug', 'link'],
          sort: [{ modified: { order: 'asc' } }, { id: { order: 'asc' } }],
          query: { match_all: {} },
        };

        if (searchAfter) {
          query.search_after = searchAfter;
        }

        const response = await this.elasticService.search(ES_INDEX, query);
        const hits = response.hits?.hits;

        if (!hits || hits.length === 0) break;

        totalScanned += hits.length;

        // Extract valid slug entries from this batch, classifying numerical vs normal
        const entries: { esId: string; slug: string; link: string; isNumeric: boolean }[] = hits
          .map((hit: any) => {
            const slug = (hit._source as any)?.slug as string;
            return {
              esId: hit._id as string,
              slug,
              link: ((hit._source as any)?.link as string) || '',
              isNumeric: /^\d+$/.test(slug || ''),
            };
          })
          .filter((h) => !!h.slug);

        const numericEntries = entries.filter((e) => e.isNumeric);
        const normalEntries = entries.filter((e) => !e.isNumeric);

        // For normal slugs: check articles collection
        const existingArticleSlugs = await this.articleModel
          .find({ slug: { $in: normalEntries.map((e) => e.slug) } }, { slug: 1 })
          .lean()
          .exec()
          .then((docs) => new Set(docs.map((d) => d.slug)));

        // For numeric slugs: append '-' and check slug collection
        const numericWithDash = numericEntries.map((e) => `${e.slug}-`);
        const existingNumericSlugs = await this.slugModel
          .find({ slug: { $in: numericWithDash } }, { slug: 1 })
          .lean()
          .exec()
          .then((docs) => new Set(docs.map((d) => d.slug)));

        const missing = [
          ...normalEntries.filter((e) => !existingArticleSlugs.has(e.slug)),
          ...numericEntries.filter((e) => !existingNumericSlugs.has(`${e.slug}-`)),
        ];

        if (missing.length > 0) {
          const bulkOps = missing.map((entry) => {
            const raw = entry.link.replace(this.wpBaseUrl + '/', '');
            const lastSeg = raw.split('/').pop() ?? '';
            const fullSlug = /^\d+$/.test(lastSeg) ? `${raw}-` : raw;
            const storedSlug = entry.isNumeric ? `${entry.slug}-` : entry.slug;
            return {
              updateOne: {
                filter: { esId: entry.esId },
                update: {
                  $setOnInsert: {
                    esId: entry.esId,
                    slug: storedSlug,
                    fullSlug,
                    link: entry.link,
                    index: ES_INDEX,
                  },
                },
                upsert: true,
              },
            };
          });

          try {
            await this.missingSlugModel.bulkWrite(bulkOps, { ordered: false });
            totalMissing += missing.length;
          } catch (bulkErr) {
            this.logger.error(
              `[WordPressProvider] bulkWrite error: ${bulkErr.message}`,
              this.constructor.name
            );
            errors.push({ error: bulkErr.message });
          }
        }

        this.logger.log(
          `[WordPressProvider] Scanned: ${totalScanned} | Missing so far: ${totalMissing}`,
          this.constructor.name
        );

        searchAfter = (hits[hits.length - 1] as any).sort;
        if (hits.length < BATCH_SIZE) break;
      }

      this.logger.log(
        `[WordPressProvider] Slug diff audit complete. Scanned: ${totalScanned}, Missing: ${totalMissing}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return { success: true, total: totalScanned, created: totalMissing, errors };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] Slug diff audit failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`Slug diff audit failed: ${error.message}`);
    }
  }

  async fixSlugMeta(limit?: number): Promise<MigrationResult> {
    this.logger.log(
      `[WordPressProvider] Starting fixSlugMeta${limit ? ` [LIMIT: ${limit}]` : ''}`,
      this.constructor.name
    );

    const batchSize = limit ? Math.min(limit, 500) : 500;
    let skip = 0;
    let totalScanned = 0;
    let totalUpdated = 0;
    const errors: any[] = [];

    try {
      while (true) {
        const fetchSize = limit ? Math.min(batchSize, limit - totalScanned) : batchSize;
        const articles = (await this.articleModel
          .find(
            {},
            { slug: 1, fullSlug: 1, createdBy: 1, updatedBy: 1, createdAt: 1, updatedAt: 1 }
          )
          .skip(skip)
          .limit(fetchSize)
          .lean()
          .exec()) as any[];

        if (articles.length === 0) break;

        totalScanned += articles.length;

        if (limit) {
          for (const article of articles) {
            this.logger.log(
              `[WordPressProvider] fixSlugMeta: slug="${article.slug}" fullSlug="${article.fullSlug}"`,
              this.constructor.name
            );
          }
        }

        const bulkOps = articles
          .filter((a) => a.fullSlug)
          .map((article) => ({
            updateOne: {
              filter: { fullSlug: article.fullSlug },
              update: {
                $set: {
                  createdBy: article.createdBy,
                  updatedBy: article.updatedBy,
                  createdAt: article.createdAt,
                  updatedAt: article.updatedAt,
                },
              },
            },
          }));

        if (bulkOps.length > 0) {
          const result = await this.slugModel.collection.bulkWrite(bulkOps, { ordered: false });
          totalUpdated += result.modifiedCount || 0;
        }

        this.logger.log(
          `[WordPressProvider] fixSlugMeta: scanned ${totalScanned}, updated ${totalUpdated}`,
          this.constructor.name
        );

        if (articles.length < fetchSize || (limit && totalScanned >= limit)) break;
        skip += batchSize;
      }

      this.logger.log(
        `[WordPressProvider] fixSlugMeta completed. Total scanned: ${totalScanned}, updated: ${totalUpdated}`,
        this.constructor.name
      );

      return { success: true, total: totalScanned, updated: totalUpdated, errors };
    } catch (error) {
      this.logger.error(
        '[WordPressProvider] fixSlugMeta failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(`fixSlugMeta failed: ${error.message}`);
    }
  }

  async migrateMissingSlugs(user: TCurrentUserType, limit?: number): Promise<MigrationResult> {
    const runId = Date.now();
    const errorLogPath = path.join('/tmp', `migrate-missing-slugs-errors-${runId}.log`);
    const logError = (msg: string) => {
      const line = `[${new Date().toISOString()}] ${msg}\n`;
      fs.appendFileSync(errorLogPath, line);
    };

    this.logger.log(
      `[WordPressProvider] Starting migrateMissingSlugs${limit ? ` [LIMIT: ${limit}]` : ''}. Error log: ${errorLogPath}`,
      this.constructor.name
    );

    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');

    const defaultPropertyId = '6926b8f59a288ddf06a28884';
    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };
    const property = await this._propertyService.getById(defaultPropertyId);
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    const batchSize = 100;
    let skip = 0;
    let totalScanned = 0;
    let importedCount = 0;
    const errors: any[] = [];

    try {
      while (true) {
        const fetchSize = limit ? Math.min(batchSize, limit - totalScanned) : batchSize;

        const missingSlugs = await this.missingSlugModel
          .find({ status: 'pending' })
          .skip(skip)
          .limit(fetchSize)
          .lean()
          .exec();

        if (missingSlugs.length === 0) break;

        totalScanned += missingSlugs.length;

        // Group by ES index so we can batch-fetch from the right index
        const byIndex = new Map<string, typeof missingSlugs>();
        for (const ms of missingSlugs) {
          const idx = (ms.index as string) || 'wp_posts_prod';
          if (!byIndex.has(idx)) byIndex.set(idx, []);
          byIndex.get(idx).push(ms);
        }

        const hits: any[] = [];
        for (const [esIndex, entries] of byIndex.entries()) {
          const esIds = entries.map((e) => e.esId);
          try {
            const response = await this.elasticService.search(esIndex, {
              size: esIds.length,
              query: { ids: { values: esIds } },
            });
            if (response.hits?.hits) hits.push(...response.hits.hits);
          } catch (err: any) {
            const msg = `ES fetch failed for index=${esIndex} ids=${esIds.join(',')}: ${err.message}`;
            this.logger.warn(`[WordPressProvider] ${msg}`, this.constructor.name);
            logError(msg);
          }
        }

        if (hits.length === 0) {
          if (missingSlugs.length < fetchSize || (limit && totalScanned >= limit)) break;
          skip += batchSize;
          continue;
        }

        const docsToInsert: any[] = [];
        const esIdByWpId: Map<number, string> = new Map();

        for (const hit of hits) {
          try {
            const source = hit._source;

            // --- Categories ---
            let primaryCategory: any = null;
            let categories: any[] = [];
            if (source.categories?.length > 0) {
              const fetched: any[] = [];
              for (const esCat of source.categories) {
                try {
                  const redisKey = `wp-category-${esCat.id}`;
                  const cached = await this.redisService.get(redisKey);
                  let cat = null;
                  if (cached) {
                    cat = {
                      id: cached._id?.toString() || cached.id,
                      title: cached.title,
                      titleHn: cached.titleHn,
                      slug: cached.slug,
                      fullSlug: cached.fullSlug,
                      status: cached.status,
                      isFeatured: cached.isFeatured,
                      isPublic: cached.isPublic,
                      link: cached.link,
                      rank: cached.rank,
                      wpCategoryId: cached.wpCategoryId,
                      count: cached.count,
                    };
                  } else {
                    const dbCat = await this.categoryModel
                      .findOne({ wpCategoryId: esCat.id })
                      .lean()
                      .exec();
                    if (dbCat) {
                      cat = {
                        id: dbCat._id.toString(),
                        title: dbCat.title,
                        titleHn: dbCat.titleHn,
                        slug: dbCat.slug,
                        fullSlug: dbCat.fullSlug,
                        status: dbCat.status,
                        isFeatured: dbCat.isFeatured,
                        isPublic: dbCat.isPublic,
                        link: dbCat.link,
                        rank: dbCat.rank,
                        wpCategoryId: dbCat.wpCategoryId,
                        count: dbCat.count,
                      };
                    }
                  }
                  if (cat) fetched.push(cat);
                } catch (err: any) {
                  const msg = `Category fetch error wpPostId=${source.id} catId=${esCat.id}: ${err.message}`;
                  this.logger.warn(`[WordPressProvider] ${msg}`, this.constructor.name);
                  logError(msg);
                }
              }
              if (fetched.length > 0) {
                primaryCategory = fetched[0];
                categories = fetched;
              }
            }
            // --- Tags ---
            const tags: any[] = [];
            if (source.tags?.length > 0) {
              for (const esTag of source.tags) {
                try {
                  const dbTag = await this.tagModel.findOne({ wpTagId: esTag.id }).exec();
                  if (dbTag) {
                    const redisKey = `wp-tag-${dbTag.name}`;
                    const redisTag = await this.redisService.get(redisKey);
                    const t = redisTag ?? dbTag;
                    tags.push({
                      id: t._id?.toString() || t.id,
                      name: t.name,
                      slug: t.slug,
                      description: t.description,
                      rank: t.rank,
                      status: t.status,
                      isFeatured: t.isFeatured,
                      link: t.link,
                      wpTagId: t.wpTagId,
                      count: t.count,
                    });
                  }
                } catch (err: any) {
                  const msg = `Tag fetch error wpPostId=${source.id} tagId=${esTag.id}: ${err.message}`;
                  this.logger.warn(`[WordPressProvider] ${msg}`, this.constructor.name);
                  logError(msg);
                }
              }
            }
            // --- Author ---
            let authors: any[] = [];
            let authorForMetadata: any = null;
            if (source.author?.id) {
              try {
                const redisUser = await this.redisService.get(`wp-user-${source.author.id}`);
                if (redisUser) {
                  authorForMetadata = redisUser;
                  authors = [
                    {
                      id: redisUser._id?.toString() || redisUser.id,
                      name: redisUser.name,
                      username: redisUser.username,
                      slug: redisUser.slug,
                      profilePicture: redisUser.profilePicture,
                    },
                  ];
                }
              } catch (err: any) {
                const msg = `Author fetch error wpPostId=${source.id} authorId=${source.author.id}: ${err.message}`;
                this.logger.warn(`[WordPressProvider] ${msg}`, this.constructor.name);
                logError(msg);
              }
            }
            // --- Featured media: DB → Redis → WP API ---
            let featuredMedia: any = null;
            if (source.featured_media?.id) {
              const wpMediaId = source.featured_media.id;
              const redisKey = `wp-media-key-${wpMediaId}`;
              try {
                // 1. DB first
                const dbMedia = await this.fileUploadModel
                  .findOne({ wpId: wpMediaId })
                  .lean()
                  .exec();
                if (dbMedia) {
                  featuredMedia = {
                    id: (dbMedia as any)._id?.toString(),
                    fileName: (dbMedia as any).fileName,
                    url: (dbMedia as any).url,
                    path: (dbMedia as any).path,
                  };
                } else {
                  // 2. Redis
                  const redisMedia = await this.redisService.get(redisKey);
                  if (redisMedia) {
                    featuredMedia = {
                      id: redisMedia.id,
                      fileName: redisMedia.fileName,
                      url: redisMedia.url,
                      path: redisMedia.path,
                    };
                  } else {
                    // 3. WP API
                    const response = await firstValueFrom(
                      this.httpService.get(`${wpBaseUrl}/wp-json/wp/v2/media/${wpMediaId}`, {
                        headers: { Host: this.wpHost },
                        auth: { username: wpAdmin, password: wpPassword },
                      })
                    );
                    const media = response.data;
                    const filePath = media.media_details?.file
                      ? `/uploads/${media.media_details.file}`
                      : undefined;
                    const mediaUrl = media.source_url || media.guid?.rendered;
                    const fileObj: any = {
                      wpId: media.id,
                      fileName:
                        media.title?.rendered || media.slug || media.media_details?.file || 'image',
                      mimeType: media.mime_type || '',
                      size: media.media_details?.filesize || 0,
                      source_url: mediaUrl,
                      caption: media.caption?.rendered
                        ? media.caption.rendered.replace(/<[^>]*>/g, '').trim()
                        : '',
                      url: mediaUrl,
                      path: filePath || mediaUrl,
                      folderPath: filePath || mediaUrl,
                      type: media.media_type || '',
                      isPrivate: false,
                      alt_text: media.alt_text || '',
                      featured_media: media.featured_media,
                      media_details: media.media_details,
                      postId: media.post || '',
                      organization: organizationData,
                      property: propertyData,
                      createdAt: media.date ? new Date(media.date) : new Date(),
                      updatedAt: media.modified ? new Date(media.modified) : new Date(),
                      createdBy: { userId: user.sub, userName: user.name },
                      updatedBy: { userId: user.sub, userName: user.name },
                    };
                    const { data: savedFile } = await this.fileUploadService.saveFileToDB(fileObj);
                    featuredMedia = {
                      id: savedFile.id,
                      fileName: savedFile.fileName,
                      url: savedFile.url,
                      path: savedFile.path,
                    };
                    await this.redisService.set(redisKey, savedFile);
                  }
                }
              } catch (err: any) {
                const msg = `Media fetch error wpPostId=${source.id} wpMediaId=${wpMediaId}: ${err.message}`;
                this.logger.warn(`[WordPressProvider] ${msg}`, this.constructor.name);
                logError(msg);
              }
            }

            // --- Slug ---
            const title = source.title || 'Untitled';
            const excerpt = source.excerpt || '';
            const rawFullSlug = source.link.replace(this.wpBaseUrl + '/', '');
            const fullSlugLastSegment = rawFullSlug.split('/').pop() ?? '';
            const fullSlug = /^\d+$/.test(fullSlugLastSegment) ? `${rawFullSlug}-` : rawFullSlug;
            const seo = {
              title: source.seo_meta?.rank_math_title,
              description: source.seo_meta?.rank_math_description,
              keywords: (source.seo_meta?.rank_math_focus_keyword || '')
                .split(',')
                .map((k: string) => k.trim())
                .filter(Boolean),
            };
            const seoObj = buildSeoObject(seo, title, excerpt, featuredMedia?.url);
            let rawSlug = source.slug;
            const articleSlug = /^\d+$/.test(rawSlug) ? `${rawSlug}-` : rawSlug;
            rawSlug = await this.slugService.generateUniqueSlug(
              title,
              ModuleName.ARTICLE,
              user,
              seoObj,
              defaultPropertyId,
              articleSlug,
              fullSlug
            );

            // --- Build doc ---
            const buildAuthorMetadata = (author: any) =>
              author
                ? {
                    id: author._id?.toString() || author.id,
                    name: author.name,
                    email: author.email || '',
                    userType: UserType.AUTHOR,
                  }
                : buildUserMetadata(user);

            docsToInsert.push({
              organization: organizationData,
              property: propertyData,
              title,
              slug: articleSlug,
              fullSlug,
              excerpt,
              body: source.content || '',
              status: this.mapWordPressStatus(source.status),
              type: source.post_format || 'article',
              lang: 'hi',
              categories: categories.length > 0 ? categories : [],
              tags: tags.length > 0 ? tags : [],
              authors: authors.length > 0 ? authors : [],
              publishedAt: source.date ? new Date(source.date) : null,
              featuredMedia,
              featured_media: source.featured_media?.id || null,
              primaryCategory,
              wpId: source.id,
              metaTitle: source.seo_meta?.rank_math_title || '',
              metaDescription: source.seo_meta?.rank_math_description || '',
              keyword: source.seo_meta?.rank_math_focus_keyword || '',
              wpCategoryIds: source.categories ? source.categories.map((c: any) => c.id) : [],
              wpTagIds: source.tags ? source.tags.map((t: any) => t.id) : [],
              header: source.header || null,
              createdBy: buildAuthorMetadata(authorForMetadata),
              updatedBy: buildAuthorMetadata(authorForMetadata),
              createdAt: source.date ? new Date(source.date) : undefined,
              updatedAt: source.modified ? new Date(source.modified) : undefined,
            });
            esIdByWpId.set(source.id, hit._id);
          } catch (err: any) {
            const msg = `Article build failed wpPostId=${hit._source?.id}: ${err.message}`;
            this.logger.error(`[WordPressProvider] ${msg}`, err?.stack, this.constructor.name);
            logError(`${msg}\n${err?.stack || ''}`);
            errors.push({ wpPostId: hit._source?.id, error: err.message });
          }
        }

        if (docsToInsert.length > 0) {
          try {
            const result = await this.articleModel.collection.insertMany(docsToInsert, {
              ordered: false,
            });
            importedCount += result.insertedCount || 0;
            this.logger.log(
              `[WordPressProvider] migrateMissingSlugs: inserted ${result.insertedCount}/${docsToInsert.length} articles [total: ${importedCount}]`,
              this.constructor.name
            );

            // Mark successfully inserted articles as migrated in missing_slugs
            const migratedEsIds = docsToInsert
              .map((doc) => esIdByWpId.get(doc.wpId))
              .filter(Boolean);
            if (migratedEsIds.length > 0) {
              await this.missingSlugModel.updateMany(
                { esId: { $in: migratedEsIds } },
                { $set: { status: 'migrated' } }
              );
            }
          } catch (err: any) {
            const msg = `Bulk insert error: ${err.message}`;
            this.logger.error(`[WordPressProvider] ${msg}`, err?.stack, this.constructor.name);
            logError(`${msg}\n${err?.stack || ''}`);
            errors.push({ error: msg });
          }
        }

        if (missingSlugs.length < fetchSize || (limit && totalScanned >= limit)) break;
        skip += batchSize;
      }

      this.logger.log(
        `[WordPressProvider] migrateMissingSlugs completed. Scanned: ${totalScanned}, Imported: ${importedCount}, Errors: ${errors.length}. Error log: ${errorLogPath}`,
        this.constructor.name
      );

      return {
        success: true,
        total: totalScanned,
        imported: importedCount,
        errors,
      };
    } catch (error) {
      const msg = `migrateMissingSlugs failed: ${error.message}`;
      logError(`${msg}\n${error.stack || ''}`);
      this.logger.error(
        '[WordPressProvider] migrateMissingSlugs failed:',
        { error: error.message, stack: error.stack },
        this.constructor.name
      );
      throw new Error(msg);
    }
  }

  async migrateWebStories(user: TCurrentUserType, limit?: number): Promise<MigrationResult> {
    this.logger.log(
      `[WordPressProvider] Starting web stories migration${limit ? ` [LIMIT: ${limit}]` : ''}`,
      this.constructor.name
    );

    if (!user || !user.email || !user.sub || !user.organizationId) {
      throw new Error('User authentication required.');
    }

    const effectivePropertyId = '6926b8f59a288ddf06a28884';
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');
    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const token = process.env.WP_API_TOKEN || 'dummy_token';
    const PAGE_SIZE = 100;

    if (!wpAdmin || !wpPassword) {
      throw new Error('WordPress credentials not configured');
    }

    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const property = await this._propertyService.getById(effectivePropertyId);
    const propertyData = {
      id: property._id.toString(),
      name: property.name,
      domain: property.domain,
    };

    const systemUserMeta = buildUserMetadata(user);

    let created = 0;
    let skipped = 0;
    let total = 0;
    const errors = [];
    const startTime = Date.now();
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      this.logger.log(
        `[WordPressProvider] Fetching web stories page ${currentPage}`,
        this.constructor.name
      );

      const response = await axios.get(`${wpBaseUrl}/wp-json/api/v1/filter`, {
        params: {
          page_number: currentPage,
          limit: PAGE_SIZE,
          token,
          orderby: 'date',
          order: 'desc',
          webstory: true,
          _embed: true,
        },
        headers: {
          Host: this.wpHost,
        },
        httpsAgent: this.httpsAgent,
        timeout: 30000,
      });

      const responseData = response.data;
      if (responseData.Status !== 'success' || !Array.isArray(responseData.Data)) {
        this.logger.warn(
          `[WordPressProvider] Web stories API returned non-success on page ${currentPage}: ${responseData.StatusMessage}`,
          this.constructor.name
        );
        break;
      }

      const stories: any[] = responseData.Data;
      if (stories.length === 0) {
        hasMore = false;
        break;
      }

      total += stories.length;

      // Deduplicate: skip stories already in MongoDB by wpId
      const wpPostIds = stories.map((s) => s.post_id).filter((id) => id != null);
      const existingWpIds = new Set(
        (
          await this.articleModel
            .find({ wpId: { $in: wpPostIds } }, { wpId: 1 })
            .lean()
            .exec()
        ).map((doc) => doc.wpId)
      );

      for (const story of stories) {
        const wpPostId = story.post_id;

        if (existingWpIds.has(wpPostId)) {
          skipped++;
          this.logger.log(
            `[WordPressProvider] Web story wpId=${wpPostId} already exists, skipping`,
            this.constructor.name
          );
          continue;
        }

        try {
          // --- Resolve author from story.post_author ---
          let authorMeta = systemUserMeta;
          let authors: any[] = [];
          const wpAuthorId = story.post_author?.id || story.author_id;
          if (wpAuthorId) {
            try {
              const redisUser = await this.redisService.get(`wp-user-${wpAuthorId}`);
              if (redisUser) {
                authorMeta = {
                  id: redisUser._id?.toString() || redisUser.id,
                  name: redisUser.name,
                  email: redisUser.email || '',
                  userType: UserType.AUTHOR,
                };
                authors = [
                  {
                    id: redisUser._id?.toString() || redisUser.id,
                    name: redisUser.name,
                    username: redisUser.username,
                    slug: redisUser.slug,
                    profilePicture: redisUser.profilePicture,
                  },
                ];
              }
            } catch (authorErr) {
              this.logger.warn(
                `[WordPressProvider] Could not resolve author id=${wpAuthorId} for story ${wpPostId}: ${authorErr.message}`,
                this.constructor.name
              );
            }
          }

          // --- Resolve categories from story.categories ---
          const categories: any[] = [];
          const wpCategoryIds: number[] = (story.categories || []).map(Number).filter(Boolean);
          for (const wpCatId of wpCategoryIds) {
            try {
              const redisCategory = await this.redisService.get(`wp-category-${wpCatId}`);
              if (redisCategory) {
                categories.push({
                  id: redisCategory._id?.toString() || redisCategory.id,
                  title: redisCategory.title,
                  titleHn: redisCategory.titleHn,
                  slug: redisCategory.slug,
                  fullSlug: redisCategory.fullSlug,
                  status: redisCategory.status,
                  isFeatured: redisCategory.isFeatured,
                  isPublic: redisCategory.isPublic,
                  link: redisCategory.link,
                  rank: redisCategory.rank,
                  wpCategoryId: redisCategory.wpCategoryId,
                  count: redisCategory.count,
                });
              } else {
                const dbCat = await this.categoryModel
                  .findOne({ wpCategoryId: wpCatId })
                  .lean()
                  .exec();
                if (dbCat) {
                  categories.push({
                    id: dbCat._id.toString(),
                    title: dbCat.title,
                    titleHn: dbCat.titleHn,
                    slug: dbCat.slug,
                    fullSlug: dbCat.fullSlug,
                    status: dbCat.status,
                    isFeatured: dbCat.isFeatured,
                    isPublic: dbCat.isPublic,
                    link: dbCat.link,
                    rank: dbCat.rank,
                    wpCategoryId: dbCat.wpCategoryId,
                    count: dbCat.count,
                  });
                }
              }
            } catch (catErr) {
              this.logger.warn(
                `[WordPressProvider] Could not resolve category wpId=${wpCatId} for story ${wpPostId}: ${catErr.message}`,
                this.constructor.name
              );
            }
          }
          const primaryCategory = categories.length > 0 ? categories[0] : null;

          // --- Resolve tags from story.tags ---
          const tags: any[] = [];
          const wpTagIds: number[] = (story.tags || []).map(Number).filter(Boolean);
          for (const wpTagId of wpTagIds) {
            try {
              const dbTag = await this.tagModel.findOne({ wpTagId }).lean().exec();
              if (dbTag) {
                const redisTag = await this.redisService.get(`wp-tag-${dbTag.name}`);
                const t = redisTag ?? dbTag;
                tags.push({
                  id: (t._id ?? t.id)?.toString(),
                  name: t.name,
                  slug: t.slug,
                  description: t.description,
                  rank: t.rank,
                  status: t.status,
                  isFeatured: t.isFeatured,
                  link: t.link,
                  wpTagId: t.wpTagId,
                  count: t.count,
                });
              }
            } catch (tagErr) {
              this.logger.warn(
                `[WordPressProvider] Could not resolve tag wpTagId=${wpTagId} for story ${wpPostId}: ${tagErr.message}`,
                this.constructor.name
              );
            }
          }

          // --- Fetch RankMath head ---
          let header: string | null = null;
          let metaTitle = story.title || '';
          let metaDescription = '';
          let keyword = '';
          const storyUrl: string = story.url || '';
          if (storyUrl) {
            try {
              const rankMathUrl = `${wpBaseUrl}/wp-json/rankmath/v1/getHead?url=${encodeURIComponent(storyUrl)}`;
              const rankMathRes = await firstValueFrom(
                this.httpService.get(rankMathUrl, {
                  headers: { Host: this.wpHost },
                  timeout: 10000,
                })
              );
              header = rankMathRes.data?.head || null;
              if (header) {
                const titleMatch = header.match(/<title[^>]*>([^<]*)<\/title>/i);
                if (titleMatch) metaTitle = titleMatch[1].trim() || metaTitle;
                const descMatch = header.match(
                  /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i
                );
                if (descMatch) metaDescription = descMatch[1].trim();
                const kwMatch = header.match(
                  /<meta\s+name=["']keywords["']\s+content=["']([^"']*)["']/i
                );
                if (kwMatch) keyword = kwMatch[1].trim();
              }
            } catch (rmErr) {
              this.logger.warn(
                `[WordPressProvider] Could not fetch RankMath head for story ${wpPostId}: ${rmErr.message}`,
                this.constructor.name
              );
            }
          }

          // --- Extract slug and fullSlug from URL ---
          // e.g. this.wpBaseUrl + '/ampstories/'some-story-slug
          const urlWithoutDomain = storyUrl.replace(/^https?:\/\/[^/]+\//, '');
          const fullSlug = urlWithoutDomain.replace(/\/$/, '') || `web-story-${wpPostId}`;
          const slug = fullSlug.split('/').pop() || `web-story-${wpPostId}`;

          // --- Resolve featured image: extract /uploads path, search DB, else save ---
          let featuredMedia: any = null;
          if (story.image) {
            try {
              const imageUrl: string = story.image;
              const uploadsMatch = imageUrl.match(/(\/uploads\/.+)/);
              const imagePath = uploadsMatch
                ? uploadsMatch[1]
                : imageUrl.replace(/^https?:\/\/[^/]+/, '');

              const dbMedia = await this.fileUploadModel.findOne({ path: imagePath }).lean().exec();
              if (dbMedia) {
                featuredMedia = {
                  id: (dbMedia as any)._id?.toString(),
                  fileName: (dbMedia as any).fileName,
                  url: (dbMedia as any).url,
                  path: (dbMedia as any).path,
                };
              } else {
                const redisKey = `wp-media-webstory-${wpPostId}`;
                const cachedMedia = await this.redisService.get(redisKey);
                if (cachedMedia) {
                  featuredMedia = cachedMedia;
                } else {
                  const fileObj: any = {
                    fileName: slug,
                    url: imageUrl,
                    folderPath: imagePath,
                    mimeType:
                      imagePath
                        .match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)?.[0]
                        ?.replace('.', 'image/') || 'image/jpeg',
                    organization: organizationData,
                    property: propertyData,
                    path: imagePath,
                    isPrivate: false,
                    createdBy: { userId: user.sub, userName: user.name },
                    updatedBy: { userId: user.sub, userName: user.name },
                  };
                  const { data: savedFile } = await this.fileUploadService.saveFileToDB(fileObj);
                  featuredMedia = {
                    id: savedFile.id,
                    fileName: savedFile.fileName,
                    url: savedFile.url,
                    path: savedFile.path,
                  };
                  await this.redisService.set(redisKey, featuredMedia);
                }
              }
            } catch (mediaErr) {
              this.logger.warn(
                `[WordPressProvider] Could not resolve featured image for web story wpId=${wpPostId}: ${mediaErr.message}`,
                this.constructor.name
              );
            }
          }

          const title = story.title || 'Untitled';
          const excerpt = story.excerpt ? story.excerpt.replace(/<[^>]*>/g, '').trim() : '';
          const publishedAt = story.publish_date ? new Date(story.publish_date) : new Date();
          const updatedAt = story.modified_date ? new Date(story.modified_date) : publishedAt;

          const articleDoc: any = {
            organization: organizationData,
            property: propertyData,
            title,
            slug,
            fullSlug,
            excerpt,
            body: story.content || '',
            status: 'published',
            type: 'web_story',
            lang: 'hi',
            categories,
            primaryCategory,
            tags,
            authors,
            publishedAt,
            featuredMedia,
            canonicalUrl: storyUrl,
            wpId: wpPostId,
            metaTitle,
            metaDescription,
            keyword,
            header,
            createdBy: authorMeta,
            updatedBy: authorMeta,
            createdAt: publishedAt,
            updatedAt,
          };

          await this.articleModel.collection.insertOne(articleDoc);
          created++;

          this.logger.log(
            `[WordPressProvider] Imported web story "${title}" (wpId: ${wpPostId}, slug: ${slug})`,
            this.constructor.name
          );
        } catch (err) {
          this.logger.error(
            `[WordPressProvider] Failed to import web story wpId=${wpPostId}: ${err.message}`,
            this.constructor.name
          );
          errors.push({ wpId: wpPostId, error: err.message });
        }
      }

      if (limit !== undefined && total >= limit) {
        hasMore = false;
      } else if (stories.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        currentPage++;
      }

      this.logger.log(
        `[WordPressProvider] Web stories batch ${currentPage - 1}: total=${total}, created=${created}, skipped=${skipped}`,
        this.constructor.name
      );
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `[WordPressProvider] Web stories migration complete. Total: ${total}, Created: ${created}, Skipped: ${skipped}, Errors: ${errors.length}, Duration: ${duration}ms`,
      this.constructor.name
    );

    return {
      success: errors.length === 0,
      total,
      imported: created,
      errors,
      duration,
    };
  }

  async fixFeaturedMedia(
    user: TCurrentUserType,
    dateFrom: string,
    limit?: number
  ): Promise<MigrationResult> {
    this.logger.log(
      `[WordPressProvider] Fixing featured media for articles on/after ${dateFrom}${limit ? ` [LIMIT: ${limit}]` : ''}`,
      this.constructor.name
    );

    const [day, month, year] = dateFrom.split('-').map(Number);
    const fromDate = new Date(year, month - 1, day);

    const wpAdmin = this.configService.get<string>('WP_ADMIN');
    const wpPassword = this.configService.get<string>('WP_PASSWORD');
    const wpBaseUrl = this.configService.get<string>('WP_BASE_URL');

    let scanned = 0;
    let updated = 0;
    const errors: any[] = [];

    const cursor = this.articleModel
      .find({ createdAt: { $gte: fromDate } })
      .lean()
      .cursor();

    const BULK_SIZE = 100;
    let bulkOps: any[] = [];

    for await (const article of cursor) {
      scanned++;

      // Skip articles that already have featuredMedia or have no featured_media WP ID
      const wpMediaId: number = (article as any).featured_media;
      if ((article as any).featuredMedia || !wpMediaId) {
        continue;
      }

      if (limit) {
        this.logger.log(
          `[WordPressProvider] [${updated + 1}/${limit}] slug=${(article as any).slug}`,
          this.constructor.name
        );
      }

      try {
        const redisKey = `wp-media-key-${wpMediaId}`;
        let featuredMedia: any = null;

        // 1. Redis cache
        const cached = await this.redisService.get(redisKey);
        if (cached) {
          featuredMedia = cached;
        } else {
          // 2. Existing FileUpload document
          const existing = await this.fileUploadModel.findOne({ wpId: wpMediaId }).lean().exec();

          if (existing) {
            featuredMedia = {
              id: (existing as any)._id.toString(),
              fileName: existing.fileName,
              url: existing.url,
              path: existing.path,
              alt: existing.alt_text,
              caption: existing.caption,
            };
            await this.redisService.set(redisKey, featuredMedia);
          } else {
            // 3. WP API — create FileUpload document
            if (!wpBaseUrl || !wpAdmin || !wpPassword) {
              throw new Error(
                `WP credentials not configured (WP_BASE_URL=${wpBaseUrl}, WP_ADMIN=${wpAdmin ? 'set' : 'missing'}, WP_PASSWORD=${wpPassword ? 'set' : 'missing'})`
              );
            }
            const response = await firstValueFrom(
              this.httpService.get(`${wpBaseUrl}/wp-json/wp/v2/media/${wpMediaId}`, {
                headers: { Host: this.wpHost },
                auth: { username: wpAdmin, password: wpPassword },
              })
            );
            const media = response.data;
            const mediaUrl = media.source_url || media.guid?.rendered || '';
            const filePath = media.media_details?.file
              ? `/uploads/${media.media_details.file}`
              : mediaUrl;

            const fileObj: any = {
              wpId: media.id,
              fileName: media.title?.rendered || media.slug || 'image',
              mimeType: media.mime_type || 'image/jpeg',
              size: media.media_details?.filesize || 0,
              source_url: mediaUrl,
              caption: media.caption?.rendered
                ? media.caption.rendered.replace(/<[^>]*>/g, '').trim()
                : '',
              url: mediaUrl,
              path: filePath || mediaUrl,
              folderPath: filePath || mediaUrl,
              type: media.media_type || '',
              isPrivate: false,
              alt_text: media.alt_text || '',
              featured_media: media.featured_media,
              media_details: media.media_details,
              postId: media.post || null,
              organization: (article as any).organization,
              property: (article as any).property,
              createdAt: media.date ? new Date(media.date) : new Date(),
              updatedAt: media.modified ? new Date(media.modified) : new Date(),
              createdBy: {
                userId: (article as any).createdBy?.id || user.sub,
                userName: (article as any).createdBy?.name || user.name,
              },
              updatedBy: {
                userId: (article as any).updatedBy?.id || user.sub,
                userName: (article as any).updatedBy?.name || user.name,
              },
            };

            const { data: savedFile } = await this.fileUploadService.saveFileToDB(fileObj);
            featuredMedia = {
              id: savedFile.id,
              fileName: savedFile.fileName,
              url: savedFile.url,
              path: savedFile.path,
              alt: media.alt_text || '',
              caption: fileObj.caption,
            };
            await this.redisService.set(redisKey, featuredMedia);
          }
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: (article as any)._id },
            update: { $set: { featuredMedia } },
          },
        });
        updated++;

        if (bulkOps.length >= BULK_SIZE) {
          await this.articleModel.bulkWrite(bulkOps);
          this.logger.log(
            `[WordPressProvider] Flushed ${bulkOps.length} featuredMedia updates`,
            this.constructor.name
          );
          bulkOps = [];
        }

        if (limit && updated >= limit) {
          break;
        }
      } catch (err) {
        this.logger.error(
          `[WordPressProvider] Error fixing featured media for article ${(article as any)._id}: ${err.message}`,
          err.stack,
          this.constructor.name
        );
        errors.push({ articleId: (article as any)._id.toString(), error: err.message });
      }
    }

    if (bulkOps.length) {
      await this.articleModel.bulkWrite(bulkOps);
    }

    this.logger.log(
      `[WordPressProvider] Fix featured media completed. Scanned: ${scanned}, Updated: ${updated}, Errors: ${errors.length}`,
      this.constructor.name
    );

    return { success: errors.length === 0, total: scanned, imported: updated, errors };
  }
}
