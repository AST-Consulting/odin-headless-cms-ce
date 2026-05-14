import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Integration, IntegrationDocument, IntegrationProvider, IntegrationStatus } from './schemas/integration.schema';
import { ConnectIntegrationDto, OAuthCallbackDto } from './dto/integration.dto';
import { SelectAccountDto } from './dto/select-account.dto';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { GoogleServicesProvider } from './providers/google-services.provider';
import { GoogleAnalyticsProvider } from './providers/google-analytics.provider';
import { GoogleSearchConsoleProvider } from './providers/google-search-console.provider';
import { YouTubeProvider } from './providers/youtube.provider';
import { MetaAuthProvider } from './providers/meta-auth.provider';
import { FacebookProvider } from './providers/facebook.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { TwitterAuthProvider } from './providers/twitter-auth.provider';
import { PropertyService } from 'src/property/property.service';

@Injectable()
export class IntegrationsService {
    private readonly logger = new Logger(IntegrationsService.name);

    constructor(
        @InjectModel(Integration.name) private readonly integrationModel: Model<IntegrationDocument>,
        private readonly googleServicesProvider: GoogleServicesProvider,
        private readonly gaProvider: GoogleAnalyticsProvider,
        private readonly gscProvider: GoogleSearchConsoleProvider,
        private readonly youtubeProvider: YouTubeProvider,
        private readonly metaAuthProvider: MetaAuthProvider,
        private readonly facebookProvider: FacebookProvider,
        private readonly instagramProvider: InstagramProvider,
        private readonly twitterAuthProvider: TwitterAuthProvider,
        private readonly propertyService: PropertyService,
    ) { }

    // ─────────────────────────────────────────────
    // 1. OAuth Connect
    // ─────────────────────────────────────────────

    async getConnectUrl(dto: ConnectIntegrationDto, user: TCurrentUserType): Promise<{ url: string }> {
        const property = await this.propertyService.findOne(dto.propertyId, user);
        if (!property) throw new NotFoundException('Property not found or you do not have access');

        const stateObj = {
            propertyId: dto.propertyId,
            organizationId: property.organization?.id || property.organization,
            userId: user.sub,
            provider: dto.provider,
            redirectUrl: dto.redirectUrl,
        };

        let url = '';
        switch (dto.provider) {
            case IntegrationProvider.GOOGLE_ANALYTICS:
            case IntegrationProvider.SEARCH_CONSOLE:
            case IntegrationProvider.YOUTUBE:
                url = this.googleServicesProvider.generateAuthUrl(JSON.stringify(stateObj), dto.provider);
                break;
            case IntegrationProvider.FACEBOOK:
            case IntegrationProvider.INSTAGRAM:
                url = this.metaAuthProvider.generateAuthUrl(JSON.stringify(stateObj));
                break;
            case IntegrationProvider.TWITTER:
                const { url: twitterUrl, codeVerifier } = this.twitterAuthProvider.generateAuthUrl(Buffer.from(JSON.stringify(stateObj)).toString('base64'));
                url = twitterUrl;
                // Store codeVerifier in metadata temporarily
                await this.integrationModel.findOneAndUpdate(
                    { propertyId: dto.propertyId, provider: IntegrationProvider.TWITTER },
                    { 
                        propertyId: dto.propertyId,
                        organizationId: stateObj.organizationId,
                        userId: user.sub,
                        provider: IntegrationProvider.TWITTER,
                        status: IntegrationStatus.PENDING_SELECTION,
                        metadata: { codeVerifier } 
                    },
                    { upsert: true }
                );
                break;
            default:
                throw new BadRequestException(`Provider ${dto.provider} is not supported yet`);
        }

        return { url };
    }

    // ─────────────────────────────────────────────
    // 2. OAuth Callback
    // ─────────────────────────────────────────────

