import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../utilities/redis/redis.service';
import { GoogleTrendsProvider } from './providers/google-trends.provider';
import { YouTubeTrendsProvider } from './providers/youtube-trends.provider';
import { RedditTrendsProvider } from './providers/reddit-trends.provider';
import { TwitterTrendsProvider } from './providers/twitter-trends.provider';
import {
  TrendPlatform,
  TrendProviderOptions,
  UnifiedTrendItem,
  UnifiedTrendsResponse,
} from './interfaces/trend-provider.interface';

const CROSS_PLATFORM_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'has',
  'have', 'will', 'been', 'how', 'what', 'when', 'who', 'why', 'not', 'all',
  'can', 'had', 'her', 'his', 'its', 'new', 'now', 'old', 'our', 'out',
  'own', 'say', 'she', 'too', 'use', 'day', 'box', 'get', 'got', 'set',
  'top', 'big', 'man', 'one', 'two', 'may', 'also', 'best', 'just', 'over',
]);

const CACHE_TTL: Record<TrendPlatform, number> = {
  [TrendPlatform.GOOGLE]: 60 * 60 * 1000,    // 1 hour
  [TrendPlatform.YOUTUBE]: 60 * 60 * 1000,   // 1 hour
  [TrendPlatform.REDDIT]: 60 * 60 * 1000,    // 1 hour
  [TrendPlatform.TWITTER]: 60 * 60 * 1000,   // 1 hour
};

@Injectable()
export class TrendsAggregatorService {
  private readonly logger = new Logger(TrendsAggregatorService.name);

  constructor(
    private readonly googleProvider: GoogleTrendsProvider,
    private readonly youtubeProvider: YouTubeTrendsProvider,
    private readonly redditProvider: RedditTrendsProvider,
    private readonly twitterProvider: TwitterTrendsProvider,
    private readonly redisService: RedisService,
  ) {}

  async getGoogleTrends(options: TrendProviderOptions): Promise<UnifiedTrendsResponse> {
    return this.getOrFetch(TrendPlatform.GOOGLE, options, () =>
      this.googleProvider.fetchTrending(options),
    );
  }

  async getYoutubeTrends(options: TrendProviderOptions): Promise<UnifiedTrendsResponse> {
    return this.getOrFetch(TrendPlatform.YOUTUBE, options, () =>
      this.youtubeProvider.fetchTrending(options),
    );
  }

  async getRedditTrends(options: TrendProviderOptions): Promise<UnifiedTrendsResponse> {
    return this.getOrFetch(TrendPlatform.REDDIT, options, () =>
      this.redditProvider.fetchTrending(options),
    );
  }

  async getTwitterTrends(options: TrendProviderOptions): Promise<UnifiedTrendsResponse> {
    return this.getOrFetch(TrendPlatform.TWITTER, options, () =>
      this.twitterProvider.fetchTrending(options),
    );
  }

  async getAllTrends(
    options: TrendProviderOptions,
  ): Promise<Record<TrendPlatform, UnifiedTrendsResponse>> {
    const [google, youtube, reddit, twitter] = await Promise.allSettled([
      this.getGoogleTrends(options),
      this.getYoutubeTrends(options),
      this.getRedditTrends(options),
      this.getTwitterTrends(options),
    ]);

    const emptyResponse = (platform: TrendPlatform): UnifiedTrendsResponse => ({
      platform,
      region: options.geo || 'US',
      items: [],
      fetchedAt: new Date().toISOString(),
      cached: false,
    });

    return {
      [TrendPlatform.GOOGLE]:
        google.status === 'fulfilled' ? google.value : emptyResponse(TrendPlatform.GOOGLE),
      [TrendPlatform.YOUTUBE]:
        youtube.status === 'fulfilled' ? youtube.value : emptyResponse(TrendPlatform.YOUTUBE),
      [TrendPlatform.REDDIT]:
        reddit.status === 'fulfilled' ? reddit.value : emptyResponse(TrendPlatform.REDDIT),
      [TrendPlatform.TWITTER]:
        twitter.status === 'fulfilled' ? twitter.value : emptyResponse(TrendPlatform.TWITTER),
    } as Record<TrendPlatform, UnifiedTrendsResponse>;
  }

