import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from 'src/utilities/redis/redis.service';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit-decorator';
import { getClientIp } from '../utils/utils';
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly _reflector: Reflector,
    private readonly _redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this._reflector.getAllAndOverride(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    let limit, ttl;

    if (!rateLimitOptions) {
      // No rate-limiting options are set on this route
      // return true;
      limit = process.env.RATE_LIMIT || 10;
      ttl = process.env.RATE_LIMIT_TTL || 60;
    } else {
      limit = rateLimitOptions.limit;
      ttl = rateLimitOptions.ttl;
    }

    const request = context.switchToHttp().getRequest();
    // Security: Use validated IP extraction to prevent header spoofing
    const ip = getClientIp(request);
    const redisKey = `rate_limit:${ip}`;
    const currentRequestCount = await this._redisService.get(redisKey);
    // if (currentRequestCount && currentRequestCount >= limit) {
    //   throw new HttpException(
    //     'Rate limit exceeded. Try again later.',
    //     HttpStatus.TOO_MANY_REQUESTS
    //   );
    // }

    const multi = this._redisService.multi();

    if (currentRequestCount) {
      multi.incr(redisKey); // Increment the request count
    } else {
      multi.set(redisKey, 1, 'EX', ttl); // Set initial request count with TTL
    }

    await this._redisService.execMulti(multi);
    return true;
  }
}
