export type Topic = {
  topic: string;
  score: number;
  lang: string;
  freshness: string;
  category?: string;
};

export type FactCheckSource = {
  title: string;
  url: string;
};

export type FactCheckFinding = {
  id: string;
  blockId?: string;
  quote: string;
  claim: string;
  verdict: "contradicted" | "outdated" | "unsupported" | "needs_review";
  severity: "high" | "medium" | "low";
  confidence: number;
  reason: string;
  suggestedReplacement: string;
  suggestedAction: "replace" | "soften" | "attribute" | "review";
  sources: FactCheckSource[];
};

export type FactCheckResult = {
  language?: string;
  summary: {
    claimsReviewed: number;
    issuesFound: number;
    findingsByVerdict: Record<string, number>;
    highRiskCount: number;
    overallRisk: "low" | "medium" | "high";
    modelUsed: string;
    validatedAt: string;
  };
  findings: FactCheckFinding[];
};

export type AuthorStub = {
  id: string;
  name: string;
  slug?: string;
  profileUrl?: string;
};

export type FeaturedMedia = {
  id: string;
  url: string;
  path: string;
  alt?: string;
  caption?: string;
  duration?: string;
};

export interface RecipeMetadata {
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeCategory?: string;
  recipeCuisine?: string;
  ratingValue?: string;
  ratingCount?: string;
}

export interface MovieReviewMetadata {
  movieName?: string;
  director?: string;
  actors?: string;
  ratingValue?: string;
  ratingCount?: string;
  bestRating?: string;
  reviewCount?: string;
}

export type Article = {
  _id: string;
  title: string;
  englishHeadline?: string;
  type: string;
  status: string;
  lang: string;
  slug?: string;
  fullSlug?: string;
  images?: any[];
  featuredMedia?: FeaturedMedia;
  featuredVideo?: FeaturedMedia;
  user: {
    id: string;
    name: string;
  };
  organizationId: string;
  propertyId: string;
  webStoryData?: {
    slides: any[];
  };
  seo?: {
    title?: string;
    description?: string;
    internalLinks?: any[];
  };
  tags?: string[] | Array<{ id: string; _id?: string; name: string; slug: string; fullSlug?: string }>;
  categories?: string[] | Array<{ id: string; _id?: string; name?: string; title?: string; slug: string; fullSlug?: string }>;
  primaryCategory?: string | { id: string; _id?: string; title?: string; name?: string; slug: string; fullSlug?: string };
  beats?: string[];
  authors?: AuthorStub[];
  richBlocks?: any[];
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    name: string;
    id: string;
  };
  updatedBy?: {
    name: string;
    id: string;
  };
  metaTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  header?: string;
  scheduledAt?: string;
  coverageStartTime?: string;
  coverageEndTime?: string;
  isSponsored?: boolean;
  isPremium?: boolean;
  recipeData?: RecipeMetadata;
  movieReviewData?: MovieReviewMetadata;
  metricsLatest?: {
    uv?: number;
    pv?: number;
    ctr?: number;
    clicks?: number;
    impressions?: number;
    position?: number;
    lastSyncedAt?: string;
  };
};

export type SeoHealth = {
  article: string;
  largeImage: boolean;
  schema: "ok" | "warn" | "error";
  byline: boolean;
  freshness: string;
  score: number;
};

export type KpiMetric = {
  title: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
};

export type User = {
  id: string;
  name: string;
  email: string;
  userType: string;
  avatar?: string;
  profilePicture?: {
    fileName: string;
    path: string;
    id: string;
    url: string;
  };
  organizationId?: string;
  propertyId?: string;
  organizations?: UserOrganizationSub[];
  status?: string;
  properties?: UserProperty[];
  roles?: Array<{ id: string; name: string }>;
  rolesName?: string[];
  slug?: string;
  designation?: string;
  alt_name?: string;
  description?: string;
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
    instagram?: string;
  };
  permissions?: Permission[];
  roleIds?: string[];
  generateNewPw?: boolean;
  rank?: number;
};

export type UserOrganizationSub = {
  id: string;
  _id?: string;
  name: string;
  domain?: string;
  slug?: string;
};

export type Permission = {
  module: string;
  actions: string[];
};

