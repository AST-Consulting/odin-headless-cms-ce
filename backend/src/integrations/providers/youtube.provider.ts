import { Injectable, Logger } from '@nestjs/common';
import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class YouTubeProvider {
    private readonly logger = new Logger(YouTubeProvider.name);

    public getYouTubeClient(authClient: OAuth2Client): youtube_v3.Youtube {
        return google.youtube({
            version: 'v3',
            auth: authClient,
        });
    }

    private getYouTubeAnalyticsClient(authClient: OAuth2Client) {
        return google.youtubeAnalytics({
            version: 'v2',
            auth: authClient,
        });
    }

    /**
     * Lists YouTube channels owned by the authenticated user
     */
    async listChannels(authClient: OAuth2Client) {
        try {
            const ytClient = this.getYouTubeClient(authClient);
            const response = await ytClient.channels.list({
                part: ['snippet', 'statistics'],
                mine: true,
            });

            return (response.data.items || []).map(channel => ({
                accountId: channel.id,
                accountLabel: channel.snippet?.title || `Channel ${channel.id}`,
                statistics: channel.statistics,
                thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
            }));
        } catch (error) {
            this.logger.error('Error fetching YouTube channels', error);
            throw new Error('Failed to fetch YouTube channels');
        }
    }

    /**
     * Fetches analytics (views, watch time, subscribers) for a specific channel.
     * Used by the Integrations settings card for a quick summary.
     */
    async getChannelAnalytics(authClient: OAuth2Client, channelId: string, startDate: string, endDate: string) {
        try {
            const analyticsClient = this.getYouTubeAnalyticsClient(authClient);

            const response = await analyticsClient.reports.query({
                ids: `channel==${channelId}`,
                startDate,
                endDate,
                metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
                dimensions: 'day',
                sort: 'day',
            });

            const rows = response.data.rows || [];

            let totalViews = 0;
            let totalEstimatedMinutesWatched = 0;
            let totalSubscribersGained = 0;
            let totalSubscribersLost = 0;

            rows.forEach(row => {
                totalViews += row[1] || 0;
                totalEstimatedMinutesWatched += row[2] || 0;
                totalSubscribersGained += row[4] || 0;
                totalSubscribersLost += row[5] || 0;
            });

            return {
                views: totalViews,
                estimatedMinutesWatched: totalEstimatedMinutesWatched,
                netSubscribersGained: totalSubscribersGained - totalSubscribersLost,
                dailyData: rows.map(row => ({
                    date: row[0],
                    views: row[1],
                    estimatedMinutesWatched: row[2],
                    averageViewDuration: row[3],
                    subscribersGained: row[4],
                    subscribersLost: row[5],
                })),
            };
        } catch (error) {
            this.logger.error(`Error fetching basic YouTube Analytics for channel ${channelId}`, error);
            throw new Error('Failed to fetch YouTube Analytics');
        }
    }

    /**
     * Fetches headline KPI metrics with a comparison period
     */
    async getOverviewKPIs(authClient: OAuth2Client, channelId: string, startDate: string, endDate: string) {
        try {
            const analyticsClient = this.getYouTubeAnalyticsClient(authClient);
            const metrics = 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained,subscribersLost';

            // Current Period
            const [currentRes] = await Promise.all([
                analyticsClient.reports.query({
                    ids: `channel==${channelId}`,
                    startDate,
                    endDate,
                    metrics,
                })
            ]);

            // Previous Period Calculation
            const prev = this._getPreviousPeriod(startDate, endDate);
            const [prevRes] = await Promise.all([
                analyticsClient.reports.query({
                    ids: `channel==${channelId}`,
                    startDate: prev.startDate,
                    endDate: prev.endDate,
                    metrics,
                })
            ]);

            const current = currentRes.data.rows?.[0] || Array(8).fill(0);
            const previous = prevRes.data.rows?.[0] || Array(8).fill(0);

            return {
                views: { current: current[0], previous: previous[0] },
                watchTime: { current: current[1], previous: previous[1] },
                avgViewDuration: { current: current[2], previous: previous[2] },
                likes: { current: current[3], previous: previous[3] },
                comments: { current: current[4], previous: previous[4] },
                shares: { current: current[5], previous: previous[5] },
                netSubscribers: { 
                    current: (current[6] || 0) - (current[7] || 0), 
                    previous: (previous[6] || 0) - (previous[7] || 0) 
                },
                subscribersGained: { current: current[6] || 0, previous: previous[6] || 0 },
                subscribersLost: { current: current[7] || 0, previous: previous[7] || 0 },
                impressions: { current: 0, previous: 0 },
                ctr: { current: 0, previous: 0 },
            };
        } catch (error) {
            this.logger.error(`Error fetching YouTube Overview for channel ${channelId}`, error);
            throw new Error('Failed to fetch YouTube Overview KPIs');
        }
    }

    /**
     * Gets daily time-series data for views and watch time
     */
    async getDailyTrend(authClient: OAuth2Client, channelId: string, startDate: string, endDate: string) {
        try {
            const analyticsClient = this.getYouTubeAnalyticsClient(authClient);
            const response = await analyticsClient.reports.query({
                ids: `channel==${channelId}`,
                startDate,
                endDate,
                metrics: 'views,estimatedMinutesWatched',
                dimensions: 'day',
                sort: 'day',
            });

            return (response.data.rows || []).map(row => ({
                date: row[0],
                views: row[1],
                watchTime: row[2],
            }));
        } catch (error) {
            this.logger.error(`Error fetching YouTube Daily Trends for channel ${channelId}`, error);
            throw new Error('Failed to fetch YouTube Daily Trends');
        }
    }

    /**
     * Gets top performing videos. 
     * Note: This returns raw video IDs; enrichment with titles/thumbnails happens in the Service layer.
     */
    async getTopVideos(authClient: OAuth2Client, channelId: string, startDate: string, endDate: string, limit = 10) {
        try {
            const analyticsClient = this.getYouTubeAnalyticsClient(authClient);
            const response = await analyticsClient.reports.query({
                ids: `channel==${channelId}`,
                startDate,
                endDate,
                metrics: 'views,estimatedMinutesWatched,averageViewDuration,likes',
                dimensions: 'video',
                sort: '-views',
                maxResults: limit,
            });

            return (response.data.rows || []).map(row => ({
                videoId: row[0],
                views: row[1],
                watchTime: row[2],
                avgDuration: row[3],
                likes: row[4],
            }));
        } catch (error) {
            this.logger.error(`Error fetching YouTube Top Videos for channel ${channelId}`, error);
            throw new Error('Failed to fetch YouTube Top Videos');
        }
    }

    /**
     * Generic dimension-based report (country, deviceType, etc.)
     */
    async getByDimension(
        authClient: OAuth2Client, 
        channelId: string, 
        dimension: string, 
        startDate: string, 
        endDate: string, 
        limit = 20
    ) {
        try {
            this.logger.debug(`Fetching YouTube Dimension ${dimension} for channel ${channelId} (${startDate} to ${endDate})`);
            const analyticsClient = this.getYouTubeAnalyticsClient(authClient);
            const response = await analyticsClient.reports.query({
                ids: `channel==${channelId}`,
                startDate,
                endDate,
                metrics: 'views,estimatedMinutesWatched',
                dimensions: dimension,
                sort: '-views',
                maxResults: limit,
            });

            return (response.data.rows || []).map(row => ({
                label: row[0],
                views: row[1],
                watchTime: row[2],
            }));
        } catch (error) {
            this.logger.error(`Error fetching YouTube Dimension ${dimension} for channel ${channelId}`, error);
            throw new Error(`Failed to fetch YouTube data for ${dimension}`);
        }
    }

    /**
     * Gets traffic source breakdown
     */
    async getTrafficSources(authClient: OAuth2Client, channelId: string, startDate: string, endDate: string) {
        try {
            const analyticsClient = this.getYouTubeAnalyticsClient(authClient);
            const response = await analyticsClient.reports.query({
                ids: `channel==${channelId}`,
                startDate,
                endDate,
                metrics: 'views,estimatedMinutesWatched',
                dimensions: 'insightTrafficSourceType',
                sort: '-views',
            });

            return (response.data.rows || []).map(row => ({
                source: row[0],
                views: row[1],
                watchTime: row[2],
            }));
        } catch (error) {
            this.logger.error(`Error fetching YouTube Traffic Sources for channel ${channelId}`, error);
            throw new Error('Failed to fetch YouTube Traffic Sources');
        }
    }

    /**
     * Fetches metadata (title, thumbnail) for a list of video IDs using the YouTube Data API v3.
     */
    async getVideoDetails(authClient: OAuth2Client, videoIds: string[]) {
        try {
            const ytClient = this.getYouTubeClient(authClient);
            const response = await ytClient.videos.list({
                part: ['snippet', 'statistics'],
                id: videoIds,
            });

            return (response.data.items || []).map(item => ({
                videoId: item.id,
                title: item.snippet?.title,
                thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
                publishedAt: item.snippet?.publishedAt,
            }));
        } catch (error) {
            this.logger.error('Error fetching YouTube video details', error);
            return []; // Return empty instead of throwing to prevent crashing the whole report
        }
    }

    /**
     * Helper: Calculates the start/end date for the previous comparison period.
     */
    private _getPreviousPeriod(startDate: string, endDate: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMs = end.getTime() - start.getTime();
        
        const prevEnd = new Date(start.getTime() - 86400000); // Day before start
        const prevStart = new Date(prevEnd.getTime() - diffMs);

        return {
            startDate: prevStart.toISOString().split('T')[0],
            endDate: prevEnd.toISOString().split('T')[0],
        };
    }

    /**
     * Fetches lifetime analytics metrics (watch time, likes) that are not available in basic channel stats.
     */
    async getLifetimeAnalytics(authClient: OAuth2Client, channelId: string) {
        try {
            const analyticsClient = this.getYouTubeAnalyticsClient(authClient);
            const response = await analyticsClient.reports.query({
                ids: `channel==${channelId}`,
                startDate: '2000-01-01',
                endDate: new Date().toISOString().split('T')[0],
                metrics: 'estimatedMinutesWatched,likes,comments,shares',
            });

            const rows = response.data.rows || [];
            const data = rows[0] || [0, 0, 0, 0];

            return {
                estimatedMinutesWatched: data[0] || 0,
                likes: data[1] || 0,
                comments: data[2] || 0,
                shares: data[3] || 0,
            };
        } catch (error) {
            this.logger.error(`Error fetching lifetime YouTube Analytics for channel ${channelId}`, error);
            return { estimatedMinutesWatched: 0, likes: 0, comments: 0, shares: 0 };
        }
    }
}
