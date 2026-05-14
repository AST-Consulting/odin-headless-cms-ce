import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model } from 'mongoose';

import { Article, TArticleDocument } from '@articles/schemas/article.schema';
import { TCurrentUserType } from '@auth/types/user.type';
import { MigratorService } from '../migrator.service';

export const RICH_BLOCKS_QUEUE = 'article-rich-blocks';

export interface RichBlocksJobData {
  articleId: string;
  user: TCurrentUserType;
}

@Processor(RICH_BLOCKS_QUEUE)
export class RichBlocksProcessor {
  private readonly logger = new Logger(RichBlocksProcessor.name);

  constructor(
    @InjectModel(Article.name) private readonly articleModel: Model<TArticleDocument>,
    private readonly migratorService: MigratorService
  ) {}

  @Process({ concurrency: 2 })
  async handleConvertRichBlocks(job: Job<RichBlocksJobData>) {
    const { articleId, user } = job.data;

    try {
      const article = await this.articleModel.findById(articleId).lean();
      if (!article) {
        this.logger.warn(
          `[RichBlocksProcessor] Article ${articleId} not found, skipping`,
          this.constructor.name
        );
        return;
      }

      const richBlocks = await this.migratorService.convertHtmlToRichBlocks(
        article.title,
        article.body,
        user,
        article
      );

      await this.articleModel.updateOne(
        { _id: articleId },
        { $set: { richBlocks } },
        { timestamps: false }
      );

      this.logger.log(
        `[RichBlocksProcessor] Converted article ${articleId} (${richBlocks.length} blocks)`,
        this.constructor.name
      );
    } catch (err) {
      this.logger.error(
        `[RichBlocksProcessor] Failed to convert article ${articleId}: ${err.message}`,
        err.stack,
        this.constructor.name
      );
      throw err; // rethrow so Bull retries the job
    }
  }
}
