/**
 * Central configuration for route-path → permission-module mapping.
 *
 * The PermissionsGuard reads the controller's route path from @Controller()
 * and uses it as the permission module. This config handles the exceptions:
 *
 * - ROUTE_TO_MODULE: when the route path differs from the permission module
 * - SKIP_PERMISSION_ROUTES: routes that should skip auto-inference entirely
 */

/** Routes where the permission module differs from the @Controller() path */
export const ROUTE_TO_MODULE: Record<string, string> = {
  faqs: 'faq',
  sections: 'section',
  menus: 'menu',
  user: 'users',
  'static-pages': 'static-page',
  'webstory-templates': 'webstory-template',
};

/**
 * Routes that should skip auto-inference entirely.
 * These controllers use cross-module permissions or heterogeneous auth patterns
 * and must rely on explicit @Permissions() decorators on each method.
 */
export const SKIP_PERMISSION_ROUTES: string[] = [
  'auth',
  'trends',
  'image-generation',
  'video-generation',
];
