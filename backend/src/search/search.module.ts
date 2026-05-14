import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { IndexingService } from './indexing.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';

@Module({
  imports: [
    MongooseModule, // Make Mongoose connection available
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        node: configService.get<string>('ELASTICSEARCH_NODE'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService, IndexingService],
  exports: [SearchService],
})
export class SearchModule { }