export type UserProperty = {
  id: string;
  _id?: string;
  name?: string;
  domain: string;
  status?: string;
  organizationId?: string;
  roles?: Array<{ id: string; name: string }>;
  permissions?: Permission[];
};

export type OrganizationUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  userType: string;
};

export type Role = {
  _id: string;
  name: string;
  status: "active" | "inactive";
  user: {
    name: string;
    id: string;
    email: string;
    roles: any[];
  };
  organizationId: string;
  permissions: Permission[];
  createdBy: {
    id: string;
    name: string;
    userType: string;
  };
  updatedBy: {
    id: string;
    name: string;
    userType: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type RolesResponse = {
  data: Role[];
  success: boolean;
  message: string;
  total: number;
  limit: number;
  page: number;
  pageCount: number;
};

export type MenusResponse = {
  data: Menu[];
  success?: boolean;
  message?: string;
  total: number;
  limit: number;
  page: number;
  lastId?: string;
  pageCount: number;
};




export type UserData = {
  _id: string | { $oid: string };
  id: string;
  userType: string;
  name: string;
  alt_name?: string;
  slug: string;
  username?: string;
  designation?: string;
  description?: string;
  email: string;
  phone: string | null;
  profilePicture?: {
    fileName: string;
    path: string;
    id: string;
    url: string;
  };
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
    instagram?: string;
  };
  verified: boolean;
  emailVerified?: string | { $date: string } | null;
  phoneVerified?: string | { $date: string } | null;
  timezone: {
    name?: string | null;
    country_or_territory: string | null;
    utc_time_offset?: string | null;
  };
  usedInviteCode: string;
  roles?: Array<{ id: string; name: string }>;
  rolesName?: string[];
  permissions?: Permission[];
  createdBy: {
    id: string;
    name: string;
    userType: string;
  } | null;
  updatedBy: {
    id: string;
    name: string;
    userType: string;
  } | null;
  totalCreditsBought: number;
  totalCreditsUsed: number;
  isCompleted: boolean;
  companyName: string;
  organization: {
    id: string;
    name: string;
    slug?: string;
    domain?: string;
  };
  organizations?: UserOrganizationSub[];
  status?: string;
  properties?: UserProperty[];
  generateNewPw?: boolean;
  hasCompletedOnboarding: boolean;
  wpId?: number;
  rank?: number;
  createdAt: string | { $date: string };
  updatedAt: string | { $date: string };
  header?: string;
  seo?: {
    title: string;
    metaDescription: string;
    keywords?: string[];
    og?: {
      title: string;
      description: string;
      image?: string;
      url?: string;
    };
  };
};

export type UsersResponse = {
  data: UserData[];
  success: boolean;
  message: string;
  total: number;
  limit: number;
  page: number;
  lastId?: string;
  lastSortValues?: any[] | null;
  pageCount: number;
};

export type Organization = {
  _id: string;
  id?: string;
  name: string;
  slug?: string;
  organizationName?: string; // Legacy field
  organization_name?: string;
  legal_name?: string;
  alternate_name?: string[];
  org_type?: string;
  domain?: string;
  url?: string;
  status: string;
  isVerified: boolean;
  address?: {
    street_address?: string;
    address_locality?: string;
    address_region?: string;
    postal_code?: string;
    address_country?: string;
  };
  contact_details?: {
    email?: string;
    primary_phone?: string;
    secondary_phone?: string;
  };
  social_links?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    wikipedia?: string;
  };
  seo_data?: {
    meta_title?: string;
    meta_description?: string;
  };
  logos?: {
    square?: { url: string; id?: string; width?: number; height?: number; purpose?: string };
    rectangle?: { url: string; id?: string; width?: number; height?: number; purpose?: string };
  };
  business_hours?: Array<{
    day_of_week: string[];
    opens: string;
    closes: string;
    is_closed: boolean;
  }>;
  website_info?: {
    search_url?: string;
    in_language?: string;
    potential_action?: boolean;
  };
  location_metadata?: {
    geo?: {
      type: string;
      coordinates: number[];
    };
    price_range?: string;
  };
  founding_date?: string | { $date: string };
  admins?: any[];
  createdAt?: string;
  updatedAt?: string | { $date: string };
};

export type OrganizationResponse = {
  data: Organization;
  message: string;
};

