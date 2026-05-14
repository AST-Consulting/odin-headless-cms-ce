import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  Logger,
  InternalServerErrorException,
  Query,
  Put,
  Delete,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Version,
} from '@nestjs/common';
import { TApiResponse } from '@core/types/response';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ApiTags, ApiResponse, ApiBody } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { TagDto, UpdateTagDto, UpdateTagRank } from './dto/tags.dto';
import { TagQueryDto } from './dto/query-tags.dto';
import { GetCurrentUser, Public } from '@auth/common/decorators';
import { SwaggerFacade } from '@core/swagger/swagger-facade';
import { TCurrentUserType } from '@auth/types/user.type';
@ApiTags('Tags')
@Controller('tag')
export class TagController {
  constructor(
    private readonly _tagsService: TagsService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) { }

  private _handleError(error: any, defaultMessage: string): never {
    console.log(defaultMessage, defaultMessage);
    this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    } else {
      throw new InternalServerErrorException(`${defaultMessage}, ${error}`);
    }
  }

  @Post()
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.TAG.CREATE, TagDto)
  async create(
    @Body() createTagDto: TagDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const tag = await this._tagsService.create(createTagDto, user);
      return {
        data: tag,
        message: MESSAGE.TAG.ADDED(tag.id),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.TAG.ADD_FAILED);
    }
  }

  @Put('updateRank')
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.TAG.LIST)
  @ApiBody({ type: UpdateTagRank })
  @ApiResponse({
    status: 200,
    description: 'Tag rank updated successfully',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updateRank(
    @Body() updateTagDto: UpdateTagRank,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const updatedRanks = await this._tagsService.updateTagAndRanks(updateTagDto, user);
      return {
        data: updatedRanks,
        message: MESSAGE.TAG.RANK_UPDATED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.TAG.RANK_UPDATE_FAILED());
    }
  }

  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.TAG.LIST)
  async findAll(@Query() query: TagQueryDto): Promise<TApiResponse> {
    try {
      const tags = await this._tagsService.findAll(query);
      if (tags) this._logger.log(MESSAGE.TAG.FETCHED_ALL, this.constructor.name);
      return {
        data: tags.data,
        message: MESSAGE.TAG.FETCHED_ALL,
        total: tags.total,
        lastId: tags.lastId,
        lastSortValues: tags.lastSortValues,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(tags.total / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.TAG.FETCH_ALL_FAILED());
    }
  }

  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.TAG.GET, 'id')
  async findOne(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const tag = await this._tagsService.findOne(id);
      if (tag) this._logger.log(MESSAGE.TAG.FETCHED, this.constructor.name);
      return {
        data: tag,
        message: MESSAGE.TAG.FETCHED(tag.id),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.TAG.NOT_FOUND);
    }
  }

  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.TAG.UPDATE, UpdateTagDto, 'id')
  async update(
    @Param('id') id: string,
    @Body() updatetagDto: UpdateTagDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const updatedTag = await this._tagsService.update(id, updatetagDto, user);
      return {
        data: updatedTag,
        message: MESSAGE.TAG.UPDATED(updatedTag.id),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.TAG.UPDATE_FAILED);
    }
  }

  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.TAG.DELETE, 'id')
  async remove(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const removedtag = await this._tagsService.remove(id, user);
      return {
        data: removedtag,
        message: MESSAGE.TAG.DELETED(removedtag.id),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.TAG.DELETE_FAILED);
    }
  }

  @Post('sync/wp-tag-ids')
  async syncWpTagIds(@GetCurrentUser() user: TCurrentUserType): Promise<TApiResponse> {
    try {
      const result = await this._tagsService.syncWpTagIds(user);

      return {
        data: {
          created: result.created,
          total: result.total,
          errors: result.errors,
        },
        message: `Successfully created ${result.created} tags from ${result.total} WordPress tags`,
      };
    } catch (error) {
      this._handleError(error, 'Failed to sync WordPress tag IDs');
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  @Version('2')
  @Public()
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.TAG.GET, 'id')
  async findOneFromElastic(@Param('id') id: string): Promise<any> {
    const tag = await this._tagsService.findOneFromElastic('_id', id);
    if (!tag) {
      throw new NotFoundException(MESSAGE.TAG.NOT_FOUND);
    }
    return { data: tag, message: MESSAGE.TAG.FETCHED(tag.id) };
  }

  @Version('2')
  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.TAG.LIST)
  async findAllFromElastic(
    @Query() query: TagQueryDto,
    @GetCurrentUser() user: any
  ): Promise<TApiResponse> {
    try {
      const tags = await this._tagsService.findAllFromElastic(query, user);
      return {
        data: tags.data,
        message: MESSAGE.TAG.FETCHED_ALL,
        total: typeof tags.total === 'object' ? tags.total.value : tags.total,
        lastId: tags.lastId,
        lastSortValues: tags.lastSortValues,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(Number(tags.total) / Number(query.limit || 1)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.TAG.FETCH_ALL_FAILED());
    }
  }
}
