import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';

import { MigrationResult } from '../migrator-provider.interface';
import { TCurrentUserType } from '@auth/types/user.type';
import { Article, TArticleDocument } from '@articles/schemas/article.schema';
import { Tag, TTagDocument } from '@tags/entities/tags.schema';
import { Category, TCategoryDocument } from '../../category/entities/category.schema';
import { User, TUserDocument } from '@user/entities/user.schema';
import { Slug, TSlugDocument } from '@cms/slug/entities/slug.schema';
import { TagsService } from '@tags/tags.service';
import { buildUserMetadata } from '@core/utils/utils';
import { ARTICLE_TYPE, ModuleName, STATUS } from '@core/constants/enums.constants';
import { PropertyService } from '@property/property.service';
import { ElasticService } from '@core/elastic/elastic.service';

// ============================================
// YouTube Data API v3 Response Types
// ============================================

interface YouTubeChannelResponse {
  items: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }>;
}

interface YouTubePlaylistItemsResponse {
  items: Array<{ snippet: { resourceId: { videoId: string } } }>;
  nextPageToken?: string;
}

interface Snippet {
  title: string;
  description: string;
  publishedAt: string;
  thumbnails: Thumbnails;
  channelTitle?: string;
  tags?: string[];
}

interface Thumbnails {
  maxres?: Thumbnail;
  high?: Thumbnail;
  standard?: Thumbnail;
  medium?: Thumbnail;
  default?: Thumbnail;
}

interface Thumbnail {
  url: string;
  width?: number;
  height?: number;
}

interface YouTubeVideoListResponse {
  items: YouTubeVideoItem[];
}

interface YouTubeVideoItem {
  id: string;
  snippet: Snippet;
  contentDetails?: { duration?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

// ============================================
// Internal Video Representation
// ============================================

enum VideoType {
  Short = 'short',
  Landscape = 'landscape',
}

interface VideoData {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  channelTitle: string;
  tags: string[];
  durationIso?: string;
  durationReadable: string;
  durationSeconds: number;
  videoType: VideoType;
  viewCount?: string;
  likeCount?: string;
  embedUrl: string;
  watchUrl: string;
  videoUrl: string;
}

export interface YouTubeMigrationOptions {
  channelId?: string;
  mode?: 'shorts' | 'landscape' | 'all';
  maxResults?: number;
  postStatus?: string;
  dryRun?: boolean;
  propertyId?: string;
  lang?: string;
  /**
   * When true, stop the migration as soon as a video already present in the DB
   * is encountered. YouTube's uploads playlist is newest-first, so the first
   * hit means we have caught up — everything older is already imported.
   * Designed for short-interval cron runs (e.g. every 5 minutes).
   */
  stopOnExisting?: boolean;
}

// ============================================
// YouTube Provider
// ============================================

@Injectable()
export class YouTubeProvider {
  private readonly logger = new Logger(YouTubeProvider.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Article.name) private readonly articleModel: Model<TArticleDocument>,
    @InjectModel(Tag.name) private readonly tagModel: Model<TTagDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<TCategoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<TUserDocument>,
    @InjectModel(Slug.name) private readonly slugModel: Model<TSlugDocument>,
    private readonly propertyService: PropertyService,
    private readonly elasticService: ElasticService,
    private readonly tagsService: TagsService
  ) {}

  async migrateYoutubeVideos(
    user: TCurrentUserType,
    opts: YouTubeMigrationOptions
  ): Promise<MigrationResult> {
    const apiKey = this.configService.get<string>('YOUTUBE_API_KEY');
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY is not configured');
    }

    const channelId = opts.channelId || this.configService.get<string>('YOUTUBE_CHANNEL_ID');
    if (!channelId) {
      throw new Error('Channel ID is required. Set YOUTUBE_CHANNEL_ID or pass it as an argument.');
    }

    const mode =
      opts.mode || (this.configService.get<string>('YOUTUBE_FETCH_MODE') as any) || 'all';
    // 0 = fetch all (paginate until exhausted)
    const maxResults =
      opts.maxResults ?? parseInt(this.configService.get<string>('YOUTUBE_MAX_RESULTS') || '0', 10);
    const postStatus =
      opts.postStatus || this.configService.get<string>('YOUTUBE_POST_STATUS') || 'draft';
    const dryRun = opts.dryRun ?? false;
    const lang = opts.lang || this.configService.get<string>('YOUTUBE_DEFAULT_LANG') || 'hi';
    const stopOnExisting =
      opts.stopOnExisting ??
      (this.configService.get<string>('YOUTUBE_STOP_ON_EXISTING') || '').toLowerCase() === 'true';

    // Property and org info
    const isValidObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id);

    const rawPropertyId =
      opts.propertyId ||
      this.configService.get<string>('YOUTUBE_PROPERTY_ID') ||
      this.configService.get<string>('DEFAULT_PROPERTY_ID');
    const propertyId = rawPropertyId && isValidObjectId(rawPropertyId) ? rawPropertyId : undefined;

    const rawOrgId = this.configService.get<string>('DEFAULT_ORGANIZATION_ID');
    const orgId = rawOrgId && isValidObjectId(rawOrgId) ? rawOrgId : undefined;

    this.logger.log(
      `[YouTubeProvider] Resolved propertyId=${propertyId ?? `INVALID(${rawPropertyId})`}, orgId=${orgId ?? `INVALID(${rawOrgId})`}`,
      this.constructor.name
    );

    if (!propertyId || !orgId) {
      throw new Error(
        `Property ID and Organization ID must be valid 24-char ObjectIds. Got propertyId="${rawPropertyId}", orgId="${rawOrgId}". Set DEFAULT_PROPERTY_ID and DEFAULT_ORGANIZATION_ID env vars.`
      );
    }