export type OrganizationListResponse = {
  data: Organization[];
  message: string;
};

export type RoleName = {
  id: string;
  name: string;
};

export type RoleNamesResponse = {
  data: RoleName[];
  success: boolean;
  message: string;
};

export type InviteUserRequest = {
  email: string;
  roles: string[];
};

export type InviteUserResponse = {
  success: boolean;
  message: string;
};

export type Beat = {
  id: string;
  name: string;
  color?: string;
};

export type Channel = {
  id: string;
  name: string;
};

export type Block = {
  id: string;
  type: "paragraph" | "heading" | "list" | "image" | "quote" | "table" | "embed" | "cta";
  content: any;
  order: number;
  metadata?: any;
};

// AI Chat Types
export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

export type ChatRequest = {
  message: string;
  history?: Omit<ChatMessage, 'id' | 'timestamp'>[];
  signal?: AbortSignal;
};

// Google Trends Types
export type TrendsDataType = 'TIMESERIES' | 'GEO_MAP' | 'RELATED_TOPICS' | 'RELATED_QUERIES';

export type TrendsQuery = {
  query: string;
  data_type?: TrendsDataType;
  geo?: string;
  date?: string;
  hl?: string;
};

export type TrendingSearchesQuery = {
  geo?: string;
  hl?: string;
};

export type TrendingTopic = {
  query: string;
  title?: string;
  exploreLink?: string;
  image?: {
    imageUrl?: string;
    newsUrl?: string;
    source?: string;
  };
  articles?: Array<{
    title: string;
    snippet?: string;
    source?: string;
    url?: string;
    thumbnail?: string;
  }>;
  formattedTraffic?: string;
  traffic?: string;
  // Fields from SerpAPI trending-now endpoint
  search_volume?: number;
  increase_percentage?: number;
  active?: boolean;
  start_timestamp?: number;
  end_timestamp?: number;
  trend_breakdown?: string[];
  categories?: Array<{ id: number; name: string }>;
};

export type TimelineData = {
  date: string;
  timestamp: string;
  values: Array<{
    query: string;
    value: string;
    extracted_value: number;
  }>;
};

export type TrendsResponse = {
  search_metadata?: {
    id: string;
    status: string;
    total_time_taken: number;
  };
  interest_over_time?: {
    timeline_data: TimelineData[];
    averages?: Array<{
      query: string;
      value: number;
    }>;
  };
  interest_by_region?: Array<{
    location: string;
    extracted_value: number;
    value: string;
  }>;
  related_topics?: {
    top?: Array<{
      query?: string;
      value: number | string;
      link?: string;
      topic?: { mid?: string; title?: string; type?: string };
      topic_type?: string;
      topic_mid?: string;
      topic_title?: string;
    }>;
    rising?: Array<{
      query?: string;
      value: number | string;
      link?: string;
      topic?: { mid?: string; title?: string; type?: string };
      topic_type?: string;
      topic_mid?: string;
      topic_title?: string;
    }>;
  };
  related_queries?: {
    top?: Array<{
      query: string;
      value: number | string;
      link?: string;
    }>;
    rising?: Array<{
      query: string;
      value: number | string;
      link?: string;
    }>;
  };
};

export type PropertyDto = {
  domain: string;
  industry: string;
  status?: string;
  articleType?: string;
  about?: string;
  targetAudience?: string[];
  specialInstruction?: string;
  imageWidth?: number;
  imageHeight?: number;
  timeZone?: string;
  urlPatterns?: {
    tag?: string;
    category?: string;
    author?: string;
    page?: string;
  };
  contact_details?: {
    email?: string;
    primary_phone?: string;
  };
  social_links?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
    wikipedia?: string;
    linkedin?: string;
  };
  seo_data?: {
    meta_title?: string;
    meta_description?: string;
  };
};

