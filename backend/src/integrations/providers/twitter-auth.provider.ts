import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitterApi } from 'twitter-api-v2';

@Injectable()
export class TwitterAuthProvider {
  private readonly logger = new Logger(TwitterAuthProvider.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generates the Twitter OAuth 2.0 Auth URL with PKCE
   * @param state The state object (base64 encoded) containing propertyId, userId, etc.
   */
  generateAuthUrl(state: string) {
    const clientId = this.configService.get<string>('X_CLIENT_ID');
    const clientSecret = this.configService.get<string>('X_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>('X_CALLBACK_URL');

    if (!clientId || !clientSecret) {
      throw new Error('X_CLIENT_ID or X_CLIENT_SECRET not configured in .env');
    }

    const client = new TwitterApi({
      clientId,
      clientSecret,
    });

    const { url, codeVerifier } = client.generateOAuth2AuthLink(
      callbackUrl,
      { 
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'], 
        state 
      }
    );

    return { url, codeVerifier };
  }

  /**
   * Exchanges the authorization code for access and refresh tokens
   */
  async getTokens(code: string, codeVerifier: string) {
    const clientId = this.configService.get<string>('X_CLIENT_ID');
    const clientSecret = this.configService.get<string>('X_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>('X_CALLBACK_URL');

    const client = new TwitterApi({
      clientId,
      clientSecret,
    });

    const { client: loggedClient, accessToken, refreshToken, expiresIn, scope } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackUrl,
    });

    // Get the user details to store as metadata
    const me = await loggedClient.v2.me();

    return {
      accessToken,
      refreshToken,
      expiresIn,
      scope,
      user: me.data,
    };
  }

  /**
   * Refreshes the access token using the refresh token
   */
  async refreshTokens(refreshToken: string) {
    const clientId = this.configService.get<string>('X_CLIENT_ID');
    const clientSecret = this.configService.get<string>('X_CLIENT_SECRET');

    const client = new TwitterApi({
      clientId,
      clientSecret,
    });

    return client.refreshOAuth2Token(refreshToken);
  }
}
