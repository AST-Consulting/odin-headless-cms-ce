import { Module } from '@nestjs/common';
import { UnifiedSearchController } from './unified-search.controller';
import { UnifiedSearchService } from './unified-search.service';
import { ElasticModule } from '../elastic/elastic.module';

@Module({
  imports: [ElasticModule],
  controllers: [UnifiedSearchController],
  providers: [UnifiedSearchService],
  exports: [UnifiedSearchService],
})
export class UnifiedSearchModule {}
