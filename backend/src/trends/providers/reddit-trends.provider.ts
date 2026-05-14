import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';
import {
  TrendProvider,
  TrendPlatform,
  TrendProviderOptions,
  UnifiedTrendItem,
} from '../interfaces/trend-provider.interface';

@Injectable()
export class RedditTrendsProvider implements TrendProvider {
  readonly platform = TrendPlatform.REDDIT;
  private readonly logger = new Logger(RedditTrendsProvider.name);
  private readonly httpTimeout = 10000;

  private readonly SUBREDDIT_MAP: Record<string, string> = {
    india: 'india',
    IndiaSpeaks: 'IndiaSpeaks',
    IndianGaming: 'IndianGaming',
    bollywood: 'bollywood',
    Cricket: 'Cricket',
    IndianStockMarket: 'IndianStockMarket',
    indiainvestments: 'indiainvestments',
    technology: 'technology',
    worldnews: 'worldnews',
  };

  constructor(private readonly httpService: HttpService) {}

  isAvailable(): boolean {
    return true;
  }

  async fetchTrending(options: TrendProviderOptions): Promise<UnifiedTrendItem[]> {
    const limit = options.limit || 20;
    const subreddit = options.category
      ? this.SUBREDDIT_MAP[options.category] || options.category
      : 'popular';

    // Fetch trending search terms + hot posts in parallel
    const [trendingTerms, hotTopics] = await Promise.allSettled([
      this.fetchTrendingSearches(),
      this.fetchHotTopics(subreddit, limit),
    ]);

    const terms = trendingTerms.status === 'fulfilled' ? trendingTerms.value : [];
    const topics = hotTopics.status === 'fulfilled' ? hotTopics.value : [];

    // Merge: trending search terms first (ranked higher), then hot topics
    const merged: UnifiedTrendItem[] = [];
    let rank = 1;

    for (const term of terms) {
      merged.push({ ...term, rank: rank++ });
    }
    for (const topic of topics) {
      if (rank > limit) break;
      // Skip duplicates (if a hot post title matches a trending search)
      if (merged.some((m) => m.title.toLowerCase().includes(topic.title.toLowerCase().slice(0, 30)))) continue;
      merged.push({ ...topic, rank: rank++ });
    }

    return merged.slice(0, limit);
  }

  /** Reddit's trending search terms — actual topic-level trends */
  private async fetchTrendingSearches(): Promise<UnifiedTrendItem[]> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get('https://www.reddit.com/api/trending_searches.json', {
            headers: { 'User-Agent': 'OdinCMS/1.0' },
          })
          .pipe(timeout(this.httpTimeout)),
      );

      const searches: string[] = response.data?.trending_searches || response.data || [];
      return searches.map((term, idx) => ({
        rank: idx + 1,
        title: term,
        source: TrendPlatform.REDDIT,
        metadata: {
          type: 'trending_search',
          subreddit: 'all',
        },
      }));
    } catch (error) {
      this.logger.warn(`Reddit trending searches failed: ${error.message}`);
      return [];
    }
  }

  /** Hot posts from a subreddit — extracted as topic themes */
  private async fetchHotTopics(subreddit: string, limit: number): Promise<UnifiedTrendItem[]> {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1`;
      const response = await firstValueFrom(
        this.httpService
          .get(url, { headers: { 'User-Agent': 'OdinCMS/1.0' } })
          .pipe(timeout(this.httpTimeout)),
      );

      const posts = response.data?.data?.children || [];

      return posts
        .filter((post: Record<string, unknown>) => {
          const data = post.data as Record<string, unknown>;
          return !data.stickied;
        })
        .map((post: Record<string, unknown>, idx: number) => {
          const data = post.data as Record<string, unknown>;
          return {
            rank: idx + 1,
            title: data.title as string,
            source: TrendPlatform.REDDIT,
            metadata: {
              type: 'hot_post',
              subreddit: data.subreddit as string,
              score: data.score as number,
              numComments: data.num_comments as number,
              linkFlair: data.link_flair_text as string,
              createdUtc: data.created_utc as number,
            },
          };
        });
    } catch (error) {
      this.logger.error(`Reddit hot topics failed: ${error.message}`);
      return [];
    }
  }
}
