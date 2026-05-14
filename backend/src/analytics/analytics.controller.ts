import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { GetCurrentUser } from 'src/auth/common/decorators';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary.dto';
import { TApiResponse } from 'src/core/types/response';
import { PAGINATION } from 'src/core/constants/enums.constants';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

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
      // Security: Don't expose internal error details to clients
      throw new InternalServerErrorException(defaultMessage);
    }
  }

  // Controller methods will be implemented here

  @Get()
  async getAlltitles(
    @GetCurrentUser() user: TCurrentUserType,
    @Query() query: QueryAnalyticsDto
  ): Promise<TApiResponse> {
    try {
      const blogTopic = await this.analyticsService.findAll(user.sub, query);
      return {
        data: blogTopic.data,
        message: MESSAGE.ANALYTICS.FETCHED,
        total: blogTopic.total,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(blogTopic.total / (query.limit ?? blogTopic.total)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.ANALYTICS.ERRORS.FETCHING);
    }
  }

  @Get('summary')
  async getViewsSummary(
    @GetCurrentUser() user: TCurrentUserType,
    @Query() query: AnalyticsSummaryQueryDto
  ): Promise<TApiResponse> {
    try {
      if (!user.sub) {
        throw new UnauthorizedException('Unauthorized');
      }
      const summary = await this.analyticsService.getViewsSummary(user.sub, query);
      return {
        data: summary,
        message: MESSAGE.ANALYTICS.FETCHED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.ANALYTICS.ERRORS.FETCHING);
    }
  }
}
