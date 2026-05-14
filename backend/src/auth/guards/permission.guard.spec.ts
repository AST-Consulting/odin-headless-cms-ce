/* eslint-disable @typescript-eslint/no-unused-vars */

// Mock heavy dependencies before any imports
jest.mock('src/role/role.service', () => ({
  RoleService: jest.fn().mockImplementation(() => ({
    findByIds: jest.fn(),
  })),
}));

jest.mock('src/user/user.service', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    findOne: jest.fn(),
  })),
}));

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permission.guard';
import { TActionType } from 'src/role/entities/role.schema';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { PERMISSION_RESOURCE_KEY } from '../common/decorators/permission-resource.decorator';
import { SKIP_PERMISSION_KEY } from '../common/decorators/skip-permission.decorator';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

interface MockPermission {
  module: string;
  actions: TActionType[];
}

interface MockRole {
  permissions: MockPermission[];
}

interface MockRoleService {
  findByIds: jest.Mock;
}

/** Build a minimal ExecutionContext stub whose request carries `user` and optional `method`. */
function buildContext(
  user: Record<string, unknown> | null,
  method = 'GET',
): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user, method }),
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
  } as unknown as ExecutionContext;
}

// ------------------------------------------------------------------
// Test suite
// ------------------------------------------------------------------

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let mockRoleService: MockRoleService;
  let mockUserService: { findOne: jest.Mock };
  let mockAuthService: { getContextPermissions: jest.Mock; aggregatePermissions: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    mockRoleService = { findByIds: jest.fn() };
    mockUserService = { findOne: jest.fn() };
    mockAuthService = { 
      getContextPermissions: jest.fn(),
      aggregatePermissions: jest.fn() 
    };

    // Default mock user for guard check
    mockUserService.findOne.mockResolvedValue({
      _id: 'user1',
      status: 'active',
      roles: [{ id: 'role1', name: 'ADMIN' }],
      permissions: [],
    });

    mockAuthService.getContextPermissions.mockResolvedValue({ 
      roles: [{ id: 'role1', name: 'ADMIN' }], 
      permissions: [] 
    });

    // Construct guard with our mock dependencies
    guard = new PermissionsGuard(
      reflector,
      mockUserService as any,
      mockAuthService as any
    );
  });

  // ---------------------------------------------------------------
  // 1. No route path metadata / no explicit permissions → allow through
  // ---------------------------------------------------------------
  it('should allow access when there is no route path metadata and no explicit permissions', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation(() => undefined);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockRoleService.findByIds).not.toHaveBeenCalled();
  });

  it('should allow access when permissions array is empty and no route metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    jest.spyOn(reflector, 'get').mockImplementation(() => undefined);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockRoleService.findByIds).not.toHaveBeenCalled();
  });

  it('should infer permissions from PATH_METADATA when no explicit permissions are set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key: string | symbol) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return undefined;
      if (key === PERMISSION_RESOURCE_KEY) return undefined;
      if (key === PATH_METADATA) return 'articles';
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [{ module: 'articles', actions: [TActionType.READ] }],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockRoleService.findByIds).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // 2. No user / no roles → ForbiddenException
  // ---------------------------------------------------------------
  it('should throw ForbiddenException when user is null', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });

    const ctx = buildContext(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('no roles assigned');
  });

  it('should throw ForbiddenException when user has no roleIds', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });

    const ctx = buildContext({ sub: 'user1' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when roleIds is empty', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });

    const ctx = buildContext({ sub: 'user1', roles: [] });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when all roleIds are null', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });

    const ctx = buildContext({ sub: 'user1', roles: [{ id: null }, { id: undefined }] });

    await expect(guard.canActivate(ctx)).rejects.toThrow('no valid roles');
  });

  // ---------------------------------------------------------------
  // 3. Roles not found in DB → ForbiddenException
  // ---------------------------------------------------------------
  it('should throw ForbiddenException when roleService returns empty', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });
    mockRoleService.findByIds.mockResolvedValue([]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });

    await expect(guard.canActivate(ctx)).rejects.toThrow('roles not found');
  });

  it('should throw ForbiddenException when roleService returns null', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });
    mockRoleService.findByIds.mockResolvedValue(null);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });

    await expect(guard.canActivate(ctx)).rejects.toThrow('roles not found');
  });

  // ---------------------------------------------------------------
  // 4. Permission granted — single permission, single role
  // ---------------------------------------------------------------
  it('should allow access when role has the required permission', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [
        { module: 'articles', actions: [TActionType.READ, TActionType.WRITE] },
      ],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ---------------------------------------------------------------
  // 5. Permission denied — role lacks the action
  // ---------------------------------------------------------------
  it('should deny access when role has the module but not the action', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.delete'];
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [
        { module: 'articles', actions: [TActionType.READ] },
      ],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      "missing permission 'articles.delete'",
    );
  });

  // ---------------------------------------------------------------
  // 6. Permission denied — role has wrong module
  // ---------------------------------------------------------------
  it('should deny access when role has a different module', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['users.read'];
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [
        { module: 'articles', actions: [TActionType.READ, TActionType.WRITE] },
      ],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      "missing permission 'users.read'",
    );
  });

  // ---------------------------------------------------------------
  // 7. Multiple permissions required — all must pass
  // ---------------------------------------------------------------
  it('should allow access when role satisfies all required permissions', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read', 'category.write'];
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [
        { module: 'articles', actions: [TActionType.READ] },
        { module: 'category', actions: [TActionType.WRITE] },
      ],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should deny when one of multiple required permissions is missing', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read', 'users.delete'];
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [
        { module: 'articles', actions: [TActionType.READ] },
      ],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      "missing permission 'users.delete'",
    );
  });

  // ---------------------------------------------------------------
  // 8. Multiple roles — permission satisfied across roles
  // ---------------------------------------------------------------
  it('should allow access when permission is spread across multiple roles', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });

    const roleA: MockRole = {
      permissions: [{ module: 'category', actions: [TActionType.READ] }],
    };
    const roleB: MockRole = {
      permissions: [{ module: 'articles', actions: [TActionType.READ] }],
    };
    mockRoleService.findByIds.mockResolvedValue([roleA, roleB]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'roleA' }, { id: 'roleB' }] });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ---------------------------------------------------------------
  // 9. All four action types work
  // ---------------------------------------------------------------
  it.each([
    [TActionType.READ, 'articles.read'],
    [TActionType.WRITE, 'articles.write'],
    [TActionType.EDIT, 'articles.edit'],
    [TActionType.DELETE, 'articles.delete'],
  ])('should allow action %s for permission %s', async (action, permission) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return [permission];
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [{ module: 'articles', actions: [action] }],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ---------------------------------------------------------------
  // 10. Filters null roleIds before querying DB
  // ---------------------------------------------------------------
  it('should filter null roleIds and query only valid ones', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [{ module: 'articles', actions: [TActionType.READ] }],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: null }, { id: 'role1' }, { id: undefined }] });
    await guard.canActivate(ctx);

    expect(mockRoleService.findByIds).toHaveBeenCalledWith(['role1']);
  });

  // ---------------------------------------------------------------
  // 11. Hyphenated module names work (e.g. audit-trail, banner-type)
  // ---------------------------------------------------------------
  it('should handle hyphenated module names correctly', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['audit-trail.read'];
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [{ module: 'audit-trail', actions: [TActionType.READ] }],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ---------------------------------------------------------------
  // 12. Role with empty permissions array → denied
  // ---------------------------------------------------------------
  it('should deny access when role has empty permissions array', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['articles.read'];
      return undefined;
    });

    const mockRole: MockRole = { permissions: [] };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ---------------------------------------------------------------
  // 13. @PermissionResource auto-inference tests
  // ---------------------------------------------------------------
  describe('Auto-inference via @PermissionResource', () => {
    it.each([
      ['GET', 'articles.read'],
      ['POST', 'articles.write'],
      ['PUT', 'articles.edit'],
      ['PATCH', 'articles.edit'],
      ['DELETE', 'articles.delete'],
    ])(
      'should infer %s → %s from @PermissionResource("articles")',
      async (httpMethod, expectedPermission) => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === SKIP_PERMISSION_KEY) return undefined;
          if (key === PERMISSIONS_KEY) return undefined; // no explicit @Permissions
          if (key === PERMISSION_RESOURCE_KEY) return 'articles';
          return undefined;
        });

        const [module, action] = expectedPermission.split('.');
        const mockRole: MockRole = {
          permissions: [{ module, actions: [action as TActionType] }],
        };
        mockRoleService.findByIds.mockResolvedValue([mockRole]);

        const ctx = buildContext(
          { sub: 'user1', roles: [{ id: 'role1' }] },
          httpMethod,
        );
        const result = await guard.canActivate(ctx);

        expect(result).toBe(true);
      },
    );

    it('should deny when auto-inferred permission is missing from role', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return 'articles';
        return undefined;
      });

      const mockRole: MockRole = {
        permissions: [{ module: 'articles', actions: [TActionType.READ] }],
      };
      mockRoleService.findByIds.mockResolvedValue([mockRole]);

      // DELETE request but role only has READ
      const ctx = buildContext(
        { sub: 'user1', roles: [{ id: 'role1' }] },
        'DELETE',
      );

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "missing permission 'articles.delete'",
      );
    });

    it('should allow through for unsupported HTTP methods (HEAD, OPTIONS)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return 'articles';
        return undefined;
      });

      const ctx = buildContext(
        { sub: 'user1', roles: [{ id: 'role1' }] },
        'OPTIONS',
      );
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRoleService.findByIds).not.toHaveBeenCalled();
    });

    it('should work with hyphenated resource names', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return 'banner-type';
        return undefined;
      });

      const mockRole: MockRole = {
        permissions: [
          { module: 'banner-type', actions: [TActionType.WRITE] },
        ],
      };
      mockRoleService.findByIds.mockResolvedValue([mockRole]);

      const ctx = buildContext(
        { sub: 'user1', roles: [{ id: 'role1' }] },
        'POST',
      );
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 14. Explicit @Permissions overrides @PermissionResource
  // ---------------------------------------------------------------
  it('should use explicit @Permissions over @PermissionResource auto-inference', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      // Method has explicit @Permissions('category.write')
      if (key === PERMISSIONS_KEY) return ['category.write'];
      // Class has @PermissionResource('category') — should be ignored
      if (key === PERMISSION_RESOURCE_KEY) return 'category';
      return undefined;
    });

    const mockRole: MockRole = {
      permissions: [
        { module: 'category', actions: [TActionType.WRITE] },
      ],
    };
    mockRoleService.findByIds.mockResolvedValue([mockRole]);

    // GET request — auto-inference would give 'category.read', but explicit says 'category.write'
    const ctx = buildContext(
      { sub: 'user1', roles: [{ id: 'role1' }] },
      'GET',
    );
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ---------------------------------------------------------------
  // 15. @SkipPermission bypasses all permission checks
  // ---------------------------------------------------------------
  it('should allow access when @SkipPermission is set', async () => {
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return true;
      return undefined;
    });

    const ctx = buildContext({ sub: 'user1', roles: [] }); // no roles — would fail normally
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockRoleService.findByIds).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // 16. @Public endpoints with @PermissionResource skip inference
  // ---------------------------------------------------------------
  it('should skip permission check on @Public endpoints even with @PermissionResource', async () => {
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === SKIP_PERMISSION_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return undefined;
      if (key === PERMISSION_RESOURCE_KEY) return 'articles';
      return undefined;
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return true;
      return undefined;
    });

    const ctx = buildContext(null); // no user at all
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockRoleService.findByIds).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // 17. PATH_METADATA auto-inference from @Controller() route path
  // ---------------------------------------------------------------
  describe('Auto-inference via PATH_METADATA (@Controller route)', () => {
    it.each([
      ['GET', 'articles.read'],
      ['POST', 'articles.write'],
      ['PUT', 'articles.edit'],
      ['PATCH', 'articles.edit'],
      ['DELETE', 'articles.delete'],
    ])(
      'should infer %s → %s from @Controller("articles")',
      async (httpMethod, expectedPermission) => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === SKIP_PERMISSION_KEY) return undefined;
          if (key === PERMISSIONS_KEY) return undefined;
          if (key === PERMISSION_RESOURCE_KEY) return undefined;
          if (key === PATH_METADATA) return 'articles';
          return undefined;
        });

        const [module, action] = expectedPermission.split('.');
        const mockRole: MockRole = {
          permissions: [{ module, actions: [action as TActionType] }],
        };
        mockRoleService.findByIds.mockResolvedValue([mockRole]);

        const ctx = buildContext(
          { sub: 'user1', roles: [{ id: 'role1' }] },
          httpMethod,
        );
        const result = await guard.canActivate(ctx);

        expect(result).toBe(true);
      },
    );

    it('should map "faqs" route to "faq" module via ROUTE_TO_MODULE override', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return undefined;
        if (key === PATH_METADATA) return 'faqs';
        return undefined;
      });

      const mockRole: MockRole = {
        permissions: [{ module: 'faq', actions: [TActionType.READ] }],
      };
      mockRoleService.findByIds.mockResolvedValue([mockRole]);

      const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] }, 'GET');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should map "sections" route to "section" module via ROUTE_TO_MODULE override', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return undefined;
        if (key === PATH_METADATA) return 'sections';
        return undefined;
      });

      const mockRole: MockRole = {
        permissions: [{ module: 'section', actions: [TActionType.WRITE] }],
      };
      mockRoleService.findByIds.mockResolvedValue([mockRole]);

      const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] }, 'POST');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should skip auto-inference for routes in SKIP_PERMISSION_ROUTES', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return undefined;
        if (key === PATH_METADATA) return 'auth'; // in SKIP list
        return undefined;
      });

      const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] }, 'GET');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRoleService.findByIds).not.toHaveBeenCalled();
    });

    it('should skip auto-inference for "trends" route (SKIP list)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return undefined;
        if (key === PATH_METADATA) return 'trends';
        return undefined;
      });

      const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] }, 'GET');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRoleService.findByIds).not.toHaveBeenCalled();
    });

    it('should allow through when controller has no route path', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return undefined;
        if (key === PATH_METADATA) return undefined; // no route
        return undefined;
      });

      const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] }, 'GET');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRoleService.findByIds).not.toHaveBeenCalled();
    });

    it('should let @PermissionResource override PATH_METADATA', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        // Class has @PermissionResource('custom-module') AND @Controller('articles')
        if (key === PERMISSION_RESOURCE_KEY) return 'custom-module';
        if (key === PATH_METADATA) return 'articles';
        return undefined;
      });

      const mockRole: MockRole = {
        permissions: [{ module: 'custom-module', actions: [TActionType.READ] }],
      };
      mockRoleService.findByIds.mockResolvedValue([mockRole]);

      const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] }, 'GET');
      const result = await guard.canActivate(ctx);

      // Should use 'custom-module.read', NOT 'articles.read'
      expect(result).toBe(true);
    });

    it('should let explicit @Permissions override PATH_METADATA', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        // Method has explicit @Permissions('category.write')
        if (key === PERMISSIONS_KEY) return ['category.write'];
        if (key === PERMISSION_RESOURCE_KEY) return undefined;
        if (key === PATH_METADATA) return 'category'; // would infer 'category.read' for GET
        return undefined;
      });

      const mockRole: MockRole = {
        permissions: [{ module: 'category', actions: [TActionType.WRITE] }],
      };
      mockRoleService.findByIds.mockResolvedValue([mockRole]);

      // GET request — PATH_METADATA would give 'category.read', but explicit says 'category.write'
      const ctx = buildContext({ sub: 'user1', roles: [{ id: 'role1' }] }, 'GET');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should deny when auto-inferred PATH_METADATA permission is missing from role', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return undefined;
        if (key === PATH_METADATA) return 'articles';
        return undefined;
      });

      const mockRole: MockRole = {
        permissions: [{ module: 'articles', actions: [TActionType.READ] }],
      };
      mockRoleService.findByIds.mockResolvedValue([mockRole]);

      // DELETE request but role only has READ
      const ctx = buildContext(
        { sub: 'user1', roles: [{ id: 'role1' }] },
        'DELETE',
      );

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "missing permission 'articles.delete'",
      );
    });

    it('should allow unsupported HTTP methods through (HEAD, OPTIONS)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SKIP_PERMISSION_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === PERMISSION_RESOURCE_KEY) return undefined;
        if (key === PATH_METADATA) return 'articles';
        return undefined;
      });

      const ctx = buildContext(
        { sub: 'user1', roles: [{ id: 'role1' }] },
        'OPTIONS',
      );
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRoleService.findByIds).not.toHaveBeenCalled();
    });
  });
});
