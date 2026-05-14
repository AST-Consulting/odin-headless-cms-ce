import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
  Version,
} from '@nestjs/common';
import { PropertyService } from './property.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { GetCurrentUser } from 'src/auth/common/decorators';
import { TApiResponse } from 'src/core/types/response';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { PropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertyDto } from './dto/query-property.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/verify-email.dto';
import { ApiTags } from '@nestjs/swagger';
import { PAGINATION } from 'src/core/constants/enums.constants';
import { Public } from 'src/auth/common/decorators/public.decorator';

@ApiTags('Property Configuration')
@Controller('property')
export class PropertyController {
  constructor(
    private readonly _propertyService: PropertyService,
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
      // Security: Don't expose internal error details to clients
      throw new InternalServerErrorException(defaultMessage);
    }
  }

  @Post()
  async create(
    @Body() createPropertyDto: PropertyDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const BlogConfig = await this._propertyService.create(createPropertyDto, user);
      return {
        data: BlogConfig,
        message: MESSAGE.BLOG_CONFIG.ADDED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.CREATING);
    }
  }

  /*** GET ALL PROPERTIES FOR A USER ***/
  // @Get()
  // @Permissions('property.read')
  // async getAll(@GetCurrentUser() user: TCurrentUserType): Promise<TApiResponse> {
  //   try {
  //     console.log(user.sub)
  //     const blogConfigs = await this._propertyService.getAll(user.sub);
  //     return {
  //       data: blogConfigs,
  //       message: MESSAGE.BLOG_CONFIG.FETCHED,
  //     };
  //   } catch (error) {
  //     this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.FETCHING);
  //   }
  // }

  @Get('all')
  async getAllProperties(
    @Query() query: QueryPropertyDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const blogConfigs = await this._propertyService.findAll(query, user);
      return {
        data: blogConfigs.data,
        message: MESSAGE.BLOG_CONFIG.FETCHED,
        total: blogConfigs.total,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.FETCHING);
    }
  }

  @Get('admin/properties')
  async getAllPropertiesForAdmin(@Query() query: QueryPropertyDto): Promise<TApiResponse> {
    try {
      const blogConfigs = await this._propertyService.findAllForAdmin(query);
      return {
        data: blogConfigs.data,
        message: MESSAGE.BLOG_CONFIG.FETCHED,
        total: blogConfigs.total,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(blogConfigs.total / (Number(query.limit) || PAGINATION.DEFAULT_LIMIT)),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.FETCHING);
    }
  }

  @Version('2')
  @Get()
  async findAllFromElastic(
    @Query() query: QueryPropertyDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const config = await this._propertyService.findAllFromElastic(query, user);
      return {
        data: config.data,
        message: MESSAGE.BLOG_CONFIG.FETCHED,
        total: typeof config.total === 'object' ? config.total.value : config.total,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(
          (typeof config.total === 'object' ? config.total.value : config.total) /
            (Number(query.limit) || PAGINATION.DEFAULT_LIMIT)
        ),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.FETCHING);
    }
  }

  @Version('2')
  @Get('admin/properties')
  async findAllFromElasticForAdmin(@Query() query: QueryPropertyDto): Promise<TApiResponse> {
    try {
      const config = await this._propertyService.findAllFromElasticForAdmin(query);
      return {
        data: config.data,
        message: MESSAGE.BLOG_CONFIG.FETCHED,
        total: typeof config.total === 'object' ? config.total.value : config.total,
        page: query.page ? query.page : PAGINATION.DEFAULT_PAGE,
        limit: query.limit ? query.limit : PAGINATION.DEFAULT_LIMIT,
        pageCount: Math.ceil(
          (typeof config.total === 'object' ? config.total.value : config.total) /
            (Number(query.limit) || PAGINATION.DEFAULT_LIMIT)
        ),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.FETCHING);
    }
  }

  /*** GET PROPERTY BY ID ***/
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const blogConfig = await this._propertyService.findOne(id, user);
      return {
        data: blogConfig,
        message: MESSAGE.BLOG_CONFIG.FETCHED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.FETCHING);
    }
  }

  /*** UPDATE PROPERTY ***/

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const updatedConfig = await this._propertyService.update(id, updatePropertyDto, user);
      return {
        data: updatedConfig,
        message: MESSAGE.BLOG_CONFIG.UPDATED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.UPDATING);
    }
  }

  /*** DELETE PROPERTY ***/
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      await this._propertyService.delete(id, user);
      return {
        data: null,
        message: MESSAGE.BLOG_CONFIG.DELETED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.BLOG_CONFIG.ERRORS.DELETING);
    }
  }

  /**
   * Verify property email verification token
   */
  @Post('verify-email')
  @Public()
  async verifyPropertyEmail(@Body() body: VerifyEmailDto): Promise<TApiResponse> {
    try {
      console.log(body, 'body');
      const result = await this._propertyService.verifyPropertyEmail(body.token);
      return {
        data: { email: result.email },
        message: 'Email verified successfully',
        success: true,
      };
    } catch (error) {
      this._handleError(error, 'Email verification failed');
    }
  }

  /**
   * Resend property email verification
   */
  @Post('resend-verification')
  async resendPropertyEmailVerification(
    @Body() body: ResendVerificationDto
  ): Promise<TApiResponse> {
    try {
      const result = await this._propertyService.resendPropertyEmailVerification(
        body.email,
        body.propertyId
      );
      return {
        data: null,
        message: result.message,
        success: result.success,
      };
    } catch (error) {
      this._handleError(error, 'Failed to resend verification email');
    }
  }
}
