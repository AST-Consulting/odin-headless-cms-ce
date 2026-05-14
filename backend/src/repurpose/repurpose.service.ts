import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { InstagramProvider } from 'src/integrations/providers/instagram.provider';
import { ArticlesService } from '@articles/articles.service';
import { AiService } from '@ai/ai.service';
import { AuditTrailService } from '@core/audit-trail/audit-trail.service';
import { QUEUE_CONSTANTS } from '@core/constants/redis.constants';
import { ACTIONS, ModuleName } from '@core/constants/enums.constants';
import { TCurrentUserType } from 'src/auth/types/user.type';
import {
  buildFullRepurposePrompt,
  buildSingleFormatPrompt,
} from './prompts/repurpose.prompts';
import {
  ImageBearingFormat,
  ImageSource,
  RepurposedArticle,
  RepurposeMeta,
  RepurposeOutputKey,
  SlotImage,
  TwitterTweet,
  WhatsappCard,
} from './interfaces/repurpose-output.types';
import { resolveImageSlot } from './lib/slot-resolver';
import { sanitizeText, sanitizeUrl } from './lib/sanitize-text';
import { GenerateImageJobData } from './repurpose.processor';
import {
  RepurposeJob,
  TRepurposeJobDocument,
} from './schemas/repurpose-job.schema';
import { IntegrationsService } from 'src/integrations/integrations.service';
import { XProvider } from 'src/integrations/providers/x.provider';
import { IntegrationProvider } from 'src/integrations/schemas/integration.schema';

interface ArticleSummary {
  title: string;
  excerpt?: string;
  body: string;
  language?: string;
  tags?: string[];
  categories?: string[];
}

interface ArticleContext extends ArticleSummary {
  organizationId: string;
  propertyId: string;
  featuredImageUrl?: string;
  previewUrl?: string;
}

export interface RepurposeConfig {
  instaSlideCount?: number;
  webStorySlideCount?: number;
  mirrorInstaToWebstory?: boolean;
}

const MAX_BODY_CHARS = 8000;
const IMAGE_JOB_TIMEOUT_MS = 90_000;
const IMAGE_JOB_POLL_INTERVAL_MS = 400;

@Injectable()
export class RepurposeService {
  constructor(
    @InjectModel(RepurposeJob.name)
    private readonly _jobModel: Model<TRepurposeJobDocument>,
    @InjectQueue(QUEUE_CONSTANTS.REPURPOSE_QUEUE)
    private readonly _imageQueue: Queue<GenerateImageJobData>,
    private readonly _aiService: AiService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    private readonly _articlesService: ArticlesService,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _integrationsService: IntegrationsService,
    private readonly _xProvider: XProvider,
    private readonly _instagramProvider: InstagramProvider,
  ) {}

  async repurposeArticle(
    articleId: string,
    user: TCurrentUserType,
    forceRegenerate = false,
    formats?: string[],
    config?: RepurposeConfig,
  ): Promise<{
    jobId: string;
    outputs: RepurposedArticle;
    meta: RepurposeMeta;
    config?: RepurposeConfig;
    cached: boolean;
  }> {
    const ctx = await this._loadArticleContext(articleId);
    this._assertScope(user, ctx);

    const articleHash = this._hashArticle(ctx);
    const meta = this._buildMeta(ctx);

    if (!forceRegenerate) {
      const existing = await this._jobModel
        .findOne({ articleId, articleHash, status: 'completed' })
        .sort({ createdAt: -1 })
        .exec();
      if (existing) {
        const outputs = existing.outputs as unknown as RepurposedArticle;
        const missingSome =
          formats &&
          formats.some((f) => {
            const val = outputs[f];
            if (!val) return true;
            if (Array.isArray(val)) return val.length === 0;
            if (typeof val === 'object') {
              if (f === 'whatsappCard') return !(val as any).text;
              if (f === 'newsletter') return !(val as any).subject;
              return Object.keys(val).length === 0;
            }
            return false;
          });

        if (!missingSome) {
          return {
            jobId: existing._id.toString(),
            outputs,
            meta,
            config: existing.config,
            cached: true,
          };
        }
      }
    }

    // If mirroring is on, we don't need to ask the AI for Web Story explicitly
    // as we will generate it from Instagram content.
    let effectiveFormats = formats;
    if (config?.mirrorInstaToWebstory) {
      if (!effectiveFormats) {
        // All formats requested — exclude webStory so the AI doesn't generate it
        effectiveFormats = ['instagramCarousel', 'whatsappCard', 'pushNotifications', 'newsletter', 'twitterThread'];
      } else if (effectiveFormats.includes('webStory')) {
        effectiveFormats = effectiveFormats.filter((f) => f !== 'webStory');
      }
    }

    const prompt = buildFullRepurposePrompt(ctx, effectiveFormats, config);
    const raw = await this._safeGenerate(prompt);
    const parsed = this._parseJsonObject(raw);
    const outputs = this._coerceFullOutput(parsed);

    // Apply mirroring if requested and webStory is a target format
    if (config?.mirrorInstaToWebstory && outputs.instagramCarousel?.length > 0 && (!formats || formats.includes("webStory"))) {
      outputs.webStory = outputs.instagramCarousel.map((card) => ({
        title: card.title,
        body: card.body,
        imagePrompt: card.visualSuggestion,
        image: card.image,
      }));
    }

    this._applyFeaturedImageDefaults(outputs, ctx.featuredImageUrl);

    const job = await this._jobModel.create({
      articleId,
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId,
      createdBy: {
        userId: user.sub,
        userName: user.name,
        email: user.email,
      },
      articleHash,
      articleTitle: sanitizeText(ctx.title),
      language: ctx.language,
      status: 'completed',
      outputs: outputs as unknown as Record<string, unknown>,
      config,
    });

    void this._auditTrailService
      .logAuditTrail({
        action: ACTIONS.CREATE,
        collectionName: ModuleName.REPURPOSE,
        user,
        objectId: job._id as unknown as Types.ObjectId,
        newData: { articleId, language: ctx.language } as unknown as Parameters<
          typeof this._auditTrailService.logAuditTrail
        >[0]['newData'],
      })
      .catch(() => undefined);

    this._logger.log(
      `[Repurpose] created jobId=${job._id.toString()} articleId=${articleId} userId=${user.sub} cached=false`,
    );

    // Auto-generate images for Instagram and Web Story by default
    this._enqueueAutoImageGeneration(
      job._id.toString(),
      outputs,
      user,
      config,
    );

    return {
      jobId: job._id.toString(),
      outputs,
      meta,
      config,
      cached: false,
    };
  }

