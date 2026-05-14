import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { IntegrationsService } from 'src/integrations/integrations.service';
import { YouTubeProvider } from 'src/integrations/providers/youtube.provider';
import { IntegrationProvider } from 'src/integrations/schemas/integration.schema';
import { RedisService } from 'src/utilities/redis/redis.service';
import { YtBaseQueryDto, YtDimensionQueryDto, YtTopVideosQueryDto } from './dto/yt-analytics.dto';

@Injectable()
export class YtAnalyticsService {
  private readonly logger = new Logger(YtAnalyticsService.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly ytProvider: YouTubeProvider,
    private readonly redisService: RedisService,
  ) {}

  // ─────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────

  private async _getYtAuthClient(propertyId: string) {
    const integration = await this.integrationsService.getIntegrationWithCredentials(
      propertyId,
      IntegrationProvider.YOUTUBE,
    );

    const channelId = integration.metadata?.channelId;
    if (!channelId) {
      throw new BadRequestException('YouTube channel not selected. Please select a channel from the Integration settings.');
    }

    const authClient = this.integrationsService.getGoogleAuthClient(integration.credentials);
    return { authClient, channelId };
  }

  private _cacheKey(prefix: string, ...parts: string[]): string {
    return `yt:${prefix}:${parts.filter(Boolean).join(':')}`;
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

  private _getDates(query: YtBaseQueryDto) {
    const end = query.endDate || new Date().toISOString().split('T')[0];
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - 30);
    const start = query.startDate || startObj.toISOString().split('T')[0];
    return { start, end };
  }

  // ─────────────────────────────────────────────
  // Endpoints
  // ─────────────────────────────────────────────

  async getOverview(query: YtBaseQueryDto) {
    const { authClient, channelId } = await this._getYtAuthClient(query.propertyId);
    const { start, end } = this._getDates(query);
    const key = this._cacheKey('overview', query.propertyId, start, end);

    return this._getCachedOrFetch(key, 900, () =>
      this.ytProvider.getOverviewKPIs(authClient, channelId, start, end),
    );
  }

  async getTrends(query: YtBaseQueryDto) {
    const { authClient, channelId } = await this._getYtAuthClient(query.propertyId);
    const { start, end } = this._getDates(query);
    const key = this._cacheKey('trends', query.propertyId, start, end);

    return this._getCachedOrFetch(key, 3600, () =>
      this.ytProvider.getDailyTrend(authClient, channelId, start, end),
    );
  }

  async getTopVideos(query: YtTopVideosQueryDto) {
    const { authClient, channelId } = await this._getYtAuthClient(query.propertyId);
    const { start, end } = this._getDates(query);
    const limit = query.limit || 25;
    const key = this._cacheKey('top_videos', query.propertyId, start, end, String(limit));

    return this._getCachedOrFetch(key, 1800, async () => {
      // 1. Get analytics data (IDs + metrics)
      const analyticsData = await this.ytProvider.getTopVideos(authClient, channelId, start, end, limit);
      
      if (analyticsData.length === 0) return [];

      // 2. Fetch metadata (titles, thumbnails) concurrently using Data API
      const videoIds = analyticsData.map(v => v.videoId);
      const metadata = await this.ytProvider.getVideoDetails(authClient, videoIds);

      // 3. Merge data
      return analyticsData.map(video => {
        const meta = metadata.find(m => m.videoId === video.videoId);
        return {
          ...video,
          title: meta?.title || 'Unknown Title',
          thumbnail: meta?.thumbnail || '',
          publishedAt: meta?.publishedAt,
        };
      });
    });
  }

  async getDimensionReport(query: YtDimensionQueryDto) {
    const { authClient, channelId } = await this._getYtAuthClient(query.propertyId);
    const { start, end } = this._getDates(query);
    const limit = query.limit || 20;
    const key = this._cacheKey('dim', query.propertyId, query.dimension, start, end, String(limit));

    return this._getCachedOrFetch(key, 3600, () =>
      this.ytProvider.getByDimension(authClient, channelId, query.dimension, start, end, limit),
    );
  }

