import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Inject,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  Query,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Version,
} from '@nestjs/common';
import { SlugService } from './slug.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CreateSlugDto } from './dto/create-slug.dto';
import { UpdateSlugDto } from './dto/update-slug.dto';
import { TApiResponse } from '@core/types/response';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { GetCurrentUser, Public } from '@auth/common/decorators';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerFacade } from '@core/swagger/swagger-facade';
import { QuerySlugDto } from './dto/query-slug.dto';
import { PAGINATION } from '@core/constants/enums.constants';

@ApiTags('Slugs')
@Controller('slugs')
export class SlugController {
  constructor(
    private readonly _slugService: SlugService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) { }

  /**
   * Private method to handle errors and log them.
   * Throws the error or a generic internal server error if the error type is unknown.
   * @param error - The error object encountered during execution.
   * @param defaultMessage - The default message to log and throw in case of an unknown error.
   */
  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}:${error.message}`, error.stack, this.constructor.name);

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

  /**
   * Endpoint to create a new slug.
   * @param createSlugDto - DTO containing data to create a new slug.
   * @returns A response with the created slug data and success message.
   */
  @Post()
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.SLUG.CREATE, CreateSlugDto)
  async createSlug(
    @Body() createSlugDto: CreateSlugDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const createSlug = await this._slugService.createSlug(createSlugDto, user);
      return {
        data: createSlug,
        message: MESSAGE.SLUG.ADDED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SLUG.ADD_FAILED);
    }
  }
  /**
   * Endpoint to get content by slug using Strategy Pattern.
   * This endpoint first fetches the module type from the slug collection,
   * then uses the appropriate strategy to retrieve the actual content.
   * 
   * @param slug - The slug to search for
   * @param type - Optional query parameter to filter by module type
   * @returns A response with the slug metadata, content, and module type
   */
  @Public()
  @Get('content/:slug')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.SLUG.GET_CONTENT, 'slug')
  async getContentBySlug(
    @Param('slug') slug: string,
    @Query('type') type?: string
  ): Promise<TApiResponse> {
    try {
      const result = await this._slugService.getContentBySlug(slug, type);

      return {
        data: {
          slugMetadata: result.slugMetadata,
          content: result.content,
          moduleType: result.moduleType,
        },
        message: `Content fetched successfully for ${result.moduleType}: ${slug}`,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SLUG.FETCH_FAILED(slug));
    }
  }

  /**
   * Endpoint to get a slug by its ID.
   * @param slug - The ID of the slug to retrieve.
   * @returns A response with the fetched slug data and success message.
   */
  @Public()
  @Get('details/:slug')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.SLUG.GET, 'slug')
  async getSlugDetails(
    @Param('slug') slug: string,
    @Query('type') type?: string
  ): Promise<TApiResponse> {
    const slugData = await this._slugService.getSlugDetails(slug, type);
    try {
      return {
        data: slugData,
        message: MESSAGE.SLUG.FETCHED(slug),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SLUG.FETCH_FAILED(slug));
    }
  }
  /**
   * Endpoint to get a slug by its ID.
   * @param id - The ID of the slug to retrieve.
   * @returns A response with the fetched slug data and success message.
   */
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.SLUG.GET, 'id')
  async getSlugById(@Param('id') id: string): Promise<TApiResponse> {
    const slug = await this._slugService.getSlugById(id);
    try {
      return {
        data: slug,
        message: MESSAGE.SLUG.FETCHED(id),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SLUG.FETCH_FAILED(id));
    }
  }

  /**
   * Endpoint to fetch all slugs with pagination.
   * @param query - Query parameters for pagination (limit, page).
   * @returns A response with the fetched slugs, pagination metadata, and success message.
   */
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.SLUG.LIST)
  async getAllSlugs(@Query() query: QuerySlugDto): Promise<TApiResponse> {
    try {
      // Fetch all slugs with pagination based on the provided query parameters
      const slugs = await this._slugService.getAllSlugs(query);

      // Return the fetched slugs along with pagination metadata
      return {
        data: slugs,
        message: MESSAGE.SLUG.FETCHED_ALL,
        total: slugs.total, // Total number of slugs available
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        lastSortValues: slugs.lastSortValues,
        pageCount: Math.ceil(slugs.total / query.limit), // Total number of pages
      };
    } catch (error) {
      // Handle and log errors, returning a failed response
      return this._handleError(error, MESSAGE.SLUG.FETCHED_ALL_FAILED);
    }
  }

  /**
   * Endpoint to update a slug by its ID.
   * @param id - The ID of the slug to update.
   * @param updateSlugDto - DTO containing the updated slug data.
   * @returns A response with the updated slug data and success message.
   */
  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.SLUG.UPDATE, UpdateSlugDto, 'id')
  async updateSlug(
    @Param('id') id: string,
    @Body() updateSlugDto: UpdateSlugDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const updatedSlug = await this._slugService.updateSlug(id, updateSlugDto, user);
      return {
        data: updatedSlug,
        message: MESSAGE.SLUG.UPDATED(id),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SLUG.UPDATE_FAILED(id));
    }
  }

  /**
   * Endpoint to delete a slug by its ID.
   * @param id - The ID of the slug to delete.
   * @returns A response confirming the deletion of the slug.
   */
  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.SLUG.DELETE, 'id')
  async deleteSlug(@Param('id') id: string, @GetCurrentUser() user: any): Promise<TApiResponse> {
    try {
      await this._slugService.deleteSlug(id, user);
      return {
        data: {},
        message: MESSAGE.SLUG.DELETED(id),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SLUG.DELETE_FAILED(id));
    }
  }

  @Version('2')
  @Get()
  async getAllSlugsFromElasticSearch(@Query() query: QuerySlugDto): Promise<TApiResponse> {
    try {
      const slugs = await this._slugService.getAllSlugsFromElasticSearch(query);
      const lastId = slugs.slugs.length > 0 ? (slugs.slugs[slugs.slugs.length - 1] as any)._id : null;
      return {
        data: slugs,
        message: MESSAGE.SLUG.FETCHED_ALL,
        total: slugs.total,
        limit: query.limit || 20,
        lastSortValues: slugs.lastSortValues,
        page: query.page || 1,
        lastId,
        pageCount: Math.ceil(slugs.total / (query.limit || 20)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SLUG.FETCHED_ALL_FAILED);
    }
  }
}
