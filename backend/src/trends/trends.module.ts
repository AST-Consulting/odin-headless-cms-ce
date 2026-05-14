import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule } from '@nestjs/mongoose';
import { TrendsController } from './trends.controller';
import { TrendsService } from './trends.service';
import { TrendsAggregatorService } from './trends-aggregator.service';
import { GoogleTrendsProvider } from './providers/google-trends.provider';
import { YouTubeTrendsProvider } from './providers/youtube-trends.provider';
import { RedditTrendsProvider } from './providers/reddit-trends.provider';
import { TwitterTrendsProvider } from './providers/twitter-trends.provider';
import { TrendsCache, TrendsCacheSchema } from './schemas/trends-cache.schema';

@Module({
  imports: [
    HttpModule,
    CacheModule.register({
      ttl: 3600000, // 1 hour
      max: 100,
    }),
    MongooseModule.forFeature([{ name: TrendsCache.name, schema: TrendsCacheSchema }]),
  ],
  controllers: [TrendsController],
  providers: [
    TrendsService,
    GoogleTrendsProvider,
    YouTubeTrendsProvider,
    RedditTrendsProvider,
    TwitterTrendsProvider,
    TrendsAggregatorService,
  ],
  exports: [TrendsService, TrendsAggregatorService],
})
export class TrendsModule {}