  async getTrafficSources(query: YtBaseQueryDto) {
    const { authClient, channelId } = await this._getYtAuthClient(query.propertyId);
    const { start, end } = this._getDates(query);
    const key = this._cacheKey('traffic', query.propertyId, start, end);

    return this._getCachedOrFetch(key, 1800, () =>
      this.ytProvider.getTrafficSources(authClient, channelId, start, end),
    );
  }

  async getChannelLifetimeStats(propertyId: string) {
    const { authClient, channelId } = await this._getYtAuthClient(propertyId);
    const key = this._cacheKey('lifetime_v3', propertyId);

    return this._getCachedOrFetch(key, 3600, async () => {
      this.logger.log(`DEBUG: Fetching lifetime stats. ChannelID: "${channelId}"`);
      
      const yt = this.ytProvider.getYouTubeClient(authClient);
      const response = await yt.channels.list({
        part: 'statistics',
        mine: true,
      } as any);

      this.logger.log(`DEBUG: YouTube API Response Items Count: ${response.data.items?.length || 0}`);
      
        const analytics = await this.ytProvider.getLifetimeAnalytics(authClient, channelId);
        
        if (!response.data.items || response.data.items.length === 0) {
          // Fallback to ID-based lookup if mine: true fails
          const idResponse = await yt.channels.list({
            part: 'statistics',
            id: channelId,
          } as any);
          
          if (!idResponse.data.items || idResponse.data.items.length === 0) {
             this.logger.warn(`DEBUG: No channel found for ID or Mine: ${channelId}`);
             return { subscriberCount: 0, viewCount: 0, videoCount: 0, watchTime: 0, likes: 0, comments: 0, shares: 0 };
          }
          
          const stats = idResponse.data.items[0].statistics;
          return {
            subscriberCount: parseInt(stats?.subscriberCount || '0'),
            viewCount: parseInt(stats?.viewCount || '0'),
            videoCount: parseInt(stats?.videoCount || '0'),
            watchTime: analytics.estimatedMinutesWatched,
            likes: analytics.likes,
            comments: analytics.comments,
            shares: analytics.shares,
          };
        }
  
        const stats = response.data.items[0].statistics;
        this.logger.log(`DEBUG: Statistics Object: ${JSON.stringify(stats)}`);
  
        return {
          subscriberCount: parseInt(stats?.subscriberCount || '0'),
          viewCount: parseInt(stats?.viewCount || '0'),
          videoCount: parseInt(stats?.videoCount || '0'),
          watchTime: analytics.estimatedMinutesWatched,
          likes: analytics.likes,
          comments: analytics.comments,
          shares: analytics.shares,
        };
    });
  }

  async getReports(query: YtBaseQueryDto) {
    const { authClient, channelId } = await this._getYtAuthClient(query.propertyId);
    const { start, end } = this._getDates(query);
    const key = this._cacheKey('reports', query.propertyId, start, end);

    return this._getCachedOrFetch(key, 1800, async () => {
      const [contentData, subscriberData] = await Promise.all([
        this.ytProvider.getByDimension(authClient, channelId, 'liveOrOnDemand', start, end),
        this.ytProvider.getByDimension(authClient, channelId, 'subscribedStatus', start, end),
      ]);

      return {
        contentReport: contentData.map(d => ({
          type: d.label === 'LIVE' ? 'Live Stream' : 'On Demand',
          views: d.views,
          watchTime: d.watchTime,
        })),
        subscriberReport: subscriberData.map(d => ({
          status: d.label === 'SUBSCRIBED' ? 'Subscribed' : 'Not Subscribed',
          views: d.views,
          watchTime: d.watchTime,
        })),
      };
    });
  }
}