export type Property = {
  _id: string;
  domain: string;
  industry: string;
  status: string;
  articleType: string;
  about?: string;
  targetAudience?: string[];
  specialInstruction?: string;
  imageWidth?: number;
  imageHeight?: number;
  timeZone?: string;
  lang?: string;
  organizationId?: string;
  organization?: {
    id?: string;
    _id?: string;
    name?: string;
    slug?: string;
    domain?: string;
  };
  urlPatterns?: {
    tag?: string;
    category?: string;
    author?: string;
    page?: string;
  };
  contact_details?: {
    email?: string;
    primary_phone?: string;
  };
  social_links?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
    wikipedia?: string;
    linkedin?: string;
  };
  seo_data?: {
    meta_title?: string;
    meta_description?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type MenuItem = {
  _id?: string;
  titles: string;
  link: string;
  status: string;
  type: string;
  textColor?: string;
  bgColor?: string;
  rank: number;
  others?: string;
  subMenuSlug?: string;
  label?: string;
  titleHn?: string;
  image?: {
    id: string;
    fileName: string;
    path: string;
  };
  icon?: MediaRef;
  children?: MenuItem[];
};

export type Menu = {
  _id: string;
  title: string;
  status: string;
  rank: number;
  slug: string;
  items?: MenuItem[];
  image?: {
    id: string;
    fileName: string;
    path: string;
  };
  bannerImage?: {
    id: string;
    fileName: string;
    path: string;
  };
  icon?: {
    id: string;
    fileName: string;
    path: string;
  };
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    name: string;
    id?: string;
  };
  updatedBy?: {
    name: string;
    id?: string;
  };
};

export type MenuDto = {
  title: string;
  status: string;
  rank: number;
  slug: string;
  items?: MenuItem[];
  image?: {
    id: string;
    fileName: string;
    path: string;
  };
  bannerImage?: {
    id: string;
    fileName: string;
    path: string;
  };
  icon?: {
    id: string;
    fileName: string;
    path: string;
  };
  propertyId?: string;
};

export type OgDto = {
  title: string;
  description: string;
  url?: string;
  image?: string;
};

export type SeoDto = {
  title: string;
  metaDescription: string;
  keywords?: string[];
  og?: OgDto;
};

export type CreateCategoryDTO = {
  title: string;
  slug?: string;
  isPublic?: boolean;
  titleHn?: string;
  description?: string;
  parentId?: string;
  status: string;
  isFeatured?: boolean;
  propertyId?: string;
  link?: string;
  rank?: number;
  seo?: SeoDto;
  icon?: MediaRef;
};

