import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { Article, TArticleDocument } from '../schemas/article.schema';
import { IntegrationsService } from 'src/integrations/integrations.service';
import { GoogleSearchConsoleProvider } from 'src/integrations/providers/google-search-console.provider';
import { GoogleAnalyticsProvider } from 'src/integrations/providers/google-analytics.provider';
import {
  Integration,
  IntegrationDocument,
  IntegrationProvider,
  IntegrationStatus,
} from 'src/integrations/schemas/integration.schema';
import { TCurrentUserType } from 'src/auth/types/user.type';
import {
  buildArticleMetricMatchKeys,
  normalizeArticleMetricsPath,
} from './article-metrics.utils';

export interface GscMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface Ga4Metrics {
  views: number;
  activeUsers: number;
  avgEngagementTime: number;
}

export interface ArticleWithMetrics {
  _id: string;
  title: string;
  slug: string;
  fullSlug: string;
  publishedAt: Date;
  authors: any[];
  primaryCategory: any;
  featuredMedia?: any;
  status: string;
  metrics: {
    gsc: GscMetrics | null;
    ga4: Ga4Metrics | null;
  };
}

export interface MetricsSummary {
  totalArticles: number;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  totalViews: number;
}

interface SyncMetricsLookup {
  gscByPath: Map<string, GscMetrics>;
  ga4ByPath: Map<string, Ga4Metrics>;
  gscAvailable: boolean;
  ga4Available: boolean;
  gscRows: number;
  ga4Rows: number;
}

interface PropertySyncResult {
  propertyId: string;
  articlesFound: number;
  gscRows: number;
  ga4Rows: number;
  matchedArticles: number;
  updatedArticles: number;
}

interface NightlySyncResult {
  startedAt: string;
  finishedAt: string;
  days: number;
  propertiesFound: number;
  propertiesProcessed: number;
  results: PropertySyncResult[];
}

@Injectable()
export class ArticleMetricsService {
  private readonly logger = new Logger(ArticleMetricsService.name);

  constructor(
    @InjectModel(Article.name) private readonly articleModel: Model<TArticleDocument>,
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<IntegrationDocument>,
    private readonly integrationsService: IntegrationsService,
    private readonly gscProvider: GoogleSearchConsoleProvider,
    private readonly gaProvider: GoogleAnalyticsProvider,
  ) { }

