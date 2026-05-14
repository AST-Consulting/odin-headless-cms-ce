import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from 'src/api-keys/api-keys.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly _apiKeysService: ApiKeysService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey: string | undefined = request.headers['x-api-key'];

    if (apiKey) {
      const keyDoc = await this._apiKeysService.validate(apiKey);
      request.user = {
        sub: keyDoc.createdBy.id,
        name: keyDoc.createdBy.name,
        email: keyDoc.createdBy.email,
        userType: keyDoc.createdBy.userType,
        organizationId: keyDoc.organization?.id,
      };
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
