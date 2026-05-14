import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
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
import { ApiTags } from '@nestjs/swagger';
import { StaticPageService } from './static-page.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CreateStaticPageDto } from './dto/static-page.create.dto';
import { UpdateStaticPageDto } from './dto/static-page.update.dto';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { TApiResponse } from '@core/types/response';
import { GetCurrentUser, Public } from '@auth/common/decorators';
import { TCurrentUserType } from '@auth/types/user.type';
import { SwaggerFacade } from '@core/swagger/swagger-facade'; // Import SwaggerFacade
import { QueryStaticPageDto } from './dto/static-page.query.dto';

@ApiTags('Static Pages')
@Controller('static-pages')
export class StaticPageController {
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

  @Post()
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.STATIC_PAGE.CREATE, CreateStaticPageDto)
  async create(
    @Body() createStaticPageDto: CreateStaticPageDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const page = await this._staticPageService.create(createStaticPageDto, user);
      return { data: page, message: MESSAGE.STATIC_PAGE.ADDED };
    } catch (error) {
      this._handleError(error, MESSAGE.STATIC_PAGE.ERRORS.CREATING);
    }
  }

  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.STATIC_PAGE.LIST)
  async findAll(@Query() query: QueryStaticPageDto): Promise<TApiResponse> {
    try {
      const pages = await this._staticPageService.findAll(query);
      return {
        data: pages.data,
        message: MESSAGE.STATIC_PAGE.FETCHED,
        total: pages.total,
        lastId: pages.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(pages.total / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.STATIC_PAGE.ERRORS.FETCHING);
    }
  }

  @Public()
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.STATIC_PAGE.GET, 'id')
  async findOne(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const page = await this._staticPageService.findOne(id);
      return { data: page, message: MESSAGE.STATIC_PAGE.DETAILS_FETCHED };
    } catch (error) {
      this._handleError(error, MESSAGE.STATIC_PAGE.NOT_FOUND);
    }
  }

  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.STATIC_PAGE.UPDATE, UpdateStaticPageDto, 'id')
  async update(
    @Param('id') id: string,
    @Body() updateStaticPageDto: UpdateStaticPageDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const updatedPage = await this._staticPageService.update(id, updateStaticPageDto, user);
      return { data: updatedPage, message: MESSAGE.STATIC_PAGE.UPDATED };
    } catch (error) {
      this._handleError(error, MESSAGE.STATIC_PAGE.ERRORS.UPDATING);
    }
  }

  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.STATIC_PAGE.DELETE, 'id')
  async remove(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      await this._staticPageService.remove(id, user);
      return { data: {}, message: MESSAGE.STATIC_PAGE.DELETED };
    } catch (error) {
      this._handleError(error, MESSAGE.STATIC_PAGE.ERRORS.DELETING);
    }
  }

  @Version('2')
  @Get()
  async findAllFromElastic(@Query() query: QueryStaticPageDto): Promise<TApiResponse> {
    try {
      const pages = await this._staticPageService.findAllFromElastic(query);
      // Handle SearchTotalHits object from Elasticsearch
      const totalCount = typeof pages.total === 'number' ? pages.total : pages.total.value;
      return {
        data: pages.data,
        message: MESSAGE.STATIC_PAGE.FETCHED,
        total: totalCount,
        lastId: pages.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(totalCount / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.STATIC_PAGE.ERRORS.FETCHING);
    }
  }
}