  async regenerateOne(
    articleId: string,
    format: string,
    user: TCurrentUserType,
    config?: RepurposeConfig,
  ): Promise<{
    jobId: string;
    articleId: string;
    outputs: RepurposedArticle;
    meta: RepurposeMeta;
    config?: RepurposeConfig;
  }> {
    const ctx = await this._loadArticleContext(articleId);
    this._assertScope(user, ctx);

    const job = await this._jobModel
      .findOne({ articleId, organizationId: ctx.organizationId, status: 'completed' })
      .sort({ createdAt: -1 })
      .exec();
    if (!job) {
      throw new NotFoundException('No previous repurpose job found. Generate repurposed content first before regenerating a format.');
    }

    const prompt = buildSingleFormatPrompt(format, ctx, config);
    const raw = await this._safeGenerate(prompt);
    const parsed = this._parseJsonObject(raw);
    const partial = this._coercePartial(format as RepurposeOutputKey, parsed);

    // Mirror content if requested and regenerating Instagram
    if (format === 'instagramCarousel' && config?.mirrorInstaToWebstory) {
      const instaCards = partial.instagramCarousel || [];
      partial.webStory = instaCards.map((card) => ({
        title: card.title,
        body: card.body,
        imagePrompt: card.visualSuggestion,
        image: card.image,
      }));
    }

    const merged = {
      ...(job.outputs as unknown as RepurposedArticle),
      ...partial,
    };
    this._applyFeaturedImageDefaults(merged, ctx.featuredImageUrl);
    job.outputs = merged as unknown as Record<string, unknown>;
    job.markModified('outputs');
    job.articleHash = this._hashArticle(ctx);
    if (config) {
      job.config = { ...(job.config || {}), ...config };
    }
    await job.save();

    void this._auditTrailService
      .logAuditTrail({
        action: ACTIONS.UPDATE,
        collectionName: ModuleName.REPURPOSE,
        user,
        objectId: job._id as unknown as Types.ObjectId,
        newData: { format } as unknown as Parameters<
          typeof this._auditTrailService.logAuditTrail
        >[0]['newData'],
      })
      .catch(() => undefined);

    this._logger.log(
      `[Repurpose] regenerated jobId=${job._id.toString()} format=${format} userId=${user.sub}`,
    );

    // Auto-generate images for the regenerated format if it supports them
    this._enqueueAutoImageGeneration(
      job._id.toString(),
      merged,
      user,
      job.config,
      format,
    );

    return {
      jobId: job._id.toString(),
      articleId,
      outputs: merged,
      meta: this._buildMeta(ctx),
      config: job.config,
    };
  }