export type Category = {
  _id: string;
  title: string;
  slug: string;
  fullSlug?: string;
  rank: number;
  createdBy: {
    name: string;
    userType: string;
  };
  updatedBy: {
    name: string;
    userType: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  titleHn?: string;
  description?: string;
  parentId?: string;
  parent?: {
    id: string;
    name: string;
    slug: string;
  };
  isFeatured?: boolean;
  propertyId?: string;
  link?: string;
  seo?: SeoDto;
  icon?: MediaRef;
};

export type BannerType = {
  _id: string;
  name: string;
  entity?: string;
  status: string;
  propertyId: string;
  createdBy: {
    name: string;
    userType: string;
  };
  updatedBy: {
    name: string;
    userType: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateBannerTypeDTO = {
  name: string;
  entity?: string;
  status?: string;
  propertyId?: string;
};

export type FileSubDto = {
  url: string;
  key?: string;
  bucket?: string;
  mimetype?: string;
  size?: number;
};

export type NestedBanner = {
  _id?: string;
  slug?: string;
  status?: string;
  description?: string;
  title?: string;
  ctaText?: string;
  apiLink?: string;
  appLink?: string;
  webLink?: string;
  rank?: number;
  openIn?: string;
  runsOn?: string;
  startDate: Date | string;
  endDate?: Date | string;
  image: FileSubDto;
};

export type Banner = {
  _id: string;
  title: string;
  bannerType: string | {
    id: string;
    name: string;
    slug: string;
  };
  banners: NestedBanner[];
  description: string;
  rank?: number;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  tags?: string[];
  categories?: string[];
  propertyId: string;
  createdBy: {
    name: string;
    userType: string;
  };
  updatedBy: {
    name: string;
    userType: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateBannerDTO = {
  title: string;
  bannerType: string;
  banners: NestedBanner[];
  description: string;
  rank?: number;
  startDate: Date | string;
  endDate: Date | string;
  status?: string;
  tags?: string[];
  categories?: string[];
  propertyId?: string;
};

export type Tag = {
  _id: string;
  name: string;
  slug?: string;
  rank: number;
  description: string;
  link?: string;
  status: string;
  seo?: SeoDto;
  propertyId: string;
  createdBy: {
    name: string;
    userType: string;
  };
  updatedBy: {
    name: string;
    userType: string;
  };
  createdAt: string;
  updatedAt: string;
  isFeatured?: boolean;
};

export type CreateTagDTO = {
  name: string;
  rank: number;
  description: string;
  link?: string;
  status?: string;
  seo?: SeoDto;
  propertyId?: string;
  isFeatured?: boolean;
};

export type FAQ = {
  _id: string;
  question: string;
  answer: string;
  tags?: Array<{ id: string; name: string; slug: string }>;
  categories?: Array<{ id: string; name: string; slug: string }>;
  entityType?: string;
  entityValue?: string;
  entityId?: string;
  status: string;
  rank?: number;
  propertyId: string;
  createdBy: {
    name: string;
    userType: string;
  };
  updatedBy: {
    name: string;
    userType: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateFAQDTO = {
  question: string;
  answer: string;
  tags?: string[];
  categories?: string[];
  entityType?: string;
  entityValue?: string;
  entityId?: string;
  status?: string;
  rank?: number;
  propertyId?: string;
};

export type MediaFile = {
  _id: string;
  url: string;
  fileName: string;
  path: string;
  mimeType: string;
  source: string;
  size: number;
  propertyId: string;
  createdBy: {
    id?: string;
    userId?: string;
    userName: string;
    userType?: string;
  };
  createdAt: string;
  updatedAt: string;
  media_details?: {
    width?: number;
    height?: number;
    length?: string | number;
  };
  sizes?: {
    original?: { width: number; height: number; filesize: number; source_url: string };
    [key: string]: { width: number; height: number; filesize: number; source_url: string; file?: string } | undefined;
  };
};

export type FileSub = {
  id: string;
  url: string;
  path: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
};


export type AuditChange = {
  fieldName: string;
  oldValue: string;
  newValue: string;
};

export type AuditUser = {
  userId: string;
  userName: string;
};

export type AuditEntity = {
  _id: string;
  action: "create" | "update" | "delete";
  collectionName: string;
  objectId: string;

  changes: AuditChange[];

  createdBy: AuditUser;
  updatedBy: AuditUser;

  createdAt: string;
  updatedAt: string;
};

// --- Integration Types ---
export type IntegrationStatus =
  | "pending_selection"
  | "connected"
  | "disconnected"
  | "expired"
  | "error";

export type IntegrationRecord = {
  _id: string;
  provider: "google_analytics" | "search_console" | "youtube" | "facebook" | "instagram" | "twitter" | "linkedin";
  status: IntegrationStatus;
  metadata?: {
    propertyId?: string;
    label?: string;
    username?: string;
    profileImageUrl?: string;
    twitterUserId?: string;
    name?: string;
  };
  updatedAt: string;
};

export type GA4Account = {
  accountId: string;
  accountLabel: string;
  accountName: string;
  propertyName: string;
};

export type GSCAccount = {
  accountId: string;
  accountLabel: string;
  permissionLevel: string;
};

export type GA4Data = {
  views: number;
  activeUsers: number;
  sessions: number;
  engagedSessions: number;
};

export type GA4TopPage = {
  path: string;
  title: string;
  views: number;
};

export type GSCDailyData = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GSCData = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  dailyData: GSCDailyData[];
};

export type YouTubeAccount = {
  accountId: string;
  accountLabel: string;
  statistics?: {
    viewCount: string;
    subscriberCount: string;
    videoCount: string;
  };
  thumbnailUrl?: string;
};

export type YouTubeDailyData = {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  subscribersGained: number;
  subscribersLost: number;
};

export type YouTubeData = {
  views: number;
  estimatedMinutesWatched: number;
  netSubscribersGained: number;
  dailyData: YouTubeDailyData[];
};

export type FacebookAccount = {
  accountId: string;
  accountLabel: string;
  pageAccessToken: string;
  thumbnailUrl?: string;
  followersCount?: number;
};

export type FacebookDailyData = {
  date: string;
  impressions: number;
  engagedUsers: number;
};

export type FacebookData = {
  impressions: number;
  engagedUsers: number;
  dailyData: FacebookDailyData[];
};

export type InstagramAccount = {
  accountId: string;
  accountLabel: string;
  pageAccessToken: string;
  thumbnailUrl?: string;
};

export type InstagramDailyData = {
  date: string;
  reach: number;
  impressions: number;
};

export type InstagramData = {
  reach: number;
  impressions: number;
  dailyData: InstagramDailyData[];
};

export type CreateWebStoryTemplateDTO = {
  name: string;
  slug?: string;
  html: string;
  css: string;
  previewImage?: FileSub;
  authors: AuthorStub[];
  allowedFields: string[];
  propertyId?: string;
  organizationId?: string;
};

export type WebStoryTemplate = {
  _id: string;
  name: string;
  slug: string;
  html: string;
  css: string;
  previewImage?: FileSub;
  authors: AuthorStub[];
  allowedFields: string[];
  propertyId?: string;
  organizationId?: string;
  createdBy?: any;
  updatedBy?: any;
  createdAt: string;
  updatedAt: string;
};

export type WebStoryTemplatesResponse = {
  data: WebStoryTemplate[];
  success: boolean;
  message: string;
  total: number;
};
export type ImageDto = {
  id: string;
  filename: string;
  url: string;
  path: string;
};

export type OptionDto = {
  icon?: ImageDto;
  text: string;
};

export type Poll = {
  _id: string;
  id?: string;
  question: string;
  title?: string;
  image?: ImageDto | ImageDto[];
  hint?: string;
  options: OptionDto[];
  status?: string;
  propertyId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    name: string;
    id?: string;
    _id?: string;
    userName?: string;
  };
  updatedBy?: {
    name: string;
    id?: string;
    _id?: string;
    userName?: string;
  };
};

export type CreatePollDto = {
  question: string;
  title?: string;
  image?: ImageDto[];
  hint?: string;
  options: OptionDto[];
  status?: string;
};

// ─── Media Reference (stored inline in entries) ───────────────────────────────

export type MediaRef = {
  id: string;
  url: string;
  path: string;
  fileName?: string;
  mimeType?: string;
};

// ─── Content Builder ──────────────────────────────────────────────────────────

export type FieldType =
  | 'string' | 'text' | 'richtext' | 'richblock' | 'int' | 'float' | 'decimal'
  | 'boolean' | 'date' | 'datetime' | 'time' | 'json' | 'enum' | 'uid'
  | 'email' | 'password' | 'url' | 'media' | 'relation' | 'component' | 'dynamiczone';

export type RelationType = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';

export type EnumOption = { label: string; value: string };

export type FieldValidation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  regex?: string;
  enumValues?: string[];
  enumOptions?: EnumOption[];
};

export type ContentTypeField = {
  _id?: string;
  name: string;
  label?: string;
  description?: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  private?: boolean;
  searchable?: boolean;
  indexed?: boolean;
  listable?: boolean;
  filterable?: boolean;
  sparse?: boolean;
  default?: any;
  validation?: FieldValidation;
  relationTarget?: string;
  relationType?: RelationType;
  relationInverse?: string;
  componentRef?: string;
  repeatable?: boolean;
  allowedComponents?: string[];
  zoneFields?: ContentTypeField[];
  mediaMultiple?: boolean;
  mediaAllowedTypes?: string[];
  order?: number;
};

export type ContentTypeSchema = {
  _id: string;
  displayName: string;
  singularName: string;
  pluralName: string;
  collectionName: string;
  description?: string;
  status: 'draft' | 'published';
  fields: ContentTypeField[];
  listColumns: string[];
  createdAt: string;
  updatedAt: string;
};

export type ComponentSchema = {
  _id: string;
  displayName: string;
  description?: string;
  fields: ContentTypeField[];
  createdAt: string;
  updatedAt: string;
};

// ─── Content Manager (generic entries) ───────────────────────────────────────

export type Entry = {
  _id: string;
  contentTypeId: string;
  data: Record<string, any>;
  propertyId?: string;
  organizationId?: string;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  publishedAt?: string | null;
  locale?: string | null;
  version?: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string | null } | string | null;
  updatedBy?: { id: string; name: string | null } | string | null;
};

export type CreateEntryDTO = {
  data: Record<string, any>;
  propertyId?: string;
  organizationId?: string;
  locale?: string;
  status?: 'draft' | 'published' | 'scheduled' | 'archived';
};
