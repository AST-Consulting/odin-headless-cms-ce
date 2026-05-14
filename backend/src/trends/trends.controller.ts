import { Controller, Get, Query, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { TrendsService } from './trends.service';
import { TrendsAggregatorService } from './trends-aggregator.service';
import { GetTrendsDto, GetTrendingSearchesDto } from './dto/get-trends.dto';
import { GetPlatformTrendsDto } from './dto/get-platform-trends.dto';
import { TrendsResponse } from './interfaces/trends-response.interface';
import { Permissions } from 'src/auth/common/decorators/permissions.decorator';

@Controller('trends')
@UseInterceptors(CacheInterceptor)
export class TrendsController {
  constructor(
    private readonly trendsService: TrendsService,
    private readonly aggregatorService: TrendsAggregatorService,
  ) {}

  @Get()
  @Permissions('search.read')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @CacheTTL(3600000) // 1 hour
  async getTrends(
    @Query(new ValidationPipe({ transform: true })) getTrendsDto: GetTrendsDto
  ): Promise<TrendsResponse> {
    return this.trendsService.getTrends(getTrendsDto);
  }

  @Get('trending-now')
  @Permissions('search.read')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @CacheTTL(3600000) // 1 hour
  async getTrendingSearches(
    @Query(new ValidationPipe({ transform: true })) dto: GetTrendingSearchesDto
  ): Promise<any> {
    return this.trendsService.getTrendingSearches(dto);
  }

  @Get('youtube')
  @Permissions('search.read')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @CacheTTL(3600000) // 1 hour
  async getYoutubeTrends(
    @Query(new ValidationPipe({ transform: true })) dto: GetPlatformTrendsDto
  ) {
    return this.aggregatorService.getYoutubeTrends(dto);
  }

  @Get('reddit')
  @Permissions('search.read')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @CacheTTL(3600000) // 1 hour
  async getRedditTrends(
    @Query(new ValidationPipe({ transform: true })) dto: GetPlatformTrendsDto
  ) {
    return this.aggregatorService.getRedditTrends(dto);
  }

  @Get('twitter')
  @Permissions('search.read')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @CacheTTL(3600000) // 1 hour
  async getTwitterTrends(
    @Query(new ValidationPipe({ transform: true })) dto: GetPlatformTrendsDto
  ) {
    return this.aggregatorService.getTwitterTrends(dto);
  }

  @Get('all')
  @Permissions('search.read')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @CacheTTL(3600000) // 1 hour
  async getAllTrends(
    @Query(new ValidationPipe({ transform: true })) dto: GetPlatformTrendsDto
  ) {
    return this.aggregatorService.getAllTrends(dto);
  }

  @Get('cross-platform')
  @Permissions('search.read')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getCrossPlatform(
    @Query('query') query: string,
    @Query('geo') geo?: string,
  ) {
    if (!query?.trim()) return {};
    return this.aggregatorService.findCrossPlatform(query.trim(), geo);
  }
}
