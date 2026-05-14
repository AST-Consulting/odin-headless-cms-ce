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
import { Permissions } from 'src/auth/common/decorators/permissions.decorator';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { SwaggerFacade } from '@core/swagger/swagger-facade';
import { SectionService } from './section.service';
import {
  CreateContentPriorityDto,
  CreateSectionDto,
  QuerySectionDto,
  UpdateSectionDto,
} from './dto/section.dto';
import { PAGINATION } from '@core/constants/enums.constants';

@ApiTags('Sections')
@Controller('sections')
export class SectionController {
  constructor(
    private readonly _sectionService: SectionService,
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
  @SwaggerFacade.createOperation(MESSAGE.SWAGGER.SECTION.CREATE, CreateSectionDto)
  async create(
    @Body() createSectionDto: CreateSectionDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const section = await this._sectionService.create(createSectionDto, user);
      return { data: section, message: MESSAGE.SECTION.CREATED };
    } catch (error) {
      this._handleError(error, MESSAGE.SECTION.ERRORS.CREATING);
    }
  }

  @Public()
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.SECTION.LIST)
  async findAll(@Query() query: QuerySectionDto): Promise<TApiResponse> {
    try {
      const sections = await this._sectionService.findAll(query);
      return {
        data: sections.data,
        message: MESSAGE.SECTION.FETCHED,
        total: sections.total,
        lastId: sections.lastId,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(sections.total / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SECTION.ERRORS.FETCHING);
    }
  }

  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.SECTION.GET, 'id')
  async findOne(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const section = await this._sectionService.findOne(id);
      return { data: section, message: MESSAGE.SECTION.DETAILS_FETCHED };
    } catch (error) {
      this._handleError(error, MESSAGE.SECTION.NOT_FOUND);
    }
  }

  @Put(':id')
  @SwaggerFacade.updateOperation(MESSAGE.SWAGGER.SECTION.UPDATE, UpdateSectionDto, 'id')
  async update(
    @Param('id') id: string,
    @Body() updateSectionDto: UpdateSectionDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const updatedSection = await this._sectionService.update(id, updateSectionDto, user);

      return { data: updatedSection, message: MESSAGE.SECTION.UPDATED };
    } catch (error) {
      this._handleError(error, MESSAGE.SECTION.ERRORS.UPDATING);
    }
  }

  @Delete(':id')
  @SwaggerFacade.deleteOperation(MESSAGE.SWAGGER.SECTION.DELETE, 'id')
  async remove(@Param('id') id: string, @GetCurrentUser() user: TCurrentUserType): Promise<TApiResponse> {
    try {
      await this._sectionService.remove(id, user);
      return { data: {}, message: MESSAGE.SECTION.DELETED };
    } catch (error) {
      this._handleError(error, MESSAGE.SECTION.ERRORS.DELETING);
    }
  }

  @Post('content-priority')
  @Permissions('section.edit')
  @SwaggerFacade.createOperation(
    'Add content priority',
    CreateContentPriorityDto // DTO for the API request
  )
  async addContentPriority(
    @Body() createContentPriorityDto: CreateContentPriorityDto
  ): Promise<TApiResponse> {
    try {
      const updatedSection =
        await this._sectionService.addContentPriority(createContentPriorityDto);

      return {
        data: updatedSection,
        message: 'Content priority added successfully',
      };
    } catch (error) {
      this._handleError(error, 'Error adding content priority');
    }
  }

  @Permissions('section.write')
  @Post('bulk-index-elasticsearch')
  async bulkIndexSectionsToElasticsearch(): Promise<TApiResponse> {
    try {
      const result = await this._sectionService.bulkIndexSectionsToElasticsearch();
      return {
        data: result,
        message: result.message,
      };
    } catch (error) {
      this._handleError(error, 'Failed to bulk index sections to Elasticsearch');
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  @Version('2')
  @Get()
  @SwaggerFacade.getAllOperation(MESSAGE.SWAGGER.SECTION.LIST)
  async findAllFromElastic(@Query() query: QuerySectionDto): Promise<TApiResponse> {
    try {
      const sections = await this._sectionService.findAllFromElastic(query);

      return {
        data: sections.data,
        message: MESSAGE.SECTION.FETCHED,
        total:
          typeof sections.total === 'object'
            ? sections.total.value
            : sections.total,
        lastId: sections.lastId,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(
          (typeof sections.total === 'object'
            ? sections.total.value
            : sections.total) / (Number(query.limit) || PAGINATION.DEFAULT_LIMIT)
        ),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.SECTION.ERRORS.FETCHING);
    }
  }

  @Version('2')
  @Get(':id')
  @SwaggerFacade.getByIdOperation(MESSAGE.SWAGGER.SECTION.GET, 'id')
  async findOneByIdFromElastic(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const section = await this._sectionService.findOneFromElastic('_id', id);
      if (!section) {
        throw new NotFoundException(MESSAGE.SECTION.NOT_FOUND);
      }
      return { data: section, message: MESSAGE.SECTION.DETAILS_FETCHED };
    } catch (error) {
      this._handleError(error, MESSAGE.SECTION.ERRORS.FETCHING);
    }
  }
}
