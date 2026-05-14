import {
  Controller,
  Get,
  Param,
  Query,
  Inject,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ArticleMetricsService } from './article-metrics.service';
import { GetCurrentUser, Public } from 'src/auth/common/decorators';
import { TCurrentUserType } from 'src/auth/types/user.type';

@ApiTags('Article Metrics')
@Controller('article-metrics')
export class ArticleMetricsController {
  constructor(
    private readonly articleMetricsService: ArticleMetricsService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
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
      throw new InternalServerErrorException(defaultMessage);
    }
  }

  /**
   * [TEMP] Populates REAL metrics from GSC/GA4 for an author's recent articles.
   * Remove after testing is complete.
   */
  @Get('populate/:authorId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[TEMP] Populate real metrics for an author\'s articles from last N days' })
  @ApiQuery({ name: 'propertyId', required: true, type: String, description: 'CMS property ID (for GSC/GA4 lookup)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 7)' })
  async populateMetrics(
    @Param('authorId') authorId: string,
    @Query('propertyId') propertyId: string,
    @Query('days') days: string,
  ) {
    try {
      if (!authorId) {
        throw new BadRequestException('authorId is required');
      }
      if (!propertyId) {
        throw new BadRequestException('propertyId query param is required for GSC/GA4 lookup');
      }

      const daysNum = days ? parseInt(days, 10) : 7;
      const result = await this.articleMetricsService.populateMetricsForAuthor(authorId, propertyId, daysNum);

      return {
        success: true,
        message: `Populated real metrics for ${result.updated} articles by author ${authorId}`,
        data: result,
      };
    } catch (error) {
      this._handleError(error, 'Failed to populate article metrics');
    }
  }

  /**
   * [TEMP DEBUG] Shows raw GSC/GA4 URLs vs CMS slugs to diagnose matching.
   * Remove after debugging is complete.
   */
  @Get('debug/:propertyId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '[DEBUG] Compare GSC/GA4 URLs with CMS article slugs' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async debugSlugMatching(
    @Param('propertyId') propertyId: string,
    @Query('days') days: string,
  ) {
    try {
      const result = await this.articleMetricsService.debugSlugMatching(propertyId, days ? parseInt(days, 10) : 7);
      return { success: true, data: result };
    } catch (error) {
      this._handleError(error, 'Failed to run debug slug matching');
    }
  }

  @Public()
  @Get('run-sync')
  @ApiOperation({ summary: '[PUBLIC TEST] Run article metrics sync manually' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 7)' })
  @ApiQuery({ name: 'propertyId', required: false, type: String, description: 'Run sync for a single property instead of all connected properties' })
  async runSync(
    @Query('days') days: string,
    @Query('propertyId') propertyId?: string,
  ): Promise<any> {
    try {
      const daysNum = days ? parseInt(days, 10) : 7;
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        throw new BadRequestException('days must be a number between 1 and 90');
      }

      this._logger.log(
        `[manual-run-sync] Triggered article metrics sync days=${daysNum} propertyId=${propertyId || 'ALL'}`,
        this.constructor.name,
      );

      if (propertyId) {
        const result = await this.articleMetricsService.syncPropertyRecentArticleMetrics(propertyId, daysNum);
        return {
          success: true,
          message: `Article metrics sync completed for property ${propertyId}`,
          data: result,
        };
      }

      const result = await this.articleMetricsService.syncRecentPublishedArticleMetrics(daysNum);
      return {
        success: true,
        message: 'Article metrics sync completed for all connected properties',
        data: result,
      };
    } catch (error) {
      this._handleError(error, 'Failed to run article metrics sync');
    }
  }

  @Get('dashboard-stats')
  // @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get aggregated dashboard stats for a property',
    description:
      'Returns aggregated metrics (clicks, impressions, views, visitors, CTR) ' +
      'using MongoDB aggregation on metricsLatest. Pass userId to filter by author, ' +
      'omit userId for cumulative stats (admin view).',
  })
  @ApiQuery({ name: 'propertyId', required: true, type: String, description: 'CMS property ID' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 7)' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'User/author ID — omit for cumulative (admin) stats' })
  async getDashboardStats(
    @Query('propertyId') propertyId: string,
    @Query('days') days: string,
    @Query('userId') userId?: string,
  ) {
    try {
      if (!propertyId) {
        throw new BadRequestException('propertyId is required');
      }

      const daysNum = days ? parseInt(days, 10) : 7;
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        throw new BadRequestException('days must be a number between 1 and 90');
      }

      const result = await this.articleMetricsService.getDashboardStats(
        propertyId,
        daysNum,
        userId || undefined,
      );

      return {
        success: true,
        message: userId
          ? `Dashboard stats for user ${userId} (last ${daysNum} days)`
          : `Cumulative dashboard stats (last ${daysNum} days)`,
        data: result,
      };
    } catch (error) {
      this._handleError(error, 'Failed to fetch dashboard stats');
    }
  }

  @Get(':propertyId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get metrics for articles published in the last N days',
    description:
      'Returns per-article impressions, clicks, CTR, and position from Google Search Console, ' +
      'plus page views and active users from Google Analytics, for articles published within the specified range.',
  })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 7)' })
  async getArticleMetrics(
    @Param('propertyId') propertyId: string,
    @Query('days') days: string,
    @GetCurrentUser() user: TCurrentUserType,
  ) {
    try {
      if (!propertyId) {
        throw new BadRequestException('propertyId is required');
      }

      const daysNum = days ? parseInt(days, 10) : 7;
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        throw new BadRequestException('days must be a number between 1 and 90');
      }

      const result = await this.articleMetricsService.getRecentArticleMetrics(propertyId, user, daysNum);

      return {
        success: true,
        message: `Metrics for articles published in the last ${daysNum} days`,
        data: result,
      };
    } catch (error) {
      this._handleError(error, 'Failed to fetch article metrics');
    }
  }
}
