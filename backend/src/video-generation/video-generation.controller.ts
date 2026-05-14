import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { GetCurrentUser } from 'src/auth/common/decorators';
import { Permissions } from 'src/auth/common/decorators/permissions.decorator';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { PlanScenesDto } from './dto/plan-scenes.dto';
import { SceneImagesDto } from './dto/scene-images.dto';
import { PublishVideoJobDto } from './dto/publish-video-job.dto';
import { TtsDto } from './dto/tts.dto';
import { VideoGenerationService } from './video-generation.service';

@Controller('video-generation')
export class VideoGenerationController {
  constructor(
    private readonly _videoGenerationService: VideoGenerationService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

  @Post('plan-scenes')
  @Permissions('ai.write')
  async planScenes(@Body() payload: PlanScenesDto) {
    const data = await this._videoGenerationService.planScenes(payload);
    return { success: true, data };
  }

  @Post('scene-images')
  @Permissions('ai.write')
  async sceneImages(
    @Body() payload: SceneImagesDto,
    @GetCurrentUser() user: TCurrentUserType
  ) {
    const data = await this._videoGenerationService.sceneImages(payload, user);
    return { success: true, data };
  }

  @Post('tts')
  @Permissions('ai.write')
  async tts(@Body() payload: TtsDto) {
    const data = await this._videoGenerationService.generateTts(payload);
    return { success: true, data };
  }

  @Post('jobs')
  @Permissions('ai.write')
  async createJob(
    @Body() payload: CreateVideoJobDto,
    @GetCurrentUser() user: TCurrentUserType
  ) {
    const data = await this._videoGenerationService.createJob(payload, user);
    return { success: true, data };
  }

  @Get('jobs')
  @Permissions('ai.read')
  async listJobs(
    @GetCurrentUser() user: TCurrentUserType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('propertyId') propertyId?: string
  ) {
    const data = await this._videoGenerationService.listJobs(user, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      propertyId,
    });
    return { success: true, ...data };
  }

  @Get('jobs/:id')
  @Permissions('ai.read')
  async getJob(@Param('id') id: string, @GetCurrentUser() user: TCurrentUserType) {
    const data = await this._videoGenerationService.getJob(id, user);
    return { success: true, data };
  }

  @Post('jobs/:id/cancel')
  @Permissions('ai.write')
  async cancelJob(@Param('id') id: string, @GetCurrentUser() user: TCurrentUserType) {
    const data = await this._videoGenerationService.cancelJob(id, user);
    return { success: true, data };
  }

  @Post('jobs/:id/publish')
  @Permissions('ai.write')
  async publishJob(
    @Param('id') id: string,
    @Body() payload: PublishVideoJobDto,
    @GetCurrentUser() user: TCurrentUserType
  ) {
    try {
      const data = await this._videoGenerationService.publishJob(id, payload, user);
      return { success: true, data };
    } catch (error) {
      this._logger.error('Video publish failed', error instanceof Error ? error.stack : undefined);
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw error;
    }
  }
}
