import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UnprocessableEntityException,
  Version,
} from '@nestjs/common';
import { CreateFAQDto, UpdateFAQDto } from './dtos/faq.dto';
import { GetCurrentUser, Public } from '@auth/common/decorators';

import { FAQService } from './faqs.service';
import { TApiResponse } from '@core/types/response';

import { MESSAGE } from '@core/constants/generalMessages.constants';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { FaqQueryDto } from './dtos/faq-query.dto';
import { PAGINATION } from '@core/constants/enums.constants';
import { TCurrentUserType } from '@auth/types/user.type';
import { SwaggerFacade } from '@core/swagger/swagger-facade';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('FAQs')
@Controller('faqs')
export class FAQController {
  constructor(
    private readonly _faqService: FAQService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) { }

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
    } else if (error.name === 'ValidationError') {
      throw new BadRequestException(error.message);
    }
    throw new InternalServerErrorException(defaultMessage);
  }

  @Post('create')
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.FAQ.CREATE, CreateFAQDto)
  async createFAQ(
    @Body() faqData: CreateFAQDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const faq = await this._faqService.createFAQ(faqData, user);

      return {
        data: faq,
        message: MESSAGE.FAQ.ADDED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.FAQ.ADDED);
    }
  }
  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.FAQ.UPDATE, UpdateFAQDto, 'id')
  async updateFAQ(
    @Param('id') id: string,
    @Body() faqData: UpdateFAQDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const faq = await this._faqService.updateFAQ(id, faqData, user);

      return {
        data: faq,
        message: MESSAGE.FAQ.UPDATED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.FAQ.ERRORS.UPDATING);
    }
  }
  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.FAQ.LIST)
  async getAllFAQs(@Query() query: FaqQueryDto): Promise<TApiResponse> {
    try {
      const faqs = await this._faqService.findAll(query);
      if (!faqs) this._logger.log(MESSAGE.FAQ.ERRORS.LIST_FETCHED_FAILED, this.constructor.name);

      return {
        data: faqs.data,
        message: MESSAGE.FAQ.LIST_FETCHED,
        total: faqs.total,
        lastId: faqs.lastId,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(faqs.total / (query.limit ?? faqs.total)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.FAQ.ERRORS.LIST_FETCHED_FAILED);
    }
  }
  @Public()
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.FAQ.GET, 'id')
  async getFAQById(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const faq = await this._faqService.getFAQById(id);

      return {
        data: faq,
        message: MESSAGE.FAQ.DETAILS_FETCHED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.FAQ.DATA_NOT_FOUND);
    }
  }
  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.FAQ.DELETE, 'id')
  async deleteFAQ(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const deletedFaq = await this._faqService.deleteFAQ(id, user);

      return {
        data: deletedFaq,
        message: MESSAGE.FAQ.DELETED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.FAQ.DELETED);
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  @Version('2')
  @Public()
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.FAQ.GET, 'id')
  async findOneFromElastic(@Param('id') id: string): Promise<any> {
    const faq = await this._faqService.findOneFromElastic('_id', id);
    if (!faq) {
      throw new NotFoundException(MESSAGE.FAQ.NOT_FOUND);
    }
    return { data: faq, message: MESSAGE.FAQ.DETAILS_FETCHED };
  }

  @Version('2')
  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.FAQ.LIST)
  async findAllFromElastic(
    @Query() query: FaqQueryDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const faqs = await this._faqService.findAllFromElastic(query, user);
      const totalCount = (typeof faqs.total === 'object' ? faqs.total?.value : faqs.total) || 0;
      const limitVal = Number(query.limit) || 10;
      const currentPage = Number(query.page) || 1;

      return {
        data: faqs.data,
        message: MESSAGE.FAQ.LIST_FETCHED,
        total: totalCount,
        lastId: faqs.lastId,
        limit: limitVal,
        page: currentPage,
        pageCount: Math.ceil(totalCount / limitVal),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.FAQ.ERRORS.LIST_FETCHED_FAILED);
    }
  }
}
