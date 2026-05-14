import {
  Controller,
  Get,
  Query,
  Inject,
  Logger,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  Version,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { QueryCategoryDto } from './dto/category.query.dto';
import { Public } from 'src/auth/common/decorators';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { SwaggerFacade } from 'src/core/swagger/swagger-facade';
import { STATUS } from '@core/constants/enums.constants';
import { mapCategoriesToWpResponse, mapCategoryItemToWpResponse } from '@core/utils/utilFunc';

@Controller()
export class WpCompatibleController {
  constructor(
    private readonly _categoryService: CategoryService,
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
      throw new InternalServerErrorException(`${defaultMessage} : ${error.message}`);
    }
  }

  ////////////////////////////////////////////////////////
  // WordPress-compatible APIs
  ////////////////////////////////////////////////////////
  @Public()
  @Version('2')
  @Get('categories')
  async getCategoriesWpV2(@Query() query: QueryCategoryDto) {
    const start = Date.now();
    const result = await this._categoryService.findAllFromElastic({
      ...query,
      status: STATUS.ACTIVE,
    });
    const response = mapCategoriesToWpResponse(
      result.data,
      typeof result.total === 'object' ? result.total.value : result.total,
      query.limit || 15,
      query.page || 1,
      Math.ceil(
        (typeof result.total === 'object' ? result.total.value : result.total) / (query.limit || 15)
      )
    );
    this._logger.log(`getCategoriesWpV2 completed in ${Date.now() - start}ms`);
    return response;
  }


  @Public()
  @Version('2')
  @Get('getcategorybyslug')
  async getCategoryDetailWpV2(
    @Query('slug') slug: string,
    @Query('id') id: string,
  ) {
    const start = Date.now();
    try {
      if (!slug && !id) {
        throw new BadRequestException('Either slug or id is required');
      }
      const category = slug
        ? await this._categoryService.findOneFromElastic('slug', slug)
        : await this._categoryService.findOneFromElastic('id', id);
      return mapCategoryItemToWpResponse(category);
    } finally {
      this._logger.log(`getCategoryDetailWpV2 completed in ${Date.now() - start}ms`);
    }
  }
}

