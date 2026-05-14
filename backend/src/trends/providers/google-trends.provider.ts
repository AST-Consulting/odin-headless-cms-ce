import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { XMLParser } from 'fast-xml-parser';
import {
  TrendProvider,
  TrendPlatform,
  TrendProviderOptions,
  UnifiedTrendItem,
} from '../interfaces/trend-provider.interface';

interface RssNewsItem {
  'ht:news_item_title'?: string;
  'ht:news_item_url'?: string;
  'ht:news_item_source'?: string;
  'ht:news_item_picture'?: string;
}

interface RssItem {
  title: string;
  'ht:approx_traffic'?: string;
  'ht:picture'?: string;
  'ht:picture_source'?: string;
  'ht:news_item'?: RssNewsItem | RssNewsItem[];
  pubDate?: string;
}

@Injectable()
export class GoogleTrendsProvider implements TrendProvider {
  readonly platform = TrendPlatform.GOOGLE;
  private readonly logger = new Logger(GoogleTrendsProvider.name);
  private readonly serpApiKey: string;
  private readonly serpApiBaseUrl = 'https://serpapi.com/search';
  private readonly rssBaseUrl = 'https://trends.google.com/trending/rss';
  private readonly httpTimeout = 10000;
  private readonly xmlParser: XMLParser;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.serpApiKey = this.configService.get<string>('SERPAPI_KEY') || '';
    this.xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  }

  isAvailable(): boolean {
    return true;
  }

  async fetchTrending(options: TrendProviderOptions): Promise<UnifiedTrendItem[]> {
    // If explicitly requesting SerpAPI ("today" view)
    if (options.source === 'today') {
      if (!this.serpApiKey) {
        this.logger.error('SerpAPI unavailable — SERPAPI_KEY not configured');
        return [];
      }
      const serpResults = await this.fetchFromSerpApi(options);
      return this.enrichWithGoogleNews(serpResults, options);
    }

    // Default: try free RSS feed first, fall back to SerpAPI
    try {
      const results = await this.fetchFromRss(options);
      if (results.length > 0) return results;
      this.logger.warn('Google Trends RSS returned empty results, falling back to SerpAPI');
    } catch (error) {
      this.logger.warn(`Google Trends RSS failed (${error.message}), falling back to SerpAPI`);
    }

    if (!this.serpApiKey) {
      this.logger.error('SerpAPI fallback unavailable — SERPAPI_KEY not configured');
      return [];
    }

    return this.fetchFromSerpApi(options);
  }

  private async enrichWithGoogleNews(
    serpResults: UnifiedTrendItem[],
    options: TrendProviderOptions,
  ): Promise<UnifiedTrendItem[]> {
    const geo = options.geo || 'US';
    const langMap: Record<string, string> = {
      IN: 'en-IN', US: 'en-US', GB: 'en-GB', AU: 'en-AU', CA: 'en-CA',
      DE: 'de', FR: 'fr', JP: 'ja',
    };
    const hl = langMap[geo] || 'en';

    // Fetch Google News in batches of 5 to avoid flooding Google
    const enriched = [...serpResults];
    const BATCH_SIZE = 5;
    for (let i = 0; i < serpResults.length; i += BATCH_SIZE) {
      const batch = serpResults.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((item) => this.fetchGoogleNewsForQuery(item.title, geo, hl)),
      );
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          const original = enriched[i + idx];
          enriched[i + idx] = {
            ...original,
            metadata: { ...original.metadata, articles: result.value },
          };
        }
      });
    }

    const count = enriched.filter((item) => (item.metadata?.articles as unknown[])?.length > 0).length;
    this.logger.log(`Enriched ${count}/${serpResults.length} SerpAPI trends with Google News articles`);
    return enriched;
  }

  private async fetchGoogleNewsForQuery(
    query: string,
    geo: string,
    hl: string,
  ): Promise<{ title: string; url: string; source: string }[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=${hl}&gl=${geo}&ceid=${geo}:${hl.split('-')[0]}`;

    const response = await firstValueFrom(
      this.httpService.get<string>(url, { responseType: 'text' as const }).pipe(timeout(5000)),
    );

    const parsed = this.xmlParser.parse(response.data);
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];

    const newsItems = Array.isArray(items) ? items : [items];
    return newsItems.slice(0, 3).map((item: Record<string, string>) => {
      // Google News title format: "Article Title - Source Name"
      const fullTitle = item.title || '';
      const lastDash = fullTitle.lastIndexOf(' - ');
      const title = lastDash > 0 ? fullTitle.substring(0, lastDash) : fullTitle;
      const source = lastDash > 0 ? fullTitle.substring(lastDash + 3) : '';

      return { title, url: item.link || '', source };
    });
  }

  private async fetchFromRss(options: TrendProviderOptions): Promise<UnifiedTrendItem[]> {
    const geo = options.geo || 'US';
    const url = `${this.rssBaseUrl}?geo=${geo}`;

    const response = await firstValueFrom(
      this.httpService.get<string>(url, { responseType: 'text' as const }).pipe(timeout(this.httpTimeout)),
    );

    const parsed = this.xmlParser.parse(response.data);
    const items: RssItem[] = parsed?.rss?.channel?.item;
    if (!items || !Array.isArray(items) || items.length === 0) return [];

    this.logger.log(`RSS fetched ${items.length} trends for geo=${geo}`);
    return this.mapRssResults(items.slice(0, options.limit || 20));
  }

  private async fetchFromSerpApi(options: TrendProviderOptions): Promise<UnifiedTrendItem[]> {
    const params = {
      engine: 'google_trends_trending_now',
      api_key: this.serpApiKey,
      ...(options.geo && { geo: options.geo }),
      ...(options.hl && { hl: options.hl }),
    };

    const response = await firstValueFrom(
      this.httpService.get(this.serpApiBaseUrl, { params }).pipe(timeout(this.httpTimeout)),
    );

    const searches =
      response.data.daily_searches ||
      response.data.trending_searches ||
      [];

    return this.mapSerpApiResults(searches.slice(0, options.limit || 20));
  }

  private mapRssResults(items: RssItem[]): UnifiedTrendItem[] {
    return items.map((item, idx) => {
      const newsItems = Array.isArray(item['ht:news_item'])
        ? item['ht:news_item']
        : item['ht:news_item'] ? [item['ht:news_item']] : [];

      return {
        rank: idx + 1,
        title: item.title,
        description: newsItems[0]?.['ht:news_item_title'],
        url: newsItems[0]?.['ht:news_item_url'],
        imageUrl: item['ht:picture'],
        source: TrendPlatform.GOOGLE,
        metadata: {
          formattedTraffic: item['ht:approx_traffic'],
          pictureSource: item['ht:picture_source'],
          articles: newsItems.slice(0, 3).map((n) => ({
            title: n['ht:news_item_title'],
            url: n['ht:news_item_url'],
            source: n['ht:news_item_source'],
          })),
          dataSource: 'google-trends-rss',
        },
      };
    });
  }

  private mapSerpApiResults(searches: Record<string, unknown>[]): UnifiedTrendItem[] {
    return searches.map((item: Record<string, unknown>, idx: number) => ({
      rank: idx + 1,
      title: (item.title as string) || (item.query as string) || '',
      description: undefined,
      url: item.link as string,
      imageUrl: undefined,
      source: TrendPlatform.GOOGLE,
      metadata: {
        searchVolume: item.search_volume,
        formattedTraffic: item.formattedTraffic,
        trendBreakdown: Array.isArray(item.trend_breakdown) ? (item.trend_breakdown as string[]).slice(0, 10) : item.trend_breakdown,
        categories: item.categories,
        relatedQueries: item.related_queries,
        dataSource: 'serpapi',
      },
    }));
  }
}
