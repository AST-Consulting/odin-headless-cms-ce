import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IntegrationsService } from 'src/integrations/integrations.service';
import { GoogleAnalyticsProvider } from 'src/integrations/providers/google-analytics.provider';
import { IntegrationProvider } from 'src/integrations/schemas/integration.schema';
import { ElasticService } from 'src/core/elastic/elastic.service';
import { Article, TArticleDocument } from 'src/articles/schemas/article.schema';
import { RedisService } from 'src/utilities/redis/redis.service';
import { GaBaseQueryDto, GaDimensionQueryDto, GaTopArticlesQueryDto, GaTrafficSourcesQueryDto } from './dto/ga-analytics.dto';

@Injectable()
export class GaAnalyticsService {
  private readonly logger = new Logger(GaAnalyticsService.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly gaProvider: GoogleAnalyticsProvider,
    private readonly elasticService: ElasticService,
    @InjectModel(Article.name) private readonly articleModel: Model<TArticleDocument>,
    private readonly redisService: RedisService,
  ) {}

  // ─────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────

  private async _getGaAuthClient(propertyId: string) {
    const integration = await this.integrationsService.getIntegrationWithCredentials(
      propertyId,
      IntegrationProvider.GOOGLE_ANALYTICS,
    );

    const gaPropertyId = integration.metadata?.propertyId;
    if (!gaPropertyId) {
      throw new BadRequestException('GA4 property not selected. Please select a property from the Integration settings.');
    }

    const authClient = this.integrationsService.getGoogleAuthClient(integration.credentials);
    return { authClient, gaPropertyId };
  }

  private _cacheKey(prefix: string, ...parts: string[]): string {
    return `ga:${prefix}:${parts.filter(Boolean).join(':')}`;
  }

  private async _getCachedOrFetch<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redisService.get(key);
      if (cached) {
        this.logger.debug(`Cache hit: ${key}`);
        return cached as T;
      }
    } catch (err) {
      this.logger.warn(`Redis cache read failed for ${key}: ${err.message}`);
    }

    const data = await fetcher();

    try {
      await this.redisService.setWithTTL(key, data, 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis cache write failed for ${key}: ${err.message}`);
    }

    return data;
  }

  // ─────────────────────────────────────────────
  // 1. Realtime
  // ─────────────────────────────────────────────

  async getRealtime(query: GaBaseQueryDto) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const key = this._cacheKey('realtime', query.propertyId);

    return this._getCachedOrFetch(key, 60, () =>
      this.gaProvider.getRealtimeSnapshot(authClient, gaPropertyId),
    );
  }

  async getDeepRealtimePages(query: GaBaseQueryDto) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const key = this._cacheKey('deep_realtime_pages', query.propertyId);

    return this._getCachedOrFetch(key, 60, () =>
      this.gaProvider.getDeepRealtimePages(authClient, gaPropertyId, 200),
    );
  }

  async getDeepRealtimeDimensions(query: GaBaseQueryDto, dimension: string) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const key = this._cacheKey('deep_realtime_dim', query.propertyId, dimension);

    return this._getCachedOrFetch(key, 60, () =>
      this.gaProvider.getDeepRealtimeDimensions(authClient, gaPropertyId, dimension, 100),
    );
  }

  // ─────────────────────────────────────────────
  // 2. Overview KPIs
  // ─────────────────────────────────────────────

  async getOverview(query: GaBaseQueryDto) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const start = query.startDate || '30daysAgo';
    const end = query.endDate || 'today';
    const key = this._cacheKey('overview', query.propertyId, start, end);

    return this._getCachedOrFetch(key, 900, () =>
      this.gaProvider.getOverviewKPIs(authClient, gaPropertyId, start, end),
    );
  }

  // ─────────────────────────────────────────────
  // 3. Author & Category Reports (ES + MongoDB)
  // ─────────────────────────────────────────────

  async getReports(query: GaBaseQueryDto) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const start = query.startDate || '30daysAgo';
    const end = query.endDate || 'today';
    const key = this._cacheKey('reports', query.propertyId, start, end);

    return this._getCachedOrFetch(key, 1800, async () => {
      // Fetch Author AND Category custom dimensions concurrently
      const [authorData, categoryData] = await Promise.all([
        this.gaProvider.getCustomDimensionPerformance(authClient, gaPropertyId, 'customEvent:author', start, end, 50),
        this.gaProvider.getCustomDimensionPerformance(authClient, gaPropertyId, 'customEvent:category', start, end, 50),
      ]);

      const deskReport = authorData.map(d => ({
        desk: d.label,
        numberOfStories: 0, // Unable to gather distinct page counts natively via simple dimension query
        totalPageviews: d.views,
        totalUsers: d.activeUsers,
        avgTimeOnPage: Math.round(d.avgEngagementTime),
      }));

      const categoryReport = categoryData.map(d => ({
        category: d.label,
        numberOfStories: 0,
        totalPageviews: d.views,
        totalUsers: d.activeUsers,
        avgTimeOnPage: Math.round(d.avgEngagementTime),
      }));

      return { deskReport, categoryReport };
    });
  }

  // ─────────────────────────────────────────────
  // 4. Top Articles
  // ─────────────────────────────────────────────

  async getTopArticles(query: GaTopArticlesQueryDto) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const start = query.startDate || '30daysAgo';
    const end = query.endDate || 'today';
    const limit = query.limit || 25;
    const key = this._cacheKey('top_articles', query.propertyId, start, end, String(limit));

    return this._getCachedOrFetch(key, 1800, () =>
      this.gaProvider.getTopPages(authClient, gaPropertyId, limit, start, end),
    );
  }

  // ─────────────────────────────────────────────
  // 5. Generic Dimension Report
  // ─────────────────────────────────────────────

  async getDimensionReport(query: GaDimensionQueryDto) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const start = query.startDate || '30daysAgo';
    const end = query.endDate || 'today';
    const limit = query.limit || 20;
    const key = this._cacheKey('dim', query.propertyId, query.dimension, start, end, String(limit));

    return this._getCachedOrFetch(key, 3600, () =>
      this.gaProvider.getByDimension(authClient, gaPropertyId, query.dimension, start, end, limit),
    );
  }

  // ─────────────────────────────────────────────
  // 6. Traffic Sources
  // ─────────────────────────────────────────────

  async getTrafficSources(query: GaTrafficSourcesQueryDto) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const start = query.startDate || '30daysAgo';
    const end = query.endDate || 'today';
    const limit = query.limit || 20;
    const key = this._cacheKey('traffic', query.propertyId, start, end, String(limit));

    return this._getCachedOrFetch(key, 1800, () =>
      this.gaProvider.getTrafficSources(authClient, gaPropertyId, start, end, limit),
    );
  }

  // ─────────────────────────────────────────────
  // 7. Daily Trends
  // ─────────────────────────────────────────────

  async getTrends(query: GaBaseQueryDto) {
    const { authClient, gaPropertyId } = await this._getGaAuthClient(query.propertyId);
    const start = query.startDate || '30daysAgo';
    const end = query.endDate || 'today';
    const key = this._cacheKey('trends', query.propertyId, start, end);

    return this._getCachedOrFetch(key, 3600, () =>
      this.gaProvider.getDailyTrend(authClient, gaPropertyId, start, end),
    );
  }
}
