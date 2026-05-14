import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  UsePipes,
  ValidationPipe,
  Inject,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Version,
} from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { QueryTestimonialDto } from './dto/query-testimonial.dto';
import { GetCurrentUser } from 'src/auth/common/decorators';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PAGINATION } from 'src/core/constants/enums.constants';

@Controller('testimonials')
export class TestimonialsController {
  constructor(
    private readonly testimonialsService: TestimonialsService,
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
    } else {
      // Security: Don't expose internal error details to clients
      throw new InternalServerErrorException(defaultMessage);
    }
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() createTestimonialDto: CreateTestimonialDto,
    @GetCurrentUser() user: TCurrentUserType
  ) {
    try {
      const data = await this.testimonialsService.create(createTestimonialDto, user);
      return {
        data,
        message: 'Testimonial created successfully',
      };
    } catch (error) {
      this._handleError(error, 'Failed to create testimonial');
    }
  }

  @Get()
  async findAll(@Query() query: QueryTestimonialDto, @GetCurrentUser() user: TCurrentUserType) {
    try {
      const result = await this.testimonialsService.findAll(query, user);
      return {
        data: result.data,
        message: 'Testimonials fetched successfully',
        total: result.total,
        lastId: result.lastId,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(result.total / (query.limit ?? result.total)),
      };
    } catch (error) {
      this._handleError(error, 'Failed to fetch testimonials');
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @GetCurrentUser() user: TCurrentUserType) {
    try {
      const data = await this.testimonialsService.findOne(id, user);
      return {
        data,
        message: 'Testimonial fetched successfully',
      };
    } catch (error) {
      this._handleError(error, 'Failed to fetch testimonial');
    }
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async update(
    @Param('id') id: string,
    @Body() updateTestimonialDto: UpdateTestimonialDto,
    @GetCurrentUser() user: TCurrentUserType
  ) {
    try {
      const data = await this.testimonialsService.update(id, updateTestimonialDto, user);
      return {
        data,
        message: 'Testimonial updated successfully',
      };
    } catch (error) {
      this._handleError(error, 'Failed to update testimonial');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @GetCurrentUser() user: TCurrentUserType) {
    try {
      const data = await this.testimonialsService.remove(id, user);
      return {
        data,
        message: 'Testimonial deleted successfully',
      };
    } catch (error) {
      this._handleError(error, 'Failed to delete testimonial');
    }
  }

  @Version('2')
  @Get()
  async findAllFromElasticSearch(
    @Query() query: QueryTestimonialDto,
    @GetCurrentUser() user: TCurrentUserType
  ) {
    try {
      const result = await this.testimonialsService.findAllFromElasticSearch(query, user);
      // Handle SearchTotalHits object from Elasticsearch
      const totalCount = typeof result.total === 'number' ? result.total : result.total.value;
      return {
        data: result.data,
        message: 'Testimonials fetched successfully',
        total: totalCount,
        lastId: result.lastId,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(totalCount / (query.limit ?? totalCount)),
      };
    } catch (error) {
      this._handleError(error, 'Failed to fetch testimonials');
    }
  }
}
