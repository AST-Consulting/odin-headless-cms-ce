import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ArticlesService } from '@articles/articles.service';
import { ImageGenerationService } from '@utilities/image-generation/image-generation.service';
import { QUEUE_CONSTANTS } from '@core/constants/redis.constants';
import { TCurrentUserType } from 'src/auth/types/user.type';
import {
  ImageBearingFormat,
  ImageSource,
  RepurposedArticle,
  SlotImage,
} from './interfaces/repurpose-output.types';
import {
  resolveImageSlot,
} from './lib/slot-resolver';
import {
  RepurposeJob,
  TRepurposeJobDocument,
} from './schemas/repurpose-job.schema';

interface GenerateImageJobData {
  jobDocId: string;
  format: ImageBearingFormat;
  index: number;
  source: ImageSource;
  user: TCurrentUserType;
}

interface GenerateImageJobResult {
  image: SlotImage;
}

@Injectable()
@Processor(QUEUE_CONSTANTS.REPURPOSE_QUEUE, { concurrency: 2 })
export class RepurposeProcessor extends WorkerHost {
  constructor(
    @InjectModel(RepurposeJob.name)
    private readonly _jobModel: Model<TRepurposeJobDocument>,
    private readonly _articlesService: ArticlesService,
    private readonly _imageService: ImageGenerationService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
  ) {
    super();
  }

  async process(job: Job<GenerateImageJobData>): Promise<GenerateImageJobResult> {
    if (job.name !== QUEUE_CONSTANTS.GENERATE_REPURPOSE_IMAGE_JOB) {
      throw new Error(`Unknown job name: ${job.name}`);
    }
    return this._handleGenerateImage(job);
  }

  private async _handleGenerateImage(
    job: Job<GenerateImageJobData>,
  ): Promise<GenerateImageJobResult> {
    const { jobDocId, format, index, source, user } = job.data;
    const start = Date.now();

    const repurposeJob = await this._jobModel.findById(jobDocId);
    if (!repurposeJob) {
      throw new Error(`RepurposeJob ${jobDocId} not found`);
    }

    const outputs = repurposeJob.outputs as unknown as RepurposedArticle;
    const slot = resolveImageSlot(outputs, format, index);

    let slotImage: SlotImage;

    if (source === 'featured') {
      const article = await this._articlesService.getById(repurposeJob.articleId);
      const featuredUrl = (article as { featuredMedia?: { url?: string } })
        ?.featuredMedia?.url;
      if (!featuredUrl) {
        throw new Error('Article has no featured image to attach.');
      }
      slotImage = {
        imageUrl: featuredUrl,
        imageId: '',
        generatedAt: new Date().toISOString(),
      };
    } else {
      const fullPrompt = `${slot.title}. ${slot.promptSeed}`;
      const result = await this._imageService.generateOrReuseImage(
        {
          prompt: fullPrompt,
          aspectRatio: slot.aspectRatio,
          propertyId: repurposeJob.propertyId,
          title: slot.title,
        },
        user,
      );
      if (!result?.data?.url) {
        throw new Error('Image generation returned no URL.');
      }
      slotImage = {
        imageUrl: result.data.url,
        imageId: result.data._id,
        generatedAt: new Date().toISOString(),
      };
    }

    const updates: Record<string, any> = {};
    const mainPath =
      format === 'webStory'
        ? `outputs.webStory.${index}.image`
        : format === 'instagramCarousel'
          ? `outputs.instagramCarousel.${index}.image`
          : format === 'whatsapp'
            ? 'outputs.whatsappCard.image'
            : 'outputs.twitterThread.0.image';

    updates[mainPath] = slotImage;

    // Handle mirroring in the atomic update — only if the target slot exists
    if (repurposeJob.config?.mirrorInstaToWebstory) {
      if (format === 'instagramCarousel' && repurposeJob.outputs?.webStory?.[index]) {
        updates[`outputs.webStory.${index}.image`] = slotImage;
      } else if (format === 'webStory' && repurposeJob.outputs?.instagramCarousel?.[index]) {
        updates[`outputs.instagramCarousel.${index}.image`] = slotImage;
      }
    }

    await this._jobModel.updateOne({ _id: jobDocId }, { $set: updates });

    this._logger.log(
      `[Repurpose.processor] image attached (atomic) jobDocId=${jobDocId} format=${format} index=${index} source=${source} durationMs=${Date.now() - start}`,
    );

    return { image: slotImage };
  }
}

export type { GenerateImageJobData };
