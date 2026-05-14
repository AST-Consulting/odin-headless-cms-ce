import {
  Controller,
  Get,
  Inject,
  Logger,
  Query,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { GetCurrentUser } from 'src/auth/common/decorators';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { GaAnalyticsService } from './ga-analytics.service';
import {
  GaBaseQueryDto,
  GaDimensionQueryDto,
  GaTopArticlesQueryDto,
  GaTrafficSourcesQueryDto,
} from './dto/ga-analytics.dto';

@ApiTags('GA Analytics')
@Controller('analytics/ga')
export class GaAnalyticsController {
  constructor(
    private readonly gaAnalyticsService: GaAnalyticsService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
  ) {}

  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }
    throw new InternalServerErrorException(defaultMessage);
  }

  @Get('realtime')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch realtime active users and top pages' })
  async getRealtime(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaBaseQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getRealtime(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch realtime analytics');
    }
  }

  @Get('realtime-pages')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch up to 200 realtime pages paginated' })
  async getDeepRealtimePages(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaBaseQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getDeepRealtimePages(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch deep realtime pages');
    }
  }

  @Get('realtime-dimension')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch realtime analytics grouped by custom dimension' })
  async getDeepRealtimeDimensions(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaDimensionQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getDeepRealtimeDimensions(query, query.dimension);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch deep realtime dimension');
    }
  }

  @Get('overview')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch overview KPIs with period comparison' })
  async getOverview(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaBaseQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getOverview(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch overview analytics');
    }
  }

  @Get('reports')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch author-wise and category-wise reports' })
  async getReports(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaBaseQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getReports(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch content reports');
    }
  }

  @Get('top-articles')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch top performing articles' })
  async getTopArticles(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaTopArticlesQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getTopArticles(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch top articles');
    }
  }

  @Get('dimension')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch data grouped by a GA4 dimension (city, browser, device, etc.)' })
  async getDimensionReport(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaDimensionQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getDimensionReport(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, `Failed to fetch ${query.dimension} analytics`);
    }
  }

  @Get('traffic-sources')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch traffic source breakdown' })
  async getTrafficSources(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaTrafficSourcesQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getTrafficSources(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch traffic sources');
    }
  }

  @Get('trends')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch daily time-series trend data' })
  async getTrends(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: GaBaseQueryDto,
  ) {
    try {
      const data = await this.gaAnalyticsService.getTrends(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch trend data');
    }
  }
}
