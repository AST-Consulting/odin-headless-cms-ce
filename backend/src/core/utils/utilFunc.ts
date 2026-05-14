import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { jwtDecode } from 'jwt-decode';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { getTimezones } from 'country-timezone';

type TValTypes = '_number_' | '_string_' | '_boolean_' | '_include_' | '_include_i_' | '_exact_';

export const transformObject = (obj: any, type: TValTypes[] = ['_include_i_']): any => {
  if (typeof obj !== 'object' || obj === null) {
    let tempVal = obj;

    if (type.includes('_number_')) {
      tempVal = Number(tempVal);
    } else if (type.includes('_string_')) {
      tempVal = `${tempVal}`;
    } else if (type.includes('_boolean_')) {
      tempVal = JSON.parse(tempVal);
    }

    if (type.includes('_exact_')) {
      return tempVal;
    } else if (!type.includes('_boolean_') && !type.includes('_number_')) {
      if (type.includes('_include_')) {
        tempVal = new RegExp(tempVal);
      } else if (type.includes('_include_i_')) {
        tempVal = new RegExp(tempVal, 'i');
      }
    }

    return tempVal;
  }

  if ('_number_' in obj) {
    return transformObject(obj['_number_'], type.concat('_number_'));
  } else if ('_string_' in obj) {
    return transformObject(obj['_string_'], type.concat('_string_'));
  } else if ('_boolean_' in obj) {
    return transformObject(obj['_boolean_'], type.concat('_boolean_'));
  } else if ('_exact_' in obj) {
    return transformObject(obj['_exact_'], type.concat('_exact_'));
  } else if ('_include_' in obj) {
    return transformObject(obj['_include_'], type.concat('_include_'));
  } else if ('_include_i_' in obj) {
    return transformObject(obj['_include_i_'], type.concat('_include_i_'));
  } else {
    const transformedObj = {};
    for (const key in obj) {
      transformedObj[key] = transformObject(obj[key], type);
    }
    return transformedObj;
  }
};

export const convertObjectToString = (inputObject: any): string => {
  const processNestedObject = (obj: any, prefix = '', first = true): any => {
    let result = '';

    const tempArr = Object.keys(obj);
    for (let i = 0; i < tempArr.length; i++) {
      const key = tempArr[i];
      if (typeof obj[key] === 'object') {
        if (first) {
          result += processNestedObject(obj[key], `${key}`, false);
        } else {
          result += processNestedObject(obj[key], `${prefix}[${key}]`, first);
        }
      } else {
        if (first) {
          result += `${key}=${obj[key]}&`;
        } else {
          result += `${prefix}[${key}]=${obj[key]}&`;
        }
      }
    }

    return result;
  };

  return processNestedObject(inputObject);
};

export function sanitizeElasticDocument(document: any, fields: string[]): any {
  const sanitized = {};
  fields.forEach((field) => {
    if (document[field] !== undefined) {
      sanitized[field] = document[field];
    }
  });
  return sanitized;
}

export function extractUserFromRequest(req: Request): TCurrentUserType | null {
  let token: string | null = null;

  // Extract JWT from cookies
  if (req && req.cookies) {
    token = req.cookies['token'];
  }

  // If token is not in cookies, check Authorization header
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  // If token is still not found, return null
  if (!token) {
    return null;
  }

  try {
    // Verify and decode the JWT using the secret key
    const secretKey = process.env.JWT_ACCESS_TOKEN_SECRET;
    const decoded = jwt.verify(token, secretKey) as TCurrentUserType;

    return decoded;
  } catch (error) {
    return null;
  }
}

export function sanitizeDocument(document: any, fields: string[]): any {
  const newDocument = {};
  Object.keys(document._doc).forEach((key) => {
    if (fields.includes(key)) {
      newDocument[key] = document[key];
    }
  });

  return newDocument;
}

export function sanitizeDocumentListing(document: any, fields: string[]): any {
  const newDocument: any = {};

  fields.forEach((field) => {
    // Handle nested fields like 'user.namelast'
    const fieldParts = field.split('.');
    let value = document;

    for (const part of fieldParts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        value = undefined;
        break;
      }
    }

    // Only include the field if a value is found
    if (value !== undefined) {
      const fieldKey = fieldParts[0]; // Root field (e.g., 'user')

      if (fieldParts.length === 1) {
        newDocument[fieldKey] = value;
      } else {
        // Ensure nested object structure for deep fields
        newDocument[fieldKey] = newDocument[fieldKey] || {};
        let current = newDocument[fieldKey];
        for (let i = 1; i < fieldParts.length - 1; i++) {
          current[fieldParts[i]] = current[fieldParts[i]] || {};
          current = current[fieldParts[i]];
        }
        current[fieldParts[fieldParts.length - 1]] = value;
      }
    }
  });

  return newDocument;
}
export function extractUserSub(token: string) {
  const userInfo = jwtDecode(token);
  return userInfo.sub;
}
export function parseResponseString(responseString: string): Record<string, string> {
  const pairs = responseString.split('&');
  const result: Record<string, string> = {};

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    result[key] = decodeURIComponent(value);
  }

  return result;
}
export function getIanaTimeZone(countryOrTimeZone: string): string {
  // Use country-timezone package if not in the mapping
  const timeZones = getTimezones(countryOrTimeZone);
  if (timeZones && timeZones.length > 0) {
    return timeZones[0]; // Return the first matching timezone
  }

  // Fallback to a default timezone
  return 'Asia/Kolkata';
}

