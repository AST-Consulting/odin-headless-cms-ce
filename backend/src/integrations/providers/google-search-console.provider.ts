import { Injectable, Logger } from '@nestjs/common';
import { google, searchconsole_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleSearchConsoleProvider {
    private readonly logger = new Logger(GoogleSearchConsoleProvider.name);

    /**
     * Initializes the Google Search Console Client using the provided OAuth client
     */
    private getSearchConsoleClient(authClient: OAuth2Client): searchconsole_v1.Searchconsole {
        return google.searchconsole({
            version: 'v1',
            auth: authClient,
        });
    }

    /**
     * Gets a list of sites the user has verified in Google Search Console
     */
    async getVerifiedSites(authClient: OAuth2Client) {
        try {
            const gscClient = this.getSearchConsoleClient(authClient);
            const response = await gscClient.sites.list();
            return response.data.siteEntry || [];
        } catch (error) {
            this.logger.error('Error fetching verified GSC sites', error);
            throw new Error('Failed to fetch verified Search Console sites');
        }
    }

    /**
     * Gets a summary of search performance (Clicks, Impressions, CTR, Position)
     * @param siteUrl The exact URL verified in GSC (e.g., 'sc-domain:example.com' or 'https://example.com/')
     */
    async getSearchAnalytics(authClient: OAuth2Client, siteUrl: string, startDate: string, endDate: string) {
        try {
            const gscClient = this.getSearchConsoleClient(authClient);

            const response = await gscClient.searchanalytics.query({
                siteUrl,
                requestBody: {
                    startDate,
                    endDate,
                    dimensions: ['date'], // Group by date to get daily trend, but we'll also aggregate total
                    rowLimit: 1000,
                },
            });

            const rows = response.data.rows || [];

            // Calculate totals
            let totalClicks = 0;
            let totalImpressions = 0;
            let totalPosition = 0;

            rows.forEach(row => {
                totalClicks += row.clicks || 0;
                totalImpressions += row.impressions || 0;
                totalPosition += (row.position || 0) * (row.impressions || 0); // Weighted average for position
            });

            const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
            const averagePosition = totalImpressions > 0 ? totalPosition / totalImpressions : 0;

            return {
                clicks: totalClicks,
                impressions: totalImpressions,
                ctr: parseFloat(averageCtr.toFixed(2)),
                position: parseFloat(averagePosition.toFixed(2)),
                dailyData: rows, // Returning the daily breakdown as well
            };

        } catch (error) {
            this.logger.error(`Error fetching GSC analytics for site ${siteUrl}`, error);
            throw new Error('Failed to fetch Search Console analytics');
        }
    }

    /**
     * Gets per-page performance data (Clicks, Impressions, CTR, Position)
     * Each row corresponds to a unique URL that received impressions during the period.
     * @param siteUrl The exact URL verified in GSC (e.g., 'sc-domain:example.com')
     * @param startDate ISO date string (YYYY-MM-DD)
     * @param endDate   ISO date string (YYYY-MM-DD)
     * @param urlPrefix Optional URL prefix to filter results (e.g., 'https://example.com/news/')
     * @param exactPaths Optional array of exact URLs/paths to filter. Automatically chunked to avoid 2048-char regex limit.
     */
    async getPageLevelAnalytics(
        authClient: OAuth2Client,
        siteUrl: string,
        startDate: string,
        endDate: string,
        urlPrefix?: string,
        exactPaths?: string[],
    ): Promise<{ url: string; clicks: number; impressions: number; ctr: number; position: number }[]> {
        try {
            const gscClient = this.getSearchConsoleClient(authClient);

            const baseRequestBody: any = {
                startDate,
                endDate,
                dimensions: ['page'],
                rowLimit: 25000,
            };

            const allRows: any[] = [];

            if (exactPaths && exactPaths.length > 0) {
                // Determine safe chunks to avoid Google API 2048-character regex limit
                // Each slug is approx 60-80 chars. 30 slugs * 80 = 2400 chars (slightly high).
                // Let's use 20 items per chunk to be safely under 2048 characters.
                const chunkSize = 20;
                for (let i = 0; i < exactPaths.length; i += chunkSize) {
                    const chunk = exactPaths.slice(i, i + chunkSize);
                    
                    // Escape special characters and join with OR '|'
                    const regexExp = `(${chunk.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
                    
                    const requestBody = { ...baseRequestBody };
                    requestBody.dimensionFilterGroups = [
                        {
                            filters: [
                                {
                                    dimension: 'page',
                                    operator: 'includingRegex',
                                    expression: regexExp,
                                },
                            ],
                        },
                    ];

                    const response = await gscClient.searchanalytics.query({
                        siteUrl,
                        requestBody,
                    });
                    
                    if (response.data.rows) {
                        allRows.push(...response.data.rows);
                    }
                }
            } else {
                // Normal request with just URL prefix or no filter
                const requestBody = { ...baseRequestBody };
                
                if (urlPrefix) {
                    requestBody.dimensionFilterGroups = [
                        {
                            filters: [
                                {
                                    dimension: 'page',
                                    operator: 'includingRegex',
                                    expression: urlPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                                },
                            ],
                        },
                    ];
                }

                const response = await gscClient.searchanalytics.query({
                    siteUrl,
                    requestBody,
                });
                
                if (response.data.rows) {
                    allRows.push(...response.data.rows);
                }
            }

            // Deduplicate rows in case chunked paths somehow matched the same URL
            const uniqueRowsMap = new Map();
            for (const row of allRows) {
                if (row.keys && row.keys.length > 0) {
                    uniqueRowsMap.set(row.keys[0], row);
                }
            }
            
            const uniqueRows = Array.from(uniqueRowsMap.values());

            return uniqueRows.map(row => ({
                url: row.keys?.[0] || '',
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: parseFloat(((row.ctr || 0) * 100).toFixed(2)),
                position: parseFloat((row.position || 0).toFixed(2)),
            }));
        } catch (error) {
            this.logger.error(`Error fetching GSC page-level analytics for site ${siteUrl}`, error);
            throw new Error('Failed to fetch Search Console page-level analytics');
        }
    }

    /**
     * Submits a sitemap to Google Search Console
     */
    async submitSitemap(authClient: OAuth2Client, siteUrl: string, sitemapUrl: string) {
        try {
            const gscClient = this.getSearchConsoleClient(authClient);

            await gscClient.sitemaps.submit({
                siteUrl,
                feedpath: sitemapUrl,
            });

            return { success: true, message: 'Sitemap submitted successfully' };
        } catch (error) {
            this.logger.error(`Error submitting sitemap for site ${siteUrl}`, error);
            throw new Error('Failed to submit sitemap to Search Console');
        }
    }
}