  async generateSlotImage(
    jobId: string,
    user: TCurrentUserType,
    format: ImageBearingFormat,
    index: number,
    source: ImageSource = 'generated',
  ): Promise<{
    jobId: string;
    outputs: RepurposedArticle;
    meta: RepurposeMeta;
    config?: RepurposeConfig;
    image: SlotImage;
  }> {
    const job = await this._jobModel.findById(jobId);
    if (!job) {
      throw new NotFoundException('Repurpose job not found');
    }

    const ctx = await this._loadArticleContext(job.articleId);
    this._assertScope(user, ctx);

    const outputs = job.outputs as unknown as RepurposedArticle;
    resolveImageSlot(outputs, format, index);

    if (source === 'featured' && !ctx.featuredImageUrl) {
      throw new BadRequestException(
        'Article has no featured image set. Pick or upload one in the editor first.',
      );
    }

    const queueJob = await this._imageQueue.add(
      QUEUE_CONSTANTS.GENERATE_REPURPOSE_IMAGE_JOB,
      {
        jobDocId: job._id.toString(),
        format,
        index,
        source,
        user,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );

    this._logger.log(
      `[Repurpose] image-gen enqueued queueJobId=${queueJob.id} repurposeJobId=${jobId} format=${format} index=${index} source=${source} userId=${user.sub}`,
    );

    const initialImage = readSlotImage(outputs, format, index);
    const initialTs = initialImage?.generatedAt;

    const updated = await this._awaitImageReady(
      jobId,
      format,
      index,
      queueJob.id as string,
      initialTs,
    );

    void this._auditTrailService
      .logAuditTrail({
        action: ACTIONS.UPLOAD,
        collectionName: ModuleName.REPURPOSE,
        user,
        objectId: job._id as unknown as Types.ObjectId,
        newData: { format, index, source } as unknown as Parameters<
          typeof this._auditTrailService.logAuditTrail
        >[0]['newData'],
      })
      .catch(() => undefined);

    return {
      jobId,
      outputs: updated.outputs,
      meta: this._buildMeta(ctx),
      config: job.config,
      image: updated.image,
    };
  }

  async updateOutputs(
    jobId: string,
    outputs: RepurposedArticle,
    user: TCurrentUserType,
  ): Promise<{ jobId: string; outputs: RepurposedArticle }> {
    const job = await this._jobModel.findById(jobId);
    if (!job) {
      throw new NotFoundException('Repurpose job not found');
    }

    if (!outputs || Object.keys(outputs).length === 0) {
      throw new BadRequestException('Empty outputs payload');
    }

    const ctx = await this._loadArticleContext(job.articleId);
    this._assertScope(user, ctx);

    // Validate and coerce the outputs to ensure it matches the full RepurposedArticle shape
    // this prevents corruption if the DTO sends partial or invalid shapes.
    const coerced = this._coerceFullOutput(
      outputs as unknown as Record<string, unknown>,
    );

    job.outputs = coerced as unknown as Record<string, unknown>;
    job.markModified('outputs');
    await job.save();

    this._logger.log(
      `[Repurpose] manually updated jobId=${jobId} userId=${user.sub}`,
    );

    return { jobId, outputs: coerced };
  }

  private async _awaitImageReady(
    jobDocId: string,
    format: ImageBearingFormat,
    index: number,
    queueJobId: string,
    initialTs?: string,
  ): Promise<{ outputs: RepurposedArticle; image: SlotImage }> {
    const start = Date.now();
    while (Date.now() - start < IMAGE_JOB_TIMEOUT_MS) {
      const queueJob = await this._imageQueue.getJob(queueJobId);
      if (queueJob) {
        const state = await queueJob.getState();
        if (state === 'failed') {
          const reason =
            queueJob.failedReason || 'Image generation worker failed.';
          throw new ServiceUnavailableException(reason);
        }
      }

      const fresh = await this._jobModel.findById(jobDocId).lean().exec();
      if (fresh) {
        const outputs = fresh.outputs as unknown as RepurposedArticle;
        const image = readSlotImage(outputs, format, index);
        if (image && image.generatedAt !== initialTs) {
          return { outputs, image };
        }
      }

      await sleep(IMAGE_JOB_POLL_INTERVAL_MS);
    }
    throw new GatewayTimeoutException(
      'Image generation timed out. Please retry.',
    );
  }

  async getLatestForArticle(
    articleId: string,
    user: TCurrentUserType,
  ): Promise<{
    jobId: string;
    outputs: RepurposedArticle;
    meta: RepurposeMeta;
    config?: RepurposeConfig;
    generatedAt: Date;
    isStale: boolean;
  } | null> {
    const ctx = await this._loadArticleContext(articleId);
    this._assertScope(user, ctx);

    const job = await this._jobModel
      .findOne({ articleId, organizationId: ctx.organizationId, status: 'completed' })
      .sort({ createdAt: -1 })
      .exec();
    if (!job) return null;

    const currentHash = this._hashArticle(ctx);
    const outputs = this._coerceFullOutput(
      job.outputs as Record<string, unknown>,
    );

    return {
      jobId: job._id.toString(),
      outputs,
      meta: this._buildMeta(ctx),
      config: job.config,
      generatedAt: (job as unknown as { createdAt: Date }).createdAt,
      isStale: job.articleHash !== currentHash,
    };
  }

  async listJobs(
    user: TCurrentUserType,
    page = 1,
    limit = 20,
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
    if (!user.organizationId) {
      throw new BadRequestException('Missing organization context');
    }
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safePage = Math.max(page, 1);
    const filter: Record<string, string> = {
      organizationId: user.organizationId,
      status: 'completed',
    };
    if (user.propertyId) {
      filter.propertyId = user.propertyId;
    }
    const [docs, total] = await Promise.all([
      this._jobModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
        .exec(),
      this._jobModel.countDocuments(filter).exec(),
    ]);

    const data = docs.map((doc) => ({
      jobId: (doc._id as { toString(): string }).toString(),
      articleId: doc.articleId,
      articleTitle: doc.articleTitle,
      language: doc.language,
      generatedAt: (doc as unknown as { createdAt: Date }).createdAt,
      formatsCount: doc.outputs ? Object.keys(doc.outputs).length : 0,
    }));

    return { data, total, page: safePage, limit: safeLimit };
  }

  async shareToTwitter(
    jobId: string,
    user: TCurrentUserType,
  ): Promise<{ success: boolean; tweetUrl: string }> {
    const job = await this._jobModel.findById(jobId).exec();
    if (!job || job.status !== 'completed') {
      throw new NotFoundException('Repurpose job not found or not completed');
    }

    const ctx = await this._loadArticleContext(job.articleId);
    this._assertScope(user, ctx);

    const outputs = job.outputs as unknown as RepurposedArticle;
    const thread = outputs.twitterThread;

    if (!thread || thread.length === 0) {
      throw new BadRequestException('No Twitter thread found in this job');
    }

    // Get Twitter integration for the property
    const integration = await this._integrationsService.getIntegrationWithCredentials(
      job.propertyId,
      IntegrationProvider.TWITTER,
    );

    this._logger.log(
      `[Repurpose] sharing to twitter jobId=${jobId} propertyId=${job.propertyId} userId=${user.sub}`,
    );

    try {
      const tweetsToPost: { text: string; mediaIds?: string[] }[] = [];

      for (const tweet of thread) {
        let mediaIds: string[] = [];
        if (tweet.image?.imageUrl) {
          try {
            const mediaId = await this._xProvider.uploadMediaFromUrl(
              integration.credentials.accessToken,
              tweet.image.imageUrl,
            );
            mediaIds = [mediaId];
          } catch (uploadError) {
            this._logger.warn(
              `[Repurpose] failed to upload image for tweet ${tweet.index}: ${uploadError.message}`,
            );
          }
        }
        tweetsToPost.push({ text: tweet.text, mediaIds });
      }

      const response = await this._xProvider.postThread(
        integration.credentials.accessToken,
        tweetsToPost,
      );

      // The response from twitter-api-v2 for tweetThread usually contains an array of results
      // We'll extract the URL of the first tweet in the thread
      const res = response as any;
      const firstTweetResult = Array.isArray(res) ? res[0] : res;
      const rawFirstTweetId =
        firstTweetResult?.data?.id ??
        firstTweetResult?.id ??
        (Array.isArray(res?.data) ? res.data[0]?.id : undefined);

      const firstTweetId =
        typeof rawFirstTweetId === 'string' ||
        typeof rawFirstTweetId === 'number' ||
        typeof rawFirstTweetId === 'bigint'
          ? String(rawFirstTweetId).trim()
          : '';

      if (!firstTweetId) {
        this._logger.error(
          `[Repurpose] X thread post response did not include a valid tweet id`,
        );
        throw new ServiceUnavailableException(
          'Unable to determine the first tweet ID from the X provider response',
        );
      }

      const tweetUrl = `https://twitter.com/i/status/${firstTweetId}`;

      void this._auditTrailService
        .logAuditTrail({
          action: ACTIONS.SHARE,
          collectionName: ModuleName.REPURPOSE,
          user,
          objectId: job._id as unknown as Types.ObjectId,
          newData: { platform: 'twitter', tweetId: firstTweetId } as unknown as Parameters<
            typeof this._auditTrailService.logAuditTrail
          >[0]['newData'],
        })
        .catch(() => undefined);

      return { success: true, tweetUrl };
    } catch (error) {
      this._logger.error(
        `[Repurpose] Twitter share failed: ${error.message}`,
        error.stack,
      );

      // Handle specific Twitter API errors
      const twitterData = (error as any).data;
      if (twitterData?.title === 'CreditsDepleted') {
        throw new BadRequestException(
          'Your Twitter API credit limit has been reached. Please check your X (Twitter) Developer Portal plan or wait for the reset.',
        );
      }

      throw new BadRequestException(`Failed to post to Twitter: ${error.message}`);
    }
  }

  async shareSingleTweetToTwitter(
    jobId: string,
    index: number,
    user: TCurrentUserType,
  ): Promise<{ success: boolean; tweetUrl: string }> {
    const job = await this._jobModel.findById(jobId).exec();
    if (!job || job.status !== 'completed') {
      throw new NotFoundException('Repurpose job not found or not completed');
    }

    const ctx = await this._loadArticleContext(job.articleId);
    this._assertScope(user, ctx);

    const outputs = job.outputs as unknown as RepurposedArticle;
    const tweet = outputs.twitterThread?.[index];

    if (!tweet) {
      throw new BadRequestException(
        `Tweet at index ${index} not found in this job`,
      );
    }

    // Get Twitter integration for the property
    const integration =
      await this._integrationsService.getIntegrationWithCredentials(
        job.propertyId,
        IntegrationProvider.TWITTER,
      );

    this._logger.log(
      `[Repurpose] sharing single tweet to twitter jobId=${jobId} index=${index} propertyId=${job.propertyId} userId=${user.sub}`,
    );

    try {
      let mediaIds: string[] = [];
      if (tweet.image?.imageUrl) {
        try {
          const mediaId = await this._xProvider.uploadMediaFromUrl(
            integration.credentials.accessToken,
            tweet.image.imageUrl,
          );
          mediaIds = [mediaId];
        } catch (uploadError) {
          this._logger.warn(
            `[Repurpose] failed to upload image for single tweet share: ${uploadError.message}`,
          );
        }
      }

      const response = await this._xProvider.postTweet(
        integration.credentials.accessToken,
        tweet.text,
        mediaIds,
      );

      const res = response as any;
      const tweetResult = Array.isArray(res) ? res[0] : res;
      const rawTweetId =
        tweetResult?.data?.id ??
        tweetResult?.id ??
        (Array.isArray(res?.data) ? res.data[0]?.id : undefined);

      const tweetId =
        typeof rawTweetId === 'string' ||
        typeof rawTweetId === 'number' ||
        typeof rawTweetId === 'bigint'
          ? String(rawTweetId).trim()
          : '';

      if (!tweetId) {
        this._logger.error(
          `[Repurpose] X single post response did not include a valid tweet id`,
        );
        throw new ServiceUnavailableException(
          'Unable to determine the tweet ID from the X provider response',
        );
      }

      const tweetUrl = `https://twitter.com/i/status/${tweetId}`;

      void this._auditTrailService
        .logAuditTrail({
          action: ACTIONS.SHARE,
          collectionName: ModuleName.REPURPOSE,
          user,
          objectId: job._id as unknown as Types.ObjectId,
          newData: {
            platform: 'twitter',
            tweetId,
            isSingle: true,
            tweetIndex: index,
          } as unknown as Parameters<
            typeof this._auditTrailService.logAuditTrail
          >[0]['newData'],
        })
        .catch(() => undefined);

      return { success: true, tweetUrl };
    } catch (error) {
      this._logger.error(
        `[Repurpose] Twitter single share failed: ${error.message}`,
        error.stack,
      );

      const twitterData = (error as any).data;
      if (twitterData?.title === 'CreditsDepleted') {
        throw new BadRequestException(
          'Your Twitter API credit limit has been reached. Please check your X (Twitter) Developer Portal plan or wait for the reset.',
        );
      }

      throw new BadRequestException(
        `Failed to post tweet to Twitter: ${error.message}`,
      );
    }
  }

  async shareCarouselToInstagram(
    jobId: string,
    user: TCurrentUserType,
  ): Promise<{ success: boolean; postId: string }> {
    const job = await this._jobModel.findById(jobId).exec();
    if (!job) throw new NotFoundException('Repurpose job not found');

    const ctx = await this._loadArticleContext(job.articleId);
    this._assertScope(user, ctx);

    const outputs = job.outputs as unknown as RepurposedArticle;
    const cards = outputs.instagramCarousel || [];

    if (cards.length === 0) {
      throw new BadRequestException('No Instagram carousel content found');
    }

    // Extract image URLs
    const mediaUrls = cards
      .map((card) => card.image?.imageUrl)
      .filter((url): url is string => !!url);

    if (mediaUrls.length === 0) {
      throw new BadRequestException(
        'No images generated for the carousel yet. Please generate them first.',
      );
    }

    // Get Instagram integration
    const integration =
      await this._integrationsService.getIntegrationWithCredentials(
        ctx.propertyId,
        IntegrationProvider.INSTAGRAM,
      );

    const { igAccountId, pageAccessToken } = integration.metadata || {};
    if (!igAccountId || !pageAccessToken) {
      throw new BadRequestException(
        'Instagram account not fully configured. Please select an account in Integrations.',
      );
    }

    this._logger.log(
      `[Repurpose] sharing carousel to instagram jobId=${jobId} propertyId=${ctx.propertyId} userId=${user.sub}`,
    );

    // Instagram carousel needs a caption.
    const caption = `${ctx.title}\n\n${cards.map((c) => c.title).join('\n')}`;

    try {
      const response = await this._instagramProvider.publishCarousel(
        igAccountId,
        pageAccessToken,
        mediaUrls,
        caption,
      );

      void this._auditTrailService
        .logAuditTrail({
          action: ACTIONS.SHARE,
          collectionName: ModuleName.REPURPOSE,
          user,
          objectId: job._id,
          newData: {
            platform: 'instagram',
            postId: response.postId,
            type: 'carousel',
          } as any,
        })
        .catch(() => undefined);

      return response;
    } catch (error) {
      this._logger.error(
        `[Repurpose] Instagram carousel share failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to post carousel to Instagram: ${error.message}`,
      );
    }
  }

  async shareRawTwitter(
    text: string,
    propertyId: string,
    user: TCurrentUserType,
  ): Promise<{ success: boolean; tweetUrl: string }> {
    if (!text || text.trim().length === 0) {
      throw new BadRequestException('Text cannot be empty');
    }

    // Get Twitter integration for the property
    const integration =
      await this._integrationsService.getIntegrationWithCredentials(
        propertyId,
        IntegrationProvider.TWITTER,
      );

    this._logger.log(
      `[Repurpose] sharing raw text to twitter propertyId=${propertyId} userId=${user.sub}`,
    );

    try {
      const response = await this._xProvider.postTweet(
        integration.credentials.accessToken,
        text,
        [],
      );

      const res = response as any;
      const tweetResult = Array.isArray(res) ? res[0] : res;
      const rawTweetId =
        tweetResult?.data?.id ??
        tweetResult?.id ??
        (Array.isArray(res?.data) ? res.data[0]?.id : undefined);

      const tweetId =
        typeof rawTweetId === 'string' ||
        typeof rawTweetId === 'number' ||
        typeof rawTweetId === 'bigint'
          ? String(rawTweetId).trim()
          : '';

      if (!tweetId) {
        this._logger.error(
          `[Repurpose] X raw post response did not include a valid tweet id`,
        );
        throw new ServiceUnavailableException(
          'Unable to determine the tweet ID from the X provider response',
        );
      }

      const tweetUrl = `https://twitter.com/i/status/${tweetId}`;

      void this._auditTrailService
        .logAuditTrail({
          action: ACTIONS.SHARE,
          collectionName: ModuleName.REPURPOSE,
          user,
          objectId: undefined, // No specific job object
          newData: {
            platform: 'twitter',
            tweetId,
            isRaw: true,
          } as unknown as Parameters<
            typeof this._auditTrailService.logAuditTrail
          >[0]['newData'],
        })
        .catch(() => undefined);

      return { success: true, tweetUrl };
    } catch (error) {
      this._logger.error(
        `[Repurpose] Twitter raw share failed: ${error.message}`,
        error.stack,
      );

      const twitterData = (error as any).data;
      if (twitterData?.title === 'CreditsDepleted') {
        throw new BadRequestException(
          'Your Twitter API credit limit has been reached. Please check your X (Twitter) Developer Portal plan or wait for the reset.',
        );
      }

      throw new BadRequestException(
        `Failed to post tweet to Twitter: ${error.message}`,
      );
    }
  }

  private _assertScope(user: TCurrentUserType, ctx: ArticleContext): void {
    if (!user.organizationId || user.organizationId !== ctx.organizationId) {
      throw new ForbiddenException(
        'You do not have access to this article in this organization',
      );
    }
    if (user.propertyId && user.propertyId !== ctx.propertyId) {
      throw new ForbiddenException(
        'You do not have access to this article in this property',
      );
    }
  }

  private _hashArticle(ctx: ArticleSummary): string {
    const seed = `${ctx.title || ''}::${ctx.language || ''}::${ctx.body}`;
    return createHash('sha1').update(seed).digest('hex');
  }

  private _applyFeaturedImageDefaults(
    outputs: RepurposedArticle,
    featuredImageUrl?: string,
  ): void {
    const safeUrl = sanitizeUrl(featuredImageUrl);
    if (!safeUrl) return;
    const slotImage: SlotImage = {
      imageUrl: safeUrl,
      imageId: '',
      generatedAt: new Date().toISOString(),
    };
    if (outputs.whatsappCard && !outputs.whatsappCard.image) {
      outputs.whatsappCard = { ...outputs.whatsappCard, image: slotImage };
    }
    if (
      Array.isArray(outputs.twitterThread) &&
      outputs.twitterThread.length > 0 &&
      !outputs.twitterThread[0].image
    ) {
      const tweets = [...outputs.twitterThread];
      tweets[0] = { ...tweets[0], image: slotImage };
      outputs.twitterThread = tweets;
    }
  }

  private async _safeGenerate(prompt: string): Promise<string> {
    try {
      const response = await this._aiService.generateText(prompt);
      if (!response || typeof response !== 'string') {
        throw new Error('Empty AI response');
      }
      return response;
    } catch (error) {
      const message = (error as Error)?.message || 'AI provider failed';
      this._logger.error(
        `[Repurpose] AI generation failed: ${message}`,
        undefined,
        RepurposeService.name,
      );
      throw new ServiceUnavailableException(
        'Could not generate repurposed content right now. Please retry.',
      );
    }
  }

  private async _loadArticleContext(articleId: string): Promise<ArticleContext> {
    const article = await this._articlesService.getById(articleId);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const body = this._extractPlainText(article);
    if (!body || body.trim().length < 50) {
      throw new BadRequestException(
        'Article does not have enough body text to repurpose.',
      );
    }

    const orgId =
      (article as { organization?: { id?: string } }).organization?.id || '';
    const propertyId =
      (article as { property?: { id?: string } }).property?.id || '';
    if (!orgId || !propertyId) {
      throw new BadRequestException(
        'Article is missing organization or property context',
      );
    }

    const featuredImageUrl =
      (article as { featuredMedia?: { url?: string } }).featuredMedia?.url ||
      undefined;
    const previewUrl = this._buildPreviewUrl(article);

    return {
      organizationId: orgId,
      propertyId,
      title: article.title || article.englishHeadline || 'Untitled',
      excerpt: article.excerpt || undefined,
      body: body.slice(0, MAX_BODY_CHARS),
      language: article.lang || undefined,
      tags: article.tags?.map((t: { name: string }) => t.name).filter(Boolean),
      categories: article.categories
        ?.map((c: { title: string }) => c.title)
        .filter(Boolean),
      featuredImageUrl,
      previewUrl,
    };
  }

  private _buildPreviewUrl(article: {
    slug?: string;
    primaryCategory?: { slug?: string };
    property?: { domain?: string };
  }): string | undefined {
    const slug = article?.slug;
    const domain = article?.property?.domain;
    if (!slug || !domain) return undefined;
    const protocol = domain.startsWith('localhost') ? 'http' : 'https';
    const base = domain.startsWith('http') ? domain : `${protocol}://${domain}`;
    const categorySlug = article?.primaryCategory?.slug;
    const path = categorySlug ? `/${categorySlug}/${slug}` : `/${slug}`;
    return `${base}${path}`;
  }

  private _buildMeta(ctx: ArticleContext): RepurposeMeta {
    const meta: RepurposeMeta = {};
    if (ctx.featuredImageUrl) meta.featuredImageUrl = ctx.featuredImageUrl;
    if (ctx.previewUrl) meta.previewUrl = ctx.previewUrl;
    return meta;
  }

  private _extractPlainText(article: {
    body?: string;
    richBlocks?: Array<{
      type?: string;
      content?: unknown;
      metadata?: { children?: unknown[] };
    }>;
  }): string {
    const parts: string[] = [];

    if (Array.isArray(article.richBlocks) && article.richBlocks.length > 0) {
      this._collectBlockText(article.richBlocks, parts);
    }

    if (parts.length === 0 && article.body) {
      parts.push(this._stripHtml(article.body));
    }

    return parts.filter((p) => p && p.trim().length > 0).join('\n\n');
  }

  private _collectBlockText(blocks: unknown[], out: string[]): void {
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      const b = block as {
        type?: string;
        content?: unknown;
        metadata?: { children?: unknown[] };
      };
      const text = this._textFromContent(b.content);
      if (text) out.push(text);
      if (b.metadata && Array.isArray(b.metadata.children)) {
        this._collectBlockText(b.metadata.children, out);
      }
    }
  }

