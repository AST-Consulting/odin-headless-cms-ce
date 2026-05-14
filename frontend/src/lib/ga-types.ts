// ─── GA Analytics Types ───────────────────────────────────────────────────────

export type GaMetricWithComparison = {
  current: number;
  previous: number;
};

export type GaOverview = {
  pageviews: GaMetricWithComparison;
  totalUsers: GaMetricWithComparison;
  newUsers: GaMetricWithComparison;
  sessions: GaMetricWithComparison;
  avgSessionDuration: GaMetricWithComparison;
  bounceRate: GaMetricWithComparison;
  pagesPerSession: GaMetricWithComparison;
  engagedSessions: GaMetricWithComparison;
  engagementRate: GaMetricWithComparison;
};

export type GaRealtimePage = {
  page: string;
  activeUsers: number;
};

export type GaRealtimeCountry = {
  country: string;
  activeUsers: number;
};

export type GaRealtime = {
  activeUsers: number;
  topPages: GaRealtimePage[];
  topCountries: GaRealtimeCountry[];
};

export type GaDimensionRow = {
  label: string;
  pageviews: number;
  users: number;
  sessions: number;
  bounceRate: number;
};

export type GaTopArticle = {
  path: string;
  title: string;
  views: number;
  users: number;
  avgDuration: number;
  bounceRate: number;
};

export type GaDeskRow = {
  desk: string;
  numberOfStories: number;
  totalPageviews: number;
  totalUsers: number;
  avgTimeOnPage: number;
};

export type GaCategoryRow = {
  category: string;
  numberOfStories: number;
  totalPageviews: number;
  totalUsers: number;
  avgTimeOnPage: number;
};

export type GaReports = {
  deskReport: GaDeskRow[];
  categoryReport: GaCategoryRow[];
};

export type GaTrendRow = {
  date: string;
  pageviews: number;
  users: number;
  sessions: number;
};

export type GaTrafficSource = {
  channelGroup: string;
  source: string;
  medium: string;
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
};

export type GaDateRange = '7daysAgo' | '30daysAgo' | '90daysAgo';
