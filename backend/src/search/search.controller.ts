import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query('q') query: string,
    @Query('tenantId') tenantId: string,
    @Query('lang') lang: string
  ) {
    // In a real application, the query_vector would be generated
    // from the query text by an embedding service.
    // For now, we'll perform a keyword-only search.
    return this.searchService.search(query, tenantId, lang);
  }
}