  private _textFromContent(content: unknown): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'text' in item) {
            const t = (item as { text?: unknown }).text;
            return typeof t === 'string' ? t : '';
          }
          return '';
        })
        .join('');
    }
    if (typeof content === 'object' && 'text' in (content as object)) {
      const t = (content as { text?: unknown }).text;
      return typeof t === 'string' ? t : '';
    }
    return '';
  }

  private _stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private _parseJsonObject(raw: string): Record<string, unknown> {
    const cleaned = this._stripCodeFences(raw);
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const candidate =
      start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSON root is not an object');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      this._logger.error(
        `[Repurpose] Failed to parse AI JSON: ${(error as Error).message}`,
        undefined,
        RepurposeService.name,
      );
      throw new ServiceUnavailableException(
        'AI returned invalid JSON. Please retry.',
      );
    }
  }

  private _stripCodeFences(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('```')) {
      return trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
    }
    return trimmed;
  }

  private _coerceFullOutput(
    parsed: Record<string, unknown>,
  ): RepurposedArticle {
    return {
      webStory: this._asArray(parsed.webStory).map((slide) => ({
        title: sanitizeText(slide?.title),
        body: sanitizeText(slide?.body),
        imagePrompt: sanitizeText(slide?.imagePrompt),
        image: this._coerceSlotImage(slide?.image),
      })),
      instagramCarousel: this._asArray(parsed.instagramCarousel).map(
        (card) => ({
          title: sanitizeText(card?.title),
          body: sanitizeText(card?.body),
          visualSuggestion: sanitizeText(card?.visualSuggestion),
          image: this._coerceSlotImage(card?.image),
        }),
      ),
      whatsappCard: this._coerceWhatsappCard(parsed.whatsappCard),
      pushNotifications: this._asArray(parsed.pushNotifications).map(
        (variant) => ({
          label: sanitizeText(variant?.label),
          headline: sanitizeText(variant?.headline),
          body: sanitizeText(variant?.body),
        }),
      ),
      newsletter: {
        subject: sanitizeText(
          (parsed.newsletter as Record<string, unknown>)?.subject,
        ),
        preview: sanitizeText(
          (parsed.newsletter as Record<string, unknown>)?.preview,
        ),
        body: sanitizeText(
          (parsed.newsletter as Record<string, unknown>)?.body,
        ),
      },
      twitterThread: this._asArray(parsed.twitterThread).map((tweet, idx) => {
        const tweetData: TwitterTweet = {
          index:
            typeof tweet?.index === 'number' && tweet.index > 0
              ? (tweet.index as number)
              : idx + 1,
          text: sanitizeText(tweet?.text),
        };
        const promptValue = sanitizeText(tweet?.imagePrompt);
        if (promptValue) tweetData.imagePrompt = promptValue;
        const image = this._coerceSlotImage(tweet?.image);
        if (image) tweetData.image = image;
        return tweetData;
      }),
    };
  }

  private _coerceWhatsappCard(value: unknown): WhatsappCard {
    if (typeof value === 'string') {
      return { text: sanitizeText(value) };
    }
    if (!value || typeof value !== 'object') {
      return { text: '' };
    }
    const obj = value as Record<string, unknown>;
    const card: WhatsappCard = { text: sanitizeText(obj.text) };
    const imagePrompt = sanitizeText(obj.imagePrompt);
    if (imagePrompt) card.imagePrompt = imagePrompt;
    const previewLink = sanitizeUrl(obj.previewLink);
    if (previewLink) card.previewLink = previewLink;
    const previewTitle = sanitizeText(obj.previewTitle);
    if (previewTitle) card.previewTitle = previewTitle;
    const previewDescription = sanitizeText(obj.previewDescription);
    if (previewDescription) card.previewDescription = previewDescription;
    const image = this._coerceSlotImage(obj.image);
    if (image) card.image = image;
    return card;
  }

  private _coerceSlotImage(value: unknown): SlotImage | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const obj = value as Record<string, unknown>;
    const url = sanitizeUrl(obj.imageUrl);
    if (!url) return undefined;
    return {
      imageUrl: url,
      imageId: this._asString(obj.imageId),
      generatedAt: this._asString(obj.generatedAt) || new Date().toISOString(),
    };
  }

  private _coercePartial(
    format: RepurposeOutputKey,
    parsed: Record<string, unknown>,
  ): Partial<RepurposedArticle> {
    const fullShape = this._coerceFullOutput({
      ...parsed,
      webStory: parsed.webStory ?? [],
      instagramCarousel: parsed.instagramCarousel ?? [],
      whatsappCard: parsed.whatsappCard ?? { text: '' },
      pushNotifications: parsed.pushNotifications ?? [],
      newsletter: parsed.newsletter ?? {},
      twitterThread: parsed.twitterThread ?? [],
    });
    return { [format]: fullShape[format] };
  }

  private _asString(value: unknown): string {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }

  private _asArray(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    );
  }

  /**
   * Enqueues image generation jobs for Instagram Carousel and Web Stories
   * if they have content but no images yet.
   */
  private _enqueueAutoImageGeneration(
    jobId: string,
    outputs: RepurposedArticle,
    user: TCurrentUserType,
    config?: { mirrorInstaToWebstory?: boolean },
    specificFormat?: string,
  ): void {
    const formatsToGen: ImageBearingFormat[] = [];

    const checkInsta = !specificFormat || specificFormat === 'instagramCarousel';
    const checkWebStory = !specificFormat || specificFormat === 'webStory';

    if (checkInsta && outputs.instagramCarousel?.length > 0) {
      formatsToGen.push('instagramCarousel');
    }

    // Only enqueue webStory specifically if it's NOT mirrored.
    // If it is mirrored, the processor will sync images from instagramCarousel.
    if (
      checkWebStory &&
      outputs.webStory?.length > 0 &&
      !config?.mirrorInstaToWebstory
    ) {
      formatsToGen.push('webStory');
    }

    for (const format of formatsToGen) {
      const slots =
        format === 'webStory'
          ? outputs.webStory
          : format === 'instagramCarousel'
            ? outputs.instagramCarousel
            : [];

      if (!slots || slots.length === 0) continue;

      this._logger.log(
        `[Repurpose] auto-enqueuing ${slots.length} image jobs for ${format} (jobId=${jobId})`,
      );

      slots.forEach((slot, index) => {
        // Skip if image already exists
        if (slot.image?.imageUrl) return;

        this._imageQueue
          .add(
            QUEUE_CONSTANTS.GENERATE_REPURPOSE_IMAGE_JOB,
            {
              jobDocId: jobId,
              format,
              index,
              source: 'generated',
              user,
            },
            {
              attempts: 2,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: true,
              removeOnFail: 1000,
            },
          )
          .catch((err) =>
            this._logger.error(
              `[Repurpose] auto-image-gen failed to enqueue for ${format}[${index}]: ${err.message}`,
            ),
          );
      });
    }
  }
}

function readSlotImage(
  outputs: RepurposedArticle,
  format: ImageBearingFormat,
  index: number,
): SlotImage | undefined {
  if (format === 'webStory') return outputs.webStory?.[index]?.image;
  if (format === 'instagramCarousel')
    return outputs.instagramCarousel?.[index]?.image;
  if (format === 'whatsapp') return outputs.whatsappCard?.image;
  if (format === 'twitterHero') return outputs.twitterThread?.[0]?.image;
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
