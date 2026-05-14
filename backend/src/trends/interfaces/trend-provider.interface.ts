export enum TrendPlatform {
  GOOGLE = 'google',
  YOUTUBE = 'youtube',
  REDDIT = 'reddit',
  TWITTER = 'twitter',
}

export interface UnifiedTrendItem {
  rank: number;
  title: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  source: TrendPlatform;
  metadata: Record<string, unknown>;
}

export interface UnifiedTrendsResponse {
  platform: TrendPlatform;
  region: string;
  items: UnifiedTrendItem[];
  fetchedAt: string;
  cached: boolean;
}

export interface TrendProviderOptions {
  geo?: string;
  limit?: number;
  category?: string;
  hl?: string;
  refresh?: string;
  source?: string; // 'live' (RSS) or 'today' (SerpAPI)
  // Optional topic text. When present, providers should perform a topic-scoped
  // lookup (e.g. YouTube search) instead of returning generic regional trends.
  query?: string;
}

export interface TrendProvider {
  readonly platform: TrendPlatform;
  fetchTrending(options: TrendProviderOptions): Promise<UnifiedTrendItem[]>;
  isAvailable(): boolean;
}