    // Resolve property details from DB (ensures domain is always accurate)
    const property = await this.propertyService.getById(propertyId);
    const propertyName =
      property?.name ||
      this.configService.get<string>('DEFAULT_PROPERTY_NAME') ||
      'Default Property';
    const propertyDomain =
      property?.domain || this.configService.get<string>('DEFAULT_PROPERTY_DOMAIN') || '';
    const orgName = this.configService.get<string>('DEFAULT_ORG_NAME') || 'Default Organization';

    // Resolve default tag, category, author by slug
    const defaultTagSlug = this.configService.get<string>('YOUTUBE_DEFAULT_TAG_SLUG') || 'video';
    const defaultCategorySlug =
      this.configService.get<string>('YOUTUBE_DEFAULT_CATEGORY_SLUG') || 'video';
    const defaultAuthorSlug =
      this.configService.get<string>('YOUTUBE_DEFAULT_AUTHOR_SLUG') || 'janardan-pandey';

    const [defaultTag, defaultCategory, defaultAuthor] = await Promise.all([
      this.tagModel.findOne({ slug: defaultTagSlug }).lean().exec(),
      this.categoryModel.findOne({ slug: defaultCategorySlug }).lean().exec(),
      this.userModel.findOne({ slug: defaultAuthorSlug }).lean().exec(),
    ]);

    if (!defaultTag)
      this.logger.warn(
        `[YouTubeProvider] Default tag "${defaultTagSlug}" not found`,
        this.constructor.name
      );
    if (!defaultCategory)
      this.logger.warn(
        `[YouTubeProvider] Default category "${defaultCategorySlug}" not found`,
        this.constructor.name
      );
    if (!defaultAuthor)
      this.logger.warn(
        `[YouTubeProvider] Default author "${defaultAuthorSlug}" not found`,
        this.constructor.name
      );

    this.logger.log(`[YouTubeProvider] Starting YouTube migration`, this.constructor.name);
    this.logger.log(`[YouTubeProvider] Channel: ${channelId}`, this.constructor.name);
    this.logger.log(
      `[YouTubeProvider] Mode: ${mode}, MaxResults: ${maxResults}, Status: ${postStatus}, DryRun: ${dryRun}, StopOnExisting: ${stopOnExisting}`,
      this.constructor.name
    );

    const startTime = Date.now();
    const lap = (label: string, since: number) =>
      this.logger.log(`[YT-PERF] ${label}: ${Date.now() - since}ms`, this.constructor.name);
    const created: string[] = [];
    const errors: any[] = [];

    // 1. Resolve uploads playlist — contains every video the channel has published
    const tPlaylist = Date.now();
    const uploadsPlaylistId = await this.getUploadsPlaylistId(apiKey, channelId);
    lap('getUploadsPlaylistId', tPlaylist);

    const updated: string[] = [];
    const ctx = {
      propertyId,
      propertyName,
      propertyDomain,
      orgId,
      orgName,
      postStatus,
      lang,
      defaultTag,
      defaultCategory,
      defaultAuthor,
    };

    let pageToken: string | undefined;
    let totalScanned = 0;
    let pageIndex = 0;
    let stopRequested = false;

