import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
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
import { UpdateCategoryDto } from './dto/category.update.dto';
import { CreateCategoryDTO } from './dto/category.create.dto';
import { QueryCategoryDto } from './dto/category.query.dto';
import { GetCurrentUser, Public } from 'src/auth/common/decorators';
import { Permissions } from 'src/auth/common/decorators/permissions.decorator';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { STATUS } from 'src/core/constants/enums.constants';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { SwaggerFacade } from 'src/core/swagger/swagger-facade';
import { TApiResponse } from 'src/core/types/response';

@ApiTags('Categories')
@Controller('category')
export class CategoryController {
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

  @Post()
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.CATEGORY.CREATE, CreateCategoryDTO)
  async create(
    @Body() createCategoryDto: CreateCategoryDTO,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const category = await this._categoryService.create(createCategoryDto, user);
      return { data: category, message: MESSAGE.CATEGORY.CREATED };
    } catch (error) {
      this._handleError(error, MESSAGE.CATEGORY.ERRORS.CREATING);
    }
  }

  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.CATEGORY.LIST)
  async findAll(@Query() query: QueryCategoryDto): Promise<TApiResponse> {
    try {
      const categories = await this._categoryService.findAll(query);
      return {
        data: categories.data,
        message: MESSAGE.CATEGORY.FETCHED,
        total: categories.total,
        lastId: categories.lastId,
        lastSortValues: categories.lastSortValues,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(categories.total / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.CATEGORY.ERRORS.FETCHING);
    }
  }

  @Public()
  @Get('/findall')
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.CATEGORY.LIST)
  async findAllCategories(@Query() query: QueryCategoryDto): Promise<any> {
    const updatedQuery: QueryCategoryDto = {
      ...query,
      status: STATUS.ACTIVE,
      fields: 'title,slug',
    };
    try {
      const categories = await this._categoryService.findAll(updatedQuery);
      const transformedCategories = categories.data.map((category) => ({
        name: category.title,
        slug: category.slug,
      }));
      return {
        data: transformedCategories,
        message: MESSAGE.CATEGORY.FETCHED,
      };
    } catch (error) {
      return this._handleError(error, MESSAGE.CATEGORY.ERRORS.FETCHING);
    }
  }
  @Get('sync')
  @Permissions('category.write')
  async syncCategories(@GetCurrentUser() user: TCurrentUserType) {
    try {
      await this._categoryService.syncCategories(user);
      return { data: {}, message: 'Categories synced successfully' };
    } catch (error) {
      this._handleError(error, 'Failed to import WordPress categories');
    }
  }

  @Post('create/wp-categories')
  async createWpCategories(@GetCurrentUser() user: TCurrentUserType): Promise<TApiResponse> {
    try {
      const result = await this._categoryService.fetchAndCreateWpCategories(user);

      return {
        data: {
          created: result.created,
          total: result.total,
          errors: result.errors,
        },
        message: `Successfully created ${result.created} categories from ${result.total} WordPress categories`,
      };
    } catch (error) {
      this._handleError(error, 'Failed to create WordPress categories');
    }
  }

  @Post('sync/wp-category-ids')
  async syncWpCategoryIds(@GetCurrentUser() user: TCurrentUserType): Promise<TApiResponse> {
    try {
      const result = await this._categoryService.syncWpCategoryIds(user);

      return {
        data: {
          updated: result.updated,
          total: result.total,
          errors: result.errors,
        },
        message: `Successfully synced ${result.updated} category IDs from ${result.total} WordPress categories`,
      };
    } catch (error) {
      this._handleError(error, 'Failed to sync WordPress category IDs');
    }
  }

  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.CATEGORY.GET, 'id')
  async findOne(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const category = await this._categoryService.findOne(id);
      return { data: category, message: MESSAGE.CATEGORY.DETAILS_FETCHED };
    } catch (error) {
      this._handleError(error, MESSAGE.CATEGORY.NOT_FOUND);
    }
  }

  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.CATEGORY.UPDATE, UpdateCategoryDto, 'id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const updatedCategory = await this._categoryService.update(id, updateCategoryDto, user);
      return { data: updatedCategory, message: MESSAGE.CATEGORY.UPDATED };
    } catch (error) {
      this._handleError(error, MESSAGE.CATEGORY.ERRORS.UPDATING);
    }
  }

  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.CATEGORY.DELETE, 'id')
  async remove(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      await this._categoryService.remove(id, user);
      return { data: {}, message: MESSAGE.CATEGORY.DELETED };
    } catch (error) {
      this._handleError(error, MESSAGE.CATEGORY.ERRORS.DELETING);
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  @Version('2')
  @Public()
  @Get('')
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.CATEGORY.LIST)
  async findAllFromElastic(@Query() query: QueryCategoryDto): Promise<TApiResponse> {
    try {
      const categories = await this._categoryService.findAllFromElastic(query);
      return {
        data: categories.data,
        message: MESSAGE.CATEGORY.FETCHED,
        total: typeof categories.total === 'object' ? categories.total.value : categories.total,
        lastId: categories.lastId,
        limit: query.limit || 15,
        lastSortValues: categories.lastSortValues,
        page: query.page || 1,
        pageCount: Math.ceil(
          (typeof categories.total === 'object' ? categories.total.value : categories.total) /
          (query.limit || 15)
        ),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.CATEGORY.ERRORS.FETCHING);
    }
  }

  /**
   * WordPress REST API v2 compatible endpoint
   * GET /v2/categories
   * Returns categories in standard WordPress REST API format
   * @Public - No authentication required
   */
  @Version('2')
  @Public()
  @Get('categories')
  async getCategories(@Query() wpParams: any): Promise<any> {
    try {
      // Map WordPress params to internal QueryCategoryDto
      const query: Partial<QueryCategoryDto> = {
        page: wpParams.page ? parseInt(wpParams.page) : 1,
        limit: wpParams.per_page ? parseInt(wpParams.per_page) : 10,
        sort: wpParams.orderby || 'title',
        sortOrder: wpParams.order || 'asc',
      };

      // Handle search query
      if (wpParams.search) {
        query.searchTerm = wpParams.search;
      }

      // Handle parent filter
      if (wpParams.parent !== undefined) {
        if (wpParams.parent === '0' || wpParams.parent === 0) {
          // Filter for root categories (no parent)
          query['parent'] = null;
        } else {
          query['parent.id'] = wpParams.parent.toString();
        }
      }

      // Handle hide_empty (in WordPress, this hides categories with no posts)
      // We'll skip this for now as it requires counting posts per category

      // Fetch categories from Elasticsearch
      const result = await this._categoryService.findAllFromElastic(
        query as QueryCategoryDto
      );

      // Map categories to WordPress REST API v2 format
      const mappedData = result.data.map((category: any) =>
        this._categoryService.mapCategoryToWordPressRestApiFormat(category)
      );

      // Return as array (WordPress REST API returns array directly)
      return mappedData;
    } catch (error) {
      this._handleError(error, 'Failed to fetch categories');
    }
  }

  @Version('2')
  @Public()
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.CATEGORY.GET, 'id')
  async findOneFromElastic(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const category = await this._categoryService.findOneFromElastic('_id', id);
      if (!category) {
        throw new NotFoundException(MESSAGE.CATEGORY.NOT_FOUND);
      }
      return { data: category, message: MESSAGE.CATEGORY.DETAILS_FETCHED };
    } catch (error) {
      this._handleError(error, MESSAGE.CATEGORY.NOT_FOUND);
    }
  }
}