    async handleOAuthCallback(dto: OAuthCallbackDto): Promise<{ redirectUrl: string }> {
        this.logger.debug(`[OAuth Callback] Received callback with dto: ${JSON.stringify(dto)}`);
        try {
            if (!dto.state) {
                this.logger.error('[OAuth Callback] Missing state parameter in DTO');
                throw new BadRequestException('Missing state parameter');
            }

            const stateObj = JSON.parse(Buffer.from(dto.state, 'base64').toString('utf-8'));
            const { propertyId, userId, provider, redirectUrl } = stateObj;
            this.logger.debug(`[OAuth Callback] Parsed state (step 1). propertyId: ${propertyId}, userId: ${userId}, provider: ${provider}, redirectUrl: ${redirectUrl}`);
            let { organizationId } = stateObj;

            // Resolve organizationId from the property if missing from state
            if (!organizationId && propertyId) {
                this.logger.debug(`[OAuth Callback] organizationId missing in state. Fetching property ID: ${propertyId}`);
                const property = await this.propertyService.getById(propertyId);
                this.logger.debug(`[OAuth Callback] Property fetched (step 2): ${JSON.stringify(property)}`);
                
                // Safely convert mongoose document to plain object
                const propObj = property && typeof (property as any).toJSON === 'function' ? (property as any).toJSON() : property;
                
                organizationId = propObj?.organization?.id || propObj?.organization?._id?.toString() || propObj?.organizationId || (propObj?.user as any)?.organizationId;
                this.logger.debug(`[OAuth Callback] Resolved organizationId to: ${organizationId}`);
            }
            this.logger.debug(`[OAuth Callback] Final organizationId (step 3): ${organizationId}`);

            if (!organizationId) {
                this.logger.error(`[OAuth Callback] Could not resolve organizationId for property ${propertyId}`);
                throw new BadRequestException('Unable to determine organization for this property');
            }

            // Exchange code for tokens
            this.logger.debug(`[OAuth Callback] Exchanging code for tokens with provider...`);
            const tokens = await this.googleServicesProvider.getTokens(dto.code);
            this.logger.debug(`[OAuth Callback] Tokens received. access_token length: ${tokens?.access_token?.length}, scope: ${tokens?.scope}`);

            // Save with PENDING_SELECTION — user still needs to pick which GA property / GSC site
            this.logger.debug(`[OAuth Callback] Looking up existing integration for propertyId: ${propertyId}, provider: ${provider}`);
            const existingIntegration = await this.integrationModel.findOne({ propertyId, provider });

            if (existingIntegration) {
                this.logger.debug(`[OAuth Callback] Found existing integration. Updating credentials and setting status to PENDING_SELECTION`);
                existingIntegration.credentials = {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || existingIntegration.credentials.refreshToken,
                    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
                    scope: tokens.scope,
                    tokenType: tokens.token_type,
                };
                existingIntegration.status = IntegrationStatus.PENDING_SELECTION;
                existingIntegration.userId = userId;
                existingIntegration.organizationId = organizationId;
                existingIntegration.metadata = {}; // Reset previous selection
                await existingIntegration.save();
                this.logger.debug(`[OAuth Callback] Existing integration updated successfully`);
            } else {
                this.logger.debug(`[OAuth Callback] No existing integration found. Creating new integration record.`);
                await this.integrationModel.create({
                    propertyId,
                    organizationId,
                    userId,
                    provider,
                    status: IntegrationStatus.PENDING_SELECTION,
                    credentials: {
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token,
                        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
                        scope: tokens.scope,
                        tokenType: tokens.token_type,
                    },
                    metadata: {},
                });
                this.logger.debug(`[OAuth Callback] New integration created successfully`);
            }

            this.logger.debug(`[OAuth Callback] Flow completed successfully. Returning redirectUrl: ${redirectUrl}`);
            return { redirectUrl };
        } catch (error: any) {
            this.logger.error(`[OAuth Callback] Error handling OAuth callback: ${error.message}`, error.stack);
            throw new BadRequestException(`Failed to process authentication callback: ${error.message}`);
        }
    }

