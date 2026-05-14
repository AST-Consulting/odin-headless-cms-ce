import { NestFactory } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import mongoose from 'mongoose';
import { AppModule } from '../app.module';
import { MigratorService } from './migrator.service';
import { UserService } from '../user/user.service';
import { TCurrentUserType } from '@auth/types/user.type';
import { RICH_BLOCKS_QUEUE } from './processors/rich-blocks.processor';
import { BulkOnboardingService } from '../auth/bulk-onboarding/bulk-onboarding.service';
import { YouTubeMigrationOptions } from './providers/youtube.provider';

async function waitForQueueDrain(queue: Queue, pollIntervalMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const check = async () => {
      const counts = await queue.getJobCounts();
      const pending = counts.waiting + counts.active + counts.delayed;
      if (pending === 0) {
        resolve();
      } else {
        console.log(
          `[Queue] Waiting for rich block conversion — waiting: ${counts.waiting}, active: ${counts.active}, failed: ${counts.failed}`
        );
        setTimeout(check, pollIntervalMs);
      }
    };
    check();
  });
}

/**
 * System user for command-line migrations
 * This user object is used when running migrations from the command line
 */
const getSystemUser = (): TCurrentUserType => {
  return {
    sub: '699d471d5015572ad96b4aac',
    name: 'System',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    organizationId: process.env.DEFAULT_ORGANIZATION_ID || '000000000000000000000000',
  };
};

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function bootstrap() {
  const application = await NestFactory.createApplicationContext(AppModule);

  const command = process.argv[2];
  const migratorService = application.get(MigratorService);
  const systemUser = getSystemUser();

  // Optional propertyId from command line (third argument)
  const propertyId = process.argv[3] || '6926b8f59a288ddf06a28884';

  switch (command) {
    case 'migrate-tags':
      try {
        const result = await migratorService.migrateTags(systemUser);
        console.log('Tags migration completed:', result);
      } catch (error) {
        console.error('Tags migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-tags-after': {
      const afterArg = process.argv[3] || getYesterday();
      console.log(`Migrating tags modified after: ${afterArg}`);
      try {
        const result = await migratorService.migrateTagsAfter(systemUser, afterArg);
        console.log('Tags migration (after) completed:', result);
      } catch (error) {
        console.error('Tags migration (after) failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'migrate-categories-after': {
      const afterArg = process.argv[3] || getYesterday();
      console.log(`Migrating categories modified after: ${afterArg}`);
      try {
        const result = await migratorService.migrateCategoriesAfter(systemUser, afterArg);
        console.log('Categories migration (after) completed:', result);
      } catch (error) {
        console.error('Categories migration (after) failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'migrate-menus-after': {
      const afterArg = process.argv[3] || getYesterday();
      const menuPropertyId = process.argv[4] || propertyId;
      console.log(`Migrating menus after: ${afterArg}`);
      try {
        const result = await migratorService.migrateMenusAfter(systemUser, afterArg, menuPropertyId);
        console.log('Menus migration (after) completed:', result);
      } catch (error) {
        console.error('Menus migration (after) failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'migrate-media-after': {
      const afterArg = process.argv[3] || getYesterday();
      const rawDays = process.argv[4];
      // Default to 1 day when no explicit limit given — covers just the previous day
      const daysArg = rawDays && rawDays !== '-' ? parseInt(rawDays, 10) || 1 : 1;
      console.log(`Migrating media modified after: ${afterArg} (${daysArg} day(s))`);
      try {
        const result = await migratorService.migrateMediaAfter(afterArg, daysArg);
        console.log('Media migration (after) completed:', result);
      } catch (error) {
        console.error('Media migration (after) failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'migrate-categories':
      try {
        const result = await migratorService.migrateCategories(systemUser);
        console.log('Categories migration completed:', result);
      } catch (error) {
        console.error('Categories migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-users':
      try {
        const result = await migratorService.migrateUsers(systemUser);
        console.log('Users migration completed:', result);
      } catch (error) {
        console.error('Users migration failed:', error.message);
        process.exit(1);
      }
      break;
    case 'migrate-users-schema':
      try {
        await updateUsersCollection();
        console.log('User schema migration completed successfully!');

        console.log('🔄 Starting Elasticsearch synchronization...');
        const userService = application.get(UserService);
        const syncResult = await userService.bulkIndexUsersToElasticsearch();
        console.log(`✅ Elasticsearch sync completed: ${syncResult.indexed} users indexed, ${syncResult.failed} errors.`);
      } catch (error) {
        console.error('User schema migration or sync failed:', error.message);
        process.exit(1);
      }
      break;

    case 'sync-users-elastic':
      try {
        console.log('🔄 Starting Elasticsearch synchronization...');
        const userService = application.get(UserService);
        const syncResult = await userService.bulkIndexUsersToElasticsearch();
        console.log(`✅ Elasticsearch sync completed: ${syncResult.indexed} users indexed, ${syncResult.failed} errors.`);
      } catch (error) {
        console.error('Elasticsearch sync failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-articles':
      try {
        const result = await migratorService.migrateArticles(systemUser, propertyId);
        console.log('Articles migration completed:', result);
      } catch (error) {
        console.error('Articles migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-all':
      try {
        // Migrate in order: tags -> categories -> users -> articles
        const tagsResult = await migratorService.migrateTags(systemUser);
        console.log('Tags migration completed:', tagsResult);

        const categoriesResult = await migratorService.migrateCategories(systemUser);
        console.log('Categories migration completed:', categoriesResult);

        const usersResult = await migratorService.migrateUsers(systemUser);
        console.log('Users migration completed:', usersResult);

        const articlesResult = await migratorService.migrateArticles(systemUser, propertyId);
        console.log('Articles migration completed:', articlesResult);

        console.log('Migration completed successfully!');
      } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-tags-to-redis':
      try {
        const result = await migratorService.migrateTagsToRedis();
        console.log('Tags Redis migration completed:', result);
      } catch (error) {
        console.error('Tags Redis migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-categories-to-redis':
      try {
        const result = await migratorService.migrateCategoriesToRedis();
        console.log('Categories Redis migration completed:', result);
      } catch (error) {
        console.error('Categories Redis migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-users-to-redis':
      try {
        const result = await migratorService.migrateUsersToRedis();
        console.log('Users Redis migration completed:', result);
      } catch (error) {
        console.error('Users Redis migration failed:', error.message);
        process.exit(1);
      }
      break;
    case 'convert-to-rich-blocks': {
      const slugArg = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const limitArg =
        process.argv[4] && process.argv[4] !== '-' ? parseInt(process.argv[4], 10) : undefined;
      const dateFromArg = process.argv[5] && process.argv[5] !== '-' ? process.argv[5] : undefined; // dd-mm-yyyy
      if (slugArg) console.log(`Converting rich blocks for slug: ${slugArg}`);
      if (limitArg) console.log(`Running with limit: ${limitArg} articles`);
      if (dateFromArg) console.log(`Only articles created on/after: ${dateFromArg}`);
      try {
        const result = await migratorService.convertToRichBlocks(
          systemUser,
          slugArg,
          limitArg,
          dateFromArg
        );
        console.log('Rich blocks conversion completed:', result);
      } catch (error) {
        console.error('Rich blocks conversion failed:', error.message);
        process.exit(1);
      }
      break;
    }
    case 'migrate-articles-v2':
      try {
        // Pass '-' or '0' as limit to skip it (useful in cron jobs):
        //   npm run execute migrate-articles-v2 <propertyId> - <dateFrom>
        const rawLimit = process.argv[4];
        const limitArg =
          rawLimit && rawLimit !== '-' && rawLimit !== '0'
            ? parseInt(rawLimit, 10) || undefined
            : undefined;
        const dateFromArg = process.argv[5] || undefined; // dd-mm-yyyy
        const dateToArg = process.argv[6] || undefined; // dd-mm-yyyy
        if (limitArg) {
          console.log(`Running with limit: ${limitArg} articles`);
        }
        if (dateFromArg || dateToArg) {
          console.log(`Running with date range: ${dateFromArg || '*'} to ${dateToArg || '*'}`);
        }
        const result = await migratorService.migrateArticlesV2(
          systemUser,
          propertyId,
          limitArg,
          dateFromArg,
          dateToArg
        );
        console.log('Articles V2 (Elasticsearch) migration completed:', result);

        // Wait for all rich block conversion jobs to finish before closing
        console.log('Waiting for rich block conversion queue to drain...');
        const richBlocksQueue = application.get<Queue>(getQueueToken(RICH_BLOCKS_QUEUE));
        await waitForQueueDrain(richBlocksQueue);
        console.log('Rich block conversion queue drained.');
      } catch (error) {
        console.error('Articles V2 migration failed:', error.message);
        process.exit(1);
      }
      break;
    case 'sync-tags':
      try {
        const rawLimit = process.argv[4];
        const limitArg =
          rawLimit && rawLimit !== '-' && rawLimit !== '0'
            ? parseInt(rawLimit, 10) || undefined
            : undefined;
        const dateFromArg = process.argv[5] || undefined;
        const dateToArg = process.argv[6] || undefined;
        if (limitArg) {
          console.log(`Running with limit: ${limitArg} articles`);
        }
        if (dateFromArg || dateToArg) {
          console.log(`Running with date range: ${dateFromArg || '*'} to ${dateToArg || '*'}`);
        }
        const result = await migratorService.syncTags(
          systemUser,
          propertyId,
          limitArg,
          dateFromArg,
          dateToArg
        );
        console.log('Sync tags completed:', result);
      } catch (error) {
        console.error('Sync tags failed:', error.message);
        process.exit(1);
      }
      break;
    case 'migrate-articles-v3':
      try {
        // Pass '-' or '0' as limit to skip it (useful in cron jobs):
        //   npm run execute migrate-articles-v2 <propertyId> - <dateFrom>
        const rawLimit = process.argv[4];
        const limitArg =
          rawLimit && rawLimit !== '-' && rawLimit !== '0'
            ? parseInt(rawLimit, 10) || undefined
            : undefined;
        const dateFromArg = process.argv[5] || undefined; // dd-mm-yyyy
        const dateToArg = process.argv[6] || undefined; // dd-mm-yyyy
        if (limitArg) {
          console.log(`Running with limit: ${limitArg} articles`);
        }
        if (dateFromArg || dateToArg) {
          console.log(`Running with date range: ${dateFromArg || '*'} to ${dateToArg || '*'}`);
        }
        const result = await migratorService.migrateArticlesV3(
          systemUser,
          propertyId,
          limitArg,
          dateFromArg,
          dateToArg
        );
        console.log('Articles V3 (Elasticsearch) migration completed:', result);

        // Wait for all rich block conversion jobs to finish before closing
        console.log('Waiting for rich block conversion queue to drain...');
        const richBlocksQueue = application.get<Queue>(getQueueToken(RICH_BLOCKS_QUEUE));
        await waitForQueueDrain(richBlocksQueue);
        console.log('Rich block conversion queue drained.');
      } catch (error) {
        console.error('Articles V3 migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-live-articles':
      try {
        const result = await migratorService.migrateLiveArticles(systemUser, propertyId);
        console.log('Live articles migration completed:', result);
      } catch (error) {
        console.error('Live articles migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-live-articles-v2': {
      const slugArg = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const limit = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;
      if (slugArg) console.log(`Migrating live articles V2 for slug: ${slugArg}`);
      if (limit) console.log(`Running with limit: ${limit} articles`);
      try {
        const result = await migratorService.migrateLiveArticlesV2(systemUser, slugArg, limit);
        console.log('Live articles V2 migration completed:', result);
      } catch (error) {
        console.error('Live articles V2 migration failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'migrate-menus':
      try {
        const result = await migratorService.migrateMenus(systemUser, propertyId);
        console.log('Menus migration completed:', result);
      } catch (error) {
        console.error('Menus migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-user-headers':
      try {
        const result = await migratorService.migrateUserHeaders();
        console.log('User headers migration completed:', result);
      } catch (error) {
        console.error('User headers migration failed:', error.message);
        process.exit(1);
      }
      break;
    case 'parse-user-headers':
      try {
        const result = await migratorService.parseUserHeaders();
        console.log('User headers parse completed:', result);
      } catch (error) {
        console.error('User headers parsing failed:', error.message);
        process.exit(1);
      }
      break;
    case 'migrate-static-pages':
      try {
        const result = await migratorService.migrateStaticPages(systemUser, propertyId);
        console.log('Static pages migration completed:', result);
      } catch (error) {
        console.error('Static pages migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'audit-slug-diff':
      try {
        const result = await migratorService.auditSlugDiff();
        console.log('Slug diff audit completed:', result);
      } catch (error) {
        console.error('Slug diff audit failed:', error.message);
        process.exit(1);
      }
      break;

    case 'fix-slug-meta':
      try {
        const limitArg = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
        const result = await migratorService.fixSlugMeta(limitArg);
        console.log('Fix slug meta completed:', result);
      } catch (error) {
        console.error('Fix slug meta failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-missing-slugs':
      try {
        const limitArg = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
        const result = await migratorService.migrateMissingSlugs(systemUser, limitArg);
        console.log('Migrate missing slugs completed:', result);
      } catch (error) {
        console.error('Migrate missing slugs failed:', error.message);
        process.exit(1);
      }
      break;

    case 'migrate-media':
      try {
        const daysArg = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
        if (daysArg) {
          console.log(`Running media migration for the last ${daysArg} days`);
        }
        const result = await migratorService.migrateMedia(daysArg);
        console.log('Media migration completed:', result);
      } catch (error) {
        console.error('Media migration failed:', error.message);
        process.exit(1);
      }
      break;

    case 'fix-featured-media': {
      const dateArg = process.argv[3];
      if (!dateArg) {
        console.error('Error: date argument is required (format: dd-mm-yyyy)');
        console.error('Usage: npm run execute fix-featured-media <dd-mm-yyyy>');
        process.exit(1);
      }
      try {
        const limitArg = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;
        if (limitArg) {
          console.log(`Running with limit: ${limitArg} articles`);
        }
        console.log(`Fixing featured media for articles on or after: ${dateArg}`);
        const result = await migratorService.fixFeaturedMedia(systemUser, dateArg, limitArg);
        console.log('Fix featured media completed:', result);
      } catch (error) {
        console.error('Fix featured media failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'migrate-web-stories': {
      const rawLimit = process.argv[3];
      const limitArg =
        rawLimit && rawLimit !== '-' && rawLimit !== '0'
          ? parseInt(rawLimit, 10) || undefined
          : undefined;
      if (limitArg) {
        console.log(`Running with limit: ${limitArg} web stories`);
      }
      try {
        const result = await migratorService.migrateWebStories(systemUser, limitArg);
        console.log('Web stories migration completed:', result);
      } catch (error) {
        console.error('Web stories migration failed:', error.message);
        process.exit(1);
      }
      break;
    }
    // case 'parse-category-headers':
    //   try {
    //     const result = await migratorService.parseCategoryHeaders();
    //     console.log('User headers parse completed:', result);
    //   } catch (error) {
    //     console.error('User headers parsing failed:', error.message);
    //     process.exit(1);
    //   }
    //   break;
    case 'migrate-slug-rankmath-headers': {
      const limitArg = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
      if (limitArg) console.log(`Running with limit: ${limitArg} articles`);
      try {
        const result = await migratorService.migrateSlugRankMathHeaders(limitArg);
        console.log('Slug RankMath headers migration completed:', result);
      } catch (error) {
        console.error('Slug RankMath headers migration failed:', error.message);
        process.exit(1);
      }
      break;
    }
    case 'fix-video-media-paths': {
      try {
        const result = await migratorService.fixVideoMediaPaths();
        console.log('Video media paths fix completed:', result);
      } catch (error) {
        console.error('Video media paths fix failed:', error.message);
        process.exit(1);
      }
      break;
    }
    case 'migrate-featured-video': {
      const slugArg = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const limitArg = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;
      if (slugArg) console.log(`Migrating featured video for slug: ${slugArg}`);
      if (limitArg) console.log(`Running with limit: ${limitArg} articles`);
      try {
        const result = await migratorService.migrateFeaturedVideo(slugArg, limitArg);
        console.log('Featured video migration completed:', result);
      } catch (error) {
        console.error('Featured video migration failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'fix-video-stories': {
      const slugArg = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const limitArg = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;
      if (slugArg) console.log(`Fixing video stories for slug: ${slugArg}`);
      if (limitArg) console.log(`Running with limit: ${limitArg} articles`);
      try {
        const result = await migratorService.fixVideoStories(slugArg, limitArg);
        console.log('Fix video stories completed:', result);
      } catch (error) {
        console.error('Fix video stories failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'revert-live-articles-v2': {
      const slugArg = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const limit = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;
      if (slugArg) console.log(`Reverting live articles V2 for slug: ${slugArg}`);
      if (limit) console.log(`Running with limit: ${limit} articles`);
      try {
        const result = await migratorService.revertLiveArticlesV2(slugArg, limit);
        console.log('Live articles V2 revert completed:', result);
      } catch (error) {
        console.error('Live articles V2 revert failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'migrate-liveblog-richblocks': {
      const limitArg = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
      if (limitArg) console.log(`Running with limit: ${limitArg} articles`);
      try {
        const result = await migratorService.migrateLiveblogRichBlocks(limitArg);
        console.log('Liveblog richblocks migration completed:', result);
      } catch (error) {
        console.error('Liveblog richblocks migration failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'bulk-invite-onboarding':
      try {
        const arg = process.argv[3];
        let limitArg: number | undefined;
        let emailArg: string | undefined;

        if (arg) {
          if (arg.includes('@')) {
            emailArg = arg;
            console.log(`\u2611 Running onboarding TEST for email: ${emailArg}`);
          } else {
            limitArg = parseInt(arg, 10);
            console.log(`Running bulk onboarding with limit: ${limitArg} users`);
          }
        }

        const onboardingService = application.get(BulkOnboardingService);
        const result = await onboardingService.bulkInviteUsers(limitArg, emailArg);
        console.log(`\u2705 Onboarding triggered: ${result.queued} users added to queue.`);
        
        console.log('Checking queue status...');
        const status = await onboardingService.getQueueStatus();
        console.log('Current Queue Status:', status);
      } catch (error) {
        console.error('Bulk onboarding failed:', error.message);
        process.exit(1);
      }
      break;

    /**
     * migrate-youtube-videos [channelId] [mode] [maxResults] [status] [dryRun] [stopOnExisting]
     *
     * Examples:
     *   npm run execute migrate-youtube-videos
     *   npm run execute migrate-youtube-videos UCxxxxxx all 20 draft
     *   npm run execute migrate-youtube-videos UCxxxxxx shorts 50 published
     *   npm run execute migrate-youtube-videos - - - - true            # dry run
     *   npm run execute migrate-youtube-videos - shorts - - - false    # disable early-stop
     *
     * stopOnExisting (default: true) — halt as soon as a video already in DB
     * is encountered. Intended for short-interval crons (e.g. every 5 min).
     *
     * All args are optional and fall back to env vars:
     *   YOUTUBE_CHANNEL_ID, YOUTUBE_FETCH_MODE, YOUTUBE_MAX_RESULTS, YOUTUBE_POST_STATUS
     */
    case 'migrate-youtube-videos': {
      const ytChannelArg = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const ytModeRaw = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : undefined;
      const ytMaxResultsRaw = process.argv[5] && process.argv[5] !== '-' ? parseInt(process.argv[5], 10) : 0; // 0 = all
      const ytStatusArg = process.argv[6] && process.argv[6] !== '-' ? process.argv[6] : undefined;
      const ytDryRun = process.argv[7] === 'true';
      // Default to true — suits the 5-minute cron use case. Pass 'false' to disable.
      const ytStopOnExisting = process.argv[8] === 'false' ? false : true;

      const ytMode = ytModeRaw as YouTubeMigrationOptions['mode'] | undefined;
      const ytMaxResults = isNaN(ytMaxResultsRaw) ? 0 : ytMaxResultsRaw;

      if (ytChannelArg) console.log(`YouTube channel: ${ytChannelArg}`);
      if (ytMode) console.log(`Fetch mode: ${ytMode}`);
      if (ytMaxResults) console.log(`Max results: ${ytMaxResults}`);
      if (ytStatusArg) console.log(`Post status: ${ytStatusArg}`);
      if (ytDryRun) console.log('DRY RUN — no articles will be created');
      console.log(`Stop on existing: ${ytStopOnExisting}`);

      const ytOpts: YouTubeMigrationOptions = {
        channelId: ytChannelArg,
        mode: ytMode,
        maxResults: ytMaxResults,
        postStatus: ytStatusArg,
        dryRun: ytDryRun,
        stopOnExisting: ytStopOnExisting,
        // propertyId resolved by the provider from YOUTUBE_PROPERTY_ID / DEFAULT_PROPERTY_ID env vars
      };

      try {
        const result = await migratorService.migrateYoutubeVideos(systemUser, ytOpts);
        console.log('YouTube video migration completed:', result);
      } catch (error) {
        console.error('YouTube video migration failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'reorder-shorts-timestamps': {
      // Usage: npm run execute reorder-shorts-timestamps [propertyId] [articleType]
      // articleType defaults to 'shorts'. Pass '-' to skip propertyId.
      const reorderPropertyId = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const reorderType = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : undefined;
      if (reorderPropertyId) console.log(`Filtering by propertyId: ${reorderPropertyId}`);
      if (reorderType) console.log(`Article type: ${reorderType}`);
      try {
        const result = await migratorService.reorderShortsTimestamps({
          propertyId: reorderPropertyId,
          articleType: reorderType,
        });
        console.log('Reorder timestamps completed:', result);
      } catch (error) {
        console.error('Reorder timestamps failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'verify-shorts': {
      // Usage: npm run execute verify-shorts [propertyId] [limit] [articleType]
      // articleType defaults to 'shorts'. Pass '-' to skip any argument.
      // Read-only: scans articles, probes each videoId against YouTube's
      // /shorts/{id} redirect (+ duration sanity check) and reports any
      // that are not actually Shorts. No DB writes.
      const vPropertyId = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const vLimitRaw = process.argv[4] && process.argv[4] !== '-' ? parseInt(process.argv[4], 10) : 0;
      const vLimit = isNaN(vLimitRaw) ? 0 : vLimitRaw;
      const vType = process.argv[5] && process.argv[5] !== '-' ? process.argv[5] : undefined;
      if (vPropertyId) console.log(`Filtering by propertyId: ${vPropertyId}`);
      if (vLimit) console.log(`Limit: ${vLimit}`);
      if (vType) console.log(`Article type: ${vType}`);
      try {
        const result = await migratorService.verifyShortsClassification({
          propertyId: vPropertyId,
          articleType: vType,
          limit: vLimit,
        });
        for (const d of result.details) {
          console.log(d.slug);
        }
      } catch (error) {
        console.error('Shorts verification failed:', error.message);
        process.exit(1);
      }
      break;
    }

    case 'delete-shorts-slugs': {
      // Usage: npm run execute delete-shorts-slugs [propertyId] [articleType]
      // articleType defaults to 'shorts'. Pass '-' to skip propertyId.
      // For each matching article, looks up its slug in the slugs collection
      // and HARD-DELETES it (Mongo + Elasticsearch). The article itself is NOT touched.
      const delPropertyId = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : undefined;
      const delType = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : undefined;
      if (delPropertyId) console.log(`Filtering by propertyId: ${delPropertyId}`);
      if (delType) console.log(`Article type: ${delType}`);
      console.log('This will HARD-DELETE slug docs (no soft-delete). Articles are not removed.');
      try {
        const result = await migratorService.hardDeleteShortsSlugs({
          propertyId: delPropertyId,
          articleType: delType,
        });
        console.log('Slug hard-delete completed:', result);
      } catch (error) {
        console.error('Slug hard-delete failed:', error.message);
        process.exit(1);
      }
      break;
    }

    default:
      console.log('Available commands:');
      console.log('  migrate-tags                - Migrate tags from WordPress');
      console.log(
        '  migrate-tags-after <YYYY-MM-DD>        - Migrate tags from WordPress modified after date'
      );
      console.log('  migrate-categories           - Migrate categories from WordPress');
      console.log(
        '  migrate-categories-after <YYYY-MM-DD>  - Migrate categories from WordPress modified after date'
      );
      console.log('  migrate-users                - Migrate users from WordPress');
      console.log('  migrate-users-schema            - Update existing users to New Property Schema');
      console.log('  migrate-articles             - Migrate articles from WordPress');
      console.log('  migrate-articles <id>        - Migrate articles with specific propertyId');
      console.log('  migrate-all                  - Run all migrations in sequence');
      console.log('  migrate-tags-to-redis        - Migrate tags to Redis');
      console.log('  migrate-categories-to-redis  - Migrate categories to Redis');
      console.log('  migrate-users-to-redis       - Migrate users to Redis');
      console.log('  migrate-menus                - Migrate menus from WordPress');
      console.log(
        '  migrate-menus-after <YYYY-MM-DD> [propertyId]  - Migrate menus (custom API has no date filter; runs full migration)'
      );
      console.log(
        '  migrate-static-pages         - Migrate pages from WordPress (/wp-json/wp/v2/pages)'
      );
      console.log(
        '  migrate-user-headers         - Migrate header meta tags for users from RankMath API'
      );
      console.log(
        '  migrate-media [days]         - Migrate media from WordPress. Optional: number of days to look back from today (e.g. migrate-media 7)'
      );
      console.log(
        '  migrate-media-after <YYYY-MM-DD> [days]  - Migrate media starting from a specific date, bypassing Redis resume key'
      );
      console.log(
        '  audit-slug-diff              - Traverse Elasticsearch, compare slugs against MongoDB articles, write missing entries to missing_slugs collection'
      );
      console.log(
        '  fix-slug-meta [limit]        - Copy createdBy, updatedBy, createdAt, updatedAt from articles into their corresponding slug documents'
      );
      console.log(
        '  migrate-missing-slugs [limit] - Fetch articles from missing_slugs collection, migrate via Elasticsearch. Media resolved DB-first → Redis → WP API. Errors logged to /tmp/'
      );
      console.log(
        '  migrate-web-stories [limit]  - Migrate web stories from WordPress custom API. Optional: max number to import (e.g. migrate-web-stories 10)'
      );
      console.log(
        '  fix-featured-media <date> [limit]  - Fix featuredMedia for articles on/after date where featuredMedia is null. Date format: dd-mm-yyyy. Optional: max articles to process (logs slug per article when set)'
      );
      console.log(
        '  bulk-invite-onboarding [limit|email]     - Trigger bulk invitation emails for users who haven\'t completed onboarding'
      );
      console.log('');
      console.log('  sync-tags [propertyId] [limit] [dateFrom] [dateTo]');
      console.log('      Sync tags on articles from Elasticsearch source (wp_posts_prod).');
      console.log('');
      console.log('  migrate-articles-v2 [propertyId] [limit] [dateFrom] [dateTo]');
      console.log('      Migrate articles from Elasticsearch source (wp_posts_prod).');
      console.log('      All arguments are optional.');
      console.log("      limit   - Max articles per run. Use '-' or '0' to skip (no cap).");
      console.log('      dateFrom/dateTo - Date range filter in dd-mm-yyyy format.');
      console.log('');
      console.log('  Examples:');
      console.log('    # Migrate all articles from a specific date onward:');
      console.log('    npm run execute migrate-articles-v2 <propertyId> - 01-01-2025');
      console.log('');
      console.log('    # Migrate articles in a specific date window:');
      console.log('    npm run execute migrate-articles-v2 <propertyId> - 01-01-2025 31-01-2025');
      console.log('');
      console.log('  Cron job (run every 4 hours, migrate from a fixed cutoff date):');
      console.log(
        '    0 */4 * * * cd /path/to/app && npm run execute migrate-articles-v2 <propertyId> - 01-01-2025 >> /var/log/migrate.log 2>&1'
      );
      console.log('');
      console.log(
        '  migrate-slug-rankmath-headers [limit] - Fetch RankMath headers for articles whose slug matches ^[0-9]+-$ and update in MongoDB'
      );
      console.log('');
      console.log(
        '  migrate-live-articles-v2 [slug] [limit] - Migrate live blog richBlocks from Elasticsearch.'
      );
      console.log("      slug  - Optional slug to target a single live blog (use '-' to skip).");
      console.log('      limit - Optional max number of articles to process.');
      console.log('');
      console.log('  Examples:');
      console.log('    # Test a single live blog by slug:');
      console.log('    npm run execute migrate-live-articles-v2 my-live-blog-slug');
      console.log('    # Migrate all live blogs:');
      console.log('    npm run execute migrate-live-articles-v2');
      console.log('    # Migrate all live blogs with a limit:');
      console.log('    npm run execute migrate-live-articles-v2 - 50');
      console.log('');
      console.log(
        '  migrate-liveblog-richblocks [limit] - Copy embedded richBlocks from existing live articles'
      );
      console.log(
        '                                        into article_rich_blocks collection, then trim the'
      );
      console.log(
        '                                        article document to max 3 timestamp blocks.'
      );
      console.log('');
      console.log('  migrate-tags-after-cutoff [propertyId] [limit]');
      console.log('      Sync tags on articles modified on/after 03-10-2026 (hardcoded cutoff).');
      console.log('      Useful as a periodic cron after the Oct 2026 data migration.');
      console.log('');
      console.log('  sync-tags-last-hour [propertyId] [limit]');
      console.log('      Sync tags on articles modified in the last ~1 hour (dynamic window).');
      console.log('      Designed to be run as an hourly cron job.');
      console.log('');
      console.log('  Examples:');
      console.log('    npm run execute migrate-tags-after-cutoff');
      console.log('    npm run execute migrate-tags-after-cutoff <propertyId> 100');
      console.log('    npm run execute sync-tags-last-hour');
      console.log('    # Hourly cron:');
      console.log(
        '    0 * * * * cd /path/to/app && npm run execute sync-tags-last-hour >> /var/log/sync-tags.log 2>&1'
      );
      console.log('');
      console.log('  migrate-youtube-videos [channelId] [mode] [maxResults] [status] [dryRun] [stopOnExisting]');
      console.log('      Fetch videos from a YouTube channel and create CMS articles (type: video).');
      console.log('      channelId      - YouTube channel ID (overrides YOUTUBE_CHANNEL_ID env var)');
      console.log("      mode           - shorts | landscape | all  (default: all)");
      console.log('      maxResults     - Max videos to fetch (default: 10)');
      console.log("      status         - draft | published  (default: draft)");
      console.log('      dryRun         - true | false  (default: false)');
      console.log('      stopOnExisting - true | false  (default: true) — stop on first video already in DB');
      console.log('');
      console.log('  Required env vars for migrate-youtube-videos:');
      console.log('      YOUTUBE_API_KEY            - YouTube Data API v3 key');
      console.log('      YOUTUBE_CHANNEL_ID         - Default YouTube channel ID');
      console.log('      DEFAULT_ORGANIZATION_ID    - CMS organization ID');
      console.log('      DEFAULT_PROPERTY_ID        - CMS property ID');
      console.log('');
      console.log('  Optional env vars:');
      console.log('      YOUTUBE_FETCH_MODE         - shorts | landscape | all (default: all)');
      console.log('      YOUTUBE_MAX_RESULTS        - Default max videos per run (default: 10)');
      console.log('      YOUTUBE_POST_STATUS        - draft | published (default: draft)');
      console.log('      YOUTUBE_DEFAULT_LANG       - Article language code (default: en)');
      console.log('      DEFAULT_PROPERTY_NAME      - Property display name');
      console.log('      DEFAULT_PROPERTY_DOMAIN    - Property domain URL');
      console.log('      DEFAULT_ORG_NAME           - Organization display name');
      console.log('');
      console.log('  Examples:');
      console.log('    # Fetch 10 latest videos from env channel, create as drafts:');
      console.log('    npm run execute migrate-youtube-videos');
      console.log('');
      console.log('    # Fetch 20 Shorts from a specific channel, publish immediately:');
      console.log('    npm run execute migrate-youtube-videos UCxxxxxx shorts 20 published');
      console.log('');
      console.log('    # Dry run to preview what would be created:');
      console.log('    npm run execute migrate-youtube-videos - all 10 - true');
      console.log('');
      console.log(
        '    # Cron: run every 5 minutes, only Shorts, stop on first already-imported short:'
      );
      console.log(
        '    */5 * * * * cd /path/to/app && npm run execute migrate-youtube-videos - shorts >> /var/log/yt-migrate.log 2>&1'
      );
      console.log('');
      console.log('  verify-shorts [propertyId] [limit] [articleType]');
      console.log('      Audit existing "shorts" articles against YouTube\'s own classification.');
      console.log('      Uses the same tiered logic as migrate-youtube-videos:');
      console.log('        1. duration > 180s → not a Short');
      console.log('        2. /shorts/{id} redirect probe → not a Short if it lands on /watch');
      console.log('      Read-only; reports misclassified articles but does not modify anything.');
      console.log('      articleType defaults to "shorts". Pass "-" to skip any positional arg.');
      console.log('');
      console.log('  Examples:');
      console.log('    npm run execute verify-shorts');
      console.log('    npm run execute verify-shorts <propertyId>');
      console.log('    npm run execute verify-shorts - 100');
      console.log('');
      console.log('Usage: npm run execute <command> [propertyId]');
      process.exit(1);
  }

  await application.close();
  process.exit(0);
}

bootstrap();

async function updateUsersCollection() {
  try {
    const mongoUri = process.env.DATABASE_URI;
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to DB for User Schema Migration");

    const usersCollection = mongoose.connection.collection("users");

    // 🎯 Process ALL users in the collection
    const totalUsers = await usersCollection.countDocuments({});
    console.log(`🔄 Found ${totalUsers} users to migrate`);

    const batchSize = 200;
    let processedCount = 0;

    // 🎯 Full permissions for ADMINISTRATOR
    const adminPermissions = [
      { "module": "category", "actions": ["read", "write", "edit", "delete"] },
      { "module": "menu", "actions": ["read", "write", "edit", "delete"] },
      { "module": "banner", "actions": ["read", "write", "edit", "delete"] },
      { "module": "faq", "actions": ["read", "write", "edit", "delete"] },
      { "module": "property", "actions": ["read", "write", "edit", "delete"] },
      { "module": "role", "actions": ["read", "write", "edit", "delete"] },
      { "module": "banner-type", "actions": ["read", "write", "edit", "delete"] },
      { "module": "admins", "actions": ["read", "write", "edit", "delete"] },
      { "module": "invitation", "actions": ["read", "write", "edit", "delete"] },
      { "module": "organizations", "actions": ["read", "write", "edit", "delete"] },
      { "module": "users", "actions": ["read", "write", "edit", "delete"] },
      { "module": "articles", "actions": ["read", "write", "edit", "delete"] },
      { "module": "tags", "actions": ["read", "write", "edit", "delete"] },
      { "module": "testimonials", "actions": ["read", "write", "edit", "delete"] },
      { "module": "pages", "actions": ["read", "write", "edit", "delete"] },
      { "module": "section", "actions": ["read", "write", "edit", "delete"] },
      { "module": "slugs", "actions": ["read", "write", "edit", "delete"] },
      { "module": "ai", "actions": ["read", "write", "edit", "delete"] },
      { "module": "analytics", "actions": ["read", "write", "edit", "delete"] },
      { "module": "audit-trail", "actions": ["read", "write", "edit", "delete"] },
      { "module": "files", "actions": ["read", "write", "edit", "delete"] },
      { "module": "webstory-template", "actions": ["read"] }
    ];

    // 🎯 Standard permissions for EDITOR
    const editorPermissions = [
      { module: "users", actions: ["read"] },
      { module: "articles", actions: ["read", "write", "edit", "delete"] },
      { module: "category", actions: ["read", "write", "edit", "delete"] },
      { module: "tags", actions: ["read", "write", "edit", "delete"] },
      { module: "webstory-template", actions: ["read", "write"] },
      { module: "faq", actions: ["read", "write", "edit", "delete"] },
      { module: "menu", actions: ["read", "write"] },
      { module: "section", actions: ["read", "write"] },
      { module: "slugs", actions: ["read", "write"] },
      { module: "ai", actions: ["read", "write"] },
      { module: "files", actions: ["read", "write", "edit", "delete"] },
      { module: "organizations", actions: ["read", "write", "edit", "delete"] },
      { module: "property", actions: ["read", "write", "edit", "delete"] }
    ];

    while (processedCount < totalUsers) {
      // Use skip/limit to safely iterate through a large collection without a snapshot/session
      const users = await usersCollection.find({}).skip(processedCount).limit(batchSize).toArray();
      if (users.length === 0) break;

      for (const user of users) {
        const { _id, roles = [], permissions = [], properties = [] } = user;

        // ✅ Check roles (case-insensitive)
        const isEditor = (roles || []).some((r: any) => (r.name || "").toUpperCase() === "EDITOR");
        const isAdmin = (roles || []).some((r: any) => (r.name || "").toUpperCase() === "ADMINISTRATOR" || (r.name || "").toUpperCase() === "ADMIN");

        // 🎯 Determine user roles/permissions
        let targetRoles = roles;
        let targetPermissions = permissions;

        // if (isAdmin) {
        //   targetRoles = [{ id: "6981c4524c8fcdf379592610", name: "ADMINISTRATOR" }];
        //   targetPermissions = adminPermissions;
        // } else if (isEditor) {
        //   targetRoles = [{ id: "698dcda4c7582b94d777a385", name: "EDITOR" }];
        //   targetPermissions = editorPermissions;
        // }

        // 🎯 Map to existing properties
        let updatedProperties = (properties || []).map((p: any) => ({
          id: p.id || p._id?.toString(),
          name: p.name,
          domain: p.domain,
          status: "active",
          roles: targetRoles,
          permissions: targetPermissions
        }));

        // Fallback for user without properties
        if (updatedProperties.length === 0) {
          updatedProperties = [{
            id: "6926b8f59a288ddf06a28884",
            name: process.env.BRAND_NAME || "Default Organization",
            domain: process.env.SITE || "https://example.com",
            status: "active",
            roles: targetRoles,
            permissions: targetPermissions
          }];
        }

        await usersCollection.updateOne(
          { _id },
          {
            $set: {
              properties: updatedProperties,
              organization: [
                {
                  id: "6915d0490f0319baabaea793",
                  name: process.env.BRAND_NAME || "Default Organization",
                  domain: process.env.SITE || "https://example.com"
                }
              ]
            },
            $unset: { roles: "", permissions: "" }
          }
        );
      }

      processedCount += users.length;
      console.log(`✅ Processed ${processedCount} of ${totalUsers} users...`);
    }

    console.log("🎉 User Schema Migration (ALL Users) completed");
    // Do not process.exit(0) here, bootstrap() handles it.
  } catch (error) {
    console.error("❌ Migration Error:", error);
    throw error;
  }
}

