import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as http from 'http';
import axios from 'axios';
import {
  MigratorProvider,
  MIGRATOR_PROVIDER,
  MigrationResult,
} from './migrator-provider.interface';
import { TCurrentUserType } from '@auth/types/user.type';
import { Tag, TTagDocument } from '@tags/entities/tags.schema';
import { Category, TCategoryDocument } from '../category/entities/category.schema';
import { User, TUserDocument } from '@user/entities/user.schema';
import { RedisService } from '@utilities/redis/redis.service';
import { Article, TArticleDocument } from '@articles/schemas/article.schema';
import { FileUploadService } from '@utilities/file-upload/fileUpload.service';
import { FileUpload, TFileUploadDocument } from '@utilities/file-upload/entities/fileUpload.schema';
import { ArticleRichBlocksService } from '@articles/article-rich-blocks/article-rich-blocks.service';
import { ElasticService } from '@core/elastic/elastic.service';
import { ModuleName } from '@core/constants/enums.constants';
import { Types } from 'mongoose';
import { YouTubeProvider, YouTubeMigrationOptions } from './providers/youtube.provider';

@Injectable()
export class MigratorService {
  private readonly logger: Logger;

  constructor(
    @Inject(MIGRATOR_PROVIDER) private readonly migratorProvider: MigratorProvider,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly winstonLogger: Logger,
    @InjectModel(Tag.name) private readonly tagModel: Model<TTagDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<TCategoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<TUserDocument>,
    @InjectModel(Article.name) private readonly articleModel: Model<TArticleDocument>,
    @InjectModel(FileUpload.name) private readonly fileUploadModel: Model<TFileUploadDocument>,
    private readonly redisService: RedisService,
    private readonly fileUploadService: FileUploadService,
    private readonly richBlocksService: ArticleRichBlocksService,
    private readonly elasticService: ElasticService,
    private readonly youTubeProvider: YouTubeProvider,
  ) {
    this.logger = new Logger(MigratorService.name);
  }