    async handleMetaCallback(dto: OAuthCallbackDto): Promise<{ redirectUrl: string }> {
        try {
            if (!dto.state) throw new BadRequestException('Missing state parameter');

            const stateObj = JSON.parse(Buffer.from(dto.state, 'base64').toString('utf-8'));
            const { propertyId, userId, provider, redirectUrl } = stateObj;
            this.logger.debug(`[Meta Callback] Parsed state: ${JSON.stringify(stateObj)}`);
            let { organizationId } = stateObj;

            // Resolve organizationId from the property if missing from state
            if (!organizationId && propertyId) {
                this.logger.debug(`[Meta Callback] Organization ID missing in state. Attempting to fetch from property: ${propertyId}`);
                const property = await this.propertyService.getById(propertyId);
                this.logger.debug(`[Meta Callback] Found property: ${property?._id}. Organization fetched: ${JSON.stringify(property)}`);
                
                // Safely convert mongoose document to plain object
                const propObj = property && typeof (property as any).toJSON === 'function' ? (property as any).toJSON() : property;
                
                organizationId = propObj?.organization?.id || propObj?.organization?._id?.toString() || propObj?.organizationId || (propObj?.user as any)?.organizationId;
            }

            if (!organizationId) {
                this.logger.error(`[Meta Callback] Could not resolve organizationId for property ${propertyId}`);
                throw new BadRequestException('Unable to determine organization for this property');
            }

            // Exchange code for long-lived tokens
            this.logger.debug(`[Meta Callback] Exchanging code for tokens...`);
            const tokens = await this.metaAuthProvider.getLongLivedToken(dto.code);
            this.logger.debug(`[Meta Callback] Tokens received successfully. Length: ${tokens?.access_token?.length || 0}`);

            // Save with PENDING_SELECTION
            const existingIntegration = await this.integrationModel.findOne({ propertyId, provider });

            let expiresAt = undefined;
            if (tokens.expires_in) {
                expiresAt = new Date();
                expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);
            }

            if (existingIntegration) {
                this.logger.debug(`[Meta Callback] Updating existing integration for property: ${propertyId}, provider: ${provider}`);
                existingIntegration.credentials = {
                    accessToken: tokens.access_token,
                    refreshToken: '',
                    expiresAt,
                    tokenType: 'bearer',
                };
                existingIntegration.status = IntegrationStatus.PENDING_SELECTION;
                existingIntegration.userId = userId;
                existingIntegration.organizationId = organizationId;
                existingIntegration.metadata = {};
                await existingIntegration.save();
            } else {
                this.logger.debug(`[Meta Callback] Creating new integration record for property: ${propertyId}, provider: ${provider}`);
                await this.integrationModel.create({
                    propertyId,
                    organizationId,
                    userId,
                    provider,
                    status: IntegrationStatus.PENDING_SELECTION,
                    credentials: {
                        accessToken: tokens.access_token,
                        refreshToken: '',
                        expiresAt,
                        tokenType: 'bearer',
                    },
                    metadata: {},
                });
            }

            this.logger.debug(`[Meta Callback] Processing complete. Redirecting to: ${redirectUrl}`);
            return { redirectUrl };
        } catch (error: any) {
            this.logger.error(`[Meta Callback] Error handling Meta OAuth callback: ${error.message}`, error.stack);
            throw new BadRequestException(`Failed to process Meta authentication callback: ${error.message}`);
        }
    }

    async handleTwitterCallback(dto: OAuthCallbackDto): Promise<{ redirectUrl: string }> {
        this.logger.debug(`[Twitter Callback] Starting processing for callback. State length: ${dto.state?.length}`);
        try {
            if (!dto.state) {
                this.logger.error('[Twitter Callback] Missing state parameter');
                throw new BadRequestException('Missing state parameter');
            }

            const stateObj = JSON.parse(Buffer.from(dto.state, 'base64').toString('utf-8'));
            const { propertyId, provider, redirectUrl } = stateObj;
            this.logger.debug(`[Twitter Callback] Parsed state: propertyId=${propertyId}, provider=${provider}`);

            // Find the pending integration to get the codeVerifier
            const integration = await this.integrationModel.findOne({ propertyId, provider: IntegrationProvider.TWITTER });
            if (!integration) {
                this.logger.error(`[Twitter Callback] No pending integration found for property ${propertyId}`);
                throw new BadRequestException('Invalid OAuth flow: no pending integration record');
            }
            
            if (!integration.metadata?.codeVerifier) {
                this.logger.error(`[Twitter Callback] Missing codeVerifier in integration metadata for property ${propertyId}`);
                throw new BadRequestException('Invalid OAuth flow: missing code verifier');
            }

            this.logger.debug(`[Twitter Callback] Exchanging code for tokens...`);
            const tokens = await this.twitterAuthProvider.getTokens(
                dto.code,
                integration.metadata.codeVerifier
            );
            this.logger.debug(`[Twitter Callback] Tokens received for user: ${tokens.user?.username}`);

            let expiresAt = undefined;
            if (tokens.expiresIn) {
                expiresAt = new Date();
                expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expiresIn);
            }

            integration.credentials = {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt,
                tokenType: 'bearer',
            };
            integration.status = IntegrationStatus.CONNECTED;
            integration.metadata = {
                twitterUserId: tokens.user?.id,
                username: tokens.user?.username,
                name: tokens.user?.name,
                profileImageUrl: tokens.user?.profile_image_url,
            };
            
            await integration.save();
            this.logger.debug(`[Twitter Callback] Integration saved successfully. Redirecting to: ${redirectUrl}`);

            return { redirectUrl };
        } catch (error: any) {
            this.logger.error(`[Twitter Callback] Error: ${error.message}`, error.stack);
            throw new BadRequestException(`Failed to process Twitter authentication: ${error.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // 3. List Available Accounts (after OAuth, before selection)
    // ─────────────────────────────────────────────

    async listGoogleAnalyticsAccounts(propertyId: string, user: TCurrentUserType) {
        await this.propertyService.findOne(propertyId, user);

        const integration = await this.integrationModel.findOne({
            propertyId,
            provider: IntegrationProvider.GOOGLE_ANALYTICS,
            status: { $in: [IntegrationStatus.PENDING_SELECTION, IntegrationStatus.CONNECTED] },
        });

        if (!integration) {
            throw new NotFoundException('Please connect Google Analytics first before listing accounts');
        }

        const authClient = this.googleServicesProvider.getAuthenticatedClient({
            accessToken: integration.credentials.accessToken,
            refreshToken: integration.credentials.refreshToken,
            expiryDate: integration.credentials.expiresAt ? integration.credentials.expiresAt.getTime() : undefined,
        });

        return this.gaProvider.listAccountProperties(authClient);
    }

    async listSearchConsoleSites(propertyId: string, user: TCurrentUserType) {
        await this.propertyService.findOne(propertyId, user);

        const integration = await this.integrationModel.findOne({
            propertyId,
            provider: IntegrationProvider.SEARCH_CONSOLE,
            status: { $in: [IntegrationStatus.PENDING_SELECTION, IntegrationStatus.CONNECTED] },
        });

        if (!integration) {
            throw new NotFoundException('Please connect Google Search Console first before listing sites');
        }

        const authClient = this.googleServicesProvider.getAuthenticatedClient({
            accessToken: integration.credentials.accessToken,
            refreshToken: integration.credentials.refreshToken,
            expiryDate: integration.credentials.expiresAt ? integration.credentials.expiresAt.getTime() : undefined,
        });

        const sites = await this.gscProvider.getVerifiedSites(authClient);
        return sites.map((site: any) => ({
            accountId: site.siteUrl,
            accountLabel: site.siteUrl,
            permissionLevel: site.permissionLevel,
        }));
    }

    async listYouTubeChannels(propertyId: string, user: TCurrentUserType) {
        await this.propertyService.findOne(propertyId, user);

        const integration = await this.integrationModel.findOne({
            propertyId,
            provider: IntegrationProvider.YOUTUBE,
            status: { $in: [IntegrationStatus.PENDING_SELECTION, IntegrationStatus.CONNECTED] },
        });

        if (!integration) {
            throw new NotFoundException('Please connect YouTube first before listing channels');
        }

        const authClient = this.googleServicesProvider.getAuthenticatedClient({
            accessToken: integration.credentials.accessToken,
            refreshToken: integration.credentials.refreshToken,
            expiryDate: integration.credentials.expiresAt ? integration.credentials.expiresAt.getTime() : undefined,
        });

        return this.youtubeProvider.listChannels(authClient);
    }

    async listFacebookPages(propertyId: string, user: TCurrentUserType) {
        await this.propertyService.findOne(propertyId, user);

        const integration = await this.integrationModel.findOne({
            propertyId,
            provider: IntegrationProvider.FACEBOOK,
            status: { $in: [IntegrationStatus.PENDING_SELECTION, IntegrationStatus.CONNECTED] },
        });

        if (!integration) {
            throw new NotFoundException('Please connect Facebook first before listing pages');
        }

        return this.facebookProvider.listPages(integration.credentials.accessToken);
    }

    async listInstagramAccounts(propertyId: string, user: TCurrentUserType) {
        await this.propertyService.findOne(propertyId, user);

        const integration = await this.integrationModel.findOne({
            propertyId,
            provider: IntegrationProvider.INSTAGRAM,
            status: { $in: [IntegrationStatus.PENDING_SELECTION, IntegrationStatus.CONNECTED] },
        });

        if (!integration) {
            throw new NotFoundException('Please connect Instagram first before listing accounts');
        }

        return this.instagramProvider.listInstagramAccounts(integration.credentials.accessToken);
    }

    // ─────────────────────────────────────────────
    // 4. Select / Map Account
    // ─────────────────────────────────────────────

    async selectAccount(dto: SelectAccountDto, user: TCurrentUserType) {
        await this.propertyService.findOne(dto.propertyId, user);

        const integration = await this.integrationModel.findOne({
            propertyId: dto.propertyId,
            provider: dto.provider,
        });

        if (!integration) {
            throw new NotFoundException('Integration not found. Please connect the provider first.');
        }

        // Save the selected account into metadata
        if (dto.provider === IntegrationProvider.GOOGLE_ANALYTICS) {
            integration.metadata = {
                propertyId: dto.accountId,   // GA4 property ID like "123456789"
                label: dto.accountLabel || dto.accountId,
            };
        } else if (dto.provider === IntegrationProvider.SEARCH_CONSOLE) {
            integration.metadata = {
                siteUrl: dto.accountId,      // GSC siteUrl like "sc-domain:example.com"
                label: dto.accountLabel || dto.accountId,
            };
        } else if (dto.provider === IntegrationProvider.YOUTUBE) {
            integration.metadata = {
                channelId: dto.accountId,
                label: dto.accountLabel || dto.accountId,
            };
        } else if (dto.provider === IntegrationProvider.FACEBOOK) {
            integration.metadata = {
                pageId: dto.accountId,
                label: dto.accountLabel || dto.accountId,
                pageAccessToken: dto.pageAccessToken,
            };
        } else if (dto.provider === IntegrationProvider.INSTAGRAM) {
            integration.metadata = {
                igAccountId: dto.accountId,
                label: dto.accountLabel || dto.accountId,
                pageAccessToken: dto.pageAccessToken,
            };
        }

        integration.status = IntegrationStatus.CONNECTED;
        await integration.save();

        return {
            success: true,
            message: `Successfully mapped ${dto.provider} account`,
            data: {
                provider: integration.provider,
                status: integration.status,
                metadata: integration.metadata,
            },
        };
    }

    // ─────────────────────────────────────────────
    // 5. List integrations for a property
    // ─────────────────────────────────────────────

    async getIntegrationsForProperty(propertyId: string, user: TCurrentUserType) {
        await this.propertyService.findOne(propertyId, user);
        return this.integrationModel.find({ propertyId }).select('-credentials').exec();
    }

    // ─────────────────────────────────────────────
    // 6. Disconnect (soft delete — keeps record, clears tokens)
    // ─────────────────────────────────────────────

    async disconnectIntegration(propertyId: string, provider: IntegrationProvider, user: TCurrentUserType) {
        await this.propertyService.findOne(propertyId, user);

        const integration = await this.integrationModel.findOne({ propertyId, provider });
        if (!integration) throw new NotFoundException('Integration not found');

        integration.status = IntegrationStatus.DISCONNECTED;
        integration.credentials = {
            accessToken: '',
            refreshToken: ''
        };
        integration.metadata = {};

        try {
            await integration.save();
        } catch (error) {
            this.logger.error(`Error disconnecting ${provider} integration`, error);
            throw new BadRequestException(error.message || 'Failed to update integration status');
        }

        return { success: true, message: `Successfully disconnected ${provider}` };
    }

    // ─────────────────────────────────────────────
    // 7. Delete (hard delete — removes record entirely)
    // ─────────────────────────────────────────────

    async deleteIntegration(propertyId: string, provider: IntegrationProvider, user: TCurrentUserType) {
        await this.propertyService.findOne(propertyId, user);

        const result = await this.integrationModel.deleteOne({ propertyId, provider });
        if (result.deletedCount === 0) throw new NotFoundException('Integration not found');

        return { success: true, message: `Successfully deleted ${provider} integration` };
    }

    // ─────────────────────────────────────────────
    // 8. Internal: get integration with credentials (for fetching data)
    // ─────────────────────────────────────────────

    async getIntegrationWithCredentials(propertyId: string, provider: IntegrationProvider) {
        const integration = await this.integrationModel.findOne({
            propertyId,
            provider,
            status: IntegrationStatus.CONNECTED,
        });

        if (!integration) {
            throw new NotFoundException(`Active ${provider} connection not found for this property`);
        }

        return integration;
    }

    /**
     * Expose the googleServicesProvider for the controller to create auth clients
     */
    getGoogleAuthClient(credentials: { accessToken?: string; refreshToken?: string; expiresAt?: Date }) {
        if (!credentials?.accessToken) {
            throw new BadRequestException('Access token is missing. Please reconnect the integration.');
        }
        return this.googleServicesProvider.getAuthenticatedClient({
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
            expiryDate: credentials.expiresAt ? credentials.expiresAt.getTime() : undefined,
        });
    }
}
