import { Injectable, Logger } from '@nestjs/common';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleAnalyticsProvider {
    private readonly logger = new Logger(GoogleAnalyticsProvider.name);

    /**
     * Initializes the Google Analytics Data Client using the provided OAuth client
     */
    private getAnalyticsClient(authClient: OAuth2Client): BetaAnalyticsDataClient {
        return new BetaAnalyticsDataClient({
            authClient,
        });
    }

    // ─────────────────────────────────────────────
    // Realtime
    // ─────────────────────────────────────────────

    /**
     * Fetches a realtime snapshot: active users, top active pages, and users by country.
     */
    async getRealtimeSnapshot(authClient: OAuth2Client, propertyId: string) {
        try {
            const client = this.getAnalyticsClient(authClient);

            // Realtime active users & pageviews (no dimensions)
            const [totalRes] = await client.runRealtimeReport({
                property: `properties/${propertyId}`,
                metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
            });

            const activeUsers = parseInt(totalRes.rows?.[0]?.metricValues?.[0]?.value ?? '0', 10);
            const pageViews = parseInt(totalRes.rows?.[0]?.metricValues?.[1]?.value ?? '0', 10);

            // Realtime active users by page title
            const [pagesRes] = await client.runRealtimeReport({
                property: `properties/${propertyId}`,
                dimensions: [{ name: 'unifiedScreenName' }],
                metrics: [{ name: 'activeUsers' }],
                limit: 10,
                orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            });

            const topPages = (pagesRes.rows || []).map(row => ({
                page: row.dimensionValues?.[0]?.value ?? '',
                activeUsers: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
            }));

            // Realtime active users by country
            const [countryRes] = await client.runRealtimeReport({
                property: `properties/${propertyId}`,
                dimensions: [{ name: 'country' }],
                metrics: [{ name: 'activeUsers' }],
                limit: 10,
                orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            });

            const topCountries = (countryRes.rows || []).map(row => ({
                country: row.dimensionValues?.[0]?.value ?? '',
                activeUsers: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
            }));

            return { activeUsers, pageViews, topPages, topCountries };
        } catch (error) {
            this.logger.error(`Error fetching realtime data for property ${propertyId}`, error);
            throw new Error(`Failed to fetch realtime data: ${error.message}`);
        }
    }

    /**
     * Gets deep realtime tracking specifically focused on pulling up to a large number of pages
     */
    async getDeepRealtimePages(
        authClient: OAuth2Client,
        propertyId: string,
        limit = 200,
    ) {
        try {
            const client = this.getAnalyticsClient(authClient);

            const [response] = await client.runRealtimeReport({
                property: `properties/${propertyId}`,
                dimensions: [{ name: 'unifiedScreenName' }], 
                metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
                limit,
                orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            });

            return (response.rows || []).map(row => ({
                page: row.dimensionValues?.[0]?.value ?? '(not set)',
                activeUsers: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
                pageviews: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
            }));
        } catch (error) {
            this.logger.error(`Error fetching Realtime Pages for property ${propertyId}`, error);
            throw new Error(`Failed to fetch Realtime Pages: ${error.message}`);
        }
    }

    /**
     * Gets realtime metrics grouped by custom dimensions (Author / Category)
     */
    async getDeepRealtimeDimensions(
        authClient: OAuth2Client,
        propertyId: string,
        dimensionName: string,
        limit = 50,
    ) {
        try {
            const client = this.getAnalyticsClient(authClient);

            if (dimensionName.startsWith('customEvent:')) {
                // Fallback to standard historical API for 'today' since Realtime API rejects customEvent
                const [response] = await client.runReport({
                    property: `properties/${propertyId}`,
                    dateRanges: [{ startDate: 'today', endDate: 'today' }],
                    dimensions: [{ name: dimensionName }],
                    metrics: [{ name: 'activeUsers' }],
                    limit,
                    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
                });

                return (response.rows || []).map(row => ({
                    label: row.dimensionValues?.[0]?.value ?? '(not set)',
                    activeUsers: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
                }));
            }

            const [response] = await client.runRealtimeReport({
                property: `properties/${propertyId}`,
                dimensions: [{ name: dimensionName }],
                metrics: [{ name: 'activeUsers' }],
                limit,
                orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            });

            return (response.rows || []).map(row => ({
                label: row.dimensionValues?.[0]?.value ?? '(not set)',
                activeUsers: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
            }));
        } catch (error) {
            this.logger.error(`Error fetching Realtime Dimension ${dimensionName} for property ${propertyId}`, error);
            throw new Error(`Failed to fetch Realtime Dimension ${dimensionName}: ${error.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // Overview KPIs
    // ─────────────────────────────────────────────

    /**
     * Gets the headline KPI metrics for a date range, along with the comparison period.
     */
    async getOverviewKPIs(authClient: OAuth2Client, propertyId: string, startDate = '30daysAgo', endDate = 'today') {
        try {
            const client = this.getAnalyticsClient(authClient);

            const [response] = await client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [
                    { startDate, endDate },
                    // Previous period comparison
                    { startDate: this._getPreviousPeriodStart(startDate, endDate), endDate: this._getPreviousPeriodEnd(startDate) },
                ],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'totalUsers' },
                    { name: 'newUsers' },
                    { name: 'sessions' },
                    { name: 'averageSessionDuration' },
                    { name: 'bounceRate' },
                    { name: 'screenPageViewsPerSession' },
                    { name: 'engagedSessions' },
                    { name: 'engagementRate' },
                ],
            });

            const current = response.rows?.[0]?.metricValues || [];
            const previous = response.rows?.[1]?.metricValues || [];

            const parse = (arr: any[], idx: number) => parseFloat(arr[idx]?.value ?? '0');

            return {
                pageviews: { current: parse(current, 0), previous: parse(previous, 0) },
                totalUsers: { current: parse(current, 1), previous: parse(previous, 1) },
                newUsers: { current: parse(current, 2), previous: parse(previous, 2) },
                sessions: { current: parse(current, 3), previous: parse(previous, 3) },
                avgSessionDuration: { current: parse(current, 4), previous: parse(previous, 4) },
                bounceRate: { current: parse(current, 5), previous: parse(previous, 5) },
                pagesPerSession: { current: parse(current, 6), previous: parse(previous, 6) },
                engagedSessions: { current: parse(current, 7), previous: parse(previous, 7) },
                engagementRate: { current: parse(current, 8), previous: parse(previous, 8) },
            };
        } catch (error) {
            this.logger.error(`Error fetching overview KPIs for property ${propertyId}`, error);
            throw new Error(`Failed to fetch overview KPIs: ${error.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // Dimension-based report (generic)
    // ─────────────────────────────────────────────

    /**
     * Queries GA4 data grouped by a single dimension (city, browser, deviceCategory, etc.)
     */
    async getByDimension(
        authClient: OAuth2Client,
        propertyId: string,
        dimension: string,
        startDate = '30daysAgo',
        endDate = 'today',
        limit = 20,
    ) {
        try {
            const client = this.getAnalyticsClient(authClient);

            const [response] = await client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: dimension }],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'totalUsers' },
                    { name: 'sessions' },
                    { name: 'bounceRate' },
                ],
                orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
                limit,
            });

            return (response.rows || []).map(row => ({
                label: row.dimensionValues?.[0]?.value ?? '(not set)',
                pageviews: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
                users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
                sessions: parseInt(row.metricValues?.[2]?.value ?? '0', 10),
                bounceRate: parseFloat(row.metricValues?.[3]?.value ?? '0'),
            }));
        } catch (error) {
            this.logger.error(`Error fetching ${dimension} data for property ${propertyId}`, error);
            throw new Error(`Failed to fetch ${dimension} data: ${error.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // Daily Trends
    // ─────────────────────────────────────────────

    /**
     * Gets daily time-series data (pageviews, users, sessions).
     */
    async getDailyTrend(authClient: OAuth2Client, propertyId: string, startDate = '30daysAgo', endDate = 'today') {
        try {
            const client = this.getAnalyticsClient(authClient);

            const [response] = await client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'date' }],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'totalUsers' },
                    { name: 'sessions' },
                ],
                orderBys: [{ dimension: { dimensionName: 'date' } }],
                limit: 90,
            });

            return (response.rows || []).map(row => ({
                date: row.dimensionValues?.[0]?.value ?? '',
                pageviews: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
                users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
                sessions: parseInt(row.metricValues?.[2]?.value ?? '0', 10),
            }));
        } catch (error) {
            this.logger.error(`Error fetching daily trend for property ${propertyId}`, error);
            throw new Error(`Failed to fetch daily trend: ${error.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // Traffic Sources
    // ─────────────────────────────────────────────

    /**
     * Gets traffic source breakdown by channel group and source/medium.
     */
    async getTrafficSources(
        authClient: OAuth2Client,
        propertyId: string,
        startDate = '30daysAgo',
        endDate = 'today',
        limit = 20,
    ) {
        try {
            const client = this.getAnalyticsClient(authClient);

            const [response] = await client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [
                    { name: 'sessionDefaultChannelGroup' },
                    { name: 'sessionSource' },
                    { name: 'sessionMedium' },
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'screenPageViews' },
                    { name: 'bounceRate' },
                ],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit,
            });

            return (response.rows || []).map(row => ({
                channelGroup: row.dimensionValues?.[0]?.value ?? '(not set)',
                source: row.dimensionValues?.[1]?.value ?? '(not set)',
                medium: row.dimensionValues?.[2]?.value ?? '(not set)',
                sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
                users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
                pageviews: parseInt(row.metricValues?.[2]?.value ?? '0', 10),
                bounceRate: parseFloat(row.metricValues?.[3]?.value ?? '0'),
            }));
        } catch (error) {
            this.logger.error(`Error fetching traffic sources for property ${propertyId}`, error);
            throw new Error(`Failed to fetch traffic sources: ${error.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // Detailed Page Views (for author/category correlation)
    // ─────────────────────────────────────────────

    /**
     * Gets a summary of traffic (Views, Active Users, Sessions) for a date range
     */
    async getTrafficSummary(authClient: OAuth2Client, propertyId: string, startDate = '30daysAgo', endDate = 'today') {
        try {
            const analyticsDataClient = this.getAnalyticsClient(authClient);

            const [response] = await analyticsDataClient.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [
                    {
                        startDate,
                        endDate,
                    },
                ],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'activeUsers' },
                    { name: 'sessions' },
                    { name: 'engagedSessions' },
                ],
            });

            if (!response.rows || response.rows.length === 0) {
                return {
                    views: 0,
                    activeUsers: 0,
                    sessions: 0,
                    engagedSessions: 0,
                };
            }

            const metrics = response.rows[0].metricValues;
            return {
                views: parseInt(metrics[0].value, 10) || 0,
                activeUsers: parseInt(metrics[1].value, 10) || 0,
                sessions: parseInt(metrics[2].value, 10) || 0,
                engagedSessions: parseInt(metrics[3].value, 10) || 0,
            };

        } catch (error) {
            this.logger.error(`Error fetching GA4 traffic data for property ${propertyId}`, error);
            throw new Error(`Failed to fetch Google Analytics data: ${error.message}`);
        }
    }

    /**
     * Gets the top pages by views
     */
    async getTopPages(authClient: OAuth2Client, propertyId: string, limit = 10, startDate = '30daysAgo', endDate = 'today') {
        try {
            const analyticsDataClient = this.getAnalyticsClient(authClient);

            const [response] = await analyticsDataClient.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [
                    {
                        startDate,
                        endDate,
                    },
                ],
                dimensions: [
                    { name: 'pagePath' },
                    { name: 'pageTitle' }
                ],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'totalUsers' },
                    { name: 'averageSessionDuration' },
                    { name: 'bounceRate' },
                ],
                orderBys: [
                    {
                        metric: { metricName: 'screenPageViews' },
                        desc: true,
                    },
                ],
                limit,
            });

            return (response.rows || []).map(row => ({
                path: row.dimensionValues[0].value,
                title: row.dimensionValues[1].value,
                views: parseInt(row.metricValues[0].value, 10) || 0,
                users: parseInt(row.metricValues[1].value, 10) || 0,
                avgDuration: parseFloat(row.metricValues[2].value) || 0,
                bounceRate: parseFloat(row.metricValues[3].value) || 0,
            }));

        } catch (error) {
            this.logger.error(`Error fetching GA4 top pages for property ${propertyId}`, error);
            throw new Error('Failed to fetch Google Analytics top pages');
        }
    }

    /**
     * Gets page views and engagement metrics grouped by page path for a date range.
     * Optionally filters results to ONLY the specified exact paths.
     */
    async getPageViewsByPaths(
        authClient: OAuth2Client,
        propertyId: string,
        startDate = '7daysAgo',
        endDate = 'today',
        limit = 10000,
        exactPaths?: string[],
    ): Promise<{ path: string; views: number; activeUsers: number; avgEngagementTime: number }[]> {
        try {
            const analyticsDataClient = this.getAnalyticsClient(authClient);

            const request: any = {
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'pagePath' }],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'activeUsers' },
                    { name: 'averageSessionDuration' },
                ],
                orderBys: [
                    {
                        metric: { metricName: 'screenPageViews' },
                        desc: true,
                    },
                ],
                limit,
            };

            if (exactPaths && exactPaths.length > 0) {
                request.dimensionFilter = {
                    filter: {
                        fieldName: 'pagePath',
                        inListFilter: {
                            values: exactPaths,
                        },
                    },
                };
            }

            const [response] = await analyticsDataClient.runReport(request);

            return (response.rows || []).map(row => ({
                path: row.dimensionValues[0].value,
                views: parseInt(row.metricValues[0].value, 10) || 0,
                activeUsers: parseInt(row.metricValues[1].value, 10) || 0,
                avgEngagementTime: parseFloat(row.metricValues[2].value) || 0,
            }));
        } catch (error) {
            this.logger.error(`Error fetching GA4 page views by path for property ${propertyId}`, error);
            throw new Error('Failed to fetch Google Analytics page-level data');
        }
    }

    /**
     * Gets performance metrics grouped by a custom dimension (e.g. customEvent:author or customEvent:category)
     */
    async getCustomDimensionPerformance(
        authClient: OAuth2Client,
        propertyId: string,
        dimensionName: string,
        startDate = '30daysAgo',
        endDate = 'today',
        limit = 50,
    ) {
        try {
            const analyticsDataClient = this.getAnalyticsClient(authClient);

            const [response] = await analyticsDataClient.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: dimensionName }],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'activeUsers' },
                    { name: 'averageSessionDuration' },
                ],
                orderBys: [
                    {
                        metric: { metricName: 'screenPageViews' },
                        desc: true,
                    },
                ],
                limit,
            });

            return (response.rows || []).map(row => ({
                label: row.dimensionValues[0].value || '(not set)',
                views: parseInt(row.metricValues[0].value, 10) || 0,
                activeUsers: parseInt(row.metricValues[1].value, 10) || 0,
                avgEngagementTime: parseFloat(row.metricValues[2].value) || 0,
            }));
        } catch (error) {
            this.logger.error(`Error fetching GA4 dimension ${dimensionName} for property ${propertyId}`, error);
            throw new Error(`Failed to fetch custom dimension ${dimensionName}`);
        }
    }

    /**
     * Lists all GA4 properties accessible by the authenticated user.
     * Uses the Google Analytics Admin API.
     */
    async listAccountProperties(authClient: OAuth2Client) {
        try {
            const analyticsAdmin = google.analyticsadmin({
                version: 'v1beta',
                auth: authClient,
            });

            // 1. List all accounts
            const accountsRes = await analyticsAdmin.accounts.list();
            const accounts = accountsRes.data.accounts || [];

            const results = [];

            for (const account of accounts) {
                // 2. For each account, list properties
                const propertiesRes = await analyticsAdmin.properties.list({
                    filter: `parent:${account.name}`,
                });
                const properties = propertiesRes.data.properties || [];

                for (const prop of properties) {
                    // prop.name is like "properties/123456789"
                    const propertyId = prop.name?.replace('properties/', '');
                    results.push({
                        accountId: propertyId,
                        accountLabel: prop.displayName || prop.name,
                        accountName: account.displayName,
                        propertyName: prop.name,
                    });
                }
            }

            return results;
        } catch (error) {
            this.logger.error('Error listing GA4 account properties', error);
            throw new Error('Failed to list Google Analytics properties');
        }
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    /**
     * Calculates the previous period start date for comparison.
     * If relative dates like '30daysAgo' are used, doubles the range.
     */
    private _getPreviousPeriodStart(startDate: string, endDate: string): string {
        const daysMatch = startDate.match(/^(\d+)daysAgo$/);
        if (daysMatch) {
            const days = parseInt(daysMatch[1], 10);
            return `${days * 2}daysAgo`;
        }
        // Absolute dates: calculate the range and shift backwards
        try {
            const start = new Date(startDate);
            const end = new Date(endDate === 'today' ? new Date().toISOString().split('T')[0] : endDate);
            const diffMs = end.getTime() - start.getTime();
            const prevStart = new Date(start.getTime() - diffMs);
            return prevStart.toISOString().split('T')[0];
        } catch {
            return '60daysAgo';
        }
    }

    private _getPreviousPeriodEnd(startDate: string): string {
        const daysMatch = startDate.match(/^(\d+)daysAgo$/);
        if (daysMatch) {
            const days = parseInt(daysMatch[1], 10);
            return `${days + 1}daysAgo`;
        }
        // Absolute: the day before the current start
        try {
            const start = new Date(startDate);
            const prevEnd = new Date(start.getTime() - 86400000);
            return prevEnd.toISOString().split('T')[0];
        } catch {
            return '31daysAgo';
        }
    }
}
