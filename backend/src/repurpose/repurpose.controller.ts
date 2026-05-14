import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GetCurrentUser } from 'src/auth/common/decorators/get-current-user.decorator';
import { Permissions } from 'src/auth/common/decorators/permissions.decorator';
import { TCurrentUserType } from 'src/auth/types/user.type';
import {
  GenerateSlotImageDto,
  ListRepurposeJobsQueryDto,
  RegenerateRepurposeDto,
  RepurposeArticleDto,
  ShareRawTwitterDto,
  UpdateRepurposeOutputsDto,
} from './dto/repurpose.dto';
import {
  RepurposedArticle,
  RepurposeMeta,
  SlotImage,
} from './interfaces/repurpose-output.types';
import { RepurposeService } from './repurpose.service';

@Controller('repurpose')
export class RepurposeController {
  constructor(private readonly _service: RepurposeService) { }

  @Post('article/:id')
  @Permissions('repurpose.write')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async repurposeArticle(
    @Param('id') id: string,
    @Body() dto: RepurposeArticleDto,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{
    jobId: string;
    articleId: string;
    outputs: RepurposedArticle;
    meta: RepurposeMeta;
    cached: boolean;
  }> {
    const result = await this._service.repurposeArticle(
      id,
      user,
      Boolean(dto.forceRegenerate),
      dto.formats,
      dto.config,
    );
    return {
      jobId: result.jobId,
      articleId: id,
      outputs: result.outputs,
      meta: result.meta,
      cached: result.cached,
    };
  }

  @Post('article/:id/regenerate')
  @Permissions('repurpose.write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async regenerateOne(
    @Param('id') id: string,
    @Body() dto: RegenerateRepurposeDto,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{
    jobId: string;
    articleId: string;
    outputs: RepurposedArticle;
    meta: RepurposeMeta;
  }> {
    const result = await this._service.regenerateOne(id, dto.format, user, dto.config);
    return {
      jobId: result.jobId,
      articleId: id,
      outputs: result.outputs,
      meta: result.meta,
    };
  }

  @Get('article/:id/latest')
  @Permissions('repurpose.read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getLatest(
    @Param('id') id: string,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{
    jobId: string;
    articleId: string;
    outputs: RepurposedArticle;
    meta: RepurposeMeta;
    generatedAt: string;
    isStale: boolean;
  } | null> {
    const result = await this._service.getLatestForArticle(id, user);
    if (!result) return null;
    return {
      jobId: result.jobId,
      articleId: id,
      outputs: result.outputs,
      meta: result.meta,
      generatedAt: result.generatedAt.toISOString(),
      isStale: result.isStale,
    };
  }

  @Post('jobs/:jobId/image')
  @Permissions('repurpose.write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async generateSlotImage(
    @Param('jobId') jobId: string,
    @Body() dto: GenerateSlotImageDto,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{
    jobId: string;
    image: SlotImage;
    outputs: RepurposedArticle;
    meta: RepurposeMeta;
  }> {
    return this._service.generateSlotImage(
      jobId,
      user,
      dto.format,
      dto.index,
      dto.source,
    );
  }

  @Post('jobs/:jobId')
  @Permissions('repurpose.write')
  async updateOutputs(
    @Param('jobId') jobId: string,
    @Body() dto: UpdateRepurposeOutputsDto,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{ jobId: string; outputs: RepurposedArticle }> {
    return this._service.updateOutputs(jobId, dto.outputs, user);
  }

  @Get('jobs')
  @Permissions('repurpose.read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listJobs(
    @Query() query: ListRepurposeJobsQueryDto,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{
    data: Array<{
      jobId: string;
      articleId: string;
      articleTitle?: string;
      language?: string;
      generatedAt: Date;
      formatsCount: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    return this._service.listJobs(user, query.page, query.limit);
  }

  @Post('jobs/:jobId/share/twitter')
  @Permissions('repurpose.write')
  async shareToTwitter(
    @Param('jobId') jobId: string,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{ success: boolean; tweetUrl: string }> {
    return this._service.shareToTwitter(jobId, user);
  }

  @Post('jobs/:jobId/share/twitter/:index')
  @Permissions('repurpose.write')
  async shareSingleTweetToTwitter(
    @Param('jobId') jobId: string,
    @Param('index', ParseIntPipe) index: number,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{ success: boolean; tweetUrl: string }> {
    return this._service.shareSingleTweetToTwitter(jobId, index, user);
  }

  @Post('share/twitter/raw')
  @Permissions('repurpose.write')
  async shareRawTwitter(
    @Body() dto: ShareRawTwitterDto,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{ success: boolean; tweetUrl: string }> {
    return this._service.shareRawTwitter(dto.text, dto.propertyId, user);
  }

  @Post('jobs/:jobId/share/instagram/carousel')
  @Permissions('repurpose.write')
  async shareCarouselToInstagram(
    @Param('jobId') jobId: string,
    @GetCurrentUser() user: TCurrentUserType,
  ): Promise<{ success: boolean; postId: string }> {
    return this._service.shareCarouselToInstagram(jobId, user);
  }
}
