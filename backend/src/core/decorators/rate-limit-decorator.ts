import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (limit?: number, ttl?: number) => {
  if (!limit) {
    limit = parseInt(process.env.RATE_LIMIT) || 10;
  }
  if (!ttl) {
    ttl = parseInt(process.env.RATE_LIMIT_TTL) || 60;
  }
  return SetMetadata(RATE_LIMIT_KEY, { limit, ttl });
};