    // Stream through playlist pages: fetch → filter → insert/update immediately
    do {
      pageIndex++;
      const tPage = Date.now();
      let playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`;
      if (pageToken) playlistUrl += `&pageToken=${pageToken}`;

      const tPlaylistFetch = Date.now();
      const playlistResp = await axios.get<YouTubePlaylistItemsResponse>(playlistUrl);
      lap(`page#${pageIndex} playlistItems API`, tPlaylistFetch);
      const playlistData = playlistResp.data;
      const videoIds = playlistData.items
        .map((item) => item.snippet?.resourceId?.videoId)
        .filter((id): id is string => Boolean(id));

      if (videoIds.length === 0) break;
      totalScanned += videoIds.length;

      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`;
      const tDetailsFetch = Date.now();
      const detailsResp = await axios.get<YouTubeVideoListResponse>(detailsUrl);
      lap(`page#${pageIndex} videos API`, tDetailsFetch);
      // Classify each video as Short vs Landscape using a tiered strategy:
      //   1. duration > 180s  → Landscape (can't be a Short by definition)
      //   2. `#shorts` hashtag in title/description/tags → Short (cheap positive signal)
      //   3. probe /shorts/{id} redirect — matches YouTube's own classification
      //      (considers vertical aspect ratio, not just duration)
      const rawBatch: VideoData[] = await Promise.all(
        detailsResp.data.items.map(async (item) => {
          const thumbnailUrl = getBestThumbnail(item.snippet.thumbnails);
          const durationIso = item.contentDetails?.duration;
          if (!durationIso) {
            this.logger.warn(
              `[YouTubeProvider] Missing contentDetails.duration for video ${item.id} — falling back to 0s`,
              this.constructor.name
            );
          }
          const durationSeconds = durationIso ? parseDurationSeconds(durationIso) : 0;
          const durationReadable = formatDurationReadable(durationSeconds);

          let videoType: VideoType;
          if (durationSeconds > 180) {
            videoType = VideoType.Landscape;
          } else if (hasShortsHashtag(item.snippet)) {
            videoType = VideoType.Short;
          } else {
            const isShort = await probeIsYouTubeShort(item.id);
            videoType = isShort ? VideoType.Short : VideoType.Landscape;
          }

          const watchUrl = `https://www.youtube.com/watch?v=${item.id}`;
          const shortsUrl = `https://www.youtube.com/shorts/${item.id}`;
          return {
            videoId: item.id,
            title: decodeHtmlEntities(item.snippet.title),
            description: item.snippet.description,
            publishedAt: item.snippet.publishedAt,
            thumbnailUrl,
            channelTitle: item.snippet.channelTitle || 'Unknown',
            tags: item.snippet.tags || [],
            durationIso,
            durationReadable,
            durationSeconds,
            videoType,
            viewCount: item.statistics?.viewCount,
            likeCount: item.statistics?.likeCount,
            embedUrl: `https://www.youtube.com/embed/${item.id}`,
            watchUrl,
            videoUrl: videoType === VideoType.Short ? shortsUrl : watchUrl,
          };
        })
      );
      const batch: VideoData[] = rawBatch.filter((v) => {
        if (mode === 'shorts') return v.videoType === VideoType.Short;
        if (mode === 'landscape') return v.videoType === VideoType.Landscape;
        return true;
      });

      // Cap the batch by remaining maxResults so we never overshoot
      const remaining =
        maxResults > 0 ? Math.max(0, maxResults - created.length - updated.length) : batch.length;
      const cappedBatch = remaining < batch.length ? batch.slice(0, remaining) : batch;

      this.logger.log(
        `[YouTubeProvider] Page scanned: ${totalScanned} total, ${cappedBatch.length} match mode="${mode}" — bulk processing...`,
        this.constructor.name
      );

      if (cappedBatch.length === 0) {
        if (maxResults > 0 && created.length + updated.length >= maxResults) {
          pageToken = undefined;
          break;
        }
        pageToken = playlistData.nextPageToken;
        continue;
      }

      try {
        // 1. Bulk existence check (one indexed query for the whole page).
        // `slug` is indexed, `featuredVideo.id` is not — so we query by slug
        // alone, computing both the new `{date}-{videoId}` slug and the legacy
        // `{videoId}` slug for each video and mapping back afterwards.
        const slugToVideoId = new Map<string, string>();
        for (const v of cappedBatch) {
          const newSlug = `${formatPublishedDateForSlug(v.publishedAt)}-${v.videoId}`;
          slugToVideoId.set(newSlug, v.videoId);
          slugToVideoId.set(v.videoId, v.videoId); // legacy format
        }
        const slugsToCheck = Array.from(slugToVideoId.keys());

        const tExistence = Date.now();
        const existingDocs = await this.articleModel
          .find({ slug: { $in: slugsToCheck } })
          .select('_id slug')
          .lean()
          .exec();
        lap(
          `page#${pageIndex} existence check (${cappedBatch.length} videos, ${existingDocs.length} hits)`,
          tExistence
        );

        const existingIdByVideoId = new Map<string, string>();
        for (const doc of existingDocs) {
          const vid = slugToVideoId.get((doc as any).slug);
          if (vid) existingIdByVideoId.set(vid, (doc as any)._id.toString());
        }

        // Early-stop: YouTube's uploads playlist is newest-first. The moment
        // we encounter a video that's already in the DB, everything older is
        // already imported — trim the batch to the strictly newer ones and
        // flag the outer loop to terminate after this page's creates.
        let trimmedBatch = cappedBatch;
        if (stopOnExisting && existingIdByVideoId.size > 0) {
          const firstExistingIdx = cappedBatch.findIndex((v) =>
            existingIdByVideoId.has(v.videoId)
          );
          if (firstExistingIdx >= 0) {
            trimmedBatch = cappedBatch.slice(0, firstExistingIdx);
            stopRequested = true;
            this.logger.log(
              `[YouTubeProvider] stopOnExisting: found existing video at index ${firstExistingIdx} on page#${pageIndex} — will create ${trimmedBatch.length} newer item(s) then stop`,
              this.constructor.name
            );
          }
        }

        // 2. Pre-resolve every unique tag-name for the page exactly once
        const tTags = Date.now();
        const uniqueTagNames = Array.from(
          new Set(
            trimmedBatch
              .flatMap((v) => v.tags || [])
              .map((t) => (t || '').trim())
              .filter(Boolean)
          )
        );
        const resolvedTagList = await this.resolveHashtagTags(uniqueTagNames, user, propertyId);
        lap(
          `page#${pageIndex} tag resolve (${uniqueTagNames.length} unique → ${resolvedTagList.length})`,
          tTags
        );
        const tagBySlug = new Map(resolvedTagList.map((t) => [t.slug, t]));
        const lookupTagsForVideo = (videoTags: string[]) => {
          const out: Array<{ id: string; name: string; slug: string }> = [];
          const seen = new Set<string>();
          for (const raw of videoTags || []) {
            const slug = slugify((raw || '').trim(), { lower: true, strict: true });
            if (!slug || seen.has(slug)) continue;
            seen.add(slug);
            const t = tagBySlug.get(slug);
            if (t) out.push(t);
          }
          return out;
        };

        // 3. Build thumbnail sub-docs inline — no FileUpload persistence.
        // The article carries all the fields the frontend needs (id, path,
        // url, alt, caption); persisting a FileUpload row per video was the
        // main bottleneck (saveFileToDB + unindexed url lookup per video).
        const tThumbs = Date.now();
        const featuredMediaList = trimmedBatch.map((v) => ({
          id: uuidv4(),
          fileName: `${v.videoId}.jpg`,
          path: `/uploads/youtube/${v.videoId}.jpg`,
          url: v.thumbnailUrl,
          alt: v.title,
          caption: v.title,
        }));
        lap(`page#${pageIndex} thumbnail build (${trimmedBatch.length})`, tThumbs);

        // 4. Split into create / update buckets
        type CreateEntry = {
          video: VideoData;
          mergedTags: any[];
          featuredMedia: any;
          baseSlug: string;
          publishedAt: Date;
        };
        type UpdateEntry = {
          existingId: string;
          video: VideoData;
          mergedTags: any[];
          featuredMedia: any;
          publishedAt: Date;
        };
        const toCreate: CreateEntry[] = [];
        const toUpdate: UpdateEntry[] = [];

        for (let i = 0; i < trimmedBatch.length; i++) {
          const video = trimmedBatch[i];
          const featuredMedia = featuredMediaList[i];
          // Cap at 5 hashtag tags per article (no default tag)
          const mergedTags = lookupTagsForVideo(video.tags || []).slice(0, 5);
          const pubRaw = video.publishedAt ? new Date(video.publishedAt) : new Date();
          const publishedAt = isNaN(pubRaw.getTime()) ? new Date() : pubRaw;
          const existingId = existingIdByVideoId.get(video.videoId);
          if (existingId) {
            toUpdate.push({ existingId, video, mergedTags, featuredMedia, publishedAt });
          } else {
            const baseSlug = `${formatPublishedDateForSlug(video.publishedAt)}-${video.videoId}`;
            toCreate.push({ video, mergedTags, featuredMedia, baseSlug, publishedAt });
          }
        }

        // 5a. Bulk create
        if (toCreate.length > 0) {
          if (dryRun) {
            for (const c of toCreate) {
              this.logger.log(
                `[YouTubeProvider] [DRY RUN] Would create: ${c.video.title}`,
                this.constructor.name
              );
              created.push(c.video.videoId);
            }
          } else {
            // Build article docs and bulk-insert via the raw collection driver.
            // This bypasses Mongoose's timestamps:true middleware so the
            // createdAt/updatedAt we set on the doc (= publishedAt) are
            // preserved — no follow-up bulkWrite needed.
            const tBuildDocs = Date.now();
            const articleDocs = toCreate.map((c) => {
              const doc = this.buildArticleDoc(c.video, user, {
                ...ctx,
                mergedTags: c.mergedTags,
                featuredMedia: c.featuredMedia,
                slug: c.baseSlug,
              });
              doc.createdAt = c.publishedAt;
              doc.updatedAt = c.publishedAt;
              return doc;
            });
            lap(`page#${pageIndex} buildArticleDoc x${articleDocs.length}`, tBuildDocs);

            const tArticleInsert = Date.now();
            let insertedCount = 0;
            try {
              const result = await this.articleModel.collection.insertMany(articleDocs, {
                ordered: false,
              });
              insertedCount = result.insertedCount;
            } catch (insertErr) {
              const writeErrors = (insertErr as any)?.writeErrors || [];
              const insertedDocs =
                (insertErr as any)?.insertedDocs || (insertErr as any)?.result?.insertedDocs || [];
              insertedCount = Array.isArray(insertedDocs)
                ? insertedDocs.length
                : articleDocs.length - writeErrors.length;
              this.logger.warn(
                `[YouTubeProvider] Bulk article insert had ${writeErrors.length} failures — ${insertedCount} succeeded`,
                this.constructor.name
              );
              for (const we of writeErrors) {
                const idx = we?.index;
                const failed = idx != null ? toCreate[idx] : undefined;
                if (failed) {
                  errors.push({
                    videoId: failed.video.videoId,
                    title: failed.video.title,
                    error: we?.errmsg || we?.message || 'unknown insert error',
                  });
                }
              }
            }
            lap(
              `page#${pageIndex} article insertMany (${insertedCount}/${articleDocs.length})`,
              tArticleInsert
            );

            for (const c of toCreate) created.push(c.video.videoId);

            this.logger.log(
              `[YouTubeProvider] Bulk created ${insertedCount}/${toCreate.length} articles`,
              this.constructor.name
            );
          }
        }

        // 5b. Bulk update
        if (toUpdate.length > 0) {
          if (dryRun) {
            for (const u of toUpdate) {
              this.logger.log(
                `[YouTubeProvider] [DRY RUN] Would update: ${u.video.title}`,
                this.constructor.name
              );
              updated.push(u.video.videoId);
            }
          } else {
            const updateBulk = toUpdate.map((u) => {
              const payload = this.buildUpdatePayload(u.video, user, {
                defaultTag: ctx.defaultTag,
                defaultCategory: ctx.defaultCategory,
                defaultAuthor: ctx.defaultAuthor,
                mergedTags: u.mergedTags,
                featuredMedia: u.featuredMedia,
              });
              return {
                updateOne: {
                  filter: { _id: new Types.ObjectId(u.existingId) },
                  update: {
                    $set: { ...payload, createdAt: u.publishedAt, updatedAt: u.publishedAt },
                  },
                },
              };
            });

            const tUpdate = Date.now();
            try {
              await this.articleModel.collection.bulkWrite(updateBulk);
            } catch (updErr) {
              this.logger.warn(
                `[YouTubeProvider] Bulk update failed: ${updErr.message}`,
                this.constructor.name
              );
            }
            lap(`page#${pageIndex} update bulkWrite (${updateBulk.length})`, tUpdate);

            for (const u of toUpdate) updated.push(u.video.videoId);

            this.logger.log(
              `[YouTubeProvider] Bulk updated ${toUpdate.length} articles`,
              this.constructor.name
            );
          }
        }
      } catch (pageErr) {
        this.logger.error(
          `[YouTubeProvider] Page processing failed: ${pageErr.message}`,
          this.constructor.name
        );
        errors.push({ page: pageToken || 'first', error: pageErr.message });
      }

      lap(`page#${pageIndex} TOTAL`, tPage);

      pageToken = playlistData.nextPageToken;
      if (stopRequested) break;
    } while (pageToken && (maxResults === 0 || created.length + updated.length < maxResults));

