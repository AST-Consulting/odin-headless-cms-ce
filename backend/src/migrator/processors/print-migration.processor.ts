import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import slugify from 'slugify';

import {
  CreatePrintArticleDto,
  PRINT_MIGRATION_QUEUE,
} from '@articles/dto/create-print-article.dto';
import { MigratorService } from '../migrator.service';
import { ArticlesService } from '@articles/articles.service';
import { AWSService } from '@utilities/file-upload/providers/aws.service';
import { CategoryService } from '../../category/category.service';
import { Category, TCategoryDocument } from '../../category/entities/category.schema';
import { User, TUserDocument } from '@user/entities/user.schema';
import { FileUpload, TFileUploadDocument } from '@utilities/file-upload/entities/fileUpload.schema';
import { TCurrentUserType } from '@auth/types/user.type';

// Raw category name → canonical slug (special-cases where simple slugify produces the wrong result)
const CATEGORY_SLUG_MAP: Record<string, string> = {
  '': 'local-news',
  Deoghar: 'deoghar',
  'Bihar Sharif': 'biharsharif',
  'bihar-sharif': 'biharsharif',
  Gopalganj: 'gopalganj',
};

// Category slug → FileUpload document ID (_id) of the fallback featured image for that category.
// Used when an article has no hero image (or hero image equals DEFAULT_HERO_IMAGE_ID).
// Fill in the actual FileUpload ObjectId strings for each category; leave empty string to skip the fallback.
const CATEGORY_FALLBACK_MEDIA: Record<string, string> = {
  kishanganj: '69ad39aa245c420cec533335',
  supaul: '69ad397c245c420cec533252',
  khagaria: '69ad39ad245c420cec53333a',
  araria: '69ad39e7245c420cec5334e4',
  katihar: '69ad39ad245c420cec53333b',
  banka: '69ac2b8f245c420cec4d07cc',
  bhagalpur: '69ad4b48245c420cec539492',
  munger: '69ad39a7245c420cec53332d',
  saharsa: '69ad39a5245c420cec53331e',
  jamtara: '69ad39af245c420cec533342',
  deogarh: '69ad4b49245c420cec539496',
  dumka: '69ad39dc245c420cec5334be',
  godda: '69ad39c4245c420cec533438',
  pakur: '69ad39a7245c420cec533329',
  sahibganj: '69ad8e43011ef44c893f1e8b',
  bokaro: '69ad39e3245c420cec5334d6',
  gaya: '69ad4b49245c420cec539497',
  giridih: '69ad62f1245c420cec541563',
  jamshedpur: '69ada4c3011ef44c894169b0',
  'east-singhbhum': '69ac2b8c245c420cec4d07b8',
  'seraikela-kharsawan': '69ad39a4245c420cec53331a',
  'west-singhbhum': '69ac2b8b245c420cec4d07b5',
  betiah: '69ac2b8b245c420cec4d07b4',
  darbhanga: '69ad39dd245c420cec5334c0',
  muzaffarpur: '69ad62f1245c420cec541564',
  samastipur: '69ad39a4245c420cec53331d',
  sitamarhi: '69ad3981245c420cec533268',
  arrah: '69ad39e5245c420cec5334e0',
  arwal: '69ac2b8a245c420cec4d07ad',
  buxar: '69ad39e2245c420cec5334d4',
  gopalganj: '69ad39c4245c420cec533435',
  shekhpura: '69ac2b8a245c420cec4d07ac',
  siwan: '69ad397f245c420cec53325d',
  chatra: '69ad39de245c420cec5334c1',
  garhwa: '69ad39dc245c420cec5334bd',
  koderma: '69ad39aa245c420cec533334',
  gumla: '69ad39b0245c420cec533347',
  ranchi: '69ad4b49245c420cec539498',
  khunti: '69ad39ad245c420cec533339',
  purnia: '69ad39a6245c420cec533324',
  lakhisarai: '69ad39a9245c420cec533333',
  hazaribagh: '69ad39af245c420cec533344',
  latehar: '69ad39a9245c420cec533332',
  biharsharif: '69ad39e3245c420cec5334d9',
  saran: '69ad398d245c420cec53329b',
  begusarai: '69ad39e4245c420cec5334dc',
  aurangabad: '69ad39e5245c420cec5334dd',
  chapra: '69ac3916245c420cec4d5f55',
  hajipur: '69ad39b0245c420cec533346',
  jamui: '69ad39ae245c420cec533340',
  jehanabad: '69ad39ae245c420cec53333e',
  kaimur: '69ad39ae245c420cec53333c',
  madhepura: '69ad39a8245c420cec533330',
  madhubani: '69ad39a8245c420cec53332f',
  motihari: '69ad39a8245c420cec53332e',
  nalanda: '69ac3913245c420cec4d5f48',
  nawada: '69ad39a7245c420cec53332c',
  patna: '69ad4b48245c420cec539490',
  raxaul: '69ac3913245c420cec4d5f45',
  sasaram: '69ad3989245c420cec53328e',
  shiekhpura: '69ac3912245c420cec4d5f42',
  dhanbad: '69ad4b48245c420cec539494',
  kolkata: '69ac9aa3245c420cec4fb082',
  lohardaga: '69ad39a9245c420cec533331',
  palamu: '69ad39a6245c420cec533325',
  ramgarh: '69ad39a5245c420cec533323',
  saraikela: '69ac3910245c420cec4d5f38',
  simdega: '69ad3984245c420cec533270',
  tilaiya: '69ac3910245c420cec4d5f35',
  bettiah: '69ad39e4245c420cec5334db',
  deoghar: '69ac3d8f245c420cec4d7bed',
  rourkela: '69ad39a5245c420cec533320',
  siliguri: '69ac9aa3245c420cec4fb081',
  asansol: '69ad39e5245c420cec5334de',
  chaibasa: '69ad39e2245c420cec5334d2',
};

@Processor(PRINT_MIGRATION_QUEUE)
export class PrintMigrationProcessor {
  private readonly logger = new Logger(PrintMigrationProcessor.name);

  constructor(
    private readonly migratorService: MigratorService,
    private readonly articlesService: ArticlesService,
    private readonly awsService: AWSService,
    private readonly _categoryService: CategoryService,
    @InjectModel(Category.name) private readonly categoryModel: Model<TCategoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<TUserDocument>,
    @InjectModel(FileUpload.name) private readonly fileUploadModel: Model<TFileUploadDocument>
  ) {}

  @Process('migrate')
  async handle(job: Job<CreatePrintArticleDto>): Promise<void> {
    const story = job.data;
    this.logger.log(`[PrintMigration] Processing story: ${story.id} — "${story.headline}"`);

    try {
      const systemUser = this._getMigrationUser();

      // 1. Convert raw HTML to BlockNote rich blocks (handles images, embeds, headings, etc.)
      const richBlocks = await this.migratorService.convertHtmlToRichBlocks(
        story.headline,
        story.content,
        systemUser
      );

      // 2. Resolve category names → odin_cms ObjectId strings
      const categoryIds = await this._resolveCategoryIds(story.categories ?? []);

      // 3. Resolve author emails → AuthorStub objects
      const authors = await this._resolveAuthors(story.authors ?? []);

      // 4. Download hero image → upload to S3 → get CDN URL.
      // If heroImageUrl is absent or is the known default placeholder, fall back to a
      // category-specific image from CATEGORY_FALLBACK_MEDIA instead.
      const isDefaultHero =
        !story.heroImageUrl ||
        (!!process.env.DEFAULT_HERO_IMAGE_ID &&
          story.heroImageId === process.env.DEFAULT_HERO_IMAGE_ID);

      let featuredMedia: any | undefined;

      if (!isDefaultHero) {
        featuredMedia = await this._uploadHeroImage(
          story.heroImageUrl,
          story.heroImageCaption || '',
          systemUser,
          story.propertyId
        );
      }

      if (!featuredMedia) {
        const mainCategorySlug = this._resolvePrimaryCategorySlug(story.categories ?? []);
        const fallbackMediaId = mainCategorySlug ? CATEGORY_FALLBACK_MEDIA[mainCategorySlug] : '';
        if (fallbackMediaId) {
          featuredMedia = await this.fileUploadModel
            .findById(fallbackMediaId)
            .select('url')
            .lean()
            .exec();
        }
      }

      // 5. Build DTO and create article
      const tags = story.tags?.filter(Boolean) ?? [];
      if (!tags.length && process.env.DEFAULT_TAG_ID) {
        tags.push(process.env.DEFAULT_TAG_ID);
      }

      if (!categoryIds.length && process.env.DEFAULT_CATEGORY_ID) {
        categoryIds.push(process.env.DEFAULT_CATEGORY_ID);
      }

      const dto = {
        organizationId: systemUser.organizationId,
        type: 'article',
        status: 'published',
        lang: story.lang || 'hi',
        title: story.headline,
        slug: story.slug || undefined,
        body: story.content,
        richBlocks,
        excerpt: story.subHeadline,
        authors,
        tags,
        primaryCategory: categoryIds[0],
        categories: categoryIds,
        seo: {
          title: story.seo?.metaTitle || story.headline,
          description: story.seo?.metaDescription || story.subHeadline || '',
          keywords: story?.seo.metaKeywords,
        },
        propertyId: story.propertyId,
        publishedAt: story.pubDate,
        preserveUpdatedAt: true,
        featuredMedia,
      };

      const article = await this.articlesService.create(dto as any, systemUser);
      this.logger.log(
        `[PrintMigration] Created article ${article._id} for story ${story.id} (${richBlocks.length} blocks)`
      );
    } catch (error) {
      this.logger.error(`[PrintMigration] Failed story ${story.id}: ${error.message}`, error.stack);
      throw error; // Re-throw so Bull retries per job config
    }
  }

  private _getMigrationUser(): TCurrentUserType {
    return {
      sub: process.env.DEFAULT_SYSTEM_USER_ID || '000000000000000000000000',
      name: process.env.BRAND_NAME || 'News Desk',
      email: 'internet@example.in',
      organizationId: process.env.DEFAULT_ORGANIZATION_ID || '000000000000000000000000',
    };
  }

  private async _resolveCategoryIds(categoryNames: string[]): Promise<string[]> {
    const ids = new Set<string>();
    for (const name of categoryNames.filter(Boolean)) {
      const slugifiedName = name.trim().toLowerCase().replace(/\s+/g, '-');

      const category = await this.categoryModel
        .findOne({
          slug: {
            $regex: new RegExp(`^${slugifiedName}$`, 'i'),
          },
        })
        .exec();
      if (category) {
        ids.add(category._id.toString());

        // Fetch and add all ancestor categories for hierarchical propagation
        if (category.fullSlug) {
          try {
            const ancestors = await this._categoryService.findAllAncestorsByFullSlug(
              category.fullSlug
            );
            for (const ancestor of ancestors) {
              ids.add(ancestor._id.toString());
            }
          } catch (error) {
            this.logger.warn(
              `[PrintMigration] Failed to fetch ancestors for category ${category.fullSlug}: ${error.message}`
            );
          }
        }
      } else {
        this.logger.warn(`[PrintMigration] Category not found: "${name}"`);
      }
    }
    return Array.from(ids);
  }

  private _resolvePrimaryCategorySlug(categoryNames: string[]): string | null {
    const first = categoryNames.find(Boolean);
    if (!first) return null;
    return CATEGORY_SLUG_MAP[first] ?? slugify(first, { lower: true, strict: true });
  }

  private async _uploadHeroImage(
    imageUrl: string,
    caption: string,
    user: TCurrentUserType,
    propertyId?: string
  ): Promise<{ url: string; caption: string } | undefined> {
    try {
      const printMediaUrl = process.env.PRINT_MEDIA_URL || '';
      const printMediaPath = process.env.PRINT_MEDIA_IMAGE_PATH || '';

      const fileName = printMediaUrl
        ? imageUrl.split(printMediaUrl)[1]
        : path.basename(imageUrl.split('?')[0]);
      const localPath = printMediaPath + fileName;

      if (!fs.existsSync(localPath)) {
        throw new Error(`Local file not found: ${localPath}`);
      }

      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).replace('.', '') || 'jpg';
      const mimeType = ext.toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${ext.toLowerCase()}`;
      const originalname = path.basename(localPath);

      const multerFile = {
        fieldname: 'file',
        originalname,
        encoding: '7bit',
        mimetype: mimeType,
        buffer,
        size: buffer.length,
      } as Express.Multer.File;

      const result = await this.awsService.singleFileUpload(
        multerFile,
        '',
        user.organizationId,
        false,
        'print-migration',
        user,
        propertyId,
        true, // skipWatermark — migrated images already have their watermarks
        '16:9' // fitAspect — pad non-16:9 images with a blurred background
      );

      const cdnUrl: string = result?.data?.url;
      if (!cdnUrl) throw new Error('No URL returned from S3 upload');

      return { url: cdnUrl, caption };
    } catch (err) {
      this.logger.warn(
        `[PrintMigration] Hero image upload failed for "${imageUrl}": ${err.message} — skipping featuredMedia`
      );
      return undefined;
    }
  }

  private async _resolveAuthors(rawAuthors: any[]): Promise<any[]> {
    const resolved = [];
    for (const a of rawAuthors) {
      if (!a?.email) continue;
      const user = await this.userModel.findOne({ email: a.email }).exec();
      if (user) {
        resolved.push({
          id: user._id.toString(),
          name: user.name || a.name,
          slug: user.slug,
        });
      } else {
        this.logger.warn(`[PrintMigration] Author not found: ${a.email}`);
      }
    }

    if (!resolved.length && process.env.DEFAULT_AUTHOR_ID) {
      const defaultAuthor = await this.userModel
        .findById(process.env.DEFAULT_AUTHOR_ID)
        .select('name slug')
        .lean()
        .exec();
      if (defaultAuthor) {
        resolved.push({
          id: process.env.DEFAULT_AUTHOR_ID,
          name: defaultAuthor.name,
          slug: defaultAuthor.slug,
        });
      }
    }

    return resolved;
  }
}
