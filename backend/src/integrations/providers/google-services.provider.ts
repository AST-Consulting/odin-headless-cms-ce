import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IntegrationProvider } from '../schemas/integration.schema';

@Injectable()
export class GoogleServicesProvider {
    private readonly logger = new Logger(GoogleServicesProvider.name);
    private oauth2Client: OAuth2Client;

    private readonly GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];
    private readonly GSC_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
    private readonly YOUTUBE_SCOPES = [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/yt-analytics.readonly',
    ];

    constructor(private configService: ConfigService) {
        this.initializeClient();
    }

    private initializeClient() {
        const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
        const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI') || 'http://localhost:4000/v1/integrations/google/callback';

        this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }

    /**
     * Generates the OAuth URL for the user to authorize the application
     * @param state A stringified JSON object containing context (e.g., propertyId, redirectUrl)
     * @param provider The integration provider to request scopes for
     */
    generateAuthUrl(state: string, provider: IntegrationProvider): string {
        let scope: string[] = [];
        if (provider === IntegrationProvider.GOOGLE_ANALYTICS) scope = this.GA4_SCOPES;
        else if (provider === IntegrationProvider.SEARCH_CONSOLE) scope = this.GSC_SCOPES;
        else if (provider === IntegrationProvider.YOUTUBE) scope = this.YOUTUBE_SCOPES;

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline', // Required to get a refresh token
            prompt: 'consent',      // Force consent screen to ensure we get a refresh token
            scope,
            state: Buffer.from(state).toString('base64'), // Encode state to base64 for safety
        });
    }

    /**
     * Exchanges the authorization code for access and refresh tokens
     * @param code The authorization code from the OAuth callback
     */
    async getTokens(code: string) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            return tokens;
        } catch (error) {
            this.logger.error('Error exchanging authorization code for tokens', error);
            throw new BadRequestException('Failed to exchange authorization code for tokens');
        }
    }

    /**
     * Sets the credentials on a new OAuth2Client instance.
     * Useful for making authenticated API calls later on.
     */
    getAuthenticatedClient(credentials: {
        accessToken: string;
        refreshToken?: string;
        expiryDate?: number;
    }): OAuth2Client {
        const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
        const client = new google.auth.OAuth2(clientId, clientSecret);

        client.setCredentials({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken,
            expiry_date: credentials.expiryDate,
        });

        return client;
    }
}
