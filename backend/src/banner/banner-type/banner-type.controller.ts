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
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { TApiResponse } from '@core/types/response';
import { GetCurrentUser, Public } from '@auth/common/decorators';
import { SwaggerFacade } from '@core/swagger/swagger-facade';
import { BannerTypeService } from './banner-type.service';
import { CreateBannerTypeDto } from './dto/create-banner-type.dto';
import { UpdateBannerTypeDto } from './dto/update-banner-type.dto';
import { QueryBannerTypeDto } from './dto/query-banner-type.dto';

@ApiTags('Banner-type')
@Controller('banner-type')
export class BannerTypeController {
  constructor(
    private readonly _bannerTypeService: BannerTypeService,
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
      throw new InternalServerErrorException(defaultMessage);
    }
  }

  @Post()
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.BANNER_TYPE.CREATE, CreateBannerTypeDto)
  async create(
    @Body() createBannerTypeDto: CreateBannerTypeDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const banner = await this._bannerTypeService.create(createBannerTypeDto, user);
      return { data: banner, message: MESSAGE.BANNER_TYPE.CREATED };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER_TYPE.ERRORS.CREATING);
    }
  }

  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.BANNER_TYPE.LIST)
  async findAll(@Query() query: QueryBannerTypeDto): Promise<TApiResponse> {
    try {
      const bannerTypes = await this._bannerTypeService.findAll(query);
      return {
        data: bannerTypes.data,
        message: MESSAGE.BANNER_TYPE.FETCHED,
        total: bannerTypes.total,
        lastId: bannerTypes.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(bannerTypes.total / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER_TYPE.ERRORS.FETCHING);
    }
  }

  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.BANNER_TYPE.GET, 'id')
  async findOne(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const bannerType = await this._bannerTypeService.findOne(id);
      return {
        data: bannerType,
        message: MESSAGE.BANNER_TYPE.DETAILS_FETCHED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER_TYPE.NOT_FOUND);
    }
  }

  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.BANNER_TYPE.UPDATE, UpdateBannerTypeDto, 'id')
  async update(
    @Param('id') id: string,
    @Body() updateBannerTypeDto: UpdateBannerTypeDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const updatedBannerType = await this._bannerTypeService.update(id, updateBannerTypeDto, user);
      return { data: updatedBannerType, message: MESSAGE.BANNER_TYPE.UPDATED };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER_TYPE.ERRORS.UPDATING);
    }
  }

  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.BANNER_TYPE.DELETE, 'id')
  async remove(@Param('id') id: string, @GetCurrentUser() user: any): Promise<TApiResponse> {
    try {
      await this._bannerTypeService.remove(id, user);
      return { data: {}, message: MESSAGE.BANNER_TYPE.DELETED };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER_TYPE.ERRORS.DELETING);
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  @Version('2')
  @Public()
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.BANNER_TYPE.GET, 'id')
  async findOneFromElastic(@Param('id') id: string): Promise<any> {
    const bannerType = await this._bannerTypeService.findOneFromElastic('_id', id);
    if (!bannerType) {
      throw new NotFoundException(MESSAGE.BANNER_TYPE.NOT_FOUND);
    }
    return { data: bannerType, message: MESSAGE.BANNER_TYPE.DETAILS_FETCHED };
  }

  @Version('2')
  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.BANNER_TYPE.LIST)
  async findAllFromElastic(
    @Query() query: QueryBannerTypeDto,
    @GetCurrentUser() user: any
  ): Promise<any> {
    try {
      const bannerTypes = await this._bannerTypeService.findAllFromElastic(query, user);
      return {
        data: bannerTypes.data,
        message: MESSAGE.BANNER_TYPE.FETCHED,
        total: typeof bannerTypes.total === 'object' ? bannerTypes.total.value : bannerTypes.total,
        lastId: bannerTypes.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(Number(bannerTypes.total) / Number(query.limit)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER_TYPE.ERRORS.FETCHING);
    }
  }
}
