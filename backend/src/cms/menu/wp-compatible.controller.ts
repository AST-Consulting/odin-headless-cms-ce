import {
  Controller,
  Get,
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
import { MenuService } from './menu.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { QueryMenuDto } from './dto/menu.query.dto';
import { Public } from '@auth/common/decorators';
import { mapMenusToWpResponse, mapMenuItemsToWpResponse } from '@core/utils/utilFunc';
import { ArticlesService } from '@articles/articles.service';

@Controller()
export class WpCompatibleController {
  constructor(
    private readonly _menuService: MenuService,
    private readonly _articleService: ArticlesService,
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
      throw new InternalServerErrorException(defaultMessage);
    }
  }

  //controller for wordpress
  // from mongo
  @Public()
  @Get('getmenu')
  async getMenusWp(@Query() query: QueryMenuDto) {
    const start = Date.now();
    const menus = await this._menuService.findAll(query);
    const response = mapMenusToWpResponse(menus.data);
    this._logger.log(`getMenusWp completed in ${Date.now() - start}ms`);
    return response;
  }

  @Public()
  @Get('getmenubyid')
  async getMenuBySlugWp(@Query('menu_slug') slug: string, @Query() query: QueryMenuDto) {
    const start = Date.now();
    try {
      if (!slug) {
        throw new BadRequestException('menu_slug is required');
      }
      const menu = await this._menuService.getMenuWithSubMenu(slug, query);
      return mapMenuItemsToWpResponse(menu);
    } finally {
      this._logger.log(`getMenuBySlugWp completed in ${Date.now() - start}ms`);
    }
  }

  //controller for wordpress
  // form elasticsearch
  @Version('2')
  @Public()
  @Get('getmenu')
  async getMenusWpV2(
    @Query() query: QueryMenuDto,
    @Query('limit') rawLimit: string,
    @Query('sort') rawSort: string,
    @Query('sortOrder') rawSortOrder: string
  ) {
    const start = Date.now();
    // Return all menus when no limit is explicitly provided
    if (!rawLimit) query.limit = undefined;
    // Default to alphabetical (title asc) when no sort is explicitly provided
    if (!rawSort) query.sort = undefined;
    if (!rawSortOrder) query.sortOrder = undefined;
    const menus = await this._menuService.findAllFromElastic(query);
    const response = mapMenusToWpResponse(menus.data);
    this._logger.log(`getMenusWpV2 completed in ${Date.now() - start}ms`);
    return response;
  }

  @Version('2')
  @Public()
  @Get('getmenubyid')
  async getMenuBySlugWpV2(
    @Query('menu_slug') menuSlug: string,
    @Query('menu_name') menuName: string,
    @Query('id') wpMenuId: string,
    @Query() query: QueryMenuDto
  ) {
    const start = Date.now();
    try {
      let field: string;
      let value: string | number;

      if (menuSlug) {
        field = 'slug';
        value = menuSlug;
      } else if (menuName) {
        field = 'title.keyword';
        value = menuName;
      } else if (wpMenuId) {
        field = 'wpMenuId';
        value = Number(wpMenuId);
      } else {
        throw new BadRequestException('One of menu_slug, menu_name, or id is required');
      }

      const menu = await this._menuService.getMenuWithSubMenuFromElastic(field, value, query);
      return mapMenuItemsToWpResponse(menu);
    } finally {
      this._logger.log(`getMenuBySlugWpV2 completed in ${Date.now() - start}ms`);
    }
  }

  @Version('2')
  @Public()
  @Get('rankmath/v1/getHead')
  async rankmathGetHead(@Query('url') url: string) {
    const start = Date.now();
    try {
      if (!url) {
        throw new BadRequestException('url is required');
      }
      const head = await this._articleService.rankmathGetHead(url);
      return {
        success: true,
        head,
      };
    } finally {
      this._logger.log(`rankmathGetHead completed in ${Date.now() - start}ms`);
    }
  }
}
