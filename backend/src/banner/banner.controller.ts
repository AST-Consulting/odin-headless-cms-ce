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
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { QueryBannerDto } from './dto/query-banner.dto';

@ApiTags('Banner')
@Controller('banner')
export class BannerController {
  constructor(
    private readonly _bannerService: BannerService,
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
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.BANNER.CREATE, CreateBannerDto)
  async create(
    @Body() createBannerDto: CreateBannerDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const banner = await this._bannerService.create(createBannerDto, user);
      return { data: banner, message: MESSAGE.BANNER.CREATED };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER.ERRORS.CREATING);
    }
  }

  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.BANNER.LIST)
  async findAll(@Query() query: QueryBannerDto): Promise<TApiResponse> {
    try {
      const banners = await this._bannerService.findAll(query);
      return {
        data: banners.data,
        message: MESSAGE.BANNER.FETCHED,
        total: banners.total,
        lastId: banners.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(banners.total / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER.ERRORS.FETCHING);
    }
  }

  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.BANNER.GET, 'id')
  async findOne(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const banner = await this._bannerService.findOne(id);
      return { data: banner, message: MESSAGE.BANNER.DETAILS_FETCHED };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER.NOT_FOUND);
    }
  }

  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.BANNER.UPDATE, UpdateBannerDto, 'id')
  async update(
    @Param('id') id: string,
    @Body() updateBannerDto: UpdateBannerDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const updatedBanner = await this._bannerService.update(id, updateBannerDto, user);
      return { data: updatedBanner, message: MESSAGE.BANNER.UPDATED };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER.ERRORS.UPDATING);
    }
  }

  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.BANNER.DELETE, 'id')
  async remove(@Param('id') id: string, @GetCurrentUser() user: any): Promise<TApiResponse> {
    try {
      await this._bannerService.remove(id, user);
      return { data: {}, message: MESSAGE.BANNER.DELETED };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER.ERRORS.DELETING);
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  @Version('2')
  @Public()
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.BANNER.GET, 'id')
  async findOneFromElastic(@Param('id') id: string): Promise<any> {
    const banner = await this._bannerService.findOneFromElastic('_id', id);
    if (!banner) {
      throw new NotFoundException(MESSAGE.BANNER.NOT_FOUND);
    }
    return { data: banner, message: MESSAGE.BANNER.DETAILS_FETCHED };
  }

  @Version('2')
  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.BANNER.LIST)
  async findAllFromElastic(
    @Query() query: QueryBannerDto,
    @GetCurrentUser() user: any
  ): Promise<any> {
    try {
      const banners = await this._bannerService.findAllFromElastic(query, user);
      return {
        data: banners.data,
        message: MESSAGE.BANNER.FETCHED,
        total: typeof banners.total === 'object' ? banners.total.value : banners.total,
        lastId: banners.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(Number(banners.total) / Number(query.limit)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER.ERRORS.FETCHING);
    }
  }

  @Version('2')
  @Public()
  @Get('nested/:bannerSlug/:nestedBannerSlug')
  @SwaggerFacade.getByIdOperation('Get a nested banner by slugs', 'bannerSlug')
  async findNestedBannerBySlug(
    @Param('bannerSlug') bannerSlug: string,
    @Param('nestedBannerSlug') nestedBannerSlug: string
  ): Promise<TApiResponse> {
    try {
      const nestedBanner = await this._bannerService.findNestedBannerBySlug(
        bannerSlug,
        nestedBannerSlug
      );
      return {
        data: nestedBanner,
        message: MESSAGE.BANNER.DETAILS_FETCHED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BANNER.ERRORS.FETCHING);
    }
  }
}
