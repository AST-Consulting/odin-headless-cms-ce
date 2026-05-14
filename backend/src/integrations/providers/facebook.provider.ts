import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class FacebookProvider {
    private readonly logger = new Logger(FacebookProvider.name);
    private readonly GRAPH_API_VERSION = 'v19.0';
    private readonly BASE_URL = `https://graph.facebook.com/${this.GRAPH_API_VERSION}`;

    constructor(private readonly httpService: HttpService) { }

    /**
     * List Facebook pages the user admin. Retrieves the unique Page Access Token for each.
     */
    async listPages(userAccessToken: string) {
        try {
            const res = await firstValueFrom(
                this.httpService.get(`${this.BASE_URL}/me/accounts`, {
                    params: {
                        access_token: userAccessToken,
                        fields: 'id,name,access_token,picture{url},followers_count',
                    },
                })
            );
            return res.data.data.map((page: any) => ({
                accountId: page.id,
                accountLabel: page.name,
                pageAccessToken: page.access_token, // Crucial for publishing/analytics
                thumbnailUrl: page.picture?.data?.url,
                followersCount: page.followers_count,
            }));
        } catch (error) {
            this.logger.error('Error fetching Facebook pages', error.response?.data || error.message);
            throw new BadRequestException('Failed to fetch Facebook pages');
        }
    }

    /**
     * Fetch Facebook Page Insights (Impressions, Engaged Users).
     */
    async getPageAnalytics(pageId: string, pageAccessToken: string, since: string, until: string) {
        try {
            const res = await firstValueFrom(
                this.httpService.get(`${this.BASE_URL}/${pageId}/insights`, {
                    params: {
                        access_token: pageAccessToken,
                        metric: 'page_impressions,page_engaged_users',
                        period: 'day',
                        since,
                        until,
                    },
                })
            );

            const data = res.data.data || [];
            if (data.length === 0) return { impressions: 0, engagedUsers: 0, dailyData: [] };

            const impressionsData = data.find(m => m.name === 'page_impressions')?.values || [];
            const engagedUsersData = data.find(m => m.name === 'page_engaged_users')?.values || [];

            let totalImpressions = 0;
            let totalEngagedUsers = 0;
            const dailyData = impressionsData.map((imp, idx) => {
                totalImpressions += imp.value;
                const engaged = engagedUsersData[idx]?.value || 0;
                totalEngagedUsers += engaged;
                return {
                    date: imp.end_time?.split('T')[0],
                    impressions: imp.value,
                    engagedUsers: engaged,
                };
            });

            return { impressions: totalImpressions, engagedUsers: totalEngagedUsers, dailyData };
        } catch (error) {
            this.logger.error(`Error fetching Facebook Insights for page ${pageId}`, error.response?.data || error.message);
            throw new BadRequestException('Failed to fetch Facebook Analytics');
        }
    }

    /**
     * Publish text/link post to the Facebook Page.
     */
    async publishPost(pageId: string, pageAccessToken: string, message: string, link?: string) {
        try {
            const data: any = { message, access_token: pageAccessToken };
            if (link) data.link = link;

            const res = await firstValueFrom(
                this.httpService.post(`${this.BASE_URL}/${pageId}/feed`, data)
            );
            return { success: true, postId: res.data.id };
        } catch (error) {
            this.logger.error(`Error publishing to Facebook page ${pageId}`, error.response?.data || error.message);
            throw new BadRequestException('Failed to publish post to Facebook');
        }
    }
}
