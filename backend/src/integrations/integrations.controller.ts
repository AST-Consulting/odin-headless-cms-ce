import { Body, Controller, Delete, Get, Param, Post, Query, Res, Logger, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { IntegrationsService } from './integrations.service';
import { ConnectIntegrationDto } from './dto/integration.dto';
import { SelectAccountDto } from './dto/select-account.dto';
import { GetCurrentUser as CurrentUser } from 'src/auth/common/decorators/get-current-user.decorator';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { Permissions } from 'src/auth/common/decorators/permissions.decorator';
import { Public } from 'src/auth/common/decorators/public.decorator';
import { IntegrationProvider } from './schemas/integration.schema';
import { GoogleAnalyticsProvider } from './providers/google-analytics.provider';
import { GoogleSearchConsoleProvider } from './providers/google-search-console.provider';
import { YouTubeProvider } from './providers/youtube.provider';
import { FacebookProvider } from './providers/facebook.provider';
import { InstagramProvider } from './providers/instagram.provider';

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
    private readonly logger = new Logger(IntegrationsController.name);

    constructor(
        private readonly integrationsService: IntegrationsService,
        private readonly gaProvider: GoogleAnalyticsProvider,
        private readonly gscProvider: GoogleSearchConsoleProvider,
        private readonly youtubeProvider: YouTubeProvider,
        private readonly facebookProvider: FacebookProvider,
        private readonly instagramProvider: InstagramProvider,
    ) {}

    // ─────────────────────────────────────────────
    // OAuth Flow
    // ─────────────────────────────────────────────

    @Version('1')
    @Post('connect')
    @ApiBearerAuth('access-token')
    @Permissions('property.edit')
    @ApiOperation({ summary: 'Initiate OAuth connection for a third-party provider' })
    async connectIntegration(
        @Body() dto: ConnectIntegrationDto,
        @CurrentUser() user: TCurrentUserType,
    ) {
        return this.integrationsService.getConnectUrl(dto, user);
    }

    @Version('1')
    @Get('google/callback')
    @Public()
    @ApiOperation({ summary: 'OAuth callback handler for Google services (do NOT call from frontend)' })
    async googleCallback(
        @Query('state') state: string,
        @Query('code') code: string,
        @Res() res: Response,
    ) {
        this.logger.debug(`[Google Callback] Received request: stateLength=${state?.length}, code=${code ? '***' : 'missing'}`);
        const result = await this.integrationsService.handleOAuthCallback({ state, code });
        return res.redirect(result.redirectUrl || '/');
    }

    @Version('1')
    @Get('meta/callback')
    @Public()
    @ApiOperation({ summary: 'OAuth callback handler for Meta (Facebook/Instagram) (do NOT call from frontend)' })
    async metaCallback(
        @Query('state') state: string,
        @Query('code') code: string,
        @Res() res: Response,
    ) {
        this.logger.debug(`[Meta Callback] Received request: stateLength=${state?.length}, code=${code ? '***' : 'missing'}`);
        const result = await this.integrationsService.handleMetaCallback({ state, code });
        return res.redirect(result.redirectUrl || '/');
    }

    @Version('1')
    @Get('twitter/callback')
    @Public()
    @ApiOperation({ summary: 'OAuth callback handler for Twitter/X (do NOT call from frontend)' })
    async twitterCallback(
        @Query('state') state: string,
        @Query('code') code: string,
        @Res() res: Response,
    ) {
        this.logger.debug(`[Twitter Callback] Received request: stateLength=${state?.length}, code=${code ? '***' : 'missing'}`);
        const result = await this.integrationsService.handleTwitterCallback({ state, code });
        return res.redirect(result.redirectUrl || '/');
    }

    // ─────────────────────────────────────────────
    // Account Listing (for selection after OAuth)
    // ─────────────────────────────────────────────

    @Version('1')
    @Get('accounts/ga4/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'List GA4 properties available in the users Google account' })
    async listGa4Accounts(
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: TCurrentUserType,
    ) {
        const accounts = await this.integrationsService.listGoogleAnalyticsAccounts(propertyId, user);
        return { success: true, data: accounts };
    }

    @Version('1')
    @Get('accounts/gsc/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'List Search Console sites available in the users Google account' })
    async listGscSites(
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: TCurrentUserType,
    ) {
        const sites = await this.integrationsService.listSearchConsoleSites(propertyId, user);
        return { success: true, data: sites };
    }

    @Version('1')
    @Get('accounts/youtube/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'List YouTube channels available in the users Google account' })
    async listYouTubeChannels(
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: TCurrentUserType,
    ) {
        const channels = await this.integrationsService.listYouTubeChannels(propertyId, user);
        return { success: true, data: channels };
    }

    @Version('1')
    @Get('accounts/facebook/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'List Facebook Pages available in the users Meta account' })
    async listFacebookPages(
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: TCurrentUserType,
    ) {
        const pages = await this.integrationsService.listFacebookPages(propertyId, user);
        return { success: true, data: pages };
    }

    @Version('1')
    @Get('accounts/instagram/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'List Instagram Business Accounts available in the users Meta account' })
    async listInstagramAccounts(
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: TCurrentUserType,
    ) {
        const accounts = await this.integrationsService.listInstagramAccounts(propertyId, user);
        return { success: true, data: accounts };
    }

    // ─────────────────────────────────────────────
    // Account Selection (map external → CMS property)
    // ─────────────────────────────────────────────

    @Version('1')
    @Post('select')
    @ApiBearerAuth('access-token')
    @Permissions('property.edit')
    @ApiOperation({ summary: 'Map a selected GA4 property or GSC site to the CMS property' })
    async selectAccount(
        @Body() dto: SelectAccountDto,
        @CurrentUser() user: TCurrentUserType,
    ) {
        return this.integrationsService.selectAccount(dto, user);
    }

    // ─────────────────────────────────────────────
    // List / Status
    // ─────────────────────────────────────────────

    @Version('1')
    @Get('property/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'List all integrations for a property' })
    async getIntegrations(
        @Param('propertyId') propertyId: string,
        @CurrentUser() user: TCurrentUserType,
    ) {
        const integrations = await this.integrationsService.getIntegrationsForProperty(propertyId, user);
        return { success: true, data: integrations };
    }

    // ─────────────────────────────────────────────
    // Disconnect & Delete
    // ─────────────────────────────────────────────

    @Version('1')
    @Post('disconnect/:propertyId/:provider')
    @ApiBearerAuth('access-token')
    @Permissions('property.edit')
    @ApiOperation({ summary: 'Disconnect an integration (soft delete — keeps record, clears tokens)' })
    async disconnectIntegration(
        @Param('propertyId') propertyId: string,
        @Param('provider') provider: IntegrationProvider,
        @CurrentUser() user: TCurrentUserType,
    ) {
        return this.integrationsService.disconnectIntegration(propertyId, provider, user);
    }

    @Version('1')
    @Delete('delete/:propertyId/:provider')
    @ApiBearerAuth('access-token')
    @Permissions('property.edit')
    @ApiOperation({ summary: 'Delete an integration permanently (hard delete)' })
    async deleteIntegration(
        @Param('propertyId') propertyId: string,
        @Param('provider') provider: IntegrationProvider,
        @CurrentUser() user: TCurrentUserType,
    ) {
        return this.integrationsService.deleteIntegration(propertyId, provider, user);
    }

    // ─────────────────────────────────────────────
    // Analytics Data Fetching
    // ─────────────────────────────────────────────

    @Version('1')
    @Get('analytics/ga4/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'Fetch GA4 traffic summary for a connected property' })
    async getGa4Metrics(
        @Param('propertyId') propertyId: string,
        @Query('startDate') startDate: string = '30daysAgo',
        @Query('endDate') endDate: string = 'today',
    ) {
        const integration = await this.integrationsService.getIntegrationWithCredentials(
            propertyId,
            IntegrationProvider.GOOGLE_ANALYTICS,
        );

        const authClient = this.integrationsService.getGoogleAuthClient(integration.credentials);
        const gaPropertyId = integration.metadata?.propertyId;
        if (!gaPropertyId) {
            return { success: false, message: 'GA4 property not selected. Please select a property first.' };
        }

        const traffic = await this.gaProvider.getTrafficSummary(authClient, gaPropertyId, startDate, endDate);
        return { success: true, data: traffic };
    }

    @Version('1')
    @Get('analytics/ga4/:propertyId/top-pages')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'Fetch top pages from GA4' })
    async getGa4TopPages(
        @Param('propertyId') propertyId: string,
        @Query('limit') limit: number = 10,
        @Query('startDate') startDate: string = '30daysAgo',
        @Query('endDate') endDate: string = 'today',
    ) {
        const integration = await this.integrationsService.getIntegrationWithCredentials(
            propertyId,
            IntegrationProvider.GOOGLE_ANALYTICS,
        );

        const authClient = this.integrationsService.getGoogleAuthClient(integration.credentials);
        const gaPropertyId = integration.metadata?.propertyId;
        if (!gaPropertyId) {
            return { success: false, message: 'GA4 property not selected. Please select a property first.' };
        }

        const pages = await this.gaProvider.getTopPages(authClient, gaPropertyId, limit, startDate, endDate);
        return { success: true, data: pages };
    }

    @Version('1')
    @Get('analytics/gsc/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'Fetch Search Console performance metrics' })
    async getGscMetrics(
        @Param('propertyId') propertyId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        const integration = await this.integrationsService.getIntegrationWithCredentials(
            propertyId,
            IntegrationProvider.SEARCH_CONSOLE,
        );

        const authClient = this.integrationsService.getGoogleAuthClient(integration.credentials);
        const siteUrl = integration.metadata?.siteUrl;
        if (!siteUrl) {
            return { success: false, message: 'Search Console site not selected. Please select a site first.' };
        }

        const end = endDate || new Date().toISOString().split('T')[0];
        const startObj = new Date();
        startObj.setDate(startObj.getDate() - 30);
        const start = startDate || startObj.toISOString().split('T')[0];

        const performance = await this.gscProvider.getSearchAnalytics(authClient, siteUrl, start, end);
        return { success: true, data: performance };
    }

    @Version('1')
    @Get('analytics/youtube/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'Fetch YouTube channel analytics' })
    async getYouTubeMetrics(
        @Param('propertyId') propertyId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        const integration = await this.integrationsService.getIntegrationWithCredentials(
            propertyId,
            IntegrationProvider.YOUTUBE,
        );

        const authClient = this.integrationsService.getGoogleAuthClient(integration.credentials);
        const channelId = integration.metadata?.channelId;
        if (!channelId) {
            return { success: false, message: 'YouTube channel not selected. Please select a channel first.' };
        }

        const end = endDate || new Date().toISOString().split('T')[0];
        const startObj = new Date();
        startObj.setDate(startObj.getDate() - 30);
        const start = startDate || startObj.toISOString().split('T')[0];

        const metrics = await this.youtubeProvider.getChannelAnalytics(authClient, channelId, start, end);
        return { success: true, data: metrics };
    }

    @Version('1')
    @Get('analytics/facebook/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'Fetch Facebook Page Insights' })
    async getFacebookMetrics(
        @Param('propertyId') propertyId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        const integration = await this.integrationsService.getIntegrationWithCredentials(
            propertyId,
            IntegrationProvider.FACEBOOK,
        );

        const pageId = integration.metadata?.pageId;
        const pageAccessToken = integration.metadata?.pageAccessToken;
        if (!pageId || !pageAccessToken) {
            return { success: false, message: 'Facebook Page not properly configured. Please reconnect.' };
        }

        const end = endDate || new Date().toISOString().split('T')[0];
        const startObj = new Date();
        startObj.setDate(startObj.getDate() - 30);
        const start = startDate || startObj.toISOString().split('T')[0];

        const metrics = await this.facebookProvider.getPageAnalytics(pageId, pageAccessToken, start, end);
        return { success: true, data: metrics };
    }

    @Version('1')
    @Get('analytics/instagram/:propertyId')
    @ApiBearerAuth('access-token')
    @Permissions('property.read')
    @ApiOperation({ summary: 'Fetch Instagram Account Insights' })
    async getInstagramMetrics(
        @Param('propertyId') propertyId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        const integration = await this.integrationsService.getIntegrationWithCredentials(
            propertyId,
            IntegrationProvider.INSTAGRAM,
        );

        const igAccountId = integration.metadata?.igAccountId;
        const pageAccessToken = integration.metadata?.pageAccessToken;
        if (!igAccountId || !pageAccessToken) {
            return { success: false, message: 'Instagram Account not properly configured. Please reconnect.' };
        }

        const end = endDate || new Date().toISOString().split('T')[0];
        const startObj = new Date();
        startObj.setDate(startObj.getDate() - 30);
        const start = startDate || startObj.toISOString().split('T')[0];

        const metrics = await this.instagramProvider.getInstagramAnalytics(igAccountId, pageAccessToken, start, end);
        return { success: true, data: metrics };
    }
}