export function mapMenusToWpResponse(menus: any[]) {
  return {
    Status: 'success',
    StatusCode: 200,
    StatusMessage: 'Menus List',
    Data: menus.map((menu) => ({
      menu_id: menu._id?.toString() || null,
      menu_name: menu.title,
      menu_slug: menu.slug,
      menu_parent: 0,
      menu_taxonomy: 'nav_menu',
      menu_term_taxonomy_id: Number(menu.wpMenuId?.toString().slice(-5)),
    })),
  };
}

function buildWpMenuItem(item: any, index: number): { key: string; value: Record<string, any> } {
  const rawId = item?.wpMenuId?.toString() ?? item._id?.toString() ?? `${index}`;
  // Convert last 7 hex chars of MongoDB ObjectId to a numeric ID (mirrors WP numeric IDs)
  const numericId = parseInt(rawId.slice(-7), 16);
  const idKey = numericId.toString();

  const hasInlineChildren = Array.isArray(item.children) && item.children.length > 0;
  const hasSubMenuChildren = item.subMenu && Array.isArray(item.subMenu.items) && item.subMenu.items.length > 0;

  const value: Record<string, any> = {
    child: hasInlineChildren || hasSubMenuChildren || !!(item.subMenuSlug && item.subMenuSlug.length > 0),
    id: numericId,
    title: item.titles ?? item.title ?? '',
    link: item.link ?? '',
    object: item.object ?? 'custom',
    object_id: item.object_id ?? idKey,
    sort_index: item.rank ?? index + 1,
  };

  if (hasInlineChildren) {
    item.children.forEach((child: any, childIndex: number) => {
      const { key: childKey, value: childValue } = buildWpMenuItem(child, childIndex);
      value[childKey] = childValue;
    });
  }

  if (hasSubMenuChildren) {
    item.subMenu.items.forEach((child: any, childIndex: number) => {
      const { key: childKey, value: childValue } = buildWpMenuItem(child, childIndex);
      value[childKey] = childValue;
    });
  }

  return { key: idKey, value };
}

export function mapMenuItemsToWpResponse(menu: any) {
  const items = menu?.items ?? [];

  const data: Record<string, any> = {};

  items.forEach((item: any, index: number) => {
    const { key, value } = buildWpMenuItem(item, index);
    data[key] = value;
  });

  return {
    Status: 'success',
    StatusCode: 200,
    StatusMessage: 'Menu Items',
    Data: data,
  };
}

export function mapCategoriesToWpResponse(
  categories: any[],
  total: number,
  limit: number,
  page: number,
  pageCount: number
) {
  return {
    Status: 'success',
    StatusCode: 200,
    StatusMessage: 'Categories List',
    Data: categories.map((category) => ({
      category_id: category._id?.toString() || null,
      category_name: category.title,
      category_slug: category.slug,
      category_parent: category.parent,
    })),
    total,
    limit,
    page,
    pageCount,
  };
}

export function mapCategoryItemToWpResponse(category: any) {
  return {
    Status: 'success',
    StatusCode: 200,
    StatusMessage: 'Category Details',
    Data: {
      id: category.wpCategoryId ?? null,
      name: category.title ?? '',
      slug: category.slug ?? '',
      description: category.description ?? '',
      parent: category.wpParentId ?? 0,
      count: category.count ?? 0,
      url: category.url ?? '',
      custom_meta: {
        rank_math_title: category.seo?.title ?? '',
        rank_math_description: category.seo?.metaDescription ?? '',
        rank_math_robots: category.seo?.robots ?? ['index'],
        rank_math_focus_keyword: category.seo?.keywords.join(',') ?? '',
        rank_math_canonical_url: category.seo?.canonicalUrl ?? '',
        rank_math_seo_score: category.seo?.seoScore ?? '',
        _bihar_cons_id: category.biharConsId ?? '',
        _bihar_hindi_title: category.hindiTitle ?? '',
        _bihar_english_title: category.englishTitle ?? '',
        _bihar_short_summary: category.shortSummary ?? '',
        _bihar_explain_content: category.explainContent ?? '',
      },
    },
  };
}

export function mapUserToWpResponse(user: any) {
  const domain = user.properties?.[0]?.domain || process.env.HOSTED_URL || 'https://example.com';
  const slug = user.slug || '';
  const idValue = user.wpId || (user._id ? parseInt(user._id.toString().slice(-7), 16) : 0);

  return [
    {
      id: idValue,
      name: user.name ? user.name.replace(/\b\w/g, (c: string) => c.toUpperCase()) : '',
      url: '',
      description: user.description ?? '',
      link: `${domain}/author/${slug}`,
      slug: slug,
      avatar_urls: {
        '24': user.profilePicture?.url ?? '',
        '48': user.profilePicture?.url ?? '',
        '96': user.profilePicture?.url ?? '',
      },
      meta: {
        web_stories_tracking_optin: false,
        web_stories_media_optimization: true,
        web_stories_onboarding: [],
      },
      amp_review_panel_dismissed_for_template_mode: '',
      amp_dev_tools_enabled: false,
      _links: {
        self: [
          {
            href: `${domain}/wp-json/wp/v2/users/${idValue}`,
          },
        ],
        collection: [
          {
            href: `${domain}/wp-json/wp/v2/users`,
          },
        ],
      },
    },
  ];
}
