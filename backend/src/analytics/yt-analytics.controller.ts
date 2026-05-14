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
import { YtAnalyticsService } from './yt-analytics.service';
import {
  YtBaseQueryDto,
  YtDimensionQueryDto,
  YtTopVideosQueryDto,
} from './dto/yt-analytics.dto';

@ApiTags('YouTube Analytics')
@Controller('analytics/youtube')
export class YtAnalyticsController {
  constructor(
    private readonly ytAnalyticsService: YtAnalyticsService,
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

  @Get('overview')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch YouTube overview KPIs with period comparison' })
  async getOverview(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: YtBaseQueryDto,
  ) {
    try {
      const data = await this.ytAnalyticsService.getOverview(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch YouTube overview analytics');
    }
  }

  @Get('trends')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch YouTube daily time-series trend data' })
  async getTrends(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: YtBaseQueryDto,
  ) {
    try {
      const data = await this.ytAnalyticsService.getTrends(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch YouTube trend data');
    }
  }

  @Get('top-videos')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch top performing YouTube videos' })
  async getTopVideos(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: YtTopVideosQueryDto,
  ) {
    try {
      const data = await this.ytAnalyticsService.getTopVideos(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch top YouTube videos');
    }
  }

  @Get('dimension')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch data grouped by a YouTube dimension (country, deviceType, etc.)' })
  async getDimensionReport(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: YtDimensionQueryDto,
  ) {
    try {
      const data = await this.ytAnalyticsService.getDimensionReport(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, `Failed to fetch YouTube ${query.dimension} analytics`);
    }
  }

  @Get('traffic-sources')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch YouTube traffic source breakdown' })
  async getTrafficSources(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: YtBaseQueryDto,
  ) {
    try {
      const data = await this.ytAnalyticsService.getTrafficSources(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch YouTube traffic sources');
    }
  }

  @Get('reports')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch YouTube content type and subscriber reports' })
  async getReports(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query() query: YtBaseQueryDto,
  ) {
    try {
      const data = await this.ytAnalyticsService.getReports(query);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch YouTube content reports');
    }
  }

  @Get('lifetime')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch lifetime YouTube channel statistics' })
  async getLifetimeStats(
    @GetCurrentUser() _user: TCurrentUserType,
    @Query('propertyId') propertyId: string,
  ) {
    try {
      const data = await this.ytAnalyticsService.getChannelLifetimeStats(propertyId);
      return { success: true, data };
    } catch (error) {
      this._handleError(error, 'Failed to fetch lifetime YouTube statistics');
    }
  }
}