  private async getOrFetch(
    platform: TrendPlatform,
    options: TrendProviderOptions,
    fetchFn: () => Promise<UnifiedTrendItem[]>,
  ): Promise<UnifiedTrendsResponse> {
    const cacheKey = `trends:${platform}:${options.geo || 'US'}:${options.category || 'all'}`;
    const ttlSeconds = Math.round(CACHE_TTL[platform] / 1000);
    const skipCache = options.refresh === 'true';

    // Check Redis cache (skip if refresh requested)
    if (!skipCache) {
      try {
        const cached = await this.redisService.get(cacheKey);
        if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
          this.logger.log(`Cache HIT: ${cacheKey} (${cached.items.length} items)`);
          return { ...cached, cached: true };
        }
      } catch (error) {
        this.logger.error(`Redis read error: ${error.message}`);
      }
    }

    // Fetch fresh
    this.logger.log(`${skipCache ? 'Cache BYPASS (refresh)' : 'Cache MISS'}: ${cacheKey} — fetching from ${platform}`);
    const items = await fetchFn();

    const response: UnifiedTrendsResponse = {
      platform,
      region: options.geo || 'US',
      items,
      fetchedAt: new Date().toISOString(),
      cached: false,
    };

    // Only cache non-empty results
    if (items.length > 0) {
      this.redisService
        .setWithTTL(cacheKey, response, 'EX', ttlSeconds)
        .catch((err) => this.logger.error(`Redis write error: ${err.message}`));
    }

    return response;
  }

  async findCrossPlatform(
    query: string,
    geo: string = 'US',
  ): Promise<Record<string, UnifiedTrendItem[]>> {
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !CROSS_PLATFORM_STOP_WORDS.has(w));

    if (queryWords.length === 0) return {};

    // Minimum matches required based on keyword count
    const minMatches = queryWords.length >= 3 ? 2 : 1;

    // Fetch all platforms in parallel. YouTube gets a topic-scoped search via
    // `query`; Reddit and Twitter still fetch regional trends and rely on the
    // post-fetch keyword scoring below to filter relevance. The YouTube call
    // bypasses the Redis cache because the cache key does not include `query`.
    const baseOptions: TrendProviderOptions = { geo };
    const [youtube, reddit, twitter] = await Promise.allSettled([
      this.youtubeProvider
        .fetchTrending({ ...baseOptions, query, limit: 10 })
        .then(
          (items) =>
            ({
              platform: TrendPlatform.YOUTUBE,
              region: geo,
              items,
              fetchedAt: new Date().toISOString(),
              cached: false,
            }) as UnifiedTrendsResponse,
        ),
      this.getRedditTrends(baseOptions),
      this.getTwitterTrends(baseOptions),
    ]);

    const results: Record<string, UnifiedTrendItem[]> = {};

    const platformResults: [string, PromiseSettledResult<UnifiedTrendsResponse>][] = [
      [TrendPlatform.YOUTUBE, youtube],
      [TrendPlatform.REDDIT, reddit],
      [TrendPlatform.TWITTER, twitter],
    ];

    for (const [platform, result] of platformResults) {
      if (result.status !== 'fulfilled' || !result.value.items?.length) continue;

      const scored = result.value.items
        .map((item) => {
          const titleWords = item.title.toLowerCase().split(/\s+/);
          const matchCount = queryWords.filter((word) =>
            titleWords.some((tw) => tw === word || (tw.startsWith(word) && word.length >= 3) || (word.startsWith(tw) && tw.length >= 3)),
          ).length;
          return { item, matchCount };
        })
        .filter((s) => s.matchCount >= minMatches)
        .sort((a, b) => b.matchCount - a.matchCount);

      if (scored.length > 0) {
        results[platform] = scored.slice(0, 3).map((s) => s.item);
      }
    }

    return results;
  }
}
