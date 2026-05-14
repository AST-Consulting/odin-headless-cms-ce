import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MetaAuthProvider {
    private readonly logger = new Logger(MetaAuthProvider.name);
    private readonly GRAPH_API_VERSION = 'v19.0';
    private readonly SCOPES = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'instagram_basic',
        'instagram_manage_insights',
        'instagram_content_publish',
    ].join(',');

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) { }

    private get redirectUri() {
        return this.configService.get<string>('META_REDIRECT_URI') || 'http://localhost:4000/v1/integrations/meta/callback';
    }

    private get clientId() {
        const id = this.configService.get<string>('META_CLIENT_ID');
        if (!id) throw new Error('META_CLIENT_ID not configured');
        return id;
    }

    private get clientSecret() {
        const secret = this.configService.get<string>('META_CLIENT_SECRET');
        if (!secret) throw new Error('META_CLIENT_SECRET not configured');
        return secret;
    }

    /**
     * Generate the Facebook Dialog OAuth URL.
     */
    generateAuthUrl(state: string): string {
        const url = new URL(`https://www.facebook.com/${this.GRAPH_API_VERSION}/dialog/oauth`);
        url.searchParams.append('client_id', this.clientId);
        url.searchParams.append('redirect_uri', this.redirectUri);
        url.searchParams.append('state', Buffer.from(state).toString('base64'));
        url.searchParams.append('scope', this.SCOPES);
        url.searchParams.append('response_type', 'code');
        return url.toString();
    }

    /**
     * Exchange the OAuth code for a long-lived User Access Token.
     */
    async getLongLivedToken(code: string): Promise<{ access_token: string; expires_in?: number }> {
        try {
            // 1. Get short-lived token
            const shortLivedRes = await firstValueFrom(
                this.httpService.get(`https://graph.facebook.com/${this.GRAPH_API_VERSION}/oauth/access_token`, {
                    params: {
                        client_id: this.clientId,
                        client_secret: this.clientSecret,
                        redirect_uri: this.redirectUri,
                        code,
                    },
                })
            );

            const shortToken = shortLivedRes.data.access_token;

            // 2. Exchange for long-lived token
            const longLivedRes = await firstValueFrom(
                this.httpService.get(`https://graph.facebook.com/${this.GRAPH_API_VERSION}/oauth/access_token`, {
                    params: {
                        grant_type: 'fb_exchange_token',
                        client_id: this.clientId,
                        client_secret: this.clientSecret,
                        fb_exchange_token: shortToken,
                    },
                })
            );

            return longLivedRes.data; // { access_token: '...', token_type: 'bearer', expires_in: ... }
        } catch (error) {
            this.logger.error('Failed to exchange Meta OAuth code for long-lived token', error.response?.data || error);
            throw new BadRequestException('Failed to authenticate with Meta');
        }
    }
}
