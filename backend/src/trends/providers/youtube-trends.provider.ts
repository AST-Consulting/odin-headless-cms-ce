import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import {
  TrendProvider,
  TrendPlatform,
  TrendProviderOptions,
  UnifiedTrendItem,
} from '../interfaces/trend-provider.interface';

@Injectable()
export class YouTubeTrendsProvider implements TrendProvider {
  readonly platform = TrendPlatform.YOUTUBE;
  private readonly logger = new Logger(YouTubeTrendsProvider.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('YOUTUBE_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('YOUTUBE_API_KEY not configured');
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async fetchTrending(options: TrendProviderOptions): Promise<UnifiedTrendItem[]> {
    if (!this.apiKey) {
      this.logger.warn('YouTube API key not set, skipping');
      return [];
    }

    try {
      const youtube = google.youtube({ version: 'v3', auth: this.apiKey });
      const query = options.query?.trim();

      // Topic-scoped: search by query so results are *about* the topic, not just
      // whatever's on the regional mostPopular chart at this moment. We then
      // hydrate with statistics so callers still get viewCount / likeCount.
      if (query) {
        const search = await youtube.search.list({
          part: ['snippet'],
          q: query,
          type: ['video'],
          regionCode: options.geo || 'US',
          relevanceLanguage: options.hl || 'en',
          order: 'viewCount',
          publishedAfter: new Date(
            Date.now() - 14 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          maxResults: options.limit || 10,
        });

        const searchItems = search.data.items || [];
        const videoIds = searchItems
          .map((item) => item.id?.videoId)
          .filter((id): id is string => !!id);
        if (videoIds.length === 0) return [];

        const stats = await youtube.videos.list({
          part: ['snippet', 'statistics'],
          id: videoIds,
          maxResults: videoIds.length,
        });

        const videos = stats.data.items || [];
        return videos.map((video, idx) => ({
          rank: idx + 1,
          title: video.snippet?.title || '',
          description: video.snippet?.description?.slice(0, 200),
          url: `https://www.youtube.com/watch?v=${video.id}`,
          imageUrl:
            video.snippet?.thumbnails?.high?.url ||
            video.snippet?.thumbnails?.medium?.url,
          source: TrendPlatform.YOUTUBE,
          metadata: {
            videoId: video.id,
            channelTitle: video.snippet?.channelTitle,
            channelId: video.snippet?.channelId,
            publishedAt: video.snippet?.publishedAt,
            viewCount: parseInt(video.statistics?.viewCount || '0', 10),
            likeCount: parseInt(video.statistics?.likeCount || '0', 10),
            commentCount: parseInt(video.statistics?.commentCount || '0', 10),
            categoryId: video.snippet?.categoryId,
            tags: video.snippet?.tags?.slice(0, 5),
          },
        }));
      }

      // No query: preserve the original behaviour and return the regional
      // mostPopular chart. Used by the standalone "trending on YouTube" panel.
      const response = await youtube.videos.list({
        part: ['snippet', 'statistics'],
        chart: 'mostPopular',
        regionCode: options.geo || 'US',
        videoCategoryId: options.category || undefined,
        maxResults: options.limit || 20,
        hl: options.hl || 'en',
      });

      const videos = response.data.items || [];
      return videos.map((video, idx) => ({
        rank: idx + 1,
        title: video.snippet?.title || '',
        description: video.snippet?.description?.slice(0, 200),
        url: `https://www.youtube.com/watch?v=${video.id}`,
        imageUrl: video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url,
        source: TrendPlatform.YOUTUBE,
        metadata: {
          videoId: video.id,
          channelTitle: video.snippet?.channelTitle,
          channelId: video.snippet?.channelId,
          publishedAt: video.snippet?.publishedAt,
          viewCount: parseInt(video.statistics?.viewCount || '0', 10),
          likeCount: parseInt(video.statistics?.likeCount || '0', 10),
          commentCount: parseInt(video.statistics?.commentCount || '0', 10),
          categoryId: video.snippet?.categoryId,
          tags: video.snippet?.tags?.slice(0, 5),
        },
      }));
    } catch (error) {
      this.logger.error(`YouTube API failed: ${error.message}`);
      return [];
    }
  }
}
