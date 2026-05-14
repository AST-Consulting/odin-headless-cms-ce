import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';
import {
  TrendProvider,
  TrendPlatform,
  TrendProviderOptions,
  UnifiedTrendItem,
} from '../interfaces/trend-provider.interface';

/**
 * Scrapes Twitter/X trends from trends24.in (free, no API key needed).
 * The site renders trending topics server-side in <ol class="trend-card__list">.
 */
@Injectable()
export class TwitterTrendsProvider implements TrendProvider {
  readonly platform = TrendPlatform.TWITTER;
  private readonly logger = new Logger(TwitterTrendsProvider.name);
  private readonly httpTimeout = 10000;

  private readonly COUNTRY_MAP: Record<string, string> = {
    IN: 'india',
    US: 'united-states',
    GB: 'united-kingdom',
    AU: 'australia',
    CA: 'canada',
    DE: 'germany',
    FR: 'france',
    JP: 'japan',
  };

  constructor(private readonly httpService: HttpService) {}

  /** Decode common HTML entities */
  private decodeEntities(str: string): string {
    return str
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  }

  isAvailable(): boolean {
    return true;
  }

  async fetchTrending(options: TrendProviderOptions): Promise<UnifiedTrendItem[]> {
    try {
      const country = this.COUNTRY_MAP[options.geo || 'IN'] || 'india';
      const url = `https://trends24.in/${country}/`;
      const limit = options.limit || 20;

      const response = await firstValueFrom(
        this.httpService
          .get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; OdinCMS/1.0)',
              Accept: 'text/html',
            },
            responseType: 'text',
          })
          .pipe(timeout(this.httpTimeout)),
      );

      const html = response.data as string;
      return this.parseHtml(html, limit);
    } catch (error) {
      this.logger.error(`Twitter trends scrape failed: ${error.message}`);
      return [];
    }
  }

  private parseHtml(html: string, limit: number): UnifiedTrendItem[] {
    const items: UnifiedTrendItem[] = [];
    const seen = new Set<string>();

    // Extract trending topics from twitter search links in the HTML
    const linkRegex = /href="https:\/\/twitter\.com\/search\?q=([^"]+)"/g;
    let match: RegExpExecArray | null;
    let rank = 1;

    while ((match = linkRegex.exec(html)) !== null && items.length < limit) {
      try {
        const decoded = decodeURIComponent(match[1]).replace(/\+/g, ' ');
        const topicName = this.decodeEntities(decoded.trim());

        if (!topicName || seen.has(topicName.toLowerCase())) continue;
        seen.add(topicName.toLowerCase());

        items.push({
          rank: rank++,
          title: topicName,
          url: `https://twitter.com/search?q=${match[1]}`,
          source: TrendPlatform.TWITTER,
          metadata: {
            isHashtag: topicName.startsWith('#'),
          },
        });
      } catch {
        continue;
      }
    }

    if (items.length === 0) {
      this.logger.warn('No Twitter trends found in HTML');
    }

    return items;
  }
}
