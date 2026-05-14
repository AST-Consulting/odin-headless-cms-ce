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
  UnprocessableEntityException,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ApiTags } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { GetCurrentUser } from 'src/auth/common/decorators';
import { TApiResponse } from 'src/core/types/response';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { RoleQueryDto } from './dto/role-query.dto';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { roleDTO, updateRoleDTO } from './dto/role.dto';

@ApiTags('Roles')
@Controller('role')
export class RoleController {
  constructor(
    private readonly _roleService: RoleService,
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
    } else if (error.name === 'ValidationError') {
      throw new BadRequestException(error.message);
    }
    throw new InternalServerErrorException(defaultMessage);
  }

  @Post()
  async createRole(
    @Query('propertyId') propertyId: string,
    @Body() roleDTO: roleDTO,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      roleDTO.propertyId = propertyId;
      const data = await this._roleService.createRole(roleDTO, user);
      return { data, success: true, message: MESSAGE.ROLE.ADDED };
    } catch (error) {
      this._handleError(error, MESSAGE.ROLE.ERRORS.CREATING);
    }
  }

  @Get()
  async getRoles(
    @Query() query: RoleQueryDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const data = await this._roleService.getRoles(query, user);
      return {
        data: data.data,
        success: true,
        message: MESSAGE.ROLE.LIST_FETCHED,
        total: data.total,
        limit: query.limit,
        page: query.page,
        pageCount: Math.ceil(data.total / query.limit),
      };
    } catch (error) {
      this._handleError(error, MESSAGE.ROLE.LIST_FETCHED_FAILED);
    }
  }

  @Get('role-name')
  async getRoleIdAndName(
    @Query() query: RoleQueryDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<any> {
    try {
      const data = await this._roleService.getRoleIdAndName(query, user);
      return {
        data: data.data,
        success: true,
        message: MESSAGE.ROLE.LIST_FETCHED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.ROLE.LIST_FETCHED_FAILED);
    }
  }

  @Get(':name')
  async getRoleByName(@Param('name') name: string): Promise<TApiResponse> {
    try {
      const data = await this._roleService.getRoleByName(name);
      return {
        data,
        success: true,
        message: MESSAGE.ROLE.DETAILS_FETCHED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.ROLE.ERRORS.FETCHING);
    }
  }

  @Get('by-id/:id')
  async getRoleById(@Param('id') id: string): Promise<TApiResponse> {
    try {
      const data = await this._roleService.getRoleById(id);
      console.log("data", data);
      return {
        data,
        success: true,
        message: MESSAGE.ROLE.DETAILS_FETCHED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.ROLE.ERRORS.FETCHING);
    }
  }

  @Put(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() roleDTO: updateRoleDTO,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const data = await this._roleService.updateRole(id, roleDTO, user);
      return { data, message: MESSAGE.ROLE.UPDATED };
    } catch (error) {
      this._handleError(error, MESSAGE.ROLE.ERRORS.UPDATING);
    }
  }

  @Delete(':id')
  async deleteRole(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const data = await this._roleService.deleteRole(id, user);
      return { data, message: MESSAGE.ROLE.DELETED };
    } catch (error) {
      this._handleError(error, MESSAGE.ROLE.ERRORS.DELETING);
    }
  }
}
