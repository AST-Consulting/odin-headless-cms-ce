import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { GetTrendsDto, GetTrendingSearchesDto } from './dto/get-trends.dto';
import { TrendsResponse } from './interfaces/trends-response.interface';
import { TrendsCache, TrendsCacheDocument } from './schemas/trends-cache.schema';
import { GoogleTrendsProvider } from './providers/google-trends.provider';
import { GoogleGenAI } from '@google/genai';
import { UnifiedTrendItem } from './interfaces/trend-provider.interface';

@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);
  private readonly serpApiKey: string;
  private readonly serpApiBaseUrl = 'https://serpapi.com/search';
  private readonly httpTimeout = 10000; // 10 seconds
  private readonly cacheDuration = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly genAI: GoogleGenAI | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly googleTrendsProvider: GoogleTrendsProvider,
    @InjectModel(TrendsCache.name)
    private readonly trendsCacheModel: Model<TrendsCacheDocument>
  ) {
    this.serpApiKey = this.configService.get<string>('SERPAPI_KEY');

    if (!this.serpApiKey) {
      this.logger.warn('SERPAPI_KEY not configured in environment variables');
    } else {
      this.logger.log(`SERPAPI_KEY loaded (length: ${this.serpApiKey.length} chars)`);
    }

    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.genAI = new GoogleGenAI({ apiKey: geminiKey.replace(/['"]/g, '') });
    }
  }

  async getTrends(getTrendsDto: GetTrendsDto): Promise<TrendsResponse> {
    if (!this.serpApiKey) {
      this.logger.error('Attempted to fetch trends without SERPAPI_KEY configured');
      throw new HttpException(
        'Trends service is not properly configured',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    // Generate cache key
    const cacheKey = `search:${getTrendsDto.query}:${getTrendsDto.data_type || 'default'}:${getTrendsDto.geo || 'global'}`;
    const skipCache = getTrendsDto.refresh === 'true';

    // Check MongoDB cache first (skip if refresh requested)
    if (!skipCache) {
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        this.logger.log(`Cache HIT for query: "${getTrendsDto.query}" (from MongoDB)`);
        return cachedData as TrendsResponse;
      }
    }

    this.logger.log(`Cache MISS for query: "${getTrendsDto.query}" - fetching from SerpApi`);

    const params = {
      engine: 'google_trends',
      q: getTrendsDto.query,
      api_key: this.serpApiKey,
      ...(getTrendsDto.data_type && { data_type: getTrendsDto.data_type }),
      ...(getTrendsDto.geo && { geo: getTrendsDto.geo }),
      ...(getTrendsDto.date && { date: getTrendsDto.date }),
      ...(getTrendsDto.hl && { hl: getTrendsDto.hl }),
    };

    try {
      const response = await firstValueFrom(
        this.httpService
          .get<TrendsResponse>(this.serpApiBaseUrl, {
            params,
          })
          .pipe(timeout(this.httpTimeout))
      );

      this.logger.log(`Successfully fetched trends for query: "${getTrendsDto.query}"`);

      // Save to MongoDB cache
      await this.saveToCacheAsync(cacheKey, 'search', response.data, {
        query: getTrendsDto.query,
        geo: getTrendsDto.geo,
        dataType: getTrendsDto.data_type,
      });

      return response.data;
    } catch (error) {
      // Log the actual error response from SerpApi
      if (error.response?.data) {
        this.logger.error(`SerpApi error response:`, JSON.stringify(error.response.data));
      }

      this.logger.error(`Failed to fetch trends for query: "${getTrendsDto.query}"`, error.stack);

      if (error.code === 'ECONNABORTED' || error.name === 'TimeoutError') {
        throw new HttpException(
          'Request timeout while fetching trends data',
          HttpStatus.REQUEST_TIMEOUT
        );
      }

      if (error.response) {
        const status = error.response.status;

        if (status === 401) {
          throw new HttpException('Invalid API credentials', HttpStatus.UNAUTHORIZED);
        }

        if (status === 429) {
          throw new HttpException(
            'Rate limit exceeded. Please try again later',
            HttpStatus.TOO_MANY_REQUESTS
          );
        }

        if (status >= 500) {
          throw new HttpException(
            'External service temporarily unavailable',
            HttpStatus.BAD_GATEWAY
          );
        }
      }

      throw new HttpException('Failed to fetch trends data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTrendingSearches(dto: GetTrendingSearchesDto): Promise<any> {
    // Generate cache key
    const source = dto.source || 'live';
    const cacheKey = `trending:${source}:${dto.geo || 'global'}:${dto.hl || 'en'}`;
    const skipCache = dto.refresh === 'true';

    // Check MongoDB cache first (skip if refresh requested)
    if (!skipCache) {
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        this.logger.log(`Cache HIT for trending: ${dto.geo || 'worldwide'} (from MongoDB)`);
        return cachedData;
      }
    }

    this.logger.log(`Cache MISS for trending: ${dto.geo || 'worldwide'} - fetching via GoogleTrendsProvider`);

    try {
      let items = await this.googleTrendsProvider.fetchTrending({
        geo: dto.geo,
        hl: dto.hl,
        source,
      });

      // Translate non-Latin titles (Telugu, Tamil, Bengali, etc.) to English
      items = await this.translateNonLatinTitles(items);

      // Transform UnifiedTrendItem[] to the raw format the frontend expects
      const responseData = {
        trending_searches: items.map((item) => ({
          title: item.title,
          query: item.title,
          search_volume: item.metadata?.searchVolume,
          formattedTraffic: item.metadata?.formattedTraffic,
          trend_breakdown: item.metadata?.trendBreakdown,
          categories: item.metadata?.categories,
          articles: item.metadata?.articles,
          image: item.imageUrl ? { imageUrl: item.imageUrl } : undefined,
        })),
      };

      this.logger.log(`Successfully fetched trending searches (${items.length} items)`);

      // Save to MongoDB cache
      if (items.length > 0) {
        await this.saveToCacheAsync(cacheKey, 'trending', responseData, {
          geo: dto.geo,
        });
      }

      return responseData;
    } catch (error) {
      this.logger.error(`Failed to fetch trending searches: ${error.message}`);
      throw new HttpException(
        'Failed to fetch trending searches',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get cached data from MongoDB if it exists and is not expired
   */
  private async getCachedData(cacheKey: string): Promise<any | null> {
    try {
      const cached = await this.trendsCacheModel
        .findOne({
          cacheKey,
          expiresAt: { $gt: new Date() },
        })
        .exec();

      if (cached) {
        return cached.data;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error reading from cache: ${error.message}`);
      return null; // Fail gracefully - fetch fresh data
    }
  }

  /**
   * Save data to MongoDB cache asynchronously (fire and forget)
   */
  private async saveToCacheAsync(
    cacheKey: string,
    cacheType: string,
    data: any,
    metadata: { query?: string; geo?: string; dataType?: string }
  ): Promise<void> {
    // Fire and forget - don't await
    this.saveToCache(cacheKey, cacheType, data, metadata).catch((error) => {
      this.logger.error(`Failed to save to cache: ${error.message}`);
      // Don't throw - caching failure shouldn't break the request
    });
  }

  /**
   * Save data to MongoDB cache
   */
  private async saveToCache(
    cacheKey: string,
    cacheType: string,
    data: any,
    metadata: { query?: string; geo?: string; dataType?: string }
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.cacheDuration);

    await this.trendsCacheModel.findOneAndUpdate(
      { cacheKey },
      {
        cacheKey,
        cacheType,
        data,
        expiresAt,
        query: metadata.query,
        geo: metadata.geo,
        dataType: metadata.dataType,
      },
      { upsert: true, new: true }
    );

    this.logger.log(`Saved to cache: ${cacheKey} (expires: ${expiresAt.toISOString()})`);
  }

  private static readonly NON_LATIN_RE = /[^\u0000-\u024F\s\d.,!?'"()\-:;@#$%&*+=/\\|~`[\]{}<>^_]/;

  private async translateNonLatinTitles(items: UnifiedTrendItem[]): Promise<UnifiedTrendItem[]> {
    if (!this.genAI) return items;

    const toTranslate: { index: number; title: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      if (TrendsService.NON_LATIN_RE.test(items[i].title)) {
        toTranslate.push({ index: i, title: items[i].title });
      }
    }

    if (toTranslate.length === 0) return items;

    try {
      const titlesText = toTranslate.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
      const prompt = `Translate these trending search terms to English. Return ONLY the translations, one per line, numbered to match. Keep proper nouns (names, brands, places) as-is in English.\n\n${titlesText}`;

      const model = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
      const response = await this.genAI.models.generateContent({
        model,
        contents: prompt,
      });

      const lines = (response.text ?? '')
        .trim()
        .split('\n')
        .map((l) => l.replace(/^\d+\.\s*/, '').trim())
        .filter((l) => l.length > 0);

      for (let i = 0; i < toTranslate.length && i < lines.length; i++) {
        const idx = toTranslate[i].index;
        const original = items[idx].title;
        items[idx].title = `${lines[i]} (${original})`;
      }

      this.logger.log(`Translated ${toTranslate.length} non-Latin trend titles`);
    } catch (error) {
      this.logger.warn(`Trend title translation failed: ${(error as Error).message}`);
    }

    return items;
  }
}
