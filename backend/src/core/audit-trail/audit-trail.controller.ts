import {
  Controller,
  Get,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
  UnprocessableEntityException,
  Inject,
  Logger,
  Query,
} from '@nestjs/common';
import { AuditTrailService } from './audit-trail.service'; // Assuming this is your service for audit trail
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { TApiResponse } from '../types/response';
import { MESSAGE } from '../constants/generalMessages.constants';
import { PAGINATION } from '../constants/enums.constants';

@Controller('audit-trail') // Route path updated to '/audit-trail'
export class AuditTrailController {
  constructor(
    private readonly _auditTrailService: AuditTrailService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}:${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof ConflictException ||
      error instanceof UnprocessableEntityException
    ) {
      throw error;
    }
    throw new InternalServerErrorException(defaultMessage);
  }
  @Get()
  async getAllAuditEntries(@Query() query: any): Promise<TApiResponse> {
    try {
      const data = await this._auditTrailService.getAllAuditTrailEntries(query);

      if (data) {
        this._logger.log(MESSAGE.AUDITTRAIL.LIST_FETCHED, this.constructor.name);

        return {
          data: data.data,
          message: MESSAGE.AUDITTRAIL.LIST_FETCHED,
          total: data.total,
          page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
          limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
          pageCount: Math.ceil(data.total / (query.limit ?? data.total)),
        };
      }
    } catch (error) {
      this._handleError(error, MESSAGE.AUDITTRAIL.LIST_FETCHED_FAILED);
    }
  }
}
