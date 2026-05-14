import { TCurrentUserType } from '@auth/types/user.type';

export interface MigrationResult {
  success: boolean;
  imported?: number;
  created?: number;
  updated?: number;
  total?: number;
  errors?: any[];
  duration?: number;
  avgTimePerArticle?: number;
}

export interface MigratorProvider {
  /**
   * Migrate tags from the source system
   */
  migrateTags(user: TCurrentUserType): Promise<MigrationResult>;

  /**
   * Migrate tags from WordPress published after a given ISO 8601 datetime.
   * Uses the same WP REST API logic as migrateTags but scoped to a date window.
   */
  migrateTagsAfter(user: TCurrentUserType, after: string): Promise<MigrationResult>;

  /**
   * Migrate categories from the source system
   */
  migrateCategories(user: TCurrentUserType): Promise<MigrationResult>;

  /**
   * Migrate categories from WordPress modified after a given ISO 8601 date (YYYY-MM-DD).
   */
  migrateCategoriesAfter(user: TCurrentUserType, after: string): Promise<MigrationResult>;

  /**
   * Migrate users from the source system
   */
  migrateUsers(user: TCurrentUserType): Promise<MigrationResult>;

  /**
   * Migrate articles from the source system
   */
  migrateArticles(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult>;

  /**
   * Migrate articles from Elasticsearch instead of WordPress
   */
  migrateArticlesV2(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult>;

  /**
   * Sync tags on existing articles from Elasticsearch source (wp_posts_prod)
   */
  syncTags(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult>;

  /**
   * Migrate articles from Elasticsearch instead of WordPress using new Index
   */
  migrateArticlesV3(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult>;

  /**
   * Migrate live articles from the source system
   */
  migrateLiveArticles(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult>;

  /**
   * Migrate live articles from Elasticsearch (wp_posts_prod), replacing richBlocks
   */
  migrateLiveArticlesV2(user: TCurrentUserType, slug?: string, limit?: number): Promise<MigrationResult>;

  /**
   * Revert updatedAt/updatedBy changes made by migrateLiveArticlesV2
   */
  revertLiveArticlesV2(slug?: string, limit?: number): Promise<MigrationResult>;

  /**
   * Migrate menus from the source system
   */
  migrateMenus(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult>;

  /**
   * Migrate menus from the source system after a given date.
   * Note: the custom menu API does not support date filtering — this delegates to migrateMenus.
   */
  migrateMenusAfter(
    user: TCurrentUserType,
    after: string,
    propertyId?: string
  ): Promise<MigrationResult>;

  /**
   * Migrate header meta tags for users via RankMath API
   */
  migrateUserHeaders(): Promise<MigrationResult>;

  /**
   * Parse header meta tags for users 
   */
  parseUserHeaders(): Promise<MigrationResult>;

  /**
   * Migrate media from the source system.
   * @param days - Optional number of days to look back from today. Overrides env-based date range.
   */
  migrateMedia(days?: number): Promise<MigrationResult>;

  /**
   * Migrate media from the source system starting from a specific date (YYYY-MM-DD),
   * bypassing the Redis resume key.
   * @param after - ISO date string (YYYY-MM-DD) to start from.
   * @param days - Optional number of days to process.
   */
  migrateMediaAfter(after: string, days?: number): Promise<MigrationResult>;

  /**
   * Migrate static pages from WordPress REST API (/wp-json/wp/v2/pages)
   */
  migrateStaticPages(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult>;

  /**
   * Traverse Elasticsearch, compare slugs against MongoDB articles,
   * and record missing slugs in the missing_slugs collection.
   */
  auditSlugDiff(): Promise<MigrationResult>;

  /**
   * Traverse all articles and copy createdBy, updatedBy, createdAt, updatedAt
   * into the corresponding slug document.
   */
  fixSlugMeta(limit?: number): Promise<MigrationResult>;

  /**
   * Fetch articles from the missing_slugs collection, pull their full source from
   * Elasticsearch, and run the standard article migration process.
   * Featured media is resolved DB-first → Redis → WP API.
   * Errors are written to a log file.
   */
  migrateMissingSlugs(user: TCurrentUserType, limit?: number): Promise<MigrationResult>;

  /**
   * Migrate web stories from WordPress custom API (/wp-json/api/v1/filter?webstory=true)
   */
  migrateWebStories(user: TCurrentUserType, limit?: number): Promise<MigrationResult>;

  /**
   * Fix featuredMedia on articles on/after a given date where it is null,
   * by fetching media from the WP API using the article's featured_media ID
   * and creating/reusing a FileUpload document.
   */
  fixFeaturedMedia(user: TCurrentUserType, dateFrom: string, limit?: number): Promise<MigrationResult>;
}

export const MIGRATOR_PROVIDER = 'MigratorProvider';
