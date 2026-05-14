import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { GetCurrentUser } from 'src/auth/common/decorators';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { TApiResponse } from 'src/core/types/response';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';

@Controller('api-keys')
export class ApiKeysController {
  constructor(
    private readonly _apiKeysService: ApiKeysService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateApiKeyDto,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<TApiResponse> {
    const { apiKey, rawKey } = await this._apiKeysService.create(dto, user);
    this._logger.log(`API key created: ${apiKey.name} by user ${user.sub}`, ApiKeysController.name);
    return {
      data: {
        id: apiKey._id,
        name: apiKey.name,
        organization: apiKey.organization,
        expiresAt: apiKey.expiresAt,
        createdAt: (apiKey as any).createdAt,
        key: rawKey,
      },
      message: 'API key created. Store the key securely — it will not be shown again.',
    };
  }

  @Get()
  async findAll(@GetCurrentUser() user: TCurrentUserType): Promise<TApiResponse> {
    const data = await this._apiKeysService.findAll(user.sub);
    return { data, message: 'API keys fetched successfully.' };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<TApiResponse> {
    const data = await this._apiKeysService.update(id, dto, user);
    return { data, message: 'API key updated successfully.' };
  }

  @Delete(':id')
  async revoke(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<TApiResponse> {
    await this._apiKeysService.revoke(id, user.sub);
    this._logger.log(`API key revoked: ${id} by user ${user.sub}`, ApiKeysController.name);
    return { data: null, message: 'API key revoked successfully.' };
  }
}