    const duration = Date.now() - startTime;
    this.logger.log(
      `[YouTubeProvider] Done — Created: ${created.length}, Updated: ${updated.length}, Errors: ${errors.length}, Scanned: ${totalScanned}, Duration: ${duration}ms`,
      this.constructor.name
    );

    return {
      success: true,
      created: created.length,
      updated: updated.length,
      total: created.length + updated.length,
      errors,
      duration,
    };
  }

  /**
   * Fix listing order for shorts/video articles: set createdAt and updatedAt to match
   * publishedAt so that newest videos appear first in createdAt-desc listings.
   * Optionally filter by propertyId and/or articleType.
   */
  async reorderShortsTimestamps(opts: {
    propertyId?: string;
    articleType?: string;
  }): Promise<{ updated: number; errors: number }> {
    const filter: Record<string, any> = {
      type: opts.articleType || ARTICLE_TYPE.SHORTS,
    };
    if (opts.propertyId) filter['property.id'] = opts.propertyId;

    const articles = await this.articleModel
      .find(filter)
      .select('_id title publishedAt')
      .sort({ publishedAt: 1 })
      .lean()
      .exec();

    this.logger.log(
      `[YouTubeProvider] Reordering timestamps for ${articles.length} "${filter.type}" articles...`,
      this.constructor.name
    );

    let updated = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        const ts = article.publishedAt ? new Date(article.publishedAt) : new Date();
        const tsIso = ts.toISOString();

        // Update MongoDB timestamps directly (bypasses Mongoose auto-timestamp)
        await this.articleModel.collection.updateOne(
          { _id: article._id },
          { $set: { createdAt: ts, updatedAt: ts } }
        );

        // Sync the same timestamps to Elasticsearch
        try {
          await this.elasticService.updateDocument(ModuleName.ARTICLE, article._id.toString(), {
            createdAt: tsIso,
            updatedAt: tsIso,
          });
        } catch (esError) {
          this.logger.warn(
            `[YouTubeProvider] ES sync failed for ${article._id}: ${esError.message}`,
            this.constructor.name
          );
        }

        updated++;
      } catch (error) {
        this.logger.error(
          `[YouTubeProvider] Failed to reorder ${article._id}: ${error.message}`,
          this.constructor.name
        );
        errors++;
      }
    }

    this.logger.log(
      `[YouTubeProvider] Reorder done — updated: ${updated}, errors: ${errors}`,
      this.constructor.name
    );

    return { updated, errors };
  }

  /**
   * Verify that articles currently stored as Shorts are *actually* Shorts per
   * YouTube's own classification, and HARD-DELETE the ones that aren't.
   * Mirrors the migrate-youtube-videos tiered strategy, minus the positive
   * hashtag shortcut:
   *   1. duration > 180s  → not a Short (guaranteed misclassification)
   *   2. /shorts/{id} probe → if it redirects to /watch, not a Short
   * Each misclassified article (and its slug doc) is removed from MongoDB
   * and Elasticsearch.
   */
  async verifyShortsClassification(opts: {
    propertyId?: string;
    articleType?: string;
    limit?: number;
  }): Promise<{
    scanned: number;
    correct: number;
    misclassified: number;
    deleted: number;
    missingVideoId: number;
    errors: number;
    details: Array<{ id: string; slug: string; videoId: string; reason: string }>;
  }> {
    const filter: Record<string, any> = { type: opts.articleType || ARTICLE_TYPE.SHORTS };
    if (opts.propertyId) filter['property.id'] = opts.propertyId;

    const query = this.articleModel
      .find(filter)
      .select('_id slug featuredVideo title')
      .sort({ publishedAt: -1 })
      .lean();
    if (opts.limit && opts.limit > 0) query.limit(opts.limit);
    const articles = await query.exec();

    this.logger.log(
      `[YouTubeProvider] Verifying ${articles.length} "${filter.type}" articles against YouTube classification...`,
      this.constructor.name
    );

    let correct = 0;
    let misclassified = 0;
    let deleted = 0;
    let missingVideoId = 0;
    let errors = 0;
    const details: Array<{ id: string; slug: string; videoId: string; reason: string }> = [];

    for (const article of articles) {
      const a = article as any;
      const videoId: string | undefined = a.featuredVideo?.id;
      const slug: string = a.slug || '';
      if (!videoId) {
        missingVideoId++;
        continue;
      }
      try {
        const durSec = parseReadableDurationSeconds(a.featuredVideo?.duration);
        let reason: string | null = null;
        if (durSec > 180) {
          reason = `duration ${durSec}s > 180s — not a Short`;
        } else {
          const isShort = await probeIsYouTubeShort(videoId);
          if (!isShort) {
            reason = '/shorts/{id} redirects to /watch — not a Short';
          }
        }

        if (!reason) {
          correct++;
          continue;
        }

        misclassified++;
        details.push({ id: a._id.toString(), slug, videoId, reason });

        const removed = await this.hardDeleteArticle(a._id.toString(), slug);
        if (removed) deleted++;
      } catch (e) {
        errors++;
        this.logger.warn(
          `[YouTubeProvider] Verify failed for ${a._id}: ${(e as Error).message}`,
          this.constructor.name
        );
      }
    }

    this.logger.log(
      `[YouTubeProvider] Verify done — scanned: ${articles.length}, correct: ${correct}, misclassified: ${misclassified}, deleted: ${deleted}, missingVideoId: ${missingVideoId}, errors: ${errors}`,
      this.constructor.name
    );

    return {
      scanned: articles.length,
      correct,
      misclassified,
      deleted,
      missingVideoId,
      errors,
      details,
    };
  }

  private async hardDeleteArticle(articleId: string, slug: string): Promise<boolean> {
    const res = await this.articleModel.deleteOne({ _id: articleId }).exec();
    try {
      await this.elasticService.deleteDocument(ModuleName.ARTICLE, articleId);
    } catch (err) {
      this.logger.warn(
        `[YouTubeProvider] ES article delete failed for ${articleId}: ${(err as Error).message}`,
        this.constructor.name
      );
    }

    if (slug) {
      try {
        const slugDoc = await this.slugModel
          .findOneAndDelete({ slug, type: ModuleName.ARTICLE })
          .exec();
        if (slugDoc?._id) {
          try {
            await this.elasticService.deleteDocument(ModuleName.SLUG, slugDoc._id.toString());
          } catch (err) {
            this.logger.warn(
              `[YouTubeProvider] ES slug delete failed for ${slug}: ${(err as Error).message}`,
              this.constructor.name
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `[YouTubeProvider] Mongo slug delete failed for ${slug}: ${(err as Error).message}`,
          this.constructor.name
        );
      }
    }

    return (res.deletedCount ?? 0) > 0;
  }

  /**
   * Hard-delete slug documents from MongoDB that correspond to articles of the
   * given type (defaults to "shorts"). Walks the articles collection, collects
   * each article's slug, then removes matching docs from the `slugs` collection.
   * Elasticsearch is NOT touched. Optional propertyId narrows the article query.
   */
  async hardDeleteSlugsForArticleType(opts: {
    propertyId?: string;
    articleType?: string;
  }): Promise<{ scanned: number; deleted: number; missing: number; errors: number }> {
    const articleType = opts.articleType || ARTICLE_TYPE.SHORTS;
    const filter: Record<string, any> = { type: articleType };
    if (opts.propertyId) filter['property.id'] = opts.propertyId;

    const articles = await this.articleModel.find(filter).select('_id slug').lean().exec();

    this.logger.log(
      `[YouTubeProvider] Hard-deleting slug docs for ${articles.length} "${articleType}" articles...`,
      this.constructor.name
    );

    let deleted = 0;
    let missing = 0;
    let errors = 0;

    for (const article of articles) {
      const slug = (article as any).slug;
      if (!slug) {
        missing++;
        continue;
      }

      try {
        const result = await this.slugModel.deleteOne({ slug, type: ModuleName.ARTICLE }).exec();

        if (result.deletedCount && result.deletedCount > 0) {
          deleted++;
        } else {
          missing++;
        }
      } catch (err) {
        this.logger.error(
          `[YouTubeProvider] Failed to delete slug "${slug}" for article ${article._id}: ${err.message}`,
          this.constructor.name
        );
        errors++;
      }
    }

    this.logger.log(
      `[YouTubeProvider] Slug hard-delete done — scanned: ${articles.length}, deleted: ${deleted}, missing: ${missing}, errors: ${errors}`,
      this.constructor.name
    );

    return { scanned: articles.length, deleted, missing, errors };
  }

  // ============================================
  // YouTube API Helpers
  // ============================================

  /**
   * Resolve the channel's uploads playlist ID (contains every published video).
   */
  private async getUploadsPlaylistId(apiKey: string, channelId: string): Promise<string> {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
    const resp = await axios.get<YouTubeChannelResponse>(url);
    const uploadsId = resp.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) throw new Error(`Could not resolve uploads playlist for channel ${channelId}`);
    return uploadsId;
  }

  /**
   * Look up tags by hashtag, creating any that don't exist. Returns tag-sub objects
   * suitable for embedding in `article.tags`.
   */
  private async resolveHashtagTags(
    hashtags: string[],
    user: TCurrentUserType,
    propertyId: string
  ): Promise<Array<{ id: string; name: string; slug: string }>> {
    if (!hashtags || hashtags.length === 0) return [];

    const startedAt = Date.now();
    let findMs = 0;
    let createMs = 0;
    let createdCount = 0;
    let foundCount = 0;

    const out: Array<{ id: string; name: string; slug: string }> = [];
    const seen = new Set<string>();

    for (const raw of hashtags) {
      const name = raw.trim();
      if (!name) continue;
      const slug = slugify(name, { lower: true, strict: true });
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);

      try {
        const tFind = Date.now();
        let dbTag: any = await this.tagModel.findOne({ slug }).lean().exec();
        if (!dbTag) {
          // Fallback: name lookup scoped to property
          dbTag = await this.tagModel.findOne({ name, 'property.id': propertyId }).lean().exec();
        }
        findMs += Date.now() - tFind;
        if (dbTag) foundCount++;

        if (!dbTag) {
          try {
            const tagDto: any = {
              name,
              slug,
              description: '',
              propertyId,
              rank: 0,
              count: 0,
              status: STATUS.ACTIVE,
            };
            const tCreate = Date.now();
            const createdTag = await this.tagsService.create(tagDto, user);
            createMs += Date.now() - tCreate;
            createdCount++;
            dbTag = createdTag;
            this.logger.log(
              `[YouTubeProvider] Created hashtag tag: ${name} (slug: ${createdTag.slug})`,
              this.constructor.name
            );
          } catch (createErr) {
            this.logger.warn(
              `[YouTubeProvider] Failed to create hashtag tag "${name}": ${createErr.message}`,
              this.constructor.name
            );
            continue;
          }
        }

        out.push({
          id: (dbTag._id ?? dbTag.id)?.toString(),
          name: dbTag.name,
          slug: dbTag.slug,
        });
      } catch (err) {
        this.logger.warn(
          `[YouTubeProvider] Error resolving hashtag "${raw}": ${err.message}`,
          this.constructor.name
        );
      }
    }

    this.logger.log(
      `[YT-PERF] resolveHashtagTags: total=${Date.now() - startedAt}ms, findMs=${findMs}, createMs=${createMs}, found=${foundCount}, created=${createdCount}, out=${out.length}`,
      this.constructor.name
    );

    return out;
  }

  // ============================================
  // Build Article Document
  // ============================================

  private buildArticleDoc(
    video: VideoData,
    user: TCurrentUserType,
    ctx: {
      propertyId: string;
      propertyName: string;
      propertyDomain: string;
      orgId: string;
      orgName: string;
      postStatus: string;
      lang: string;
      slug: string;
      defaultTag: any;
      defaultCategory: any;
      defaultAuthor: any;
      mergedTags: any[];
      featuredMedia: any;
    }
  ): any {
    const cleanDescription = cleanVideoDescription(video.description);
    const excerpt = buildExcerpt(video);
    const bodyHtml = buildBodyHtml(video, cleanDescription);
    const userMeta = buildUserMetadata(user);
    const slug = ctx.slug;

    return {
      organization: {
        id: ctx.orgId,
        name: ctx.orgName,
        slug: ctx.orgName.toLowerCase().replace(/\s+/g, '-'),
      },
      property: {
        id: ctx.propertyId,
        name: ctx.propertyName,
        domain: ctx.propertyDomain,
      },
      title: video.title,
      slug,
      fullSlug: `video/${slug}`,
      body: bodyHtml,
      excerpt,
      status: ctx.postStatus,
      type: video.videoType === VideoType.Short ? ARTICLE_TYPE.SHORTS : ARTICLE_TYPE.VIDEO,
      lang: ctx.lang,
      publishedAt: new Date(video.publishedAt),
      tags: ctx.mergedTags,
      categories: ctx.defaultCategory
        ? [
            {
              id: ctx.defaultCategory._id?.toString(),
              title: ctx.defaultCategory.title,
              slug: ctx.defaultCategory.slug,
              fullSlug: ctx.defaultCategory.fullSlug,
            },
          ]
        : [],
      primaryCategory: ctx.defaultCategory
        ? {
            id: ctx.defaultCategory._id?.toString(),
            title: ctx.defaultCategory.title,
            slug: ctx.defaultCategory.slug,
            fullSlug: ctx.defaultCategory.fullSlug,
          }
        : undefined,
      authors: ctx.defaultAuthor
        ? [
            {
              id: ctx.defaultAuthor._id,
              name: ctx.defaultAuthor.name,
              slug: ctx.defaultAuthor.slug,
              username: ctx.defaultAuthor.username,
            },
          ]
        : [],
      featuredMedia: ctx.featuredMedia,
      featuredVideo: {
        id: video.videoId,
        path: '',
        url: video.videoUrl,
        alt: video.title,
        caption: video.title,
        duration: video.durationReadable,
      },
      richBlocks: buildRichBlocks(video, cleanDescription),
      metaTitle: video.title,
      metaDescription: excerpt,
      ogTitle: video.title,
      ogDescription: excerpt,
      keyword: extractHashtags(video.description)
        .concat(extractHashtags(video.title))
        .slice(0, 5)
        .join(', '),
      seo: {
        title: video.title,
        description: excerpt,
        keywords: extractHashtags(video.description)
          .concat(extractHashtags(video.title))
          .slice(0, 10),
      },
      softDeleted: false,
      createdBy: userMeta,
      updatedBy: userMeta,
    };
  }

  private buildUpdatePayload(
    video: VideoData,
    user: TCurrentUserType,
    ctx: {
      defaultTag: any;
      defaultCategory: any;
      defaultAuthor: any;
      mergedTags: any[];
      featuredMedia: any;
    }
  ): any {
    const cleanDescription = cleanVideoDescription(video.description);
    const excerpt = buildExcerpt(video);
    const bodyHtml = buildBodyHtml(video, cleanDescription);
    const userMeta = buildUserMetadata(user);
    const keywords = extractHashtags(video.description)
      .concat(extractHashtags(video.title))
      .slice(0, 5);

    return {
      title: video.title,
      body: bodyHtml,
      excerpt,
      type: video.videoType === VideoType.Short ? ARTICLE_TYPE.SHORTS : ARTICLE_TYPE.VIDEO,
      featuredMedia: ctx.featuredMedia,
      featuredVideo: {
        id: video.videoId,
        path: '',
        url: video.videoUrl,
        alt: video.title,
        caption: video.title,
        duration: video.durationReadable,
      },
      tags: ctx.mergedTags,
      categories: ctx.defaultCategory
        ? [
            {
              id: ctx.defaultCategory._id?.toString(),
              title: ctx.defaultCategory.title,
              slug: ctx.defaultCategory.slug,
              fullSlug: ctx.defaultCategory.fullSlug,
            },
          ]
        : [],
      primaryCategory: ctx.defaultCategory
        ? {
            id: ctx.defaultCategory._id?.toString(),
            title: ctx.defaultCategory.title,
            slug: ctx.defaultCategory.slug,
            fullSlug: ctx.defaultCategory.fullSlug,
          }
        : undefined,
      authors: ctx.defaultAuthor
        ? [
            {
              id: ctx.defaultAuthor._id,
              name: ctx.defaultAuthor.name,
              slug: ctx.defaultAuthor.slug,
              username: ctx.defaultAuthor.username,
            },
          ]
        : [],
      richBlocks: buildRichBlocks(video, cleanDescription),
      seo: {
        title: video.title,
        description: excerpt,
        keywords: keywords,
      },
      metaTitle: video.title,
      metaDescription: excerpt,
      ogTitle: video.title,
      ogDescription: excerpt,
      keyword: keywords.join(', '),
      updatedBy: userMeta,
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function getBestThumbnail(thumbs: Thumbnails): string {
  return (
    thumbs.maxres?.url ||
    thumbs.high?.url ||
    thumbs.standard?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url ||
    ''
  );
}

/**
 * Parse ISO 8601 duration to seconds. e.g. "PT1M30S" → 90
 */
function parseDurationSeconds(duration: string): number {
  const d = duration.replace(/^PT/, '');
  let total = 0;
  let num = '';
  for (const ch of d) {
    if (ch === 'H') {
      total += parseInt(num, 10) * 3600;
      num = '';
    } else if (ch === 'M') {
      total += parseInt(num, 10) * 60;
      num = '';
    } else if (ch === 'S') {
      total += parseInt(num, 10);
      num = '';
    } else {
      num += ch;
    }
  }
  return total;
}

/**
 * Format seconds to "H:MM:SS" or "M:SS". e.g. 90 → "1:30"
 */
/**
 * Parse the readable duration we store on featuredVideo.duration ("m:ss" or
 * "h:mm:ss") back into total seconds. Returns 0 when the string is missing
 * or unparseable.
 */
function parseReadableDurationSeconds(readable?: string): number {
  if (!readable) return 0;
  const parts = readable.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

function formatDurationReadable(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Detect `#shorts` / `#short` in the video snippet. When YouTube sees this tag
 * the creator is explicitly marking the upload as a Short — trust it and skip
 * the redirect probe.
 */
function hasShortsHashtag(snippet: {
  title?: string;
  description?: string;
  tags?: string[];
}): boolean {
  const re = /#shorts?\b/i;
  if (snippet.title && re.test(snippet.title)) return true;
  if (snippet.description && re.test(snippet.description)) return true;
  if (snippet.tags?.some((t) => re.test(t) || /^shorts?$/i.test(t))) return true;
  return false;
}

/**
 * Probe whether a video is a YouTube Short by issuing a no-follow HEAD to
 * /shorts/{id}. Shorts respond 200; regular videos 303-redirect to /watch?v=.
 * This is the only method that matches YouTube's own classification, which
 * also factors in vertical aspect ratio rather than just duration.
 */
async function probeIsYouTubeShort(videoId: string): Promise<boolean> {
  try {
    const resp = await axios.head(`https://www.youtube.com/shorts/${videoId}`, {
      maxRedirects: 0,
      validateStatus: (s) => s >= 200 && s < 400,
      timeout: 5000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    });
    if (resp.status === 200) return true;
    if (resp.status >= 300 && resp.status < 400) {
      const loc = (resp.headers['location'] as string) || '';
      return !/\/watch/i.test(loc);
    }
    return false;
  } catch {
    // On network failure, fall back to "not a Short" — safer given the
    // original bug was over-classification of regular videos as Shorts.
    return false;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Clean description: remove hashtags, boilerplate sections, and "Produced by:" lines.
 */
function cleanVideoDescription(description: string): string {
  let clean = description;

  // Remove everything from boilerplate sections onward
  for (const marker of ['about the company:', 'about company:', 'about ']) {
    const idx = clean.toLowerCase().indexOf(marker);
    if (idx !== -1) {
      clean = clean.substring(0, idx);
      break;
    }
  }

  // Remove lines starting with "produced by:", "edited by:"
  clean = clean
    .split('\n')
    .filter((line) => {
      const lower = line.toLowerCase().trimStart();
      return !lower.startsWith('produced by:') && !lower.startsWith('edited by:');
    })
    .join('\n');

  // Remove inline hashtags
  clean = clean
    .split('\n')
    .map((line) =>
      line
        .split(/\s+/)
        .filter((word) => !word.startsWith('#'))
        .join(' ')
        .trim()
    )
    .join('\n')
    .trim();

  return clean;
}

function buildExcerpt(video: VideoData): string {
  const clean = cleanVideoDescription(video.description).trim();
  if (!clean) {
    return `Watch "${video.title}" by ${video.channelTitle} on YouTube.`;
  }
  return truncateAtWord(clean, 160);
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Build legacy HTML body with YouTube marker + embed + description paragraphs.
 */
function buildBodyHtml(video: VideoData, cleanDescription: string): string {
  const marker = `<!-- youtube:${video.videoId} -->`;
  const embed = buildEmbedCode(video);

  if (!cleanDescription.trim()) {
    return `${marker}\n\n${embed}`;
  }

  const paragraphs = cleanDescription
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n\n');

  return `${marker}\n\n${embed}\n\n${paragraphs}`;
}

function buildEmbedCode(video: VideoData): string {
  return `<iframe width="560" height="315" src="${video.embedUrl}" title="${video.title.replace(/"/g, '&quot;')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
}

/**
 * Build BlockNote-compatible richBlocks: H1 title + video embed block + description paragraphs.
 */
function buildRichBlocks(video: VideoData, cleanDescription: string): any[] {
  const blocks: any[] = [];
  let order = 1;

  // First block: H1 heading with the video title
  blocks.push({
    id: uuidv4(),
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: video.title, styles: {} }],
    metadata: {},
    order: order++,
  });

  // Video embed block — skipped for Shorts (stored as featuredVideo instead)
  if (video.videoType !== VideoType.Short) {
    blocks.push({
      id: uuidv4(),
      type: 'video',
      content: [],
      metadata: {
        url: video.embedUrl,
        watchUrl: video.watchUrl,
        provider: 'youtube',
        videoId: video.videoId,
        thumbnail: video.thumbnailUrl,
        title: video.title,
        duration: video.durationSeconds,
        durationReadable: video.durationReadable,
        videoType: video.videoType,
        channelTitle: video.channelTitle,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
      },
      order: order++,
    });
  }

  // Description paragraph blocks
  if (cleanDescription.trim()) {
    const paragraphs = cleanDescription
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const para of paragraphs) {
      blocks.push({
        id: uuidv4(),
        type: 'paragraph',
        content: [{ type: 'text', text: para, styles: {} }],
        metadata: {},
        order: order++,
      });
    }
  }

  return blocks;
}

/**
 * Format a YouTube publishedAt ISO string into a DD-MM-YYYY slug suffix (UTC).
 * Falls back to today's date if the input is missing or unparseable.
 */
function formatPublishedDateForSlug(publishedAt: string | undefined): string {
  const d = publishedAt ? new Date(publishedAt) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  const yyyy = safe.getUTCFullYear();
  const mm = String(safe.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(safe.getUTCDate()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Extract hashtags from text. e.g. "#News #India #समाचार" → ["News", "India", "समाचार"]
 * Supports Unicode letters/digits so Hindi hashtags survive.
 */
function extractHashtags(text: string): string[] {
  if (!text) return [];
  const tags: string[] = [];
  for (const word of text.split(/\s+/)) {
    if (word.startsWith('#') && word.length > 1) {
      const tag = word.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
  }
  return tags;
}
