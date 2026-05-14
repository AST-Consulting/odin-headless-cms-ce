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
import { MenuService } from './menu.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CreateMenuDto } from './dto/menu.create.dto';
import { UpdateMenuDto } from './dto/menu.update.dto';
import { QueryMenuDto } from './dto/menu.query.dto';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { TApiResponse } from '@core/types/response';
import { GetCurrentUser, Public } from '@auth/common/decorators';
import { SwaggerFacade } from '@core/swagger/swagger-facade';
import { PAGINATION } from '@core/constants/enums.constants';
import { mapMenusToWpResponse, mapMenuItemsToWpResponse } from '@core/utils/utilFunc';

@ApiTags('Menus')
@Controller('menus')
export class MenuController {
  constructor(
    private readonly _menuService: MenuService,
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
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.EVENT.CREATE, CreateMenuDto)
  async create(
    @Body() createMenuDto: CreateMenuDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const menu = await this._menuService.create(createMenuDto, user);
      return { data: menu, message: MESSAGE.MENU.CREATED };
    } catch (error) {
      this._handleError(error, MESSAGE.MENU.ERRORS.CREATING);
    }
  }

  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.EVENT.LIST)
  async findAll(@Query() query: QueryMenuDto): Promise<TApiResponse> {
    try {
      const menus = await this._menuService.findAll(query);
      return {
        data: menus.data,
        message: MESSAGE.MENU.FETCHED,
        total: menus.total,
        lastId: menus.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(menus.total / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.MENU.ERRORS.FETCHING);
    }
  }

  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.EVENT.GET, 'id')
  async findOne(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const menu = await this._menuService.findOne(id);
      return { data: menu, message: MESSAGE.MENU.DETAILS_FETCHED };
    } catch (error) {
      this._handleError(error, MESSAGE.MENU.NOT_FOUND);
    }
  }

  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.EVENT.UPDATE, UpdateMenuDto, 'id')
  async update(
    @Param('id') id: string,
    @Body() updateMenuDto: UpdateMenuDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const updatedMenu = await this._menuService.update(id, updateMenuDto, user);
      return { data: updatedMenu, message: MESSAGE.MENU.UPDATED };
    } catch (error) {
      this._handleError(error, MESSAGE.MENU.ERRORS.UPDATING);
    }
  }

  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.EVENT.DELETE, 'id')
  async remove(@Param('id') id: string, @GetCurrentUser() user: any): Promise<TApiResponse> {
    try {
      await this._menuService.remove(id, user);
      return { data: {}, message: MESSAGE.MENU.DELETED };
    } catch (error) {
      this._handleError(error, MESSAGE.MENU.ERRORS.DELETING);
    }
  }

  /**
   * API to fetch a menu along with its linked submenus based on slug.
   * @param slug - Slug of the top-level menu.
   * @returns Menu with its items and submenus.
   */
  @Public()
  @Get('slug/:slug')
  async getMenu(@Param('slug') slug: string, @Query() query: QueryMenuDto) {
    try {
      const menu = await this._menuService.getMenuWithSubMenu(slug, query);
      return {
        data: menu,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.MENU.ERRORS.FETCHING);
    }
  }

  ///////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  @Version('2')
  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.EVENT.LIST)
  async findAllFromElastic(@Query() query: QueryMenuDto): Promise<any> {
    try {
      const menus = await this._menuService.findAllFromElastic(query);
      return {
        data: menus.data,
        message: MESSAGE.MENU.FETCHED,
        total: typeof menus.total === 'object' ? menus.total.value : menus.total,
        lastId: menus.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(
          (typeof menus.total === 'object' ? menus.total.value : menus.total) /
          (Number(query.limit) || PAGINATION.DEFAULT_LIMIT)
        ),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.MENU.ERRORS.FETCHING);
    }
  }

  @Version('2')
  @Public()
  @Get('slug/:slug')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.EVENT.GET, 'slug')
  async findBySlugFromElastic(@Param('slug') slug: string): Promise<any> {
    const menu = await this._menuService.findOneFromElastic('slug', slug);
    if (!menu) {
      throw new NotFoundException(MESSAGE.MENU.NOT_FOUND);
    }
    return { data: menu, message: MESSAGE.MENU.DETAILS_FETCHED };
  }

  @Version('2')
  @Public()
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.EVENT.GET, 'id')
  async findByIdFromElastic(@Param('id') id: string): Promise<any> {
    const menu = await this._menuService.findOneFromElastic('_id', id);
    if (!menu) {
      throw new NotFoundException(MESSAGE.MENU.NOT_FOUND);
    }
    return { data: menu, message: MESSAGE.MENU.DETAILS_FETCHED };
  }
}
