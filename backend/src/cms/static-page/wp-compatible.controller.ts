import {
    Controller,
    Get,
    Query,
    InternalServerErrorException,
    Logger,
    Inject,
    ConflictException,
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
    ForbiddenException,
    Version,
} from '@nestjs/common';
import { StaticPageService } from './static-page.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Public } from '@auth/common/decorators';
import { QueryStaticPageDto } from './dto/static-page.query.dto';

@Controller()
export class WpCompatibleController {
    constructor(
        private readonly _staticPageService: StaticPageService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
    ) { }

    private _handleError(error: any, defaultMessage: string): never {
        this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
        if (
            error instanceof ConflictException ||
            error instanceof BadRequestException ||
            error instanceof NotFoundException ||
            error instanceof UnauthorizedException ||
            error instanceof ForbiddenException
        ) {
            throw error;
        } else if (error.name === 'ValidationError') {
            throw new BadRequestException(error.message);
        } else {
            throw new InternalServerErrorException(`${defaultMessage}`);
        }
    }

    /**
   * WordPress REST API v2 compatible endpoint
   * GET /v2/pages
   * Returns static pages in standard WordPress REST API format
   * @Public - No authentication required
   */
    @Version('2')
    @Public()
    @Get('pages')
    async getPages(@Query() wpParams: any): Promise<any> {
        const start = Date.now();
        try {
            // Map WordPress params to internal QueryStaticPageDto
            const query: Partial<QueryStaticPageDto> = {
                page: wpParams.page ? parseInt(wpParams.page) : 1,
                limit: wpParams.per_page ? parseInt(wpParams.per_page) : 10,
                sort: wpParams.orderby === 'date' ? 'createdAt' : wpParams.orderby || 'createdAt',
                sortOrder: wpParams.order || 'desc',
            };

            // Handle status filter
            if (wpParams.status) {
                query.status = wpParams.status === 'publish' ? 'active' : wpParams.status;
            }

            // Handle search query
            if (wpParams.search) {
                query.searchTerm = wpParams.search;
            }

            if (wpParams.slug) {
                query.slug = wpParams.slug;
            }

            // Handle parent filter (pages can be hierarchical)
            if (wpParams.parent !== undefined) {
                // For now we don't have parent support, but this is where it would go
                // query.parent = wpParams.parent;
            }

            console.log('query', query);
            // Fetch pages from Elasticsearch
            const result = await this._staticPageService.findAllFromElastic(
                query as QueryStaticPageDto
            );

            // Map pages to WordPress REST API v2 format
            const mappedData = result.data.map((page: any) =>
                this._staticPageService.mapPageToWordPressRestApiFormat(page)
            );

            // Return as array (WordPress REST API returns array directly)
            return mappedData;
        } catch (error) {
            this._handleError(error, 'Failed to fetch pages');
        } finally {
            this._logger.log(`getPages completed in ${Date.now() - start}ms`);
        }
    }
}