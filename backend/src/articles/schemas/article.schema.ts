import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Document, Schema as MongooseSchema } from 'mongoose';
import { AuthorStub } from './sub-schemas/author-stub.schema';
import { Entity } from './sub-schemas/entity.schema';
import { Channels } from './sub-schemas/channels.schema';
import { Seo, SeoSchema } from './sub-schemas/seo.schema';
import { DiscoverHealth } from './sub-schemas/discover-health.schema';
import { Counters, MetricsLatest } from './sub-schemas/metrics.schema';
import { Embeddings, RichBlock, ImageAsset, VideoAsset } from './sub-schemas/content.schema';
import { RevisionLite } from './sub-schemas/revision-lite.schema';
import { Moderation } from './sub-schemas/moderation.schema';
import { IUserSub } from 'src/user/entities/user-sub.interface';
import { UserSub } from 'src/user/entities/user-sub.schema';
import { UserInfoSchema } from '@core/schema/general.schema';
import { UserInfo } from '@core/utils/utilVars';
import { CategorySub } from 'src/category/entities/category-sub.schema';
import { TagSub } from '@tags/entities/tag-sub.schema';
import { FileSub } from '@utilities/file-upload/entities/file-sub.schema';
import { PropertySub } from '@property/schema/property.sub-schema';
import { OrganizationSub } from '@organization/entities/organization-sub.schema';

@Schema({ timestamps: true, collection: 'articles' })
export class Article extends Document {
  // @Prop({
  //   type: UserSub,
  //   required: true,
  //   _id: false,
  // })
  // user: IUserSub;

  @Prop({ required: true })
  organization: OrganizationSub;

  // @Prop({ type: Number })
  // pubBucket: number;

  @Prop({
    required: true,
    enum: ['article', 'liveblog', 'explainer', 'photo_story', 'video', 'opinion', 'post', 'recipe', 'movie_review'],
  })
  type: string;

  @Prop({
    required: true,
    enum: ['draft', 'review', 'scheduled', 'published', 'archived'],
    index: true,
  })
  status: string;

  @Prop({ type: Date, required: false })
  scheduledAt?: Date;

  @Prop({ type: Date, required: false })
  coverageStartTime?: Date;

  @Prop({ type: Date, required: false })
  coverageEndTime?: Date;

  @Prop({ type: Boolean, default: false })
  isSponsored: boolean;

  @Prop({ type: Boolean, default: false })
  isPremium: boolean;

  @Prop({ required: true })
  lang: string;

  @Prop({ index: true, required: false })
  slug: string;

  @Prop({ index: true, required: false })
  fullSlug: string;

  @Prop()
  canonicalUrl: string;

  @Prop({ required: false })
  title: string;

  @Prop({ required: false })
  englishHeadline: string;

  // @Prop()
  // dek: string; // "dek" is a journalism term for a short summary

  @Prop()
  body: string; // To store legacy HTML body, can be deprecated later

  @Prop({ type: Object, required: false })
  webStoryData?: Record<string, any>;

  @Prop({ type: [RichBlock], default: [] })
  richBlocks: RichBlock[];

  @Prop({ type: [ImageAsset], default: [] })
  images: ImageAsset[];

  @Prop({ type: [VideoAsset], default: [] })
  videos: VideoAsset[];

  @Prop({ type: [AuthorStub], default: [] })
  authors: AuthorStub[];

  // @Prop({ type: [String], default: [] })
  // beats: string[];

  // @Prop({ type: [String], default: [] })
  // geo: string[];

  @Prop({ type: [Entity], default: [] })
  entities: Entity[];

  @Prop({ type: Channels })
  channels: Channels;

  @Prop({ type: SeoSchema })
  seo: Seo;

  @Prop({ type: DiscoverHealth })
  discoverHealth: DiscoverHealth;

  // @Prop({ type: Counters, default: () => ({}) })
  // counters: Counters;

  @Prop({ type: MetricsLatest })
  metricsLatest: MetricsLatest;

  @Prop({ type: Embeddings })
  embeddings: Embeddings;

  @Prop({ type: [TagSub], default: [] })
  tags: TagSub[];

  @Prop()
  publishedAt: Date;

  @Prop()
  embargoAt: Date;

  @Prop({ type: Number, default: 1 })
  currentVersion: number;

  // @Prop({ type: [RevisionLite], default: [] })
  // revisionsLite: RevisionLite[];

  @Prop({ type: Moderation })
  moderation: Moderation;

  // @Prop({ default: false })
  // softDeleted: boolean;

  @Prop({ required: false })
  articlePostId?: number;

  @Prop({ type: [CategorySub], default: [] })
  categories: CategorySub[];

  @Prop({ required: false })
  metaTitle: string;

  @Prop({ required: false })
  metaDescription: string;

  @Prop({ required: false })
  ogTitle: string;

  @Prop({ required: false })
  ogDescription: string;

  @Prop({ required: false })
  excerpt: string;

  @Prop({ required: false })
  keyword: string;

  @Prop({ required: true })
  property: PropertySub;

  @Prop({ required: false })
  featuredMedia?: FileSub;

  @Prop({ required: false })
  featuredVideo?: FileSub;

  // @Prop({ type: [Number], default: [] })
  // wpCategoryIds: number[];

  // @Prop({ type: [Number], default: [] })
  // wpTagIds: number[];

  @Prop({ required: false })
  wpId?: number;

  @Prop({ required: false })
  primaryCategory: CategorySub;

  @Prop({ type: MongooseSchema.Types.Mixed })
  recipeData?: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  movieReviewData?: any;

  @Prop({ type: UserInfoSchema }) // Keeping track of who created the banner
  createdBy: UserInfo; // User info of the creator

  @Prop({ type: UserInfoSchema }) // Keeping track of who last updated the banner
  updatedBy: UserInfo; // User info of the last updater

  @Prop({ required: false })
  header?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ArticleSchema = SchemaFactory.createForClass(Article);

export type TArticleDocument = HydratedDocument<Article>;

// Primary listing index: filter by property + status, sorted by published date
ArticleSchema.index({ 'property.id': 1, status: 1, publishedAt: -1 });

// General listing sorted by last updated (default sort in APIFeatures)
ArticleSchema.index({ 'property.id': 1, updatedAt: -1 });

// Org-level queries (analytics aggregations)
ArticleSchema.index({ 'organization.id': 1, status: 1 });

// Author filter (multikey index on embedded authors array)
ArticleSchema.index({ 'authors.id': 1 });

// Tag filters (multikey indexes on embedded tags array)
ArticleSchema.index({ 'tags.id': 1 });
ArticleSchema.index({ 'tags.slug': 1 });

// Scheduled article processing: find due scheduled articles
ArticleSchema.index({ status: 1, scheduledAt: 1 });

// Incremental Mongo→ES resync (mongoToElastic.mjs): filter by updatedAt / createdAt since a cutoff
ArticleSchema.index({ updatedAt: -1 });
ArticleSchema.index({ createdAt: -1 });

// Author-slug filter + created-desc sort (WP /filter fallback, author listing pages)
ArticleSchema.index({ 'authors.slug': 1, createdAt: -1 });
