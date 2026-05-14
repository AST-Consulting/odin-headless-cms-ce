import {
  Controller,
  Inject,
  Logger,
  InternalServerErrorException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Get,
  Query,
  Version,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { TagsService } from './tags.service';
import { Public } from '@auth/common/decorators';
import { TagQueryDto } from './dto/query-tags.dto';

@Controller()
export class WpCompatibleController {
  constructor(
    private readonly _tagsService: TagsService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) { }

  private _handleError(error: any, defaultMessage: string): never {
    console.log(defaultMessage, defaultMessage);
    this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    } else {
      throw new InternalServerErrorException(`${defaultMessage}, ${error}`);
    }
  }

  /**
   * WordPress REST API v2 compatible endpoint
   * GET /v2/tags
   * Returns tags in standard WordPress REST API format
   * @Public - No authentication required
   */
  @Version('2')
  @Public()
  @Get('tags')
  async getTags(@Query() wpParams: any): Promise<any> {
    const start = Date.now();
    try {
      // Map WordPress params to internal TagQueryDto
      const query: Partial<TagQueryDto> = {
        page: wpParams.page ? parseInt(wpParams.page) : 1,
        limit: wpParams.per_page ? parseInt(wpParams.per_page) : 10,
        sort: wpParams.orderby || 'name',
        sortOrder: wpParams.order || 'asc',
      };

      // Handle search query
      if (wpParams.search) {
        query.searchTerm = wpParams.search;
      }

      if (wpParams.slug) {
        query.slug = wpParams.slug;
      }

      // Handle hide_empty (in WordPress, this hides tags with no posts)
      // We'll skip this for now as it requires counting posts per tag

      // Fetch tags from Elasticsearch
      const result = await this._tagsService.findAllFromElastic(
        query as TagQueryDto,
        null
      );

      // Map tags to WordPress REST API v2 format
      const mappedData = result.data.map((tag: any) =>
        this._tagsService.mapTagToWordPressRestApiFormat(tag)
      );

      // Return as array (WordPress REST API returns array directly)
      return mappedData;
    } catch (error) {
      this._handleError(error, 'Failed to fetch tags');
    } finally {
      this._logger.log(`getTags completed in ${Date.now() - start}ms`);
    }
  }
}
