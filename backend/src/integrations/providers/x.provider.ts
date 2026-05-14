import { Injectable, Logger } from '@nestjs/common';
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

@Injectable()
export class XProvider {
  private readonly logger = new Logger(XProvider.name);

  /**
   * Posts a single tweet
   */
  async postTweet(accessToken: string, text: string, mediaIds?: string[]) {
    const client = new TwitterApi(accessToken);
    try {
      const payload: any = { text };
      if (mediaIds && mediaIds.length > 0) {
        payload.media = { media_ids: mediaIds };
      }
      return await client.v2.tweet(payload);
    } catch (error: any) {
      this.logger.error(`Failed to post tweet: ${error.message}`, error.data);
      throw error;
    }
  }

  /**
   * Posts a thread of tweets
   */
  async postThread(accessToken: string, tweets: (string | { text: string; mediaIds?: string[] })[]) {
    const client = new TwitterApi(accessToken);
    try {
      const thread = tweets.map(t => {
        if (typeof t === 'string') return { text: t };
        return {
          text: t.text,
          media: t.mediaIds ? { media_ids: t.mediaIds as any } : undefined
        };
      });
      return await client.v2.tweetThread(thread);
    } catch (error: any) {
      this.logger.error(`Failed to post thread: ${error.message}`, error.data);
      throw error;
    }
  }

  /**
   * Uploads media to Twitter. 
   * Note: Media upload currently requires OAuth 1.0a or specific v2 permissions.
   * If using OAuth 2.0, media upload is supported via the v1.1 API with the same token.
   */
  async uploadMediaFromUrl(accessToken: string, imageUrl: string) {
    const client = new TwitterApi(accessToken);
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      const mimeType = String(response.headers['content-type'] || 'image/jpeg');
      
      // twitter-api-v2 handles the v1.1 upload even with OAuth2 tokens if the app has permissions
      const mediaId = await client.v1.uploadMedia(buffer, { mimeType });
      return mediaId;
    } catch (error: any) {
      this.logger.error(`Failed to upload media: ${error.message}`);
      throw error;
    }
  }
}
