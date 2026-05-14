import {
  Controller,
  ConflictException,
  ForbiddenException,
  Get,
  Logger,
  Inject,
  Query,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UnifiedSearchService } from './unified-search.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Public } from 'src/auth/common/decorators';
import { sanitizeElasticDocument } from '../utils/utilFunc';

@Controller('search')
export class UnifiedSearchController {
  constructor(
    private readonly _unifiedSearchService: UnifiedSearchService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof ConflictException ||
      error instanceof UnprocessableEntityException
    ) {
      throw error;
    }
    throw new InternalServerErrorException(defaultMessage, error.message);
  }

  // Internal search - queries all indices
  @Get('internal')
  async internalSearch(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('q') query?: string,
    @Query('index') index?: string,
    @Query('fields') fields?: string,
    @Query('filters') filters?: string,
    @Query('range') range?: string,
    @Query('rank') rank?: string,
    @Query('sortField') sortField?: string, // New query param for sort field
    @Query('sortOrder') sortOrder?: 'asc' | 'desc' // New query param for sort order
  ) {
    try {
      const fieldsArray = fields?.split(',') || [];
      const filterArray = filters?.split(',') || [];
      const queryArray = query?.split(',') || [];

      const data = await this._unifiedSearchService.search(
        page,
        pageSize,
        queryArray,
        index,
        fieldsArray,
        filterArray,
        range,
        rank,
        sortField,
        sortOrder
      );

      return this.transformData(data);
    } catch (error) {
      this._handleError(error, 'Error fetching data');
    }
  }

  @Public()
  @Get('external')
  async externalSearch(
    @Query('q') query?: string,
    @Query('index') index?: string,
    @Query('fields') fields?: string
  ) {
    try {
      const indexArray = index?.split(',') || [];
      const fieldsToKeep = ['name', 'slug']; // Fields to retain

      const rawData = await this._unifiedSearchService.externalSearch(query, indexArray, fields);

      // Transform and group the data by index
      const groupedData = this.groupByIndex(rawData.data, indexArray, fieldsToKeep);

      return {
        ...groupedData,
        total: rawData.total,
        message: 'Data Fetch successfully',
      };
    } catch (error) {
      this._handleError(error, 'Error fetching data');
    }
  }

  private groupByIndex(data: any[], indices: string[], fieldsToKeep: string[]) {
    const groupedData = {};
    // Initialize empty arrays for each index
    indices.forEach((index) => {
      groupedData[index] = [];
    });

    // Iterate through the data and assign each item to the appropriate index group
    data.forEach((item) => {
      const index = item._index; // Use `type` or other key to determine the category
      if (indices.includes(index)) {
        // Sanitize document to only include name and slug
        const sanitized = sanitizeElasticDocument(item, fieldsToKeep);
        groupedData[index].push(sanitized);
      }
    });

    // Convert the object into an array format
    // return Object.keys(groupedData).map((key) => ({
    //   [key]: groupedData[key],
    // }));
    return groupedData;
  }

  transformData(input): {
    data: [];
    total: number;
    pageCount: number;
    message: string;
  } {
    const { total, data } = input;

    const pageCount = Math.ceil(total.value / (data.length ?? 1));
    return {
      data: data,
      total: total.value,
      pageCount: pageCount,
      message: 'Data Fetch successfully',
    };
  }
  // usage GET /search/internal/?q=Elas&index=my_index&fields=name,description&filters=type:product&range=startDate=2022-01-01&endDate=2022-12-31

  @Get('all-documents')
  async getAllDocuments(
    @Query('index') index: string, // Index name
    @Query('page') page: number, // Current page number
    @Query('pageSize') pageSize: number // Number of documents per page
  ) {
    return this._unifiedSearchService.getAllDocuments(index, page, pageSize);
  }

  // usage GET /your-controller/all-documents?index=my_index&page=1&pageSize=10
}
