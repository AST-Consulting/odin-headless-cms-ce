import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { PERMISSION_RESOURCE_KEY } from '../common/decorators/permission-resource.decorator';
import { SKIP_PERMISSION_KEY } from '../common/decorators/skip-permission.decorator';
import { RoleService } from 'src/role/role.service';
import { UserService } from 'src/user/user.service';
import { TActionType } from 'src/role/entities/role.schema';
import {
  ROUTE_TO_MODULE,
  SKIP_PERMISSION_ROUTES,
} from 'src/core/constants/permission-routing.config';
import { Request } from 'express';

interface HttpMethodActionMap {
  [method: string]: TActionType;
}

const HTTP_METHOD_TO_ACTION: HttpMethodActionMap = {
  GET: TActionType.READ,
  POST: TActionType.WRITE,
  PUT: TActionType.EDIT,
  PATCH: TActionType.EDIT,
  DELETE: TActionType.DELETE,
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private userService: UserService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. If @SkipPermission() is on the method → allow through (auth still required)
    const skipPermission = this.reflector.get<boolean>(
      SKIP_PERMISSION_KEY,
      context.getHandler(),
    );
    if (skipPermission) {
      return true;
    }

    // 2. If @Public() is set → allow through (JwtAuthGuard already handled this,
    //    but we check here to avoid auto-inferring permissions on public endpoints)
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 3. Resolve the required permissions — explicit decorator takes priority
    const requiredPermissions = this.resolvePermissions(context);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 4. Get the user and organization context from the request
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const orgId = (request.headers['x-organization-id'] as string) || request.query.organizationId || request.body.organizationId;
    const propertyId = (request.headers['x-property-id'] as string) || request.query.propertyId || request.body.propertyId;

    this.logger.debug(
      `[PermissionsGuard] Checking permissions for user: ${user?.sub}, org: ${orgId || 'GLOBAL'}, prop: ${propertyId || 'NONE'}, required: ${requiredPermissions}`,
    );

    // 5. Validate user has roles and check permissions
    return this.checkPermissions(requiredPermissions, user, request, orgId, propertyId);
  }

  /**
   * Resolves the required permissions for the current request.
   *
   * Priority:
   *  1. Explicit @Permissions() on the handler method
   *  2. @PermissionResource() on the class (opt-in override)
   *  3. Auto-inferred from @Controller() route path + HTTP method
   *  4. null (no permission check needed)
   */
  private resolvePermissions(context: ExecutionContext): string[] | null {
    // Priority 1: Explicit @Permissions() on the method
    const explicit = this.reflector.get<string[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (explicit && explicit.length > 0) {
      return explicit;
    }

    // Priority 2: @PermissionResource() on the controller class (opt-in override)
    const resource = this.reflector.get<string>(
      PERMISSION_RESOURCE_KEY,
      context.getClass(),
    );
    if (resource) {
      return this.inferFromModule(resource, context);
    }

    // Priority 3: Auto-infer from @Controller() route path
    const routePath = this.reflector.get<string>(
      PATH_METADATA,
      context.getClass(),
    );
    if (!routePath) {
      return null;
    }

    // Check if this route is in the skip list
    if (SKIP_PERMISSION_ROUTES.includes(routePath)) {
      return null;
    }

    // Map route to permission module (use override map or route as-is)
    const module = ROUTE_TO_MODULE[routePath] ?? routePath;
    return this.inferFromModule(module, context);
  }

  /**
   * Given a permission module name, infers the full permission string
   * from the HTTP method (e.g., 'articles' + GET → 'articles.read').
   */
  private inferFromModule(
    module: string,
    context: ExecutionContext,
  ): string[] | null {
    const request = context.switchToHttp().getRequest<Request>();
    const action = HTTP_METHOD_TO_ACTION[request.method];
    if (!action) {
      this.logger.debug(
        `[PermissionsGuard] No action mapping for HTTP method ${request.method}, allowing through`,
      );
      return null;
    }

    return [`${module}.${action}`];
  }

  /**
   * Validates that the user's roles satisfy ALL required permissions.
   */
  private async checkPermissions(
    requiredPermissions: string[],
    user: Record<string, unknown>,
    request: Request,
    orgId?: string,
    propertyId?: string,
  ): Promise<boolean> {
    // If no user → deny access
    if (!user || !user.sub) {
      throw new ForbiddenException('Access denied: user not authenticated');
    }

    // Fetch the full user document to get their latest status and permissions
    const fullUser = await this.userService.findOne(user.sub as string);
    if (!fullUser) {
      throw new ForbiddenException('Access denied: user not found');
    }

    // 1. GLOBAL SuperAdmin bypass 
    // Always allow if userType is 'superadmin' regardless of property context
    // 2. ONBOARDING bypass: Allow everything while user is setting their password
    if (fullUser.userType === 'superadmin' || fullUser.generateNewPw) {
      return true;
    }

    // Security: Check if user is active in this context (Property)
    let propertyStatus = 'inactive';
    if (propertyId) {
      propertyStatus = fullUser.properties?.find((p) => p.id === propertyId)?.status || 'inactive';
    } else {
      // Global/Fall-through: Check if they are active in ANY property
      const isAnyActive = fullUser.properties?.some((p) => p.status === 'active');
      propertyStatus = isAnyActive ? 'active' : 'inactive';
    }

    if (propertyStatus !== 'active' && !fullUser.generateNewPw) {
      throw new ForbiddenException(
        `Access denied: account is ${propertyStatus} for this ${propertyId ? 'property' : 'request'}`,
      );
    }

    // 1. Resolve context-specific roles/permissions using AuthService
    const { roles, permissions } = await this.authService.getContextPermissions(
        fullUser._id.toString(), 
        orgId, 
        propertyId
    );

    // Update request.user with resolved context roles for downstream use
    (request.user as any).roles = roles;
    (request.user as any).permissions = permissions;

    // 2. Scoped SuperAdmin bypass 
    const isContextSuperAdmin = roles.some(r => r.name.toUpperCase() === 'SUPERADMIN');
    if (isContextSuperAdmin) {
      return true;
    }

    // 3. Resolve 'Self' ownership
    const targetUserId = request.params.id;
    const isSelf = targetUserId && targetUserId === fullUser._id.toString();

    // 4. Validate permissions
    for (const requiredPermission of requiredPermissions) {
      const [module, action] = requiredPermission.split('.');

      /**
       * Base Permission: Every user with a role should have read access to:
       * 1. property (to select a property)
       * 2. organizations (to see their org context)
       */
      if (
        (module === 'property' && action === TActionType.READ) ||
        (module === 'organizations' && action === TActionType.READ) ||
        (module === 'search' && action === TActionType.READ) ||
        (module === 'auth' && action === TActionType.EDIT && (fullUser.generateNewPw || request.url.includes('change-password') || isSelf))
      ) {
        continue;
      }

      const hasPermission = permissions.some(
        (perm) =>
          perm.module.toLowerCase() === module.toLowerCase() &&
          perm.actions.some(a => a.toLowerCase() === action.toLowerCase()),
      );

      if (!hasPermission) {
        this.logger.warn(
          `[PermissionsGuard] User ${user.sub} denied: missing permission ${requiredPermission}`,
        );
        throw new ForbiddenException(
          `Access denied: missing permission '${requiredPermission}'`,
        );
      }
    }

    return true;
  }
}
