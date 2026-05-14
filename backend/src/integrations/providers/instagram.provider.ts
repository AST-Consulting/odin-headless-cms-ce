import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class InstagramProvider {
    private readonly logger = new Logger(InstagramProvider.name);
    private readonly GRAPH_API_VERSION = 'v19.0';
    private readonly BASE_URL = `https://graph.facebook.com/${this.GRAPH_API_VERSION}`;

    constructor(private readonly httpService: HttpService) { }

    /**
     * List Instagram Business accounts linked to the user's Facebook Pages.
     */
    async listInstagramAccounts(userAccessToken: string) {
        try {
            // Fetch FB Pages with the linked IG account
            const res = await firstValueFrom(
                this.httpService.get(`${this.BASE_URL}/me/accounts`, {
                    params: {
                        access_token: userAccessToken,
                        fields: 'instagram_business_account{id,username,name,profile_picture_url},access_token',
                    },
                })
            );

            const accounts = [];
            for (const page of res.data.data) {
                if (page.instagram_business_account) {
                    accounts.push({
                        accountId: page.instagram_business_account.id,
                        accountLabel: page.instagram_business_account.username || page.instagram_business_account.name,
                        pageAccessToken: page.access_token, // IG Graph API calls use the parent FB Page token
                        thumbnailUrl: page.instagram_business_account.profile_picture_url,
                    });
                }
            }
            return accounts;
        } catch (error) {
            this.logger.error('Error fetching Instagram accounts', error.response?.data || error.message);
            throw new BadRequestException('Failed to fetch Instagram accounts');
        }
    }

    /**
     * Fetch Instagram Insights (Reach, Impressions).
     */
    async getInstagramAnalytics(igAccountId: string, pageAccessToken: string, since: string, until: string) {
        try {
            const res = await firstValueFrom(
                this.httpService.get(`${this.BASE_URL}/${igAccountId}/insights`, {
                    params: {
                        access_token: pageAccessToken,
                        metric: 'reach,impressions',
                        period: 'day',
                        since,
                        until,
                    },
                })
            );

            const data = res.data.data || [];
            if (data.length === 0) return { reach: 0, impressions: 0, dailyData: [] };

            const reachData = data.find(m => m.name === 'reach')?.values || [];
            const impressionsData = data.find(m => m.name === 'impressions')?.values || [];

            let totalReach = 0;
            let totalImpressions = 0;
            const dailyData = reachData.map((reach, idx) => {
                totalReach += reach.value;
                const imp = impressionsData[idx]?.value || 0;
                totalImpressions += imp;
                return {
                    date: reach.end_time?.split('T')[0],
                    reach: reach.value,
                    impressions: imp,
                };
            });

            return { reach: totalReach, impressions: totalImpressions, dailyData };
        } catch (error) {
            this.logger.error(`Error fetching Instagram Insights for account ${igAccountId}`, error.response?.data || error.message);
            throw new BadRequestException('Failed to fetch Instagram Analytics');
        }
    }

    /**
     * Publish photo or video to Instagram Business Account.
     * Step 1: Create media container.
     * Step 2: Publish the container.
     */
    async publishMedia(igAccountId: string, pageAccessToken: string, mediaUrl: string, caption: string, isVideo = false) {
        try {
            // Step 1: Create Container
            const createPayload: any = {
                access_token: pageAccessToken,
                caption,
            };

            if (isVideo) {
                createPayload.media_type = 'REELS';
                createPayload.video_url = mediaUrl;
            } else {
                createPayload.image_url = mediaUrl;
            }

            const createRes = await firstValueFrom(
                this.httpService.post(`${this.BASE_URL}/${igAccountId}/media`, createPayload)
            );

            const creationId = createRes.data.id;

            // Step 2: Publish Container
            const publishRes = await firstValueFrom(
                this.httpService.post(`${this.BASE_URL}/${igAccountId}/media_publish`, {
                    creation_id: creationId,
                    access_token: pageAccessToken,
                })
            );

            return { success: true, postId: publishRes.data.id };
        } catch (error) {
            this.logger.error(`Error publishing to Instagram account ${igAccountId}`, error.response?.data || error.message);
            throw new BadRequestException('Failed to publish content to Instagram');
        }
    }

    /**
     * Publish carousel (clausor) to Instagram Business Account.
     */
    async publishCarousel(igAccountId: string, pageAccessToken: string, mediaUrls: string[], caption: string) {
        try {
            this.logger.log(`Creating carousel items for account ${igAccountId}. Items: ${mediaUrls.length}`);
            
            // Step 1: Create containers for each item
            const itemIds = [];
            for (const url of mediaUrls) {
                const itemRes = await firstValueFrom(
                    this.httpService.post(`${this.BASE_URL}/${igAccountId}/media`, {
                        access_token: pageAccessToken,
                        image_url: url,
                        is_carousel_item: true,
                    })
                );
                itemIds.push(itemRes.data.id);
            }

            // Step 2: Create Carousel Container
            const carouselRes = await firstValueFrom(
                this.httpService.post(`${this.BASE_URL}/${igAccountId}/media`, {
                    access_token: pageAccessToken,
                    media_type: 'CAROUSEL',
                    children: itemIds.join(','),
                    caption,
                })
            );

            const creationId = carouselRes.data.id;

            // Step 3: Publish Carousel
            const publishRes = await firstValueFrom(
                this.httpService.post(`${this.BASE_URL}/${igAccountId}/media_publish`, {
                    creation_id: creationId,
                    access_token: pageAccessToken,
                })
            );

            return { success: true, postId: publishRes.data.id };
        } catch (error) {
            this.logger.error(`Error publishing carousel to Instagram account ${igAccountId}`, error.response?.data || error.message);
            throw new BadRequestException('Failed to publish carousel to Instagram');
        }
    }
}
