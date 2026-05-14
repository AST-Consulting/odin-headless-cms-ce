import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const CHANNEL_PREFIX = 'liveblog:';

@Injectable()
export class LiveBlogSseService implements OnModuleDestroy {
  private readonly _subscriber: Redis;
  private readonly _listeners = new Map<string, Set<(data: string) => void>>();

  constructor(@Inject('REDIS_CLIENT') private readonly _publisher: Redis) {
    this._subscriber = this._publisher.duplicate();

    this._subscriber.on('message', (channel: string, message: string) => {
      const callbacks = this._listeners.get(channel);
      if (callbacks) {
        callbacks.forEach((cb) => cb(message));
      }
    });
  }

  async publish(slug: string, payload: Record<string, unknown>): Promise<void> {
    await this._publisher.publish(`${CHANNEL_PREFIX}${slug}`, JSON.stringify(payload));
  }

  async subscribe(slug: string, callback: (data: string) => void): Promise<() => void> {
    const channel = `${CHANNEL_PREFIX}${slug}`;

    if (!this._listeners.has(channel)) {
      this._listeners.set(channel, new Set());
      await this._subscriber.subscribe(channel);
    }

    this._listeners.get(channel).add(callback);

    return async () => {
      const callbacks = this._listeners.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this._listeners.delete(channel);
          await this._subscriber.unsubscribe(channel);
        }
      }
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this._subscriber.quit();
  }
}