  async migrateYoutubeVideos(user: TCurrentUserType, opts: YouTubeMigrationOptions): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Starting YouTube video migration', this.constructor.name);
    return this.youTubeProvider.migrateYoutubeVideos(user, opts);
  }

  async reorderShortsTimestamps(opts: { propertyId?: string; articleType?: string }): Promise<{ updated: number; errors: number }> {
    this.logger.log('[MigratorService] Reordering shorts timestamps', this.constructor.name);
    return this.youTubeProvider.reorderShortsTimestamps(opts);
  }

  async hardDeleteShortsSlugs(opts: { propertyId?: string; articleType?: string }): Promise<{ scanned: number; deleted: number; missing: number; errors: number }> {
    this.logger.log('[MigratorService] Hard-deleting slug docs for shorts articles', this.constructor.name);
    return this.youTubeProvider.hardDeleteSlugsForArticleType(opts);
  }

  async verifyShortsClassification(opts: { propertyId?: string; articleType?: string; limit?: number }) {
    this.logger.log('[MigratorService] Verifying shorts classification against YouTube', this.constructor.name);
    return this.youTubeProvider.verifyShortsClassification(opts);
  }

  async migrateTags(user: TCurrentUserType): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating tags', this.constructor.name);
    return this.migratorProvider.migrateTags(user);
  }

  async migrateTagsAfter(user: TCurrentUserType, after: string): Promise<MigrationResult> {
    this.logger.log(`[MigratorService] Migrating tags after ${after}`, this.constructor.name);
    return this.migratorProvider.migrateTagsAfter(user, after);
  }

  async migrateCategories(user: TCurrentUserType): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating categories', this.constructor.name);
    return this.migratorProvider.migrateCategories(user);
  }

  async migrateCategoriesAfter(user: TCurrentUserType, after: string): Promise<MigrationResult> {
    this.logger.log(`[MigratorService] Migrating categories after ${after}`, this.constructor.name);
    return this.migratorProvider.migrateCategoriesAfter(user, after);
  }

  async migrateUsers(user: TCurrentUserType): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating users', this.constructor.name);
    return this.migratorProvider.migrateUsers(user);
  }

  async migrateArticles(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating articles', this.constructor.name);
    return this.migratorProvider.migrateArticles(user, propertyId);
  }

  async migrateArticlesV2(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult> {
    this.logger.log(
      '[MigratorService] Migrating articles V2 (Elasticsearch)',
      this.constructor.name
    );
    return this.migratorProvider.migrateArticlesV2(user, propertyId, limit, dateFrom, dateTo);
  }

  async syncTags(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Starting syncTags', this.constructor.name);
    return this.migratorProvider.syncTags(user, propertyId, limit, dateFrom, dateTo);
  }

  async migrateArticlesV3(
    user: TCurrentUserType,
    propertyId?: string,
    limit?: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MigrationResult> {
    this.logger.log(
      '[MigratorService] Migrating articles V2 (Elasticsearch)',
      this.constructor.name
    );
    return this.migratorProvider.migrateArticlesV3(user, propertyId, limit, dateFrom, dateTo);
  }

  async migrateTagsToRedis(): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating tags to Redis', this.constructor.name);

    let total = 0;
    let imported = 0;
    const errors = [];

    try {
      const tags = await this.tagModel.find({ wpTagId: { $exists: true, $ne: null } }).exec();
      total = tags.length;

      for (const tag of tags) {
        try {
          // Store tag in Redis with key: wp-tag-{name}
          const redisKey = `wp-tag-${tag.wpTagId}`;
          await this.redisService.set(redisKey, tag);
          imported++;
        } catch (error) {
          this.logger.error(
            `[MigratorService] Error storing tag ${tag.name} in Redis:`,
            error.message,
            this.constructor.name
          );
          errors.push({
            name: tag.name,
            wpTagId: tag.wpTagId,
            error: error.message,
          });
        }
      }

      this.logger.log(
        `[MigratorService] Tags Redis migration completed. Total: ${total}, Imported: ${imported}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return {
        success: true,
        imported,
        total,
        errors,
      };
    } catch (error) {
      this.logger.error(
        '[MigratorService] Tags Redis migration failed:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );
      throw new Error(`Failed to migrate tags to Redis: ${error.message}`);
    }
  }

  async migrateCategoriesToRedis(): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating categories to Redis', this.constructor.name);

    let total = 0;
    let imported = 0;
    const errors = [];

    try {
      const categories = await this.categoryModel
        .find({ wpCategoryId: { $exists: true, $ne: null } })
        .exec();
      total = categories.length;

      for (const category of categories) {
        try {
          // Store category in Redis with key: wp-category-{slug}
          const redisKey = `wp-category-${category.wpCategoryId}`;
          await this.redisService.set(redisKey, category);
          imported++;
        } catch (error) {
          this.logger.error(
            `[MigratorService] Error storing category ${category.title} in Redis:`,
            error.message,
            this.constructor.name
          );
          errors.push({
            name: category.title,
            wpCategoryId: category.wpCategoryId,
            error: error.message,
          });
        }
      }

      this.logger.log(
        `[MigratorService] Categories Redis migration completed. Total: ${total}, Imported: ${imported}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return {
        success: true,
        imported,
        total,
        errors,
      };
    } catch (error) {
      this.logger.error(
        '[MigratorService] Categories Redis migration failed:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );
      throw new Error(`Failed to migrate categories to Redis: ${error.message}`);
    }
  }

  async migrateUsersToRedis(): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating users to Redis', this.constructor.name);

    let total = 0;
    let imported = 0;
    const errors = [];

    try {
      // Find users that might have WordPress-related fields
      // Adjust the query based on your user schema
      const users = await this.userModel.find({ wpId: { $exists: true, $ne: null } }).exec();
      total = users.length;

      for (const user of users) {
        try {
          // Store user in Redis with key: wp-user-{id} or user-{id}
          const redisKey = `wp-user-${user.wpId}`;
          // const userData: any = {
          //   id: user._id.toString(),
          //   name: user.name,
          //   email: user.email,
          //   username: user.username || user.email,
          //   wpUserId: user.wpUserId,
          // };

          // Add WordPress user ID if it exists in your schema
          // if (user.wpUserId) {
          //   userData.wpUserId = user.wpUserId;
          // }

          await this.redisService.set(redisKey, user);
          imported++;
        } catch (error) {
          this.logger.error(
            `[MigratorService] Error storing user ${user.email} in Redis:`,
            error.message,
            this.constructor.name
          );
          errors.push({
            email: user.email,
            userId: user._id.toString(),
            error: error.message,
          });
        }
      }

      this.logger.log(
        `[MigratorService] Users Redis migration completed. Total: ${total}, Imported: ${imported}, Errors: ${errors.length}`,
        this.constructor.name
      );

      return {
        success: true,
        imported,
        total,
        errors,
      };
    } catch (error) {
      this.logger.error(
        '[MigratorService] Users Redis migration failed:',
        {
          error: error.message,
          stack: error.stack,
        },
        this.constructor.name
      );
      throw new Error(`Failed to migrate users to Redis: ${error.message}`);
    }
  }

  async convertToRichBlocks(
    user: TCurrentUserType,
    slug?: string,
    limit?: number,
    dateFrom?: string
  ): Promise<MigrationResult> {
    this.logger.log(
      slug
        ? `[MigratorService] Converting to rich blocks for slug: ${slug}`
        : `[MigratorService] Converting to rich blocks${limit ? ` (limit: ${limit})` : ''}${dateFrom ? ` (dateFrom: ${dateFrom})` : ''}`
    );

    const CONCURRENCY = 1; // tune this
    const BULK_SIZE = 100;

    const query: any = slug ? { slug } : {};
    if (dateFrom) {
      const [day, month, year] = dateFrom.split('-');
      const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid dateFrom format. Expected dd-mm-yyyy, got: ${dateFrom}`);
      }
      query.createdAt = { $gte: parsed };
    }
    const cursor = this.articleModel.find(query).cursor();

    let active: Promise<void>[] = [];
    let bulkOps: any[] = [];
    let processed = 0;
    let failed = 0;

    const processArticle = async (article: any) => {
      try {
        const richBlocks = await this.convertHtmlToRichBlocks(
          article.title,
          article.body,
          user,
          article
        );

        bulkOps.push({
          updateOne: {
            filter: { _id: article._id },
            update: { $set: { richBlocks } },
          },
        });

        processed++;
        this.logger.log(
          `[convertToRichBlocks] Processed ${article.slug}${limit ? ` (${processed}/${limit})` : ''}`,
          this.constructor.name
        );

        if (bulkOps.length >= BULK_SIZE) {
          await this.articleModel.bulkWrite(bulkOps, { timestamps: false } as any);
          bulkOps = [];
        }
      } catch (err) {
        failed++;
        this.logger.error(`Error converting article ${article._id}`, err.message);
      }
    };

    for await (const article of cursor) {
      if (limit && processed + failed >= limit) break;

      const task = processArticle(article);
      active.push(task);

      if (active.length >= CONCURRENCY) {
        await Promise.all(active);
        active = [];
      }
    }

    // wait remaining tasks
    if (active.length) {
      await Promise.all(active);
    }

    // flush remaining bulk ops
    if (bulkOps.length) {
      await this.articleModel.bulkWrite(bulkOps, { timestamps: false } as any);
    }

    return {
      success: failed === 0,
      total: processed,
      errors: failed ? [`Failed ${failed} articles`] : [],
    };
  }

  async convertHtmlToRichBlocks(
    title?: string,
    htmlContent?: string,
    user?: any,
    articleMeta?: any
  ): Promise<any[]> {
    if (!htmlContent && !title) {
      return [];
    }

    const blocks: any[] = [];
    let blockIdCounter = 0;
    const generateBlockId = () => {
      return `block-${Date.now()}-${blockIdCounter++}`;
    };
    let blockOrder = 0;

    // Utility: Check if a URL is a Twitter, YouTube, or Instagram post and extract the ID
    const getEmbedInfo = (url: string) => {
      // Try common patterns
      // Instagram
      const ig = url.match(/(?:instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+))/i);
      if (ig) {
        return {
          type: 'instagramEmbed',
          url,
          postId: ig[1],
        };
      }
      // YouTube (watch, share, shorts, and embed links)
      let yt = url.match(/youtube\.com\/watch\?v=([A-Za-z0-9_\-]+)/i);
      if (!yt) yt = url.match(/youtu\.be\/([A-Za-z0-9_\-]+)/i);
      if (!yt) yt = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_\-]+)/i);
      if (!yt) yt = url.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_\-]+)/i);
      if (yt) {
        return {
          type: 'youtubeEmbed',
          url,
          videoId: yt[1],
        };
      }
      // Twitter/X (new and old formats)
      const tw = url.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/i);
      if (tw) {
        return {
          type: 'twitterEmbed',
          url,
          tweetId: tw[1],
        };
      }
      return null;
    };

    // Utility: Extract embed info from blockquote tags
    const getEmbedFromBlockquote = (html: string) => {
      // Instagram blockquote
      const igBlockquote = html.match(/<blockquote[^>]*class="[^"]*instagram-media[^"]*"[^>]*>/i);
      if (igBlockquote) {
        // Extract the permalink URL
        const permalinkMatch = html.match(/data-instgrm-permalink="([^"]+)"/i);
        if (permalinkMatch) {
          const url = permalinkMatch[1].replace(/&amp;/g, '&');
          const embedInfo = getEmbedInfo(url);
          if (embedInfo) {
            return embedInfo;
          }
        }
        // Also try to extract from href inside the blockquote
        const hrefMatch = html.match(/<a\s+href="([^"]+)"[^>]*>/i);
        if (hrefMatch) {
          const url = hrefMatch[1].replace(/&amp;/g, '&');
          const embedInfo = getEmbedInfo(url);
          if (embedInfo) {
            return embedInfo;
          }
        }
      }

      // Twitter blockquote
      const twBlockquote = html.match(/<blockquote[^>]*class="[^"]*twitter-tweet[^"]*"[^>]*>/i);
      if (twBlockquote) {
        // Extract the tweet URL from the anchor tag
        const hrefMatch = html.match(
          /<a\s+href="([^"]+(?:twitter\.com|x\.com)[^"]+status\/\d+[^"]*)"[^>]*>/i
        );
        if (hrefMatch) {
          const url = hrefMatch[1].replace(/&amp;/g, '&');
          const embedInfo = getEmbedInfo(url);
          if (embedInfo) {
            return embedInfo;
          }
        }
      }

      // YouTube figure embeds (wp-block-embed-youtube / is-provider-youtube)
      const ytFigure = html.match(
        /<figure[^>]*class="[^"]*(?:wp-block-embed-youtube|is-provider-youtube)[^"]*"[^>]*>/i
      );
      if (ytFigure) {
        // Prefer the data-video_id attribute on the wrapper div
        const dataIdMatch = html.match(/data-video_id="([A-Za-z0-9_\-]+)"/i);
        if (dataIdMatch) {
          return {
            type: 'youtubeEmbed',
            url: `https://www.youtube.com/watch?v=${dataIdMatch[1]}`,
            videoId: dataIdMatch[1],
          };
        }
        // Fall back to the iframe src
        const iframeSrcMatch = html.match(/<iframe[^>]*\ssrc="([^"]+)"/i);
        if (iframeSrcMatch) {
          const url = iframeSrcMatch[1].replace(/&amp;|&#0?38;/g, '&');
          const embedInfo = getEmbedInfo(url);
          if (embedInfo) {
            return embedInfo;
          }
        }
      }

      return null;
    };

    // Utility: Remove all non-inline HTML tags from a string, but preserve text content
    // Only allow <b>, <strong>, <i>, <em>, <u>, <a href="..."> as inline, strip everything else
    const stripNonInlineTags = (input: string): string => {
      let output = input.replace(/<\s*br\s*\/?>/gi, '\n');

      output = output.replace(
        /<\/?(?!b\s*>|strong\s*>|i\s*>|em\s*>|u\s*>|a(\s+href="[^"]*")?\s*>)[^>]+>/gi,
        ''
      );
      output = output.replace(/<a\s*>(.*?)<\/a>/gi, '$1');
      output = output.replace(/<\/?p[^>]*>/gi, '');
      output = output.replace(/<\/?div[^>]*>/gi, '');
      output = output.replace(/<\/?h[1-6][^>]*>/gi, '');
      output = output.replace(/<\/?ul[^>]*>/gi, '');
      output = output.replace(/<\/?ol[^>]*>/gi, '');
      output = output.replace(/<\/?li[^>]*>/gi, '');
      output = output.replace(/<\/?blockquote[^>]*>/gi, '');
      output = output.replace(/<\/?pre[^>]*>/gi, '');
      output = output.replace(/<!--[\s\S]*?-->/g, '');

      return output;
    };

    // Utility: Create content inline span/link/run objects from text & entity runs
    // Handles <b>, <strong>, <i>, <em>, <u>, <a>
    const parseInlineFormatting = (html: string): Array<any> => {
      html = stripNonInlineTags(html);

      const content: Array<any> = [];
      const tagRegex = /<(\/?)(b|strong|i|em|u|a)(?:\s+href="([^"]*)")?\s*>/gi;
      let match: RegExpExecArray | null;
      const stylesStack: any[] = [];
      let lastIndex = 0;

      while ((match = tagRegex.exec(html))) {
        if (match.index > lastIndex) {
          const text = html.substring(lastIndex, match.index);
          if (text) {
            let curHref: string | undefined;
            for (let i = stylesStack.length - 1; i >= 0; --i) {
              if (typeof stylesStack[i] === 'object' && stylesStack[i].link) {
                curHref = stylesStack[i].link;
                break;
              }
            }
            if (curHref) {
              const displayText = decodeHtmlEntities(text);
              const styles = styleObjFromStack(stylesStack);
              content.push({
                type: 'link',
                text: displayText,
                href: curHref,
                ...(Object.keys(styles).length > 0 ? { styles } : {}),
              });
            } else {
              const styles = styleObjFromStack(stylesStack);
              content.push({
                type: 'text',
                text: decodeHtmlEntities(text),
                ...(Object.keys(styles).length > 0 ? { styles } : {}),
              });
            }
          }
        }
        const [, closing, tag, href] = match;
        if (!closing) {
          if (tag === 'b' || tag === 'strong') {
            stylesStack.push('bold');
          } else if (tag === 'i' || tag === 'em') {
            stylesStack.push('italic');
          } else if (tag === 'u') {
            stylesStack.push('underline');
          } else if (tag === 'a') {
            stylesStack.push({ link: href });
          }
        } else {
          if (tag === 'b' || tag === 'strong') {
            removeLastFromStack(stylesStack, 'bold');
          } else if (tag === 'i' || tag === 'em') {
            removeLastFromStack(stylesStack, 'italic');
          } else if (tag === 'u') {
            removeLastFromStack(stylesStack, 'underline');
          } else if (tag === 'a') {
            removeLastLinkFromStack(stylesStack);
          }
        }
        lastIndex = tagRegex.lastIndex;
      }
      if (lastIndex < html.length) {
        const text = html.substr(lastIndex);
        if (text) {
          let curHref: string | undefined;
          for (let i = stylesStack.length - 1; i >= 0; --i) {
            if (typeof stylesStack[i] === 'object' && stylesStack[i].link) {
              curHref = stylesStack[i].link;
              break;
            }
          }
          if (curHref) {
            const displayText = decodeHtmlEntities(text);
            const styles = styleObjFromStack(stylesStack);
            content.push({
              type: 'link',
              text: displayText,
              href: curHref,
              ...(Object.keys(styles).length > 0 ? { styles } : {}),
            });
          } else {
            const styles = styleObjFromStack(stylesStack);
            content.push({
              type: 'text',
              text: decodeHtmlEntities(text),
              ...(Object.keys(styles).length > 0 ? { styles } : {}),
            });
          }
        }
      }
      // Collapse adjacent link fragments with the same href
      for (let i = 0; i < content.length - 1; i++) {
        if (
          content[i].type === 'link' &&
          content[i + 1].type === 'link' &&
          content[i].href === content[i + 1].href
        ) {
          content[i].text += content[i + 1].text;
          content.splice(i + 1, 1);
          i--;
        }
      }
      // Filter out empty text or link fragments
      return content.filter(
        (span) =>
          (span.type === 'text' && span.text && span.text.length > 0) ||
          (span.type === 'link' && span.text && span.text.length > 0 && span.href)
      );
    };

    // Utility: Decodes typical html entities to their corresponding characters
    const decodeHtmlEntities = (str: string): string => {
      return str
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/<br\s*\/?>/gi, '\n');
    };

    // Style object builder
    const styleObjFromStack = (stack: any[]): any => {
      const styles: any = {};
      for (const item of stack) {
        if (item === 'bold') styles.bold = true;
        if (item === 'italic') styles.italic = true;
        if (item === 'underline') styles.underline = true;
      }
      return styles;
    };

    function removeLastFromStack(stack: any[], marker: string) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === marker) {
          stack.splice(i, 1);
          break;
        }
      }
    }
    function removeLastLinkFromStack(stack: any[]) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (typeof stack[i] === 'object' && stack[i].link) {
          stack.splice(i, 1);
          break;
        }
      }
    }

    // Helper for image tag parser
    const parseImageTag = (html: string) => {
      const imgTag = html.match(/<img\b[^>]*>/i);
      if (!imgTag) return null;
      const tag = imgTag[0];
      const getAttr = (name: string) => {
        const r = new RegExp(`${name}\\s*=\\s*"(.*?)"`, 'i').exec(tag);
        return r ? r[1] : '';
      };
      return {
        url: getAttr('src'),
        alt: getAttr('alt'),
        caption: getAttr('title'),
      };
    };


    // Helper function to split content by bold tags preserving other formatting
    // --- REWRITE: Track "a" surrounded by bold/strong and preserve both styles & link! ---
    const splitByBoldTags = (originalHtml: string): Array<any> => {
      const boldRegex = /<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi;

      // If no bold tags, use normal inline parser
      if (!boldRegex.test(originalHtml)) {
        return parseInlineFormatting(originalHtml);
      }

      boldRegex.lastIndex = 0;

      let segments: Array<any> = [];
      let lastIndex = 0;
      let m;

      while ((m = boldRegex.exec(originalHtml))) {
        // Text before this bold tag (not bold)
        if (m.index > lastIndex) {
          const notBoldHtml = originalHtml.substring(lastIndex, m.index);
          const notBoldText = stripNonInlineTags(notBoldHtml);
          if (notBoldText && notBoldText.trim().length > 0) {
            const parsed = parseInlineFormatting(notBoldHtml);
            // Remove bold from these spans if incorrectly applied
            segments = segments.concat(
              parsed.map((span) => {
                if (span.type === 'text' && span.styles && span.styles.bold) {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { bold, ...restStyles } = span.styles;
                  return {
                    ...span,
                    ...(Object.keys(restStyles).length > 0 ? { styles: restStyles } : {}),
                  };
                }
                return span;
              })
            );
          }
        }

        // The bold text segment, which may wrap a link. We want to recognize and preserve both.
        const boldHtml = m[2];
        if (boldHtml && stripNonInlineTags(boldHtml).trim().length > 0) {
          // --- Custom: Check for single link wrapped in bold ---
          // If the whole boldHtml is exactly a single <a href...>...</a> (or just one link),
          // convert to link with bold style
          const onlyLinkRegex = /^\s*<a\s+href="([^"]+)"(?:\s+[^>]*)?>([\s\S]+)<\/a>\s*$/i;
          const linkMatch = onlyLinkRegex.exec(boldHtml);
          if (linkMatch) {
            const href = linkMatch[1];
            // Get visible text: must decode possible html entities
            const linkText = decodeHtmlEntities(stripNonInlineTags(linkMatch[2]));
            if (linkText && href) {
              segments.push({
                type: 'link',
                text: linkText,
                href: href,
                styles: { bold: true }, // << THIS is key!
              });
            }
          } else {
            // Else, parse normally, but force bold on both link/text fragments
            const insideBold = parseInlineFormatting(boldHtml).map((span) => {
              if (span.type === 'link') {
                return {
                  ...span,
                  styles: { ...(span.styles || {}), bold: true },
                };
              }
              if (span.type === 'text') {
                return { ...span, styles: { ...(span.styles || {}), bold: true } };
              }
              return span;
            });
            segments = segments.concat(insideBold);
          }
        }

        lastIndex = boldRegex.lastIndex;
      }

      // Text after the last bold tag (not bold)
      if (lastIndex < originalHtml.length) {
        const tailHtml = originalHtml.substring(lastIndex);
        const tailText = stripNonInlineTags(tailHtml);
        if (tailText && tailText.trim().length > 0) {
          const parsed = parseInlineFormatting(tailHtml);
          segments = segments.concat(
            parsed.map((span) => {
              if (span.type === 'text' && span.styles && span.styles.bold) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { bold, ...restStyles } = span.styles;
                return {
                  ...span,
                  ...(Object.keys(restStyles).length > 0 ? { styles: restStyles } : {}),
                };
              }
              return span;
            })
          );
        }
      }

      // Filter and clean up
      return segments
        .filter(
          (s) =>
            (s.type === 'text' && s.text && s.text.trim().length > 0) ||
            (s.type === 'link' && s.text)
        )
        .map((span) => {
          // Clean up empty styles objects ONLY for text, not links
          if (span.type === 'text' && span.styles && Object.keys(span.styles).length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { styles, ...rest } = span;
            return rest;
          }
          return span;
        });
    };
    // --- END splitByBoldTags rewrite ---

    // Remove script and style tags
    let cleanHtml = (htmlContent || '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Pre-process: Extract complete social media embed blocks (figure/blockquote pairs)
    // and replace them with markers to keep them intact during line splitting
    const embedMarkers: Map<string, string> = new Map();
    let embedCounter = 0;

    // Match figure blocks containing blockquotes (WordPress style)
    cleanHtml = cleanHtml.replace(
      /<figure[^>]*class="[^"]*wp-block-embed[^"]*"[^>]*>[\s\S]*?<\/figure>/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // Match wp-block-video figure blocks
    cleanHtml = cleanHtml.replace(
      /<figure[^>]*class="[^"]*wp-block-video[^"]*"[^>]*>[\s\S]*?<\/figure>/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // Match wp-block-table figure blocks
    cleanHtml = cleanHtml.replace(
      /<figure[^>]*class="[^"]*wp-block-table[^"]*"[^>]*>[\s\S]*?<\/figure>/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // Match wp-block-audio figure blocks
    cleanHtml = cleanHtml.replace(
      /<figure[^>]*wp-block-audio[^>]*>[\s\S]*?<\/figure>/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // Match wp-block-file div blocks
    cleanHtml = cleanHtml.replace(
      /<div[^>]*wp-block-file[^>]*>[\s\S]*?<\/div>/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // Match standalone blockquote embeds (Instagram, Twitter)
    cleanHtml = cleanHtml.replace(
      /<blockquote[^>]*class="[^"]*(instagram-media|twitter-tweet)[^"]*"[^>]*>[\s\S]*?<\/blockquote>(?:\s*<script[^>]*>[\s\S]*?<\/script>)?/gi,
      (match) => {
        const marker = `\n__EMBED_MARKER_${embedCounter++}__\n`;
        embedMarkers.set(marker.trim(), match);
        return marker;
      }
    );

    // 1. Add title as first heading (with blocknote text marks support)
    if (title && title.trim()) {
      blocks.push({
        id: generateBlockId(),
        type: 'heading',
        content: [
          {
            type: 'text',
            text: title.trim(),
          },
        ],
        metadata: {
          props: {
            backgroundColor: 'default',
            textColor: 'default',
            textAlignment: 'left',
            level: 1,
            isToggleable: false,
          },
          children: [],
        },
        order: blockOrder++,
      });
    }

    const htmlLines = cleanHtml.split(
      /(?=<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div|img|figure)[\s>])|(?=__EMBED_MARKER_\d+__)/i
    );

    for (const rawLine of htmlLines) {
      let trimmedLine = rawLine.trim();
      if (!trimmedLine) continue;

      // Check if this line contains an embed marker and restore the original HTML
      if (/^__EMBED_MARKER_\d+__/.test(trimmedLine)) {
        const marker = trimmedLine.match(/^__EMBED_MARKER_\d+__/)?.[0];
        if (marker && embedMarkers.has(marker)) {
          trimmedLine = embedMarkers.get(marker)!;
        }
      }

      // Video blocks (wp-block-video)
      if (/^<figure[^>]*class="[^"]*wp-block-video[^"]*"/i.test(trimmedLine)) {
        const videoSrcMatch = trimmedLine.match(/<video[^>]*\ssrc="([^"]+)"/i);
        const captionMatch = trimmedLine.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
        const caption = captionMatch
          ? decodeHtmlEntities(captionMatch[1].replace(/<[^>]+>/g, '').trim())
          : '';

        if (videoSrcMatch) {
          const rawSrc = videoSrcMatch[1];
          const videoPath = rawSrc.startsWith('/uploads')
            ? rawSrc
            : (rawSrc.match(/(\/uploads\/.+)/)?.[1] ?? null);

          let videoUrl = rawSrc;
          let mediaId: string | undefined;
          let mediaPath: string | undefined;

          const mediaDoc = videoPath
            ? await this.fileUploadModel.findOne({ path: videoPath }).lean().exec()
            : null;
          if (mediaDoc) {
            videoUrl = (mediaDoc as any).url || rawSrc;
            mediaId = (mediaDoc as any)._id?.toString();
            mediaPath = (mediaDoc as any).path;
          }

          blocks.push({
            id: generateBlockId(),
            type: 'videoEmbed',
            metadata: {
              props: {
                url: videoUrl,
                caption,
                path: mediaPath || videoPath,
                id: mediaId,
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // Audio blocks (wp-block-audio)
      if (/^<figure[^>]*wp-block-audio/i.test(trimmedLine)) {
        const audioSrcMatch = trimmedLine.match(/<audio[^>]*\ssrc="([^"]+)"/i);
        const captionMatch = trimmedLine.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
        const caption = captionMatch
          ? decodeHtmlEntities(captionMatch[1].replace(/<[^>]+>/g, '').trim())
          : '';

        if (audioSrcMatch) {
          const rawSrc = audioSrcMatch[1];
          const audioPath = rawSrc.startsWith('/uploads')
            ? rawSrc
            : (rawSrc.match(/(\/uploads\/.+)/)?.[1] ?? null);

          let audioUrl = rawSrc;
          let mediaPath: string | undefined = audioPath || undefined;

          const mediaDoc = audioPath
            ? await this.fileUploadModel.findOne({ path: audioPath }).lean().exec()
            : null;
          if (mediaDoc) {
            audioUrl = (mediaDoc as any).url || rawSrc;
            mediaPath = (mediaDoc as any).path || audioPath;
          }

          const fileName = (mediaPath || audioPath || rawSrc).split('/').pop() || '';

          blocks.push({
            id: generateBlockId(),
            type: 'audio',
            metadata: {
              props: {
                backgroundColor: 'default',
                name: fileName,
                url: audioUrl,
                path: mediaPath,
                caption,
                showPreview: true,
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // File blocks (wp-block-file)
      if (/^<div[^>]*wp-block-file/i.test(trimmedLine)) {
        const allAnchors = [...trimmedLine.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi)];
        const rawHref =
          allAnchors[0]?.[1] ||
          trimmedLine.match(/<object[^>]*\sdata="([^"]+)"/i)?.[1];
        const nameFromAnchor = allAnchors.find(
          (a) => a[2]?.trim() && a[2].trim().toLowerCase() !== 'download'
        )?.[2]?.trim();

        if (rawHref) {
          const filePath = rawHref.startsWith('/uploads')
            ? rawHref
            : (rawHref.match(/(\/uploads\/.+)/)?.[1] ?? null);

          let resolvedPath = filePath || rawHref;
          let resolvedUrl: string = rawHref;

          const mediaDoc = filePath
            ? await this.fileUploadModel.findOne({ path: filePath }).lean().exec()
            : null;
          if (mediaDoc) {
            resolvedPath = (mediaDoc as any).path || filePath;
            resolvedUrl = (mediaDoc as any).url || rawHref;
          }

          const fileName = nameFromAnchor || (filePath || rawHref).split('/').pop() || '';

          blocks.push({
            id: generateBlockId(),
            type: 'file',
            metadata: {
              props: {
                backgroundColor: 'default',
                name: fileName,
                path: resolvedPath,
                url: resolvedUrl,
                caption: '',
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // Table blocks (wp-block-table)
      if (/^<figure[^>]*class="[^"]*wp-block-table[^"]*"/i.test(trimmedLine)) {
        const rows: any[] = [];
        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch: RegExpExecArray | null;
        while ((rowMatch = rowRegex.exec(trimmedLine)) !== null) {
          const rowHtml = rowMatch[1];
          const cells: any[] = [];
          const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
          let cellMatch: RegExpExecArray | null;
          while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
            const cellContent = cellMatch[1]
              .replace(/^<p[^>]*>|<\/p>$/gi, '')
              .replace(/\uFFFD/g, '')
              .trim();
            const content = parseInlineFormatting(cellContent);
            cells.push(content.length ? content : [{ type: 'text', text: '', styles: {} }]);
          }
          if (cells.length) rows.push({ cells });
        }
        if (rows.length) {
          blocks.push({
            id: generateBlockId(),
            type: 'table',
            content: {
              type: 'tableContent',
              rows,
            },
            metadata: {
              props: { textColor: 'default', backgroundColor: 'default' },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // Check for social media embeds in blockquote format first
      if (
        /^<blockquote/i.test(trimmedLine) ||
        /^<figure[^>]*class="[^"]*wp-block-embed[^"]*"/i.test(trimmedLine)
      ) {
        const embedInfo = getEmbedFromBlockquote(trimmedLine);
        if (embedInfo) {
          const { type, url } = embedInfo;
          const embedProps: any = { url };
          if (type === 'instagramEmbed') embedProps.postId = embedInfo.postId;
          if (type === 'youtubeEmbed') embedProps.videoId = embedInfo.videoId;
          if (type === 'twitterEmbed') embedProps.tweetId = embedInfo.tweetId;

          blocks.push({
            id: generateBlockId(),
            type,
            metadata: {
              props: embedProps,
              children: [],
            },
            order: blockOrder++,
          });
          continue;
        }
      }

      // Headings (h1-h6)
      const headingMatch = trimmedLine.match(/^<h([1-6])[\s>]/i);
      if (headingMatch) {
        const level = parseInt(headingMatch[1], 10);
        const lineContentHtml = trimmedLine.replace(/^<h[1-6][^>]*>|<\/h[1-6]>/gi, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
              level,
              isToggleable: false,
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Images
      if (/^<img[\s>]/i.test(trimmedLine)) {
        const imgInfo = parseImageTag(trimmedLine);
        if (imgInfo && imgInfo.url) {
          // Always extract /uploads path — never use full URL as the path
          const imagePath = imgInfo.url.startsWith('/uploads')
            ? imgInfo.url
            : (imgInfo.url.match(/(\/uploads\/.+)/)?.[1] ?? null);

          let mongoId: string | undefined;

          // 1. Check DB by path (only when we have a /uploads path)
          if (imagePath) {
            const existing = await this.fileUploadModel.findOne({ path: imagePath }).lean().exec();
            if (existing) {
              mongoId = (existing as any)._id?.toString();
            }
          }

          // 2. If not found, save to DB (only when we have a /uploads path)
          if (!mongoId && imagePath && user && user.organizationId && user.sub) {
            const cleanUrl = imgInfo.url.split('?')[0];
            const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
            const mimeTypeMap: Record<string, string> = {
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              png: 'image/png',
              gif: 'image/gif',
              webp: 'image/webp',
              svg: 'image/svg+xml',
            };
            const mimeType = mimeTypeMap[ext] || 'image/jpeg';
            try {
              const meta = articleMeta || {};
              // Article createdBy/updatedBy shape: { id, name } — remap to media schema shape: { userId, userName }
              const toMediaUser = (u: any) =>
                u ? { userId: u.id || u.userId, userName: u.name || u.userName } : undefined;
              const fileCreatedBy = toMediaUser(meta.createdBy) || { userId: user.sub, userName: user.name };
              const fileUpdatedBy = toMediaUser(meta.updatedBy);
              const { data: savedFile } = await this.fileUploadService.saveFileToDB({
                fileName: imagePath.split('/').pop() || 'image',
                url: imgInfo.url,
                folderPath: imagePath,
                mimeType,
                organization: meta.organization || { id: user.organizationId },
                property: meta.property,
                path: imagePath,
                size: 0,
                isPrivate: false,
                createdBy: fileCreatedBy,
                ...(fileUpdatedBy ? { updatedBy: fileUpdatedBy } : {}),
                ...(meta.createdAt ? { createdAt: meta.createdAt } : {}),
                ...(meta.updatedAt ? { updatedAt: meta.updatedAt } : {}),
              } as any);
              mongoId = savedFile.id;
            } catch (err) {
              this.logger.error(
                `[convertHtmlToRichBlocks] Failed to save file for url ${imgInfo.url}: ${err?.message}`,
                err?.stack,
                this.constructor.name
              );
            }
          }

          blocks.push({
            id: generateBlockId(),
            type: 'image',
            metadata: {
              props: {
                textAlignment: 'left',
                backgroundColor: 'default',
                name: imgInfo.alt || '',
                url: imgInfo.url,
                path: imagePath,
                caption: imgInfo.caption || '',
                showPreview: true,
                id: mongoId,
              },
              children: [],
            },
            order: blockOrder++,
          });
        }
        continue;
      }

      // Social embed pure links (anchor that contains only social media url)
      if (/^<a\s+href="([^"]+)"\s*>([^<]*)<\/a>\s*$/i.test(trimmedLine)) {
        const linkMatch = trimmedLine.match(/^<a\s+href="([^"]+)"\s*>([^<]*)<\/a>\s*$/i);
        if (linkMatch) {
          const href = linkMatch[1];
          const displayText = linkMatch[2]?.trim() || '';
          const maybeEmbed = getEmbedInfo(href);
          if (maybeEmbed) {
            const { type, url } = maybeEmbed;
            const embedId = maybeEmbed.postId || maybeEmbed.videoId || maybeEmbed.tweetId || '';
            const embedProps: any = { url };
            if (type === 'instagramEmbed') embedProps.postId = maybeEmbed.postId;
            if (type === 'youtubeEmbed') embedProps.videoId = maybeEmbed.videoId;
            if (type === 'twitterEmbed') embedProps.tweetId = maybeEmbed.tweetId;
            blocks.push({
              id: generateBlockId(),
              type,
              metadata: {
                props: embedProps,
                children: [],
              },
              order: blockOrder++,
            });
            continue;
          }
          blocks.push({
            id: generateBlockId(),
            type: 'paragraph',
            content: [
              {
                type: 'link',
                text: displayText || href,
                href: href,
              },
            ],
            metadata: {
              props: {
                backgroundColor: 'default',
                textColor: 'default',
                textAlignment: 'left',
              },
              children: [],
            },
            order: blockOrder++,
          });
          continue;
        }
      }

      // Unordered list item (within <ul>)
      if (
        /^<li[\s>]/i.test(trimmedLine) &&
        /<ul/i.test(cleanHtml.substring(0, cleanHtml.indexOf(trimmedLine)))
      ) {
        const lineContentHtml = trimmedLine.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'bulletListItem',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Ordered list item (within <ol>)
      if (
        /^<li[\s>]/i.test(trimmedLine) &&
        /<ol/i.test(cleanHtml.substring(0, cleanHtml.indexOf(trimmedLine)))
      ) {
        const lineContentHtml = trimmedLine.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'numberedListItem',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Blockquote (render as paragraph with formatting) - but not social embeds
      if (/^<blockquote[\s>]/i.test(trimmedLine)) {
        // Skip if it's a social media embed blockquote
        if (
          /<blockquote[^>]*class="[^"]*(instagram-media|twitter-tweet)[^"]*"/i.test(trimmedLine)
        ) {
          continue;
        }

        const lineContentHtml = trimmedLine
          .replace(/^<blockquote[^>]*>/i, '')
          .replace(/<\/blockquote>$/i, '');
        const content = parseInlineFormatting(lineContentHtml);
        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }

      // Paragraph or plain line with text or inline mark tags present
      if (
        /^<p[\s>]/i.test(trimmedLine) ||
        /<(b|strong|i|em|u|a)[\s>]/i.test(trimmedLine) ||
        /<\/(b|strong|i|em|u|a)>/i.test(trimmedLine) ||
        parseInlineFormatting(trimmedLine).length > 0
      ) {
        let lineContentHtml = trimmedLine;
        // Remove paragraph tags but preserve inline formatting
        if (/^<p[\s>]/i.test(trimmedLine)) {
          lineContentHtml = trimmedLine.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '');
        }

        // Get the original HTML before stripping
        const originalHtml = lineContentHtml;

        // Parse with fine-grained bold handling
        let content = splitByBoldTags(originalHtml);

        // Check for pure social links in the content (entire paragraph is a social link)
        if (
          content.length === 1 &&
          content[0].type === 'link' &&
          typeof content[0].href === 'string'
        ) {
          const maybeEmbed = getEmbedInfo(content[0].href);
          if (maybeEmbed) {
            const { type, url } = maybeEmbed;
            const embedProps: any = { url };
            if (type === 'instagramEmbed') embedProps.postId = maybeEmbed.postId;
            if (type === 'youtubeEmbed') embedProps.videoId = maybeEmbed.videoId;
            if (type === 'twitterEmbed') embedProps.tweetId = maybeEmbed.tweetId;
            blocks.push({
              id: generateBlockId(),
              type,
              metadata: {
                props: embedProps,
                children: [],
              },
              order: blockOrder++,
            });
            continue;
          }
        }

        content = content.map((span: any) => {
          if (span.href) {
            return {
              type: 'link',
              text: span.text,
              href: span.href,
              ...(span.styles && Object.keys(span.styles).length > 0
                ? { styles: span.styles }
                : {}),
            };
          }
          return span;
        });

        if (!content.length) continue;
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
        continue;
      }
    }

    if (blocks.length === 0 && cleanHtml) {
      // Parse with fine-grained bold handling
      let content = splitByBoldTags(cleanHtml);

      // Pure social link?
      if (
        content.length === 1 &&
        content[0].type === 'link' &&
        typeof content[0].href === 'string'
      ) {
        const maybeEmbed = getEmbedInfo(content[0].href);
        if (maybeEmbed) {
          const { type, url } = maybeEmbed;
          const embedProps: any = { url };
          if (type === 'instagramEmbed') embedProps.postId = maybeEmbed.postId;
          if (type === 'youtubeEmbed') embedProps.videoId = maybeEmbed.videoId;
          if (type === 'twitterEmbed') embedProps.tweetId = maybeEmbed.tweetId;
          blocks.push({
            id: generateBlockId(),
            type,
            metadata: {
              props: embedProps,
              children: [],
            },
            order: blockOrder++,
          });
          return blocks;
        }
      }

      content = content.map((span: any) => {
        if (span.href) {
          return {
            type: 'link',
            text: span.text,
            href: span.href,
            ...(span.styles && Object.keys(span.styles).length > 0 ? { styles: span.styles } : {}),
          };
        }
        return span;
      });

      if (content.length) {
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          content,
          metadata: {
            props: {
              backgroundColor: 'default',
              textColor: 'default',
              textAlignment: 'left',
            },
            children: [],
          },
          order: blockOrder++,
        });
      }
    }
    return blocks;
  }
  async migrateLiveArticles(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating live articles', this.constructor.name);
    return this.migratorProvider.migrateLiveArticles(user, propertyId);
  }

  async migrateLiveArticlesV2(user: TCurrentUserType, slug?: string, limit?: number): Promise<MigrationResult> {
    this.logger.log(
      '[MigratorService] Migrating live articles V2 (Elasticsearch)',
      this.constructor.name
    );
    return this.migratorProvider.migrateLiveArticlesV2(user, slug, limit);
  }

  async revertLiveArticlesV2(slug?: string, limit?: number): Promise<MigrationResult> {
    this.logger.log(
      '[MigratorService] Reverting live articles V2 updatedAt/updatedBy',
      this.constructor.name
    );
    return this.migratorProvider.revertLiveArticlesV2(slug, limit);
  }

  async migrateMenus(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating menus', this.constructor.name);
    return this.migratorProvider.migrateMenus(user, propertyId);
  }

  async migrateMenusAfter(
    user: TCurrentUserType,
    after: string,
    propertyId?: string
  ): Promise<MigrationResult> {
    this.logger.log(`[MigratorService] Migrating menus after ${after}`, this.constructor.name);
    return this.migratorProvider.migrateMenusAfter(user, after, propertyId);
  }

  async migrateUserHeaders(): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating user headers', this.constructor.name);
    return this.migratorProvider.migrateUserHeaders();
  }
  async parseUserHeaders(): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Parsing User headers', this.constructor.name);
    return this.migratorProvider.parseUserHeaders();
  }

  async migrateMedia(days?: number): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating media', this.constructor.name);
    return this.migratorProvider.migrateMedia(days);
  }

  async migrateMediaAfter(after: string, days?: number): Promise<MigrationResult> {
    this.logger.log(`[MigratorService] Migrating media after ${after}`, this.constructor.name);
    return this.migratorProvider.migrateMediaAfter(after, days);
  }

  async migrateStaticPages(user: TCurrentUserType, propertyId?: string): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating static pages', this.constructor.name);
    return this.migratorProvider.migrateStaticPages(user, propertyId);
  }

  async auditSlugDiff(): Promise<MigrationResult> {
    this.logger.log(
      '[MigratorService] Starting slug diff audit (ES ↔ MongoDB)',
      this.constructor.name
    );
    return this.migratorProvider.auditSlugDiff();
  }

  async fixSlugMeta(limit?: number): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Starting fixSlugMeta', this.constructor.name);
    return this.migratorProvider.fixSlugMeta(limit);
  }

  async migrateMissingSlugs(user: TCurrentUserType, limit?: number): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Starting migrateMissingSlugs', this.constructor.name);
    return this.migratorProvider.migrateMissingSlugs(user, limit);
  }

  async migrateWebStories(user: TCurrentUserType, limit?: number): Promise<MigrationResult> {
    this.logger.log('[MigratorService] Migrating web stories', this.constructor.name);
    return this.migratorProvider.migrateWebStories(user, limit);
  }

  async migrateFeaturedVideo(slug?: string, limit?: number): Promise<{
    processed: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: string[];
  }> {
    const PAGE_SIZE = 100;
    const WP_INDEX = 'wp_posts_prod';
    const startTime = Date.now();

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    let searchAfter: any[] | undefined = undefined;
    let totalHits: number | undefined = undefined;
    let fetched = 0;

    while (true) {
      if (limit !== undefined && processed >= limit) break;

      const response = await this.elasticService.search(ModuleName.ARTICLE, {
        size: PAGE_SIZE,
        query: slug
          ? { bool: { must: [{ term: { type: 'video' } }, { term: { slug } }] } }
          : { term: { type: 'video' } },
        sort: [{ _doc: 'asc' }],
        ...(searchAfter ? { search_after: searchAfter } : {}),
        _source: ['slug', 'wpPostId'],
      });

      const hits: any[] = response.hits?.hits ?? [];
      if (totalHits === undefined) {
        const total = response.hits?.total;
        totalHits = typeof total === 'object' ? total.value : (total ?? 0);
      }

      if (!hits.length) break;
      fetched += hits.length;
      searchAfter = hits[hits.length - 1].sort;

      this.logger.log(
        `[migrateFeaturedVideo] Fetched ${fetched}/${totalHits}`,
        this.constructor.name
      );

      for (const hit of hits) {
        if (limit !== undefined && processed >= limit) break;

        const articleId = hit._id;
        const articleSlug = (hit._source as any)?.slug;
        processed++;

        try {
          // Look up in wp_posts_prod by slug to get video URL
          const wpResponse = await this.elasticService.search(WP_INDEX, {
            size: 1,
            query: { term: { slug: articleSlug } },
            _source: ['articleDetails'],
          });

          const wpHit = wpResponse.hits?.hits?.[0];
          if (!wpHit) {
            this.logger.warn(
              `[migrateFeaturedVideo] No wp_posts_prod doc for slug=${articleSlug}`,
              this.constructor.name
            );
            skipped++;
            continue;
          }

          const videoUrl = (wpHit._source as any)?.articleDetails?.video;
          if (!videoUrl) {
            this.logger.log(
              `[migrateFeaturedVideo] No articleDetails.video for slug=${articleSlug}`,
              this.constructor.name
            );
            skipped++;
            continue;
          }

          const featuredVideo = { url: videoUrl };

          // Update MongoDB
          await this.articleModel.collection.updateOne(
            { _id: new Types.ObjectId(articleId) },
            { $set: { featuredVideo } }
          );

          // Resync featuredVideo to ES
          await this.elasticService.updateDocument(ModuleName.ARTICLE, articleId, {
            featuredVideo,
          });

          updated++;
          this.logger.log(
            `[migrateFeaturedVideo] Updated slug=${articleSlug} url=${videoUrl}`,
            this.constructor.name
          );
        } catch (err) {
          failed++;
          const msg = `${articleSlug}: ${err.message}`;
          errors.push(msg);
          this.logger.error(
            `[migrateFeaturedVideo] Failed — ${msg}`,
            this.constructor.name
          );
        }
      }

      if (hits.length < PAGE_SIZE) break;
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `[migrateFeaturedVideo] Done — processed:${processed} updated:${updated} skipped:${skipped} failed:${failed} duration:${duration}ms`,
      this.constructor.name
    );
    return { processed, updated, skipped, failed, errors };
  }

  async fixVideoStories(slug?: string, limit?: number): Promise<{
    processed: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: string[];
  }> {
    const PAGE_SIZE = 100;
    const WP_INDEX = 'wp_posts_prod';
    const startTime = Date.now();

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    let searchAfter: any[] | undefined = undefined;
    let totalHits: number | undefined = undefined;
    let fetched = 0;

    while (true) {
      if (limit !== undefined && processed >= limit) break;

      const must: any[] = [{ term: { post_format: 'video' } }];
      if (slug) must.push({ term: { slug } });

      const wpResponse = await this.elasticService.search(WP_INDEX, {
        size: PAGE_SIZE,
        query: { bool: { must } },
        sort: [{ _doc: 'asc' }],
        ...(searchAfter ? { search_after: searchAfter } : {}),
        _source: ['slug', 'video', 'articleDetails'],
      });

      const hits: any[] = wpResponse.hits?.hits ?? [];
      if (totalHits === undefined) {
        const total = wpResponse.hits?.total;
        totalHits = typeof total === 'object' ? total.value : (total ?? 0);
      }

      if (!hits.length) break;
      fetched += hits.length;
      searchAfter = hits[hits.length - 1].sort;

      this.logger.log(
        `[fixVideoStories] Fetched ${fetched}/${totalHits}`,
        this.constructor.name
      );

      for (const hit of hits) {
        if (limit !== undefined && processed >= limit) break;

        const wpSlug = (hit._source as any)?.slug;
        const videoUrl =
          (hit._source as any)?.video || (hit._source as any)?.articleDetails?.video;
        processed++;

        try {
          if (!wpSlug) {
            skipped++;
            continue;
          }
          if (!videoUrl) {
            this.logger.log(
              `[fixVideoStories] No video field for slug=${wpSlug}`,
              this.constructor.name
            );
            skipped++;
            continue;
          }

          const article = await this.articleModel.collection.findOne(
            { slug: wpSlug },
            { projection: { _id: 1 } }
          );
          if (!article) {
            this.logger.warn(
              `[fixVideoStories] No article in Mongo for slug=${wpSlug}`,
              this.constructor.name
            );
            skipped++;
            continue;
          }

          const featuredVideo = { url: videoUrl };

          await this.articleModel.collection.updateOne(
            { _id: article._id },
            { $set: { featuredVideo } }
          );

          await this.elasticService.updateDocument(
            ModuleName.ARTICLE,
            article._id.toString(),
            { featuredVideo }
          );

          updated++;
          this.logger.log(
            `[fixVideoStories] Updated slug=${wpSlug} url=${videoUrl}`,
            this.constructor.name
          );
        } catch (err) {
          failed++;
          const msg = `${wpSlug}: ${err.message}`;
          errors.push(msg);
          this.logger.error(
            `[fixVideoStories] Failed — ${msg}`,
            this.constructor.name
          );
        }
      }

      if (hits.length < PAGE_SIZE) break;
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `[fixVideoStories] Done — processed:${processed} updated:${updated} skipped:${skipped} failed:${failed} duration:${duration}ms`,
      this.constructor.name
    );
    return { processed, updated, skipped, failed, errors };
  }

  async fixFeaturedMedia(
    user: TCurrentUserType,
    dateFrom: string,
    limit?: number
  ): Promise<MigrationResult> {
    this.logger.log(
      `[MigratorService] Fixing featured media from date: ${dateFrom}`,
      this.constructor.name
    );
    return this.migratorProvider.fixFeaturedMedia(user, dateFrom, limit);
  }

  // async parsecategoryHeaders(): Promise<MigrationResult> {
  //   this.logger.log('[MigratorService] Parsing Category headers', this.constructor.name);
  //   return this.migratorProvider.parseCategoryHeaders();
  // }

  /**
   * One-time migration for existing live articles (liveblog):
   *   1. Groups each article's flat richBlocks into parent-child structure:
   *      each timestamp block becomes a parent, and all content blocks that
   *      follow it (until the next timestamp) are stored as metadata.children.
   *   2. Upserts only the timestamp (parent) blocks into article_rich_blocks.
   *   3. Clears richBlocks on the article document (liveblog articles never
   *      store blocks directly — they are always served from the collection).
   *
   * Safe to re-run — bulkUpsert is idempotent (upserts by blockId).
   */
  async migrateLiveblogRichBlocks(limit?: number): Promise<{
    total: number;
    processed: number;
    skipped: number;
    failed: number;
    errors: string[];
  }> {
    const BATCH_SIZE = 50;
    const liveFilter = { type: 'liveblog' };

    const total = await this.articleModel.countDocuments(liveFilter);
    const cap = limit ?? total;
    this.logger.log(
      `[migrateLiveblogRichBlocks] ${total} live articles found, processing up to ${cap}`,
      this.constructor.name
    );

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    let skip = 0;

    while (processed + skipped + failed < cap) {
      const articles = await this.articleModel
        .find(liveFilter)
        .skip(skip)
        .limit(Math.min(BATCH_SIZE, cap - processed - skipped - failed))
        .lean()
        .exec();

      if (!articles.length) break;

      for (const article of articles) {
        const articleId = (article._id as any).toString();
        const richBlocks: any[] = (article.richBlocks as any[]) ?? [];

        if (richBlocks.length === 0) {
          skipped++;
          continue;
        }

        try {
          // Group flat blocks into parent-child: timestamp = parent, following
          // content blocks = metadata.children (until the next timestamp block)
          const parentBlocks = this._groupBlocksByTimestamp(richBlocks);

          // Step 1: upsert only timestamp (parent) blocks into the collection
          await this.richBlocksService.bulkUpsert(articleId, parentBlocks);

          // Step 2: clear richBlocks on the article — liveblog articles are
          // always served from the collection, never from the article document
          await this.articleModel.collection.updateOne(
            { _id: article._id },
            { $set: { richBlocks: [] } }
          );

          processed++;
          this.logger.log(
            `[migrateLiveblogRichBlocks] ${articleId}${limit ? ` (${article.slug})` : ''}: ${richBlocks.length} flat blocks → ${parentBlocks.length} parent blocks in collection`,
            this.constructor.name
          );
        } catch (error) {
          failed++;
          const msg = `${articleId}: ${error.message}`;
          errors.push(msg);
          this.logger.error(`[migrateLiveblogRichBlocks] Failed — ${msg}`, this.constructor.name);
        }
      }

      skip += articles.length;
    }

    const summary = { total, processed, skipped, failed, errors };
    this.logger.log(
      `[migrateLiveblogRichBlocks] Done — ${JSON.stringify({ total, processed, skipped, failed })}`,
      this.constructor.name
    );
    return summary;
  }

  /**
   * Groups a flat list of richBlocks into timestamp-parent / content-children pairs.
   * Each timestamp block gets a metadata.children array containing all content
   * blocks that follow it up to (but not including) the next timestamp block.
   * Blocks that appear before the first timestamp are left as-is (no parent).
   */
  private _groupBlocksByTimestamp(richBlocks: any[]): any[] {
    const result: any[] = [];
    let currentParent: any | null = null;

    for (const block of richBlocks) {
      if (block.type === 'timestamp') {
        currentParent = {
          ...block,
          metadata: {
            ...(block.metadata ?? {}),
            children: [],
          },
        };
        result.push(currentParent);
      } else if (currentParent) {
        currentParent.metadata.children.push(block);
      } else {
        // Content block before any timestamp — push as top-level
        result.push(block);
      }
    }

    return result;
  }

  async migrateSlugRankMathHeaders(limit?: number): Promise<{
    total: number;
    processed: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    const POSTS_PER_PAGE = 100;
    const ES_INDEX = process.env.ELASTIC_INDEX || 'article';
    const site = process.env.SITE;
    const REDIS_CHECKPOINT_KEY = 'migrate:slug-rankmath-headers:checkpoint-date';
    const NOINDEX_PREFIX = '<meta name="robots" content="follow, noindex"/>';

    if (!site) throw new Error('SITE env var is not set');

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Determine start date from Redis checkpoint or earliest matching article
    const checkpointDateStr: string | null = await this.redisService.get(REDIS_CHECKPOINT_KEY);

    let currentDate: Date;
    if (checkpointDateStr) {
      this.logger.log(
        `[migrateSlugRankMathHeaders] Resuming from checkpoint: ${checkpointDateStr}`,
        this.constructor.name
      );
      currentDate = new Date(checkpointDateStr);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      currentDate.setUTCHours(0, 0, 0, 0);
    } else {
      currentDate = new Date('2013-07-08T00:00:00.000Z');
    }

    const endDate = new Date();
    endDate.setUTCHours(23, 59, 59, 999);

    this.logger.log(
      `[migrateSlugRankMathHeaders] Starting${limit ? ` (limit: ${limit})` : ''} from ${currentDate.toISOString().split('T')[0]}`,
      this.constructor.name
    );

    while (currentDate <= endDate) {
      if (limit && processed + failed >= limit) break;

      const dateStr = currentDate.toISOString().split('T')[0];
      const dayStart = `${dateStr}T00:00:00`;
      const dayEnd = `${dateStr}T23:59:59`;

      let daySearchAfter: any[] | undefined = undefined;
      let dayKeepGoing = true;

      while (dayKeepGoing) {
        const remaining = limit ? limit - processed - failed : POSTS_PER_PAGE;
        if (remaining <= 0) break;

        const result = await this.elasticService.search(ES_INDEX, {
          size: Math.min(POSTS_PER_PAGE, remaining),
          query: {
            bool: {
              must: [
                { regexp: { slug: '[0-9]+-' } },
                { range: { publishedAt: { gte: dayStart, lte: dayEnd } } },
              ],
            },
          },
          sort: [{ publishedAt: { order: 'asc' } }, { _doc: { order: 'asc' } }],
          ...(daySearchAfter ? { search_after: daySearchAfter } : {}),
        });

        const hits: any[] = result.hits?.hits || [];
        if (!hits.length) {
          dayKeepGoing = false;
          break;
        }

        this.logger.log(
          `[migrateSlugRankMathHeaders] [${dateStr}] Fetched ${hits.length} articles`,
          this.constructor.name
        );

        const bulkOps: any[] = [];

        for (const hit of hits) {
          const mongoId = hit._id;
          const post = hit._source as any;

          if (!post.header?.startsWith(NOINDEX_PREFIX)) {
            skipped++;
            this.logger.log(
              `[migrateSlugRankMathHeaders] Skipping ${post.slug} (header does not start with noindex meta)`,
              this.constructor.name
            );
            continue;
          }

          try {
            const agent = new http.Agent({ keepAlive: true });
            const articleUrl = `${site}/${post.fullSlug}`;
            const headerRes = await axios.get(`${site}/wp-json/rankmath/v1/getHead`, {
              params: { url: articleUrl },
              httpAgent: agent,
            });
            const header = headerRes.data.head;

            bulkOps.push({
              updateOne: {
                filter: { _id: mongoId },
                update: { $set: { header } },
              },
            });

            processed++;
            this.logger.log(
              `[migrateSlugRankMathHeaders] Queued ${post.slug}${limit ? ` (${processed}/${limit})` : ''}`,
              this.constructor.name
            );
          } catch (err) {
            failed++;
            const msg = `${post.slug}: ${err.message}`;
            errors.push(msg);
            console.error(
              `[migrateSlugRankMathHeaders] Error for ${post.slug}:`,
              err.response?.data ?? err.message
            );
            this.logger.error(
              `[migrateSlugRankMathHeaders] Failed — ${msg}`,
              this.constructor.name
            );
          }

          await new Promise((res) => setTimeout(res, 200));

          if (limit && processed + failed >= limit) break;
        }

        if (bulkOps.length) {
          await this.articleModel.bulkWrite(bulkOps, { timestamps: false } as any);
          this.logger.log(
            `[migrateSlugRankMathHeaders] [${dateStr}] Bulk wrote ${bulkOps.length} articles`,
            this.constructor.name
          );
        }

        if (hits.length < POSTS_PER_PAGE || (limit && processed + failed >= limit)) {
          dayKeepGoing = false;
        } else {
          daySearchAfter = hits[hits.length - 1].sort;
        }
      }

      // Save checkpoint after completing the day
      await this.redisService.set(REDIS_CHECKPOINT_KEY, dateStr);
      this.logger.log(
        `[migrateSlugRankMathHeaders] Checkpoint saved: ${dateStr}`,
        this.constructor.name
      );

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    const summary = { total: processed + failed + skipped, processed, failed, skipped, errors };
    this.logger.log(
      `[migrateSlugRankMathHeaders] Done — ${JSON.stringify({ total: summary.total, processed, failed, skipped })}`,
      this.constructor.name
    );
    return summary;
  }

  async fixVideoMediaPaths(): Promise<{ total: number; updated: number; skipped: number }> {
    const BATCH_SIZE = 500;
    let updated = 0;
    let skipped = 0;
    let processedTotal = 0;

    const extractUploadsPath = (value: string): string | null => {
      if (!value) return null;
      const match = value.match(/(\/uploads\/.+)/i);
      return match ? match[1] : null;
    };

    const cursor = this.fileUploadModel
      .find({ mimeType: 'video/mp4' })
      .select('path folderPath')
      .lean()
      .cursor();

    const bulkOps: any[] = [];

    for await (const doc of cursor) {
      processedTotal++;
      const newPath = extractUploadsPath((doc as any).path);
      const newFolderPath = extractUploadsPath((doc as any).folderPath);

      if (!newPath && !newFolderPath) {
        skipped++;
        continue;
      }

      const $set: any = {};
      if (newPath) $set.path = newPath;
      if (newFolderPath) $set.folderPath = newFolderPath;

      bulkOps.push({
        updateOne: {
          filter: { _id: (doc as any)._id },
          update: { $set },
        },
      });

      if (bulkOps.length >= BATCH_SIZE) {
        await this.fileUploadModel.bulkWrite(bulkOps, { timestamps: false } as any);
        updated += bulkOps.length;
        this.logger.log(`[fixVideoMediaPaths] Flushed ${updated} updates`, this.constructor.name);
        bulkOps.length = 0;
      }
    }

    if (bulkOps.length) {
      await this.fileUploadModel.bulkWrite(bulkOps, { timestamps: false } as any);
      updated += bulkOps.length;
    }

    skipped = processedTotal - updated;
    this.logger.log(
      `[fixVideoMediaPaths] Done — total: ${processedTotal}, updated: ${updated}, skipped: ${skipped}`,
      this.constructor.name
    );
    return { total: processedTotal, updated, skipped };
  }
}