  @Cron('30 2 * * *', {
    name: 'article-metrics-nightly-sync',
    timeZone: 'Asia/Kolkata',
  })
  async syncRecentPublishedArticleMetrics(days = 7): Promise<NightlySyncResult> {
    const startedAt = new Date();
    this.logger.log(`[nightly-sync] Starting nightly article metrics sync for last ${days} days`);

    const integrations = await this.integrationModel
      .find({
        provider: {
          $in: [IntegrationProvider.SEARCH_CONSOLE, IntegrationProvider.GOOGLE_ANALYTICS],
        },
        status: IntegrationStatus.CONNECTED,
      })
      .select('propertyId provider')
      .lean()
      .exec();

    const propertyProviders = new Map<string, Set<IntegrationProvider>>();

    for (const integration of integrations) {
      const propertyId = integration.propertyId?.toString();
      if (!propertyId) {
        continue;
      }

      if (!propertyProviders.has(propertyId)) {
        propertyProviders.set(propertyId, new Set());
      }

      propertyProviders.get(propertyId)?.add(integration.provider);
    }

    this.logger.log(`[nightly-sync] Found ${propertyProviders.size} properties with connected metrics providers`);

    const results: PropertySyncResult[] = [];

    for (const [propertyId, providers] of propertyProviders.entries()) {
      try {
        this.logger.log(
          `[nightly-sync] Processing property ${propertyId} with providers=${Array.from(providers).join(',')}`,
        );
        const result = await this.syncPropertyRecentArticleMetrics(propertyId, days, providers);
        results.push(result);
        this.logger.log(
          `[nightly-sync] property=${result.propertyId} articles=${result.articlesFound} gscRows=${result.gscRows} ga4Rows=${result.ga4Rows} matched=${result.matchedArticles} updated=${result.updatedArticles}`,
        );
      } catch (error) {
        this.logger.error(
          `[nightly-sync] Failed syncing property ${propertyId}: ${error.message}`,
          error.stack,
        );
      }

      await this.sleep(300);
    }

    this.logger.log('[nightly-sync] Completed nightly article metrics sync');

    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      days,
      propertiesFound: propertyProviders.size,
      propertiesProcessed: results.length,
      results,
    };
  }

  async syncPropertyRecentArticleMetrics(
    propertyId: string,
    days = 7,
    availableProviders?: Set<IntegrationProvider>,
  ): Promise<PropertySyncResult> {
    const { startDate, endDate, startDateStr, endDateStr } = this.buildDateRange(days);

    this.logger.log(
      `[property-sync] property=${propertyId} window=${startDateStr}..${endDateStr} starting article lookup`,
    );

    const articles = await this.articleModel
      .find({
        'property.id': propertyId,
        status: 'published',
        publishedAt: { $gte: startDate, $lte: endDate },
      })
      .select('_id slug fullSlug')
      .sort({ publishedAt: 1 })
      .lean()
      .exec();

    if (articles.length === 0) {
      this.logger.log(`[property-sync] property=${propertyId} no recent published articles found, skipping`);
      return {
        propertyId,
        articlesFound: 0,
        gscRows: 0,
        ga4Rows: 0,
        matchedArticles: 0,
        updatedArticles: 0,
      };
    }

    this.logger.log(
      `[property-sync] property=${propertyId} found ${articles.length} published articles to sync`,
    );

    const lookup = await this.fetchMetricsLookupForArticles(
      propertyId,
      startDateStr,
      endDateStr,
      articles,
      availableProviders,
    );

    this.logger.log(
      `[property-sync] property=${propertyId} provider rows fetched gsc=${lookup.gscRows} ga4=${lookup.ga4Rows}`,
    );

    const operations = [];
    let matchedArticles = 0;

    for (const article of articles) {
      const matchKeys = buildArticleMetricMatchKeys(article as any);
      const gscMetrics = this.findFirstMetricsMatch(matchKeys, lookup.gscByPath);
      const ga4Metrics = this.findFirstMetricsMatch(matchKeys, lookup.ga4ByPath);

      const setFields: Record<string, number | Date> = {};

      if (lookup.gscAvailable) {
        setFields['metricsLatest.clicks'] = gscMetrics?.clicks ?? 0;
        setFields['metricsLatest.impressions'] = gscMetrics?.impressions ?? 0;
        setFields['metricsLatest.ctr'] = gscMetrics?.ctr ?? 0;
        setFields['metricsLatest.position'] = gscMetrics?.position ?? 0;
      }

      if (lookup.ga4Available) {
        setFields['metricsLatest.pv'] = ga4Metrics?.views ?? 0;
        setFields['metricsLatest.uv'] = ga4Metrics?.activeUsers ?? 0;
      }

      if (Object.keys(setFields).length === 0) {
        continue;
      }

      if (gscMetrics || ga4Metrics) {
        matchedArticles += 1;
      }

      setFields['metricsLatest.lastSyncedAt'] = new Date();

      operations.push({
        updateOne: {
          filter: { _id: article._id },
          update: { $set: setFields },
        },
      });
    }

    if (operations.length > 0) {
      this.logger.log(
        `[property-sync] property=${propertyId} writing ${operations.length} article metric updates with bulkWrite`,
      );
      await this.articleModel.bulkWrite(operations, { ordered: false });
    }

    this.logger.log(
      `[property-sync] property=${propertyId} completed matched=${matchedArticles} updated=${operations.length}`,
    );

    return {
      propertyId,
      articlesFound: articles.length,
      gscRows: lookup.gscRows,
      ga4Rows: lookup.ga4Rows,
      matchedArticles,
      updatedArticles: operations.length,
    };
  }

  private buildDateRange(days: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    return {
      startDate,
      endDate,
      startDateStr: startDate.toISOString().split('T')[0],
      endDateStr: endDate.toISOString().split('T')[0],
    };
  }

  private buildGa4ExactPaths(articles: Array<{ fullSlug?: string; slug?: string }>): string[] {
    return Array.from(
      new Set(
        articles.flatMap((article) =>
          buildArticleMetricMatchKeys(article).flatMap((path) => [`/${path}`, `/${path}/amp`]),
        ),
      ),
    );
  }

  private buildGscExactPaths(articles: Array<{ fullSlug?: string; slug?: string }>): string[] {
    return Array.from(
      new Set(
        articles.flatMap((article) =>
          buildArticleMetricMatchKeys(article).map((path) => `/${path}`),
        ),
      ),
    );
  }

  private async fetchMetricsLookupForArticles(
    propertyId: string,
    startDateStr: string,
    endDateStr: string,
    articles: Array<{ fullSlug?: string; slug?: string }>,
    availableProviders?: Set<IntegrationProvider>,
  ): Promise<SyncMetricsLookup> {
    const gscByPath = new Map<string, GscMetrics>();
    const ga4ByPath = new Map<string, Ga4Metrics>();

    let gscAvailable = false;
    let ga4Available = false;
    let gscRows = 0;
    let ga4Rows = 0;

    if (
      !availableProviders ||
      availableProviders.has(IntegrationProvider.SEARCH_CONSOLE)
    ) {
      try {
        this.logger.log(`[metrics-lookup] property=${propertyId} fetching GSC page-level analytics`);
        const gscIntegration = await this.integrationsService.getIntegrationWithCredentials(
          propertyId,
          IntegrationProvider.SEARCH_CONSOLE,
        );
        const authClient = this.integrationsService.getGoogleAuthClient(gscIntegration.credentials);
        const siteUrl = gscIntegration.metadata?.siteUrl;

        if (siteUrl) {
          const gscPageData = await this.gscProvider.getPageLevelAnalytics(
            authClient,
            siteUrl,
            startDateStr,
            endDateStr,
            undefined,
            this.buildGscExactPaths(articles),
          );

          gscRows = gscPageData.length;
          gscAvailable = true;
          this.logger.log(`[metrics-lookup] property=${propertyId} GSC returned ${gscRows} rows`);

          for (const row of gscPageData) {
            const normalizedPath = normalizeArticleMetricsPath(row.url);
            if (!normalizedPath) {
              continue;
            }

            const existing = gscByPath.get(normalizedPath);
            if (!existing) {
              gscByPath.set(normalizedPath, {
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr,
                position: row.position,
              });
              continue;
            }

            const totalImpressions = existing.impressions + row.impressions;
            const totalClicks = existing.clicks + row.clicks;

            existing.clicks = totalClicks;
            existing.impressions = totalImpressions;
            existing.ctr =
              totalImpressions > 0
                ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2))
                : 0;
            existing.position =
              totalImpressions > 0
                ? parseFloat(
                  (
                    ((existing.position * (totalImpressions - row.impressions)) +
                      row.position * row.impressions) /
                    totalImpressions
                  ).toFixed(2),
                )
                : 0;
          }
        }
      } catch (error) {
        this.logger.warn(`[metrics-lookup] GSC unavailable for property ${propertyId}: ${error.message}`);
      }
    }

    if (
      !availableProviders ||
      availableProviders.has(IntegrationProvider.GOOGLE_ANALYTICS)
    ) {
      try {
        this.logger.log(`[metrics-lookup] property=${propertyId} fetching GA4 page-level analytics`);
        const gaIntegration = await this.integrationsService.getIntegrationWithCredentials(
          propertyId,
          IntegrationProvider.GOOGLE_ANALYTICS,
        );
        const authClient = this.integrationsService.getGoogleAuthClient(gaIntegration.credentials);
        const gaPropertyId = gaIntegration.metadata?.propertyId;

        if (gaPropertyId) {
          const ga4PageData = await this.gaProvider.getPageViewsByPaths(
            authClient,
            gaPropertyId,
            startDateStr,
            endDateStr,
            10000,
            this.buildGa4ExactPaths(articles),
          );

          ga4Rows = ga4PageData.length;
          ga4Available = true;
          this.logger.log(`[metrics-lookup] property=${propertyId} GA4 returned ${ga4Rows} rows`);

          for (const row of ga4PageData) {
            const normalizedPath = normalizeArticleMetricsPath(row.path);
            if (!normalizedPath) {
              continue;
            }

            const existing = ga4ByPath.get(normalizedPath);
            if (!existing) {
              ga4ByPath.set(normalizedPath, {
                views: row.views,
                activeUsers: row.activeUsers,
                avgEngagementTime: row.avgEngagementTime,
              });
              continue;
            }

            const totalViews = existing.views + row.views;
            existing.activeUsers += row.activeUsers;
            existing.avgEngagementTime =
              totalViews > 0
                ? parseFloat(
                  (
                    ((existing.avgEngagementTime * existing.views) +
                      row.avgEngagementTime * row.views) /
                    totalViews
                  ).toFixed(2),
                )
                : 0;
            existing.views = totalViews;
          }
        }
      } catch (error) {
        this.logger.warn(`[metrics-lookup] GA4 unavailable for property ${propertyId}: ${error.message}`);
      }
    }

    return {
      gscByPath,
      ga4ByPath,
      gscAvailable,
      ga4Available,
      gscRows,
      ga4Rows,
    };
  }

  private findFirstMetricsMatch<T>(matchKeys: string[], map: Map<string, T>): T | null {
    for (const key of matchKeys) {
      const metrics = map.get(key);
      if (metrics) {
        return metrics;
      }
    }

    return null;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetches articles published in the last N days and enriches them
   * with per-article metrics from Google Search Console and GA4.
   */
  async getRecentArticleMetrics(
    propertyId: string,
    user: TCurrentUserType,
    days = 7,
  ): Promise<{ summary: MetricsSummary; articles: ArticleWithMetrics[] }> {
    const { startDate, endDate, startDateStr, endDateStr } = this.buildDateRange(days);

    const recentArticles = await this.articleModel
      .find({
        $or: [
          { 'property.id': propertyId },
          { propertyId: propertyId },
        ],
        status: 'published',
        publishedAt: { $gte: startDate, $lte: endDate },
      })
      .select('title slug fullSlug publishedAt authors primaryCategory featuredMedia status')
      .sort({ publishedAt: -1 })
      .lean()
      .exec();

    this.logger.log(
      `Found ${recentArticles.length} articles published in the last ${days} days for property ${propertyId}`,
    );

    const lookup = await this.fetchMetricsLookupForArticles(
      propertyId,
      startDateStr,
      endDateStr,
      recentArticles,
    );

    // 6. Correlate articles with metrics
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalPosition = 0;
    let totalViews = 0;
    let articlesWithGsc = 0;

    const articlesWithMetrics: ArticleWithMetrics[] = recentArticles.map((article: any) => {
      const matchKeys = buildArticleMetricMatchKeys(article);
      const gscMetrics = this.findFirstMetricsMatch(matchKeys, lookup.gscByPath);
      const ga4Metrics = this.findFirstMetricsMatch(matchKeys, lookup.ga4ByPath);

      if (gscMetrics) {
        totalClicks += gscMetrics.clicks;
        totalImpressions += gscMetrics.impressions;
        totalPosition += gscMetrics.position * gscMetrics.impressions; // weighted
        articlesWithGsc++;
      }

      if (ga4Metrics) {
        totalViews += ga4Metrics.views;
      }

      return {
        _id: article._id.toString(),
        title: article.title,
        slug: article.slug,
        fullSlug: article.fullSlug,
        publishedAt: article.publishedAt,
        authors: article.authors || [],
        primaryCategory: article.primaryCategory || null,
        featuredMedia: article.featuredMedia || null,
        status: article.status,
        metrics: {
          gsc: gscMetrics,
          ga4: ga4Metrics,
        },
      };
    });

    // 7. Build summary
    const avgCtr = totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const avgPosition = totalImpressions > 0 ? parseFloat((totalPosition / totalImpressions).toFixed(2)) : 0;

    const summary: MetricsSummary = {
      totalArticles: recentArticles.length,
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition,
      totalViews,
    };

    return { summary, articles: articlesWithMetrics };
  }

  /**
   * [TEMP] Populates REAL metrics data from GSC and GA4 for articles by a
   * specific author published in the last N days. Writes into each article's
   * `metricsLatest`. Remove this method after testing is complete.
   */
  async populateMetricsForAuthor(
    authorId: string,
    propertyId: string,
    days = 7,
  ): Promise<{ updated: number; articles: any[] }> {
    const { startDate, endDate, startDateStr, endDateStr } = this.buildDateRange(days);

    // 1. Fetch published articles by this author in the date range
    const articles = await this.articleModel
      .find({
        $or: [{ 'property.id': propertyId }, { propertyId }],
        'authors.id': authorId,
        status: 'published',
        publishedAt: { $gte: startDate, $lte: endDate },
      })
      .select('title slug fullSlug publishedAt authors metricsLatest')
      .sort({ publishedAt: -1 })
      .lean()
      .exec();

    this.logger.log(
      `[populateMetricsForAuthor] Found ${articles.length} articles for author ${authorId} in the last ${days} days`,
    );
    const lookup = await this.fetchMetricsLookupForArticles(
      propertyId,
      startDateStr,
      endDateStr,
      articles,
    );

    // 5. Match articles to real metrics and update metricsLatest
    const updatedArticles: any[] = [];
    const operations = [];

    for (const article of articles) {
      const matchKeys = buildArticleMetricMatchKeys(article as any);
      const gscMetrics = this.findFirstMetricsMatch(matchKeys, lookup.gscByPath);
      const ga4Metrics = this.findFirstMetricsMatch(matchKeys, lookup.ga4ByPath);

      const metricsLatest: any = {
        lastSyncedAt: new Date(),
      };

      if (lookup.gscAvailable) {
        metricsLatest.impressions = gscMetrics?.impressions ?? 0;
        metricsLatest.clicks = gscMetrics?.clicks ?? 0;
        metricsLatest.ctr = gscMetrics?.ctr ?? 0;
        metricsLatest.position = gscMetrics?.position ?? 0;
      }

      if (lookup.ga4Available) {
        metricsLatest.pv = ga4Metrics?.views ?? 0;
        metricsLatest.uv = ga4Metrics?.activeUsers ?? 0;
      }

      if (Object.keys(metricsLatest).length === 1) {
        continue;
      }

      operations.push({
        updateOne: {
          filter: { _id: article._id },
          update: { $set: { metricsLatest } },
        },
      });

      updatedArticles.push({
        _id: article._id.toString(),
        title: article.title,
        slug: article.slug,
        fullSlug: article.fullSlug,
        metricsLatest,
        matched: {
          gsc: !!gscMetrics,
          ga4: !!ga4Metrics,
        },
      });
    }

    if (operations.length > 0) {
      await this.articleModel.bulkWrite(operations, { ordered: false });
    }

    return { updated: operations.length, articles: updatedArticles };
  }

  /**
   * [TEMP DEBUG] Fetches raw GSC/GA4 data and compares URL paths against CMS article slugs.
   * Helps identify why matching fails. Includes verbose logging.
   */
  async debugSlugMatching(propertyId: string, days = 7) {
    this.logger.log(`\n========== DEBUG SLUG MATCHING START ==========`);
    this.logger.log(`[STEP 1] Property ID: ${propertyId}, Days: ${days}`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    this.logger.log(`[STEP 2] Date range: ${startDateStr} → ${endDateStr}`);

    // Fetch a sample of articles
    const articles = await this.articleModel
      .find({
        $or: [{ 'property.id': propertyId }, { propertyId }],
        status: 'published',
        publishedAt: { $gte: startDate },
      })
      .select('title slug fullSlug')
      .sort({ publishedAt: -1 })
      .limit(10)
      .lean()
      .exec();

    this.logger.log(`[STEP 3] Found ${articles.length} recent articles from MongoDB`);
    articles.forEach((a: any, i: number) => {
      this.logger.log(`  Article ${i + 1}: slug="${a.slug}" | fullSlug="${a.fullSlug}"`);
    });

    // Fetch GSC data
    let gscUrls: { url: string; clicks: number; impressions: number }[] = [];
    let gscSiteUrl = '';
    try {
      this.logger.log(`[STEP 4] Fetching GSC integration for property ${propertyId}...`);
      const gscIntegration = await this.integrationsService.getIntegrationWithCredentials(
        propertyId,
        IntegrationProvider.SEARCH_CONSOLE,
      );
      const authClient = this.integrationsService.getGoogleAuthClient(gscIntegration.credentials);
      gscSiteUrl = gscIntegration.metadata?.siteUrl || '';
      this.logger.log(`[STEP 4] GSC site URL: ${gscSiteUrl}`);

      if (gscSiteUrl) {
        const gscData = await this.gscProvider.getPageLevelAnalytics(
          authClient,
          gscSiteUrl,
          startDateStr,
          endDateStr,
        );
        this.logger.log(`[STEP 4] GSC returned ${gscData.length} total page rows`);
        gscUrls = gscData.slice(0, 20).map(row => ({ url: row.url, clicks: row.clicks, impressions: row.impressions }));
        this.logger.log(`[STEP 4] Sample GSC URLs (top 20):`);
        gscUrls.forEach((r, i) => {
          this.logger.log(`  GSC ${i + 1}: ${r.url} (clicks: ${r.clicks}, impressions: ${r.impressions})`);
        });
      }
    } catch (error) {
      this.logger.warn(`[STEP 4] GSC error: ${error.message}`);
    }

    // Fetch GA4 data
    let ga4Data: { path: string; views: number }[] = [];
    try {
      this.logger.log(`[STEP 5] Fetching GA4 integration for property ${propertyId}...`);
      const gaIntegration = await this.integrationsService.getIntegrationWithCredentials(
        propertyId,
        IntegrationProvider.GOOGLE_ANALYTICS,
      );
      const authClient = this.integrationsService.getGoogleAuthClient(gaIntegration.credentials);
      const gaPropertyId = gaIntegration.metadata?.propertyId;
      this.logger.log(`[STEP 5] GA4 property ID: ${gaPropertyId}`);

      if (gaPropertyId) {
        const ga4Result = await this.gaProvider.getPageViewsByPaths(
          authClient,
          gaPropertyId,
          startDateStr,
          endDateStr,
        );
        this.logger.log(`[STEP 5] GA4 returned ${ga4Result.length} total path rows`);
        ga4Data = ga4Result.slice(0, 20).map(row => ({ path: row.path, views: row.views }));
        this.logger.log(`[STEP 5] Sample GA4 paths (top 20):`);
        ga4Data.forEach((r, i) => {
          this.logger.log(`  GA4 ${i + 1}: ${r.path} (views: ${r.views})`);
        });
      }
    } catch (error) {
      this.logger.warn(`[STEP 5] GA4 error: ${error.message}`);
    }

    // Normalize and compare
    this.logger.log(`[STEP 6] Normalizing and comparing...`);

    const gscNormalized = gscUrls.map(r => {
      try {
        const normalized = new URL(r.url).pathname.replace(/^\/|\/$/g, '');
        return { raw: r.url, normalized };
      } catch {
        return { raw: r.url, normalized: r.url };
      }
    });

    const ga4Normalized = ga4Data.map(r => ({
      raw: r.path,
      normalized: r.path.replace(/^\/|\/$/g, ''),
    }));

    // Per-article matching attempt
    this.logger.log(`[STEP 7] Per-article match attempts:`);
    const matchResults = articles.map((a: any, i: number) => {
      const normalizedFullSlug = (a.fullSlug || '').replace(/^\/|\/$/g, '');
      const normalizedSlug = (a.slug || '').replace(/^\/|\/$/g, '');

      const gscMatch = gscNormalized.find(g => g.normalized === normalizedFullSlug || g.normalized === normalizedSlug);
      const ga4Match = ga4Normalized.find(g => g.normalized === normalizedFullSlug || g.normalized === normalizedSlug);

      this.logger.log(`  Article ${i + 1}: "${a.slug}"`);
      this.logger.log(`    fullSlug normalized: "${normalizedFullSlug}"`);
      this.logger.log(`    GSC match: ${gscMatch ? `YES → "${gscMatch.normalized}"` : 'NO'}`);
      this.logger.log(`    GA4 match: ${ga4Match ? `YES → "${ga4Match.normalized}"` : 'NO'}`);

      // If no match, find closest GSC URL that contains the slug
      let closestGsc: string | null = null;
      if (!gscMatch) {
        const partial = gscNormalized.find(g => g.normalized.includes(normalizedSlug));
        if (partial) {
          closestGsc = partial.normalized;
          this.logger.log(`    Closest GSC (partial slug match): "${closestGsc}"`);
        }
      }

      return {
        slug: a.slug,
        fullSlug: a.fullSlug,
        normalizedFullSlug,
        gscMatched: !!gscMatch,
        ga4Matched: !!ga4Match,
        closestGsc,
      };
    });

    this.logger.log(`\n========== DEBUG SLUG MATCHING END ==========\n`);

    return {
      gscSiteUrl,
      dateRange: { start: startDateStr, end: endDateStr },
      totalGscRows: gscUrls.length,
      totalGa4Rows: ga4Data.length,
      totalArticles: articles.length,
      sampleGscNormalized: gscNormalized.slice(0, 10),
      sampleGa4Normalized: ga4Normalized.slice(0, 10),
      matchResults,
    };
  }

  /**
   * Aggregates dashboard stats from metricsLatest on article documents.
   * - If userId is provided, returns stats for that user's articles only.
   * - If userId is omitted, returns cumulative stats for all articles (admin view).
   */
  async getDashboardStats(
    propertyId: string,
    days: number,
    userId?: string,
  ): Promise<{
    totals: {
      totalArticles: number;
      totalClicks: number;
      totalImpressions: number;
      totalViews: number;
      totalVisitors: number;
      avgCtr: string;
    };
    chartData: Array<{
      date: string;
      views: number;
      published: number;
    }>;
    topArticles: Array<any>;
  }> {
    const { startDate, endDate } = this.buildDateRange(days);

    const matchStage: Record<string, any> = {
      'property.id': propertyId,
      status: 'published',
      publishedAt: { $gte: startDate, $lte: endDate },
    };

    if (userId) {
      matchStage['authors.id'] = userId;
    }

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $facet: {
          // 1. Overall Totals
          totals: [
            {
              $group: {
                _id: null,
                totalArticles: { $sum: 1 },
                totalClicks: { $sum: { $ifNull: ['$metricsLatest.clicks', 0] } },
                totalImpressions: { $sum: { $ifNull: ['$metricsLatest.impressions', 0] } },
                totalViews: { $sum: { $ifNull: ['$metricsLatest.pv', 0] } },
                totalVisitors: { $sum: { $ifNull: ['$metricsLatest.uv', 0] } },
              },
            },
          ],
          // 2. Daily grouping for Content Velocity chart
          daily: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$publishedAt', '$createdAt'] }, timezone: '+05:30' },
                },
                published: { $sum: 1 },
                views: { $sum: { $ifNull: ['$metricsLatest.pv', 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
          // 3. Top 5 Articles by Page Views
          topArticles: [
            { $sort: { 'metricsLatest.pv': -1 } },
            { $limit: 5 },
          ],
        },
      },
    ];

    const [result] = await this.articleModel.aggregate(pipeline).exec();

    const totalsObj = result?.totals?.[0] || {
      totalArticles: 0,
      totalClicks: 0,
      totalImpressions: 0,
      totalViews: 0,
      totalVisitors: 0,
    };

    const avgCtr =
      totalsObj.totalImpressions > 0
        ? ((totalsObj.totalClicks / totalsObj.totalImpressions) * 100).toFixed(2)
        : '0.00';

    return {
      totals: {
        totalArticles: totalsObj.totalArticles,
        totalClicks: totalsObj.totalClicks,
        totalImpressions: totalsObj.totalImpressions,
        totalViews: totalsObj.totalViews,
        totalVisitors: totalsObj.totalVisitors,
        avgCtr: `${avgCtr}%`,
      },
      chartData: (result?.daily || []).map((day: any) => ({
        date: day._id,
        views: day.views,
        published: day.published,
      })),
      topArticles: result?.topArticles || [],
    };
  }
}
