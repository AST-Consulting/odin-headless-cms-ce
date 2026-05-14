import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ApiConfigService } from '../config/config.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly _apiConfigService: ApiConfigService) {}
  organizationId;
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if Authorization header exists
    if (!req.headers.authorization) {
      console.error('🚨 Unauthorized access attempt!');
    }
    next();
  }
}
