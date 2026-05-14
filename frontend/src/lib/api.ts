import { useAuthStore } from "./auth";
import { usePropertyStore, useOrganizationStore } from "./store";
import { decodeHtmlEntities } from "./utils";
import type { Topic, Role, Article, SeoHealth, User, UserData, TrendsQuery, TrendsResponse, TrendingSearchesQuery, ChatMessage, ChatRequest, RolesResponse, OrganizationResponse, RoleNamesResponse, InviteUserResponse, Property, PropertyDto, Menu, MenuDto, Category, CreateCategoryDTO, BannerType, CreateBannerTypeDTO, Banner, CreateBannerDTO, Tag, CreateTagDTO, FAQ, CreateFAQDTO, MediaFile, UsersResponse, AuditEntity, IntegrationRecord, GA4Account, GSCAccount, GA4Data, GA4TopPage, GSCData, YouTubeAccount, YouTubeData, FacebookAccount, InstagramAccount, FacebookData, InstagramData, CreateWebStoryTemplateDTO, WebStoryTemplate, WebStoryTemplatesResponse, FactCheckResult, OrganizationListResponse, Poll, CreatePollDto, ContentTypeSchema, ComponentSchema, Entry, CreateEntryDTO } from "./types";

import { mockTopics, mockArticles, mockSeoHealth, mockDeskReport, mockCategoryReport } from './mock-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Helper function to normalize URL construction and avoid double slashes
const buildUrl = (base: string, endpoint: string): string => {
  // Remove trailing slashes from base
  const normalizedBase = base.replace(/\/+$/, '');
  // Ensure endpoint starts with a slash
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
};

/**
 * Processes an article to decode HTML entities in text fields.
 */
function processArticle(article: Article): Article {
  if (!article) return article;

  const decoded = { ...article };

  if (decoded.title) decoded.title = decodeHtmlEntities(decoded.title);
  if (decoded.metaTitle) decoded.metaTitle = decodeHtmlEntities(decoded.metaTitle);
  if (decoded.metaDescription) decoded.metaDescription = decodeHtmlEntities(decoded.metaDescription);
  if (decoded.excerpt) decoded.excerpt = decodeHtmlEntities(decoded.excerpt);

  if (Array.isArray(decoded.richBlocks)) {
    decoded.richBlocks = decoded.richBlocks.map(block => {
      if (Array.isArray(block.content)) {
        return {
          ...block,
          content: block.content.map((c: any) => ({
            ...c,
            text: typeof c.text === 'string' ? decodeHtmlEntities(c.text) : c.text
          }))
        };
      }
      return block;
    });
  }

  return decoded;
}

const createApiClient = () => {
  const getHeaders = () => {
    // This function can only be called on the client side
    if (typeof window === "undefined") {
      return { 'Content-Type': 'application/json' };
    }
    const { token } = useAuthStore.getState();
    const { selectedOrganization } = useOrganizationStore.getState();
    const { selectedProperty } = usePropertyStore.getState();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (selectedOrganization?._id) {
      headers['x-organization-id'] = selectedOrganization._id;
    }
    if (selectedProperty?._id) {
      headers['x-property-id'] = selectedProperty._id;
    }
    return headers;
  };

  return {
    async post(endpoint: string, data: any, options?: { signal?: AbortSignal }) {
      const response = await fetch(buildUrl(API_BASE, endpoint), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
        signal: options?.signal,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    async get(endpoint: string) {
      const response = await fetch(buildUrl(API_BASE, endpoint), {
        headers: getHeaders(),
        cache: 'no-store', // Ensure we always get fresh data and don't rely on browser cache
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    async getText(endpoint: string) {
      const response = await fetch(buildUrl(API_BASE, endpoint), {
        headers: getHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }
      return response.text();
    },
    async put(endpoint: string, data: any) {
      const response = await fetch(buildUrl(API_BASE, endpoint), {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    async delete(endpoint: string) {
      const response = await fetch(buildUrl(API_BASE, endpoint), {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    async patch(endpoint: string, data: any) {
      const response = await fetch(buildUrl(API_BASE, endpoint), {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    async postFormData(endpoint: string, formData: FormData) {
      // This function can only be called on the client side
      if (typeof window === "undefined") {
        throw new Error('postFormData can only be called on the client side');
      }
      const { token } = useAuthStore.getState();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Don't set Content-Type - browser sets it with multipart boundary

      const response = await fetch(buildUrl(API_BASE, endpoint), {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  };
};

const apiClient = createApiClient();

// --- Authentication ---
export async function login(email: string, password: string, emailOtp?: number): Promise<{ user: User; token: string } | { requiresOtp: true; email: string }> {

  try {
    // Note: login endpoint doesn't require auth token, so we use fetch directly
    // but with consistent error handling
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, emailOtp }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Invalid credentials');
    }

    const data = await response.json();

    // Handle 2FA flow: requiresOtp signal
    if (data.data?.requiresOtp) {
      return { requiresOtp: true, email: data.data.email } as any;
    }

    // Backend returns { data: { user, tokens: { access_token, refresh_token } }, message }
    const token = data.data.tokens.access_token;
    const backendUser = data.data.user;

    // Decode token only for organizationId / propertyId (roles/permissions are no longer in JWT)
    let organizationId = backendUser.organizationId || backendUser.orgId || backendUser.organization?.id;
    let propertyId = backendUser.propertyId;
    const permissions = backendUser.permissions || [];

    try {
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        organizationId = payload.organizationId || organizationId;
        propertyId = payload.propertyId || propertyId;
      }
    } catch (e) {
      console.error("Failed to decode token:", e);
    }

    // Extract roles from the backend user object (populated by ensurePopulatedRoles on the server)
    const backendRoles: Array<{ id: string; name: string }> = Array.isArray(backendUser.roles)
      ? backendUser.roles.map((r: any) =>
        typeof r === 'object' ? { id: r.id || r._id, name: r.name || '' } : { id: r, name: r }
      )
      : [];

    const rolesName = backendRoles.map(r => r.name).filter(Boolean);
    const roleIds = backendRoles.map(r => r.id).filter(Boolean);

    const user: User = {
      id: backendUser.id || backendUser._id,
      name: backendUser.name || backendUser.userName,
      email: backendUser.email,
      userType: backendUser.userType,
      roles: backendRoles,
      rolesName,
      roleIds,
      permissions,
      profilePicture: backendUser.profilePicture,
      designation: backendUser.designation,
      description: backendUser.description,
      socialLinks: backendUser.socialLinks,
      organizationId,
      propertyId,
      slug: backendUser.slug,
      generateNewPw: backendUser.generateNewPw,
    };
    console.log("LOGIN_DEBUG: Final User Object:", user);

    if (!token) {
      throw new Error('No access token received from server');
    }

    // Save to auth store
    useAuthStore.getState().setAuth(token, user);

    return { user, token };

  } catch (error) {
    console.error("Login failed:", error);
    useAuthStore.getState().logout();
    throw error;
  }
}

// --- Signup Flow ---
export async function createOrganization(payload: Record<string, unknown>): Promise<any> {
  try {
    // This expects the user to be logged in (uses apiClient to handle token)
    const response = await apiClient.post('/organizations', payload);
    return response.data || response;
  } catch (error) {
    console.error("Organization creation failed:", error);
    throw error;
  }
}

// For guests who are signing up and creating their first organization
export async function createOrganizationGuest(name: string, domain: string): Promise<any> {
  try {
    // Use fetch directly for public signup to bypass apiClient's token logic if needed
    const response = await fetch(`${API_BASE}/organizations/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_name: name,
        domain: domain,
        status: 'active'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create organization');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Guest organization creation failed:", error);
    throw error;
  }
}

export async function getOrganizations(): Promise<OrganizationListResponse> {
  try {
    const response = await apiClient.get('/organizations');
    return response; // Caller expects { data: Organization[], message }
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    throw error;
  }
}

export async function getOrganizationById(id: string): Promise<OrganizationResponse> {
  try {
    const response = await apiClient.get(`/organizations/${id}`);
    return response;
  } catch (error) {
    console.error("Failed to fetch organization:", error);
    throw error;
  }
}

export async function updateOrganization(id: string, data: Record<string, unknown>): Promise<any> {
  try {
    const response = await apiClient.put(`/organizations/${id}`, data);
    return response;
  } catch (error) {
    console.error("Failed to update organization:", error);
    throw error;
  }
}

export async function deleteOrganization(id: string): Promise<any> {
  try {
    const response = await apiClient.delete(`/organizations/${id}`);
    return response;
  } catch (error) {
    console.error("Failed to delete organization:", error);
    throw error;
  }
}


export async function signup(name: string, email: string, password: string, orgId: string): Promise<{ message: string }> {

  try {
    // Note: signup doesn't require auth token
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        orgId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Signup failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Signup failed:", error);
    throw error;
  }
}

export async function verifyOtp(email: string, emailOtp: number): Promise<{ message: string; data?: { token: string }; success: boolean }> {

  try {
    // Note: OTP verification doesn't require auth token
    const response = await fetch(`${API_BASE}/auth/verify-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        emailOtp
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'OTP verification failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("OTP verification failed:", error);
    throw error;
  }
}

export async function forgetPassword(email: string): Promise<{ message: string }> {

  try {
    // Note: forget password doesn't require auth token
    const response = await fetch(`${API_BASE}/auth/forget-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to request password reset');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Password reset request failed:", error);
    throw error;
  }
}

export async function resetPassword(password: string, token: string): Promise<{ message: string; success: boolean }> {

  try {
    // Note: reset password doesn't require auth token (uses password reset token)
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        token
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Password reset failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Password reset failed:", error);
    throw error;
  }
}

export async function getInvitationEmail(token: string): Promise<{ email: string }> {

  try {
    // Note: invitation email fetch doesn't require auth token
    const response = await fetch(`${API_BASE}/auth/verify-invitation?token=${token}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch invitation details');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Failed to fetch invitation email:", error);
    throw error;
  }
}

export async function completeOnboarding(email: string, temporaryPassword: string, newPassword: string): Promise<{ user: User; token: string }> {

  try {
    const response = await fetch(`${API_BASE}/auth/complete-onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        temporaryPassword,
        newPassword
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Onboarding failed");
    }

    const data = await response.json();

    // Backend returns { data: { user, tokens: { access_token, refresh_token } }, message }
    const accessToken = data.data.tokens.access_token;
    const backendUser = data.data.user;

    // We match the login logic to parse the user correctly for the frontend state
    let organizationId = backendUser.organizationId || backendUser.orgId || backendUser.organization?.id;
    let propertyId = backendUser.propertyId;
    const permissions = backendUser.permissions || [];

    try {
      if (accessToken) {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        organizationId = payload.organizationId || organizationId;
        propertyId = payload.propertyId || propertyId;
      }
    } catch (e) {
      console.error("Failed to decode token during onboarding:", e);
    }

    // Extract roles from the backend user object
    const backendRoles: Array<{ id: string; name: string }> = Array.isArray(backendUser.roles)
      ? backendUser.roles.map((r: string | { id?: string; _id?: string; name: string }) =>
        typeof r === 'object' ? { id: r.id || r._id || '', name: r.name || '' } : { id: r, name: r }
      )
      : [];

    const rolesName = backendRoles.map(r => r.name).filter(Boolean);
    const roleIds = backendRoles.map(r => r.id).filter(Boolean);

    const user: User = {
      id: backendUser.id || backendUser._id,
      name: backendUser.name || backendUser.userName,
      email: backendUser.email,
      userType: backendUser.userType || "user",
      roles: backendRoles,
      rolesName,
      roleIds,
      permissions,
      profilePicture: backendUser.profilePicture,
      designation: backendUser.designation,
      description: backendUser.description,
      socialLinks: backendUser.socialLinks,
      organizationId,
      propertyId,
      slug: backendUser.slug,
    };

    if (!accessToken) {
      throw new Error("No access token received from server");
    }

    // Save to auth store
    useAuthStore.getState().setAuth(accessToken, user);

    return { user, token: accessToken };
  } catch (error) {
    console.error("Onboarding failed:", error);
    throw error;
  }
}

export async function getContextPermissions(orgId: string, propertyId?: string): Promise<{ roles: any[], permissions: any[] }> {
  try {
    const url = propertyId
      ? `/auth/context-permissions?orgId=${orgId}&propertyId=${propertyId}`
      : `/auth/context-permissions?orgId=${orgId}`;
    const response = await apiClient.get(url);
    return response.data || { roles: [], permissions: [] };
  } catch (error) {
    console.error("Failed to fetch context permissions:", error);
    return { roles: [], permissions: [] };
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response;
  } catch (error: any) {
    console.error("Password change failed:", error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await apiClient.post('/auth/logout', {});
    // Clear auth store after successful API call
    useAuthStore.getState().logout();
  } catch (error: any) {
    console.error("Logout failed:", error);
    // Even if API call fails, logout locally
    useAuthStore.getState().logout();
    throw error;
  }
}

// --- API Functions ---

export async function fetchTopics(): Promise<Topic[]> {
  return new Promise(resolve => setTimeout(() => resolve(mockTopics), 500));
}

export async function fetchArticles(): Promise<Article[]> {
  return new Promise(resolve => setTimeout(() => resolve(mockArticles), 500));
}

export async function fetchRoles(params?: Record<string, string | number | boolean | undefined>): Promise<RolesResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, String(params[key]));
        }
      });
    }
    const url = queryParams.toString() ? `/role?${queryParams.toString()}` : '/role';
    const response = await apiClient.get(url);
    return response;
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    throw error;
  }
}

export async function getOrganizationDetails(): Promise<OrganizationResponse> {
  try {
    const response = await apiClient.get('/organizations/me');
    return response;
  } catch (error) {
    console.error("Failed to fetch organization details:", error);
    throw error;
  }
}

export async function getRoleNames(propertyId?: string): Promise<RoleNamesResponse> {
  try {
    const url = propertyId ? `/role/role-name?propertyId=${propertyId}` : '/role/role-name';
    const response = await apiClient.get(url);
    return response;
  } catch (error) {
    console.error("Failed to fetch role names:", error);
    throw error;
  }
}

export async function inviteUser(
  email: string,
  roles: string[],
  extras?: {
    name?: string;
    alt_name?: string;
    phone?: string;
    permissions?: any[];
    seo?: { title?: string; metaDescription?: string; slug?: string };
    socialLinks?: { twitter?: string; facebook?: string; linkedin?: string; instagram?: string };
    password?: string;
    sendEmail?: boolean;
    rank?: number;
  }
): Promise<InviteUserResponse> {
  try {
    const response = await apiClient.post('/auth/invite', {
      email,
      roles,
      ...(extras ?? {}),
    });
    return response;
  } catch (error) {
    console.error("Failed to invite user:", error);
    throw error;
  }
}

export async function updateUser(userId: string, data: Partial<UserData> | Record<string, unknown>): Promise<{ success: boolean; message: string; data: UserData }> {
  try {
    const response = await apiClient.put(`/user/${userId}`, data);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateUserRoles(userId: string, roles: string[], propertyId: string): Promise<any> {
  try {
    const response = await apiClient.put('/organizations/users/roles', {
      userId,
      roles,
      propertyId
    });
    return response;
  } catch (error) {
    console.error("Failed to update user roles:", error);
    throw error;
  }
}

export async function getUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  sort?: string;
  sortOrder?: string;
  lastSortValues?: any;
  status?: string | string[];
  verified?: boolean;
  propertyId?: string;
}): Promise<UsersResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
    if (params.search) queryParams.append('searchTerm', params.search);
    if (params.name) queryParams.append('name', params.name);
    if (params.email) queryParams.append('email', params.email);
    if (params.phone) queryParams.append('phone', params.phone);
    if (params.role) queryParams.append('role', params.role);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.status) {
      const statusValue = Array.isArray(params.status) ? params.status.join(',') : params.status;
      queryParams.append('status', statusValue);
    }
    if (params.verified !== undefined) queryParams.append('verified', params.verified.toString());
    if (params.propertyId) queryParams.append('propertyId', params.propertyId);

    const response = await apiClient.get(`/v2/user/?${queryParams.toString()}`);
    return response;
  } catch (error) {
    console.error("Failed to fetch users:", error);
    throw error;
  }
}
export async function getUserById(userId: string): Promise<{ success: boolean; data: UserData }> {
  try {
    const response = await apiClient.get(`/user/${userId}`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function resetUserPassword(userId: string, password?: string, sendEmail?: boolean, propertyId?: string) {
  try {
    const response = await apiClient.patch(`/user/${userId}/reset-password`, {
      password,
      sendEmail,
      propertyId,
    });
    return response;
  } catch (error) {
    throw error;
  }
}


export async function deleteUser(userId: string, propertyId?: string): Promise<{ success: boolean; message: string }> {
  try {
    const url = propertyId ? `/user/${userId}?propertyId=${propertyId}` : `/user/${userId}`;
    const response = await apiClient.delete(url);
    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Initiates reactivation for an inactive user
 * Sends updated permissions and triggers a welcome back email
 */
export async function reactivateUser(
  userId: string,
  permissions: Array<{ module: string, actions: string[] }>,
  password?: string,
  sendEmail?: boolean,
  propertyId?: string
) {
  try {
    const response = await apiClient.post(`/v2/user/reactivate/${userId}`, {
      permissions,
      password,
      sendEmail,
      propertyId
    });
    return response;
  } catch (error) {
    console.error("Failed to reactivate user:", error);
    throw error;
  }
}

/**
 * Resends an invitation email to a pending or expired user
 */
export async function resendInvitation(userId: string) {
  try {
    // Note: Backend endpoint to be verified/implemented
    const response = await apiClient.post(`/v2/user/resend-invite/${userId}`, {});
    return response;
  } catch (error) {
    console.error("Failed to resend invitation:", error);
    throw error;
  }
}
export async function createRole(roleData: {
  name: string;
  status: string;
  permissions: Array<{
    module: string;
    actions: string[];
  }>;
}, propertyId?: string): Promise<{ data: Role; success: boolean; message: string }> {
  try {
    const url = propertyId ? `/role?propertyId=${propertyId}` : '/role';
    const response = await apiClient.post(url, roleData);
    return response;
  } catch (error) {
    console.error("Failed to create role:", error);
    throw error;
  }
}

export async function updateRole(id: string, roleData: {
  name: string;
  status: string;
  permissions: Array<{
    module: string;
    actions: string[];
  }>;
}): Promise<any> {
  try {
    const response = await apiClient.put(`/role/${id}`, roleData);
    return response;
  } catch (error) {
    console.error("Failed to update role:", error);
    throw error;
  }
}

export async function getRoleById(id: string): Promise<any> {
  try {
    const response = await apiClient.get(`/role/by-id/${id}`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch role:", error);
    throw error;
  }
}


export async function deleteRole(id: string): Promise<any> {
  try {
    const response = await apiClient.delete(`/role/${id}`);
    return response;
  } catch (error) {
    console.error("Failed to delete role:", error);
    throw error;
  }
}

export async function deleteRichBlock(articleId: string, blockId: string): Promise<any> {
  return apiClient.delete(`/articles/${articleId}/rich-blocks/${blockId}`);
}

// --- AI Functions ---
export async function askAI(prompt: string): Promise<string> {
  return new Promise(resolve => setTimeout(() => resolve("This is a mocked AI response. In a real application, this would be a generated answer based on the prompt."), 1000));
}

export async function chatWithAI(request: ChatRequest): Promise<string> {
  const response = await apiClient.post('/ai/chat', request);
  return response.response;
}

export async function* chatWithAIStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
  const { token } = useAuthStore.getState();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (process.env.NODE_ENV === 'development') {
  }

  // Don't include signal in request body
  const { signal, ...requestBody } = request;

  const response = await fetch(`${API_BASE}/ai/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal, // Pass signal to fetch for abort support
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  if (process.env.NODE_ENV === 'development') {
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (process.env.NODE_ENV === 'development') {
        }
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      if (process.env.NODE_ENV === 'development') {
      }

      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          // Check for completion signal
          if (data === '[DONE]') {
            if (process.env.NODE_ENV === 'development') {
            }
            return; // Exit the generator entirely
          }

          if (data) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                if (process.env.NODE_ENV === 'development') {
                }
                yield parsed.content;
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // If JSON parsing fails, log in development
              if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to parse SSE data:', data, e);
              }
            }
          }
        }
      }
    }
  } finally {
    // Always release reader, even on error
    try {
      reader.releaseLock();
      if (process.env.NODE_ENV === 'development') {
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to release reader:', e);
      }
    }
  }
}

export async function suggestTopics(category: string, language?: string, context?: string, refresh = false): Promise<string[]> {
  const response = await apiClient.post('/ai/suggest-topics', { category, language, context, refresh });
  return Array.isArray(response?.topics) ? response.topics : [];
}

export async function generateOutline(topic: string): Promise<string[]> {
  const response = await apiClient.post('/ai/generate-outline', { topic });
  return response.outline;
}

export async function generateArticle(topic: string, language: string = 'en', type: string = 'article'): Promise<{ jobId: string }> {
  const response = await apiClient.post('/ai/generate-article', { topic, language, type });
  return response;
}

export interface GenerationJobResult {
  status: 'processing' | 'completed' | 'failed';
  result: {
    article: string;
    seo: { title: string; description: string; slug: string; tags: string[]; englishHeadline: string; featuredMedia?: { url: string; id?: string; _id?: string; path: string } };
  } | null;
  error: string | null;
}

export async function getGenerationStatus(jobId: string): Promise<GenerationJobResult> {
  const response = await apiClient.get(`/ai/generation-status/${jobId}`);
  return response;
}

export async function terminateGeneration(jobId: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/ai/terminate/${jobId}`, {});
  return response;
}

export type VideoGenerationStatus =
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'partial_failure';

export interface VideoGenerationJobResult {
  _id: string;
  status: VideoGenerationStatus;
  title: string;
  content: string;
  articleId?: string;
  mediaAssets?: Array<{
    url: string;
    alt?: string;
    caption?: string;
    source?: string;
    assetType?: 'image' | 'video';
    sourceId?: string;
    durationSec?: number;
    duration?: number | string;
  }>;
  result: Record<string, unknown> | null;
  publishResult: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  publishedAt: string | null;
}

interface VideoGenerationApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function createVideoGenerationJob(payload: {
  title: string;
  content: string;
  articleId?: string;
  uploadedVideoUrl?: string;
  durationSec?: number;
  mediaAssets?: Array<{
    url: string;
    alt?: string;
    caption?: string;
    source?: string;
    assetType?: 'image' | 'video';
    sourceId?: string;
    durationSec?: number;
    duration?: number | string;
  }>;
}): Promise<VideoGenerationJobResult> {
  const response = (await apiClient.post(
    '/video-generation/jobs',
    payload
  )) as VideoGenerationApiEnvelope<VideoGenerationJobResult>;
  return response.data;
}

export async function getVideoGenerationJobs(params?: {
  page?: number;
  limit?: number;
  propertyId?: string;
}): Promise<{ data: VideoGenerationJobResult[]; total: number; page: number; limit: number; pageCount: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.propertyId) qs.set('propertyId', params.propertyId);
  const response = (await apiClient.get(
    `/video-generation/jobs?${qs.toString()}`
  )) as { success: boolean; data: VideoGenerationJobResult[]; total: number; page: number; limit: number; pageCount: number };
  return response;
}

export async function getVideoGenerationJob(jobId: string): Promise<VideoGenerationJobResult> {
  const response = (await apiClient.get(
    `/video-generation/jobs/${jobId}`
  )) as VideoGenerationApiEnvelope<VideoGenerationJobResult>;
  return response.data;
}

export async function cancelVideoGenerationJob(jobId: string): Promise<VideoGenerationJobResult> {
  const response = (await apiClient.post(
    `/video-generation/jobs/${jobId}/cancel`,
    {}
  )) as VideoGenerationApiEnvelope<VideoGenerationJobResult>;
  return response.data;
}

export async function publishVideoGenerationJob(
  jobId: string,
  payload: {
    articleId: string;
    articleSlug?: string;
    uploadedVideo?: {
      id: string;
      url: string;
      path: string;
      fileName?: string;
      mimeType?: string;
      size?: number;
      duration?: string;
    };
  }
): Promise<VideoGenerationJobResult> {
  const response = (await apiClient.post(
    `/video-generation/jobs/${jobId}/publish`,
    payload
  )) as VideoGenerationApiEnvelope<VideoGenerationJobResult>;
  return response.data;
}

export async function planVideoScenes(payload: {
  title: string;
  content: string;
  maxScenes?: number;
  language?: string;
  voice?: "neutral" | "male" | "female";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  category?: string;
  includeHook?: boolean;
}): Promise<any> {
  const response = await apiClient.post('/video-generation/plan-scenes', payload);
  return response.data;
}

export async function fetchVideoSceneImages(payload: {
  query: string;
  fallbackQueries?: string[];
  orientation?: 'landscape' | 'portrait' | 'square';
  perPage?: number;
  returnAll?: boolean;
  imageProvider?: 'auto' | 'pexels' | 'google' | 'media-gallery';
  includeVideos?: boolean;
  propertyId?: string;
  contextTitle?: string;
  contextCategory?: string;
  language?: string;
  page?: number;
}): Promise<any> {
  const response = await apiClient.post('/video-generation/scene-images', payload);
  return response.data;
}

export async function synthesizeVideoTts(payload: {
  text: string;
  voice?: 'neutral' | 'male' | 'female';
  rate?: number;
  language?: string;
}): Promise<{ audioContent: string | null; mimeType?: string; skipped?: boolean }> {
  const response = await apiClient.post('/video-generation/tts', payload);
  return response.data;
}

export interface FactCheckJobStatus {
  status: 'processing' | 'completed' | 'failed';
  result: FactCheckResult | null;
  error: string | null;
}

export async function startFactValidation(
  data: {
    articleId?: string;
    title?: string;
    language?: string;
    type?: string;
    richBlocks: any[];
    strictness?: 'balanced' | 'strict';
  }
): Promise<{ jobId: string }> {
  return apiClient.post(`/ai/validate-facts`, data);
}

export async function startArticleFactValidation(
  articleId: string,
  strictness: 'balanced' | 'strict' = 'strict'
): Promise<{ jobId: string }> {
  return apiClient.post(`/ai/validate-facts/article/${articleId}`, { strictness });
}

export async function getFactValidationStatus(jobId: string): Promise<FactCheckJobStatus> {
  return apiClient.get(`/ai/validate-facts/${jobId}`);
}

export async function analyzeContent(content: string): Promise<any> {
  const response = await apiClient.post('/ai/analyze-content', { content });
  return response;
}

export async function improveContent(content: string, action: string): Promise<string> {
  const response = await apiClient.post('/ai/improve-content', { content, action });
  return response.content;
}

export async function applySuggestionFix(
  content: string,
  suggestion: { title: string; description: string; category: string },
): Promise<string> {
  const response = await apiClient.post('/ai/apply-suggestion-fix', { content, suggestion });
  return response.content;
}

export async function generateSeoMetadata(
  content: string,
  currentTitle?: string,
  language?: string,
): Promise<{ title: string; description: string; category?: string[]; tags?: string[]; englishHeadline?: string }> {
  const response = await apiClient.post('/ai/generate-seo', { content, currentTitle, language });
  return response;
}

export async function translateContent(content: string, targetLanguage: string): Promise<string> {
  const response = await apiClient.post('/ai/translate-content', { content, targetLanguage });
  return response.content;
}

export async function generateAIContent(prompt: string, maxLength: number = 1000): Promise<{ content: string; format: string }> {
  const response = await apiClient.post('/ai/generate', { prompt, max_length: maxLength });
  return response;
}

export async function getTrendingTopics(refresh = false): Promise<{ topics: any[] }> {
  const response = await apiClient.post('/ai/trending-topics', { refresh });
  return response;
}

// --- Analytics Functions ---
export async function fetchAnalyticsReports(propertyId?: string, startDate?: string, endDate?: string): Promise<{ deskReport: any[], categoryReport: any[] }> {
  if (!propertyId) {
    // Graceful fallback for pages without a connected GA property
    return { deskReport: mockDeskReport, categoryReport: mockCategoryReport };
  }
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const response = await apiClient.get(`/analytics/ga/reports?${params.toString()}`);
  return response.data;
}

export async function fetchGARealtime(propertyId: string): Promise<any> {
  const response = await apiClient.get(`/analytics/ga/realtime?propertyId=${propertyId}`);
  return response.data;
}

export async function fetchGADeepRealtimePages(propertyId: string): Promise<any[]> {
  const response = await apiClient.get(`/analytics/ga/realtime-pages?propertyId=${propertyId}`);
  return response.data;
}

export async function fetchGADeepRealtimeDimensions(propertyId: string, dimension: string): Promise<any[]> {
  const response = await apiClient.get(`/analytics/ga/realtime-dimension?propertyId=${propertyId}&dimension=${dimension}`);
  return response.data;
}

export async function fetchGAOverview(propertyId: string, startDate?: string, endDate?: string): Promise<any> {
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const response = await apiClient.get(`/analytics/ga/overview?${params.toString()}`);
  return response.data;
}

export async function fetchGATopArticles(propertyId: string, startDate?: string, endDate?: string, limit?: number): Promise<any[]> {
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (limit) params.append('limit', String(limit));
  const response = await apiClient.get(`/analytics/ga/top-articles?${params.toString()}`);
  return response.data;
}

export async function fetchGADimension(
  propertyId: string,
  dimension: string,
  startDate?: string,
  endDate?: string,
  limit?: number,
): Promise<any[]> {
  const params = new URLSearchParams({ propertyId, dimension });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (limit) params.append('limit', String(limit));
  const response = await apiClient.get(`/analytics/ga/dimension?${params.toString()}`);
  return response.data;
}

export async function fetchGATrafficSources(propertyId: string, startDate?: string, endDate?: string): Promise<any[]> {
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const response = await apiClient.get(`/analytics/ga/traffic-sources?${params.toString()}`);
  return response.data;
}

export async function fetchGATrends(propertyId: string, startDate?: string, endDate?: string): Promise<any[]> {
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const response = await apiClient.get(`/analytics/ga/trends?${params.toString()}`);
  return response.data;
}


// --- Mocked functions for now ---

export async function fetchSeoHealth(): Promise<SeoHealth[]> {
  return new Promise(resolve => setTimeout(() => resolve(mockSeoHealth), 500));
}

export async function fetchAnalytics(filters: any): Promise<any> {
  return { pageViews: [], ctr: [], dwellTime: [] };
}

// --- Google Trends Functions ---
export async function fetchTrends(params: TrendsQuery): Promise<TrendsResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('query', params.query);
  if (params.data_type) queryParams.append('data_type', params.data_type);
  if (params.geo) queryParams.append('geo', params.geo);
  if (params.date) queryParams.append('date', params.date);
  if (params.hl) queryParams.append('hl', params.hl);

  return apiClient.get(`/trends?${queryParams.toString()}`);
}

export async function fetchTrendingSearches(params: TrendingSearchesQuery & { refresh?: boolean; source?: 'live' | 'today' } = {}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.geo) queryParams.append('geo', params.geo);
  if (params.hl) queryParams.append('hl', params.hl);
  if (params.refresh) queryParams.append('refresh', 'true');
  if (params.source) queryParams.append('source', params.source);

  const query = queryParams.toString();
  return apiClient.get(`/trends/trending-now${query ? '?' + query : ''}`);
}

export async function fetchCrossPlatformTrends(query: string, geo?: string): Promise<Record<string, Array<{ title: string; metadata: Record<string, unknown> }>>> {
  const queryParams = new URLSearchParams();
  queryParams.append('query', query);
  if (geo) queryParams.append('geo', geo);
  return apiClient.get(`/trends/cross-platform?${queryParams.toString()}`);
}

// --- Platform Trends ---
export async function fetchYoutubeTrends(params: { geo?: string; limit?: number; category?: string; refresh?: boolean } = {}) {
  const queryParams = new URLSearchParams();
  if (params.geo) queryParams.append('geo', params.geo);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.category) queryParams.append('category', params.category);
  if (params.refresh) queryParams.append('refresh', 'true');
  const query = queryParams.toString();
  return apiClient.get(`/trends/youtube${query ? '?' + query : ''}`);
}

export async function fetchRedditTrends(params: { geo?: string; limit?: number; category?: string; refresh?: boolean } = {}) {
  const queryParams = new URLSearchParams();
  if (params.geo) queryParams.append('geo', params.geo);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.category) queryParams.append('category', params.category);
  if (params.refresh) queryParams.append('refresh', 'true');
  const query = queryParams.toString();
  return apiClient.get(`/trends/reddit${query ? '?' + query : ''}`);
}

export async function fetchTwitterTrends(params: { geo?: string; limit?: number; refresh?: boolean } = {}) {
  const queryParams = new URLSearchParams();
  if (params.geo) queryParams.append('geo', params.geo);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.refresh) queryParams.append('refresh', 'true');
  const query = queryParams.toString();
  return apiClient.get(`/trends/twitter${query ? '?' + query : ''}`);
}

export async function fetchAllTrends(params: { geo?: string; limit?: number } = {}) {
  const queryParams = new URLSearchParams();
  if (params.geo) queryParams.append('geo', params.geo);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString();
  return apiClient.get(`/trends/all${query ? '?' + query : ''}`);
}

// --- Articles Functions ---
export async function saveArticle(articleData: any, options?: { signal?: AbortSignal }): Promise<any> {
  const response = await apiClient.post('/articles', articleData, options);
  if (response && (response._id || response.data?._id)) {
    // If it returns the saved article, process it
    const article = response._id ? response : response.data;
    return response._id ? processArticle(article) : { ...response, data: processArticle(article) };
  }
  return response;
}

export async function getArticles(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  categories?: string;
  tags?: string;
  author?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  propertyId?: string;//added the propertyId for the property based filtering 
  fields?: string;
  lastSortValues?: any[];
  'metricsLatest.position.gte'?: number;
  'metricsLatest.position.lte'?: number;
  'metricsLatest.ctr.gte'?: number;
  'metricsLatest.ctr.lte'?: number;
}): Promise<{ data: Article[]; total: number; lastId?: string | null; lastSortValues?: any[] }> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.search) queryParams.append('searchTerm', `${params.search}`);
  if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
  // if (params.search) queryParams.append('title', `${params.search}*`);
  if (params.sort) queryParams.append('sort', params.sort);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.status) queryParams.append('status', params.status);
  if (params.categories) queryParams.append('primaryCategory.id', params.categories);
  if (params.tags) queryParams.append('tags', params.tags);
  if (params.author) queryParams.append('author', params.author);
  if (params.type) queryParams.append('type', params.type);
  if (params.startDate) queryParams.append('createdAt.gte', params.startDate);
  if (params.endDate) queryParams.append('createdAt.lte', params.endDate);
  if (params.fields) queryParams.append('fields', params.fields);
  if (params.propertyId) queryParams.append('propertyId', params.propertyId);

  if (params['metricsLatest.position.gte']) queryParams.append('metricsLatest.position.gte', params['metricsLatest.position.gte'].toString());
  if (params['metricsLatest.position.lte']) queryParams.append('metricsLatest.position.lte', params['metricsLatest.position.lte'].toString());
  if (params['metricsLatest.ctr.gte']) queryParams.append('metricsLatest.ctr.gte', params['metricsLatest.ctr.gte'].toString());
  if (params['metricsLatest.ctr.lte']) queryParams.append('metricsLatest.ctr.lte', params['metricsLatest.ctr.lte'].toString());

  const response = await apiClient.get(`/v2/articles?${queryParams.toString()}`);

  // Handle potential response structures
  const rawData = Array.isArray(response.data)
    ? response.data
    : response.data?.data || [];

  const data = rawData.map(processArticle);

  return {
    data,
    total: response.total || response.data?.total || 0,
    lastId: response.lastId || response.data?.lastId,
    lastSortValues: response.lastSortValues || response.data?.lastSortValues,
  };
}

export async function getArticleById(id: string): Promise<Article> {
  const response = await apiClient.get(`/articles/${id}`);
  return processArticle(response);
}

export async function deleteArticle(id: string): Promise<any> {
  return apiClient.delete(`/articles/${id}`);
}

export async function updateArticle(id: string, articleData: any): Promise<any> {
  return apiClient.patch(`/articles/${id}`, articleData);
}

export async function getAuthors(params: { search?: string; limit?: number; page?: number; propertyId?: string; sort?: string; sortOrder?: string; lastSortValues?: any[] } = {}): Promise<{ data: any[]; lastSortValues?: any[] }> {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.append('name', params.search);
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.sort) queryParams.append('sort', params.sort);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
  // Add filters for optimized author fetching
  queryParams.append('fields', 'userType,name,_id,slug');
  if (params.propertyId) queryParams.append('propertyId', params.propertyId);
  const response = await apiClient.get(`/v2/user/?${queryParams.toString()}`);
  return response;
}

// --- File Upload Functions ---

/**
 * Upload a single file to the backend
 * @param file - The file to upload
 * @param isPrivate - Whether the file should be private (default: false)
 * @returns The URL of the uploaded file
 */
export async function uploadFile(file: File, isPrivate = false, propertyId?: string): Promise<string> {
  const formData = new FormData();
  formData.append('files', file);

  const queryParams = new URLSearchParams({
    isPrivate: isPrivate.toString(),
    strategy: 'FULL',
  });
  if (propertyId) queryParams.append('propertyId', propertyId);


  const data = await apiClient.postFormData(`/files/upload?${queryParams.toString()}`, formData);

  // Backend returns: { data: { url, fileName, path, ... }, message }
  return data.data.url;
}

/**
 * Upload multiple files to the backend
 * @param files - Array of files to upload
 * @param isPrivate - Whether the files should be private (default: false)
 * @param source - Optional source identifier for the files
 * @returns Array of URLs for the uploaded files
 */
export async function uploadFiles(files: File[], isPrivate = false, source?: string, caption?: string, propertyId?: string, skipWatermark = false): Promise<MediaFile[]> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const queryParams = new URLSearchParams({
    isPrivate: isPrivate.toString(),
    strategy: 'FULL',
  });

  if (source) {
    queryParams.append('source', source);
  }

  if (caption) {
    queryParams.append('caption', caption);
  }
  if (propertyId) queryParams.append('propertyId', propertyId);
  if (skipWatermark) queryParams.append('skipWatermark', 'true');

  const data = await apiClient.postFormData(`/files/upload?${queryParams.toString()}`, formData);

  // Backend returns: { data: [{ url, fileName, path, ... }], message }
  // Handle both array and single object responses
  const filesData = Array.isArray(data.data) ? data.data : [data.data];
  return filesData;
}

/**
 * Ask the server to refit an existing media to a target aspect ratio.
 * If the media already matches the target the original record is returned
 * unchanged. Otherwise the server pads the image with a blurred copy of itself,
 * uploads the result as a new media record, and returns it.
 */
export async function refitMedia(
  mediaId: string,
  fitAspect: string,
  propertyId?: string,
): Promise<MediaFile> {
  const data = await apiClient.post('/files/refit', { mediaId, fitAspect, propertyId });
  return data.data as MediaFile;
}

export type AspectRatio = '1:1' | '1:4' | '1:8' | '2:3' | '3:2' | '3:4' | '4:1' | '4:3' | '4:5' | '5:4' | '8:1' | '9:16' | '16:9' | '21:9';

export interface GeneratedImageResponse {
  _id: string;
  url: string;
  path: string;
  mimeType?: string;
}

export interface InfographicPromptTemplate {
  key: string;
  label: string;
  description: string;
  promptSkeleton: string;
}

export interface PrepareInfographicPromptRequest {
  templateKey: string;
  topic?: string;
  csvText?: string;
  screenshotInsights?: string;
  additionalContext?: string;
  overrideDataSummary?: string;
}

export interface InfographicItemInput {
  label: string;
  value: string | number;
  meta?: string;
}

export interface GenerateInfographicRequest {
  type: 'ranking' | 'comparison' | 'timeline' | 'fact-box' | 'pie-chart' | 'quote-highlight' | 'stat-card';
  title: string;
  subtitle?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  accentColor?: string;
  items?: InfographicItemInput[];
  // For quote-highlight
  quote?: string;
  author?: string;
  designation?: string;
  // For stat-card
  statValue?: string;
  statLabel?: string;
  context?: string;
}

export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio = '16:9',
  template?: string,
  isInfographic?: boolean,
  propertyId?: string
): Promise<GeneratedImageResponse> {
  const data = await apiClient.post('/image-generation', { prompt, aspectRatio, template, isInfographic, propertyId });
  // The response structure is { message: "...", data: { url: "...", ... } }
  return data.data;
}

export async function getInfographicPromptTemplates(): Promise<InfographicPromptTemplate[]> {
  const data = await apiClient.get('/image-generation/infographic/templates');
  return data.data;
}

export async function prepareInfographicPrompt(
  payload: PrepareInfographicPromptRequest
): Promise<{ prompt: string; dataSummary: string; sources: string[] }> {
  const data = await apiClient.post('/image-generation/infographic/prepare-prompt', payload);
  return data.data;
}

export async function extractInfographicScreenshotInsights(
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
): Promise<{ insights: string }> {
  const data = await apiClient.post('/image-generation/infographic/extract-screenshot', {
    imageBase64,
    mimeType,
  });
  return data.data;
}

export async function generateInfographic(
  payload: GenerateInfographicRequest
): Promise<GeneratedImageResponse> {
  const data = await apiClient.post('/image-generation/infographic', payload);
  return data.data;
}

export async function generateDistributionPack(payload: {
  title: string;
  content: string;
  tags?: string[];
  tone?: string;
}): Promise<any> {
  return await apiClient.post('/ai/generate-distribution', payload);
}



// Testimonials API
export interface Testimonial {
  _id: string;
  testimonialText: string;
  authorName: string;
  authorDesignation?: string;
  authorCompany?: string;
  status: string;
  rating: number;
  date: Date;
  media?: Array<{ id: string; fileName: string; path: string }>;
  slug: string;
  rank?: number;
  isFeatured?: boolean;
  videoURL?: string;
  organization: { id: string; name: string };
  property: { id: string; name: string; domain: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTestimonialData {
  testimonialText: string;
  authorName: string;
  authorDesignation?: string;
  authorCompany?: string;
  status: string;
  rating: number;
  date?: Date;
  media?: Array<{ id: string; fileName: string; path: string }>;
  rank?: number;
  isFeatured?: boolean;
  videoURL?: string;
  organizationId: string;
  propertyId: string;
}

export async function getTestimonials(params?: {
  page?: number;
  limit?: number;
  lastId?: string;
  status?: string;
  isFeatured?: boolean;
  rating?: number;
  propertyId?: string;
}): Promise<{ data: Testimonial[]; total: number; page: number; lastId?: string; limit: number; pageCount: number }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.lastId) queryParams.append('lastId', params.lastId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.isFeatured !== undefined) queryParams.append('isFeatured', params.isFeatured.toString());
  if (params?.rating) queryParams.append('rating', params.rating.toString());
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
  const response = await apiClient.get(`/v2/testimonials?${queryParams.toString()}`);
  return response;
}

export async function getTestimonialById(id: string): Promise<Testimonial> {
  const response = await apiClient.get(`/testimonials/${id}`);
  return response.data;
}

export async function createTestimonial(data: CreateTestimonialData): Promise<Testimonial> {
  const response = await apiClient.post('/testimonials', data);
  return response.data;
}

// --- Categories Functions ---
export async function getCategories(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  slug?: string;
  lastId?: string | null;
  rank?: number;
  propertyId?: string;
  sort?: string;
  sortOrder?: string;
  lastSortValues?: any[];
}): Promise<{ data: Category[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null; lastSortValues?: any[] }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.lastId) queryParams.append('lastId', params.lastId);
  if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
  if (params?.search) queryParams.append('searchTerm', params.search);
  if (params?.slug) queryParams.append('slug', `${params.slug}`);
  if (params?.rank !== undefined) queryParams.append('rank', params.rank.toString());
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const response = await apiClient.get(`/v2/category?${queryParams.toString()}`);
  return response;
}

export async function createCategory(data: CreateCategoryDTO): Promise<Category> {
  const response = await apiClient.post('/category', data);
  return response.data;
}

export async function updateCategory(id: string, data: Partial<CreateCategoryDTO>): Promise<Category> {
  const response = await apiClient.put(`/category/${id}`, data);
  return response.data;
}

export async function deleteCategory(id: string): Promise<any> {
  const response = await apiClient.delete(`/category/${id}`);
  return response;
}

export async function getCategoryById(id: string): Promise<Category> {
  const response = await apiClient.get(`/category/${id}`);
  return response.data;
}

// --- Banner Type Functions ---

export async function getBannerTypes(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  lastId?: string | null;
  propertyId?: string;
}): Promise<{ data: BannerType[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('searchTerm', params.search);
  if (params?.lastId) queryParams.append('lastId', params.lastId);
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);

  const response = await apiClient.get(`/v2/banner-type?${queryParams.toString()}`);
  return response;
}

export async function getBannerTypeById(id: string): Promise<BannerType> {
  const response = await apiClient.get(`/banner-type/${id}`);
  return response.data;
}
export async function createBannerType(data: CreateBannerTypeDTO): Promise<BannerType> {
  const response = await apiClient.post('/banner-type', data);
  return response.data;
}

export async function updateBannerType(id: string, data: Partial<CreateBannerTypeDTO>): Promise<BannerType> {
  const response = await apiClient.put(`/banner-type/${id}`, data);
  return response.data;
}

export async function deleteBannerType(id: string): Promise<any> {
  const response = await apiClient.delete(`/banner-type/${id}`);
  return response;
}

// --- Banner Functions ---

export async function getBanners(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  propertyId?: string;
  bannerType?: string;
  lastId?: string;
  lastSortValues?: any[];
}): Promise<{ data: Banner[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null; lastSortValues?: any[] }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.lastId) queryParams.append('lastId', params.lastId);
  if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('searchTerm', params.search);
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
  if (params?.bannerType) queryParams.append('bannerType.id', params.bannerType);

  const response = await apiClient.get(`/v2/banner?${queryParams.toString()}`);
  return response;
}

export async function createBanner(data: CreateBannerDTO): Promise<Banner> {
  const response = await apiClient.post('/banner', data);
  return response.data;
}

export async function updateBanner(id: string, data: Partial<CreateBannerDTO>): Promise<Banner> {
  const response = await apiClient.put(`/banner/${id}`, data);
  return response.data;
}

export async function deleteBanner(id: string): Promise<any> {
  const response = await apiClient.delete(`/banner/${id}`);
  return response;
}

export async function getBannerById(id: string): Promise<Banner> {
  const response = await apiClient.get(`/banner/${id}`);
  return response.data;
}

// --- Tag Functions ---

export async function getTags(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  description?: string;
  rank?: number;
  propertyId?: string;
  sort?: string;
  sortOrder?: string;
  lastSortValues?: any;
}): Promise<{ data: Tag[]; total: number; page: number; limit: number; pageCount: number; lastSortValues?: any[] }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('searchTerm', params.search);
  if (params?.description) queryParams.append('description', `${params.description}*`);
  if (params?.rank !== undefined) queryParams.append('rank', params.rank.toString());
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const response = await apiClient.get(`/v2/tag?${queryParams.toString()}`);
  return response;
}

export async function getTagById(id: string): Promise<Tag> {
  const response = await apiClient.get(`/tag/${id}`);
  return response.data;
}

export async function createTag(data: CreateTagDTO): Promise<Tag> {
  const response = await apiClient.post('/tag', data);
  return response.data;
}

export async function updateTag(id: string, data: Partial<CreateTagDTO>): Promise<Tag> {
  const response = await apiClient.put(`/tag/${id}`, data);
  return response.data;
}

export async function deleteTag(id: string): Promise<any> {
  const response = await apiClient.delete(`/tag/${id}`);
  return response;
}

// --- FAQ Functions ---

export async function getFAQs(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  lastId?: string;
  rank?: number;
  categoryId?: string;
  propertyId?: string;
  entityType?: string;
  sort?: string;
  sortOrder?: string;
  lastSortValues?: any[];
}): Promise<{ data: FAQ[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null; lastSortValues?: any[] }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('searchTerm', params.search);
  if (params?.rank !== undefined) queryParams.append('rank', params.rank.toString());
  if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
  if (params?.entityType) queryParams.append('entityType', params.entityType);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));

  const response = await apiClient.get(`/v2/faqs?${queryParams.toString()}`);
  return response;
}

export async function createFAQ(data: CreateFAQDTO): Promise<FAQ> {
  const response = await apiClient.post('/faqs/create', data);
  return response.data;
}

export async function updateFAQ(id: string, data: Partial<CreateFAQDTO>): Promise<FAQ> {
  const response = await apiClient.put(`/faqs/${id}`, data);
  return response.data;
}

export async function deleteFAQ(id: string): Promise<any> {
  const response = await apiClient.delete(`/faqs/${id}`);
  return response;
}

export async function getFAQById(id: string): Promise<FAQ> {
  const response = await apiClient.get(`/faqs/${id}`);
  return response.data;
}

// --- Poll Functions ---

export async function getPolls(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  propertyId?: string;
  organizationId?: string;
  sort?: string;
  sortOrder?: "asc" | "desc";
  lastSortValues?: any;
}): Promise<{ data: Poll[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('searchTerm', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
    if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));

    const url = queryParams.toString() ? `/poll?${queryParams.toString()}` : '/poll';
    const response = await apiClient.get(url);
    return response;
  } catch (error) {
    console.error("Failed to fetch polls:", error);
    throw error;
  }
}

export async function createPoll(data: CreatePollDto): Promise<Poll> {
  const response = await apiClient.post('/poll', data);
  return response.data;
}

export async function updatePoll(id: string, data: Partial<CreatePollDto>): Promise<Poll> {
  const response = await apiClient.put(`/poll/${id}`, data);
  return response.data;
}

export async function deletePoll(id: string): Promise<any> {
  const response = await apiClient.delete(`/poll/${id}`);
  return response;
}

export async function getPollById(id: string): Promise<Poll> {
  const response = await apiClient.get(`/poll/${id}`);
  return response.data;
}

export async function votePoll(id: string, option: string): Promise<any> {
  const response = await apiClient.post(`/poll/${id}/vote`, { option });
  return response.data;
}

// --- Property Functions ---

export async function createProperty(data: PropertyDto): Promise<Property> {
  try {
    const { selectedOrganization } = useOrganizationStore.getState();
    const finalData = {
      organizationId: selectedOrganization?._id,
      ...data
    };
    const response = await apiClient.post('/property', finalData);
    return response.data;
  } catch (error) {
    console.error("Failed to create property:", error);
    throw error;
  }
}

export async function getProperties(params?: string | Record<string, string | number | boolean | undefined>): Promise<Property[]> {
  try {
    const queryParams = new URLSearchParams();
    if (typeof params === 'string') {
      queryParams.append('organizationId', params);
    } else if (params && typeof params === 'object') {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, String(params[key]));
        }
      });
    }
    const url = queryParams.toString() ? `/property/all?${queryParams.toString()}` : '/property/all';
    const response = await apiClient.get(url);
    // Backend returns { data: Property[], total: number } for /all endpoint
    return response.data || [];
  } catch (error) {
    console.error("Failed to fetch properties:", error);
    throw error;
  }
}

export async function updateProperty(id: string, data: Partial<PropertyDto>): Promise<Property> {
  try {
    const response = await apiClient.put(`/property/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Failed to update property:", error);
    throw error;
  }
}

export async function deleteProperty(id: string): Promise<void> {
  try {
    await apiClient.delete(`/property/${id}`);
  } catch (error) {
    console.error("Failed to delete property:", error);
    throw error;
  }
}

// --- Menu Functions ---

export async function createMenu(data: MenuDto): Promise<Menu> {
  try {
    const response = await apiClient.post('/menus', data);
    return response.data;
  } catch (error) {
    console.error("Failed to create menu:", error);
    throw error;
  }
}

export async function getMenus(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  propertyId?: string;
  lastSortValues?: any[];
  sort?: string;
  sortOrder?: string;
}): Promise<{ data: Menu[]; total: number; page: number; lastSortValues?: any[]; limit: number; pageCount: number } | Menu[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('searchTerm', params.search);
    if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const limit = params?.limit ?? 100;
    const url = queryParams.toString() ? `/v2/menus?${queryParams.toString()}` : `/v2/menus?limit=${limit}`;
    const response = await apiClient.get(url);

    // Handle paginated response structure
    if (response.total !== undefined) {
      return response;
    }
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      return response.data;
    }
    // Handle array response (backward compatibility)
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data;
  } catch (error) {
    console.error("Failed to fetch menus:", error);
    throw error;
  }
}

export async function getMenuById(id: string): Promise<Menu> {
  try {
    const response = await apiClient.get(`/menus/${id}`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch menu:", error);
    throw error;
  }
}

export async function updateMenu(id: string, data: Partial<MenuDto>): Promise<Menu> {
  try {
    const response = await apiClient.put(`/menus/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Failed to update menu:", error);
    throw error;
  }
}

export async function deleteMenu(id: string): Promise<void> {
  try {
    await apiClient.delete(`/menus/${id}`);
  } catch (error) {
    console.error("Failed to delete menu:", error);
    throw error;
  }
}

export async function updateTestimonial(id: string, data: Partial<CreateTestimonialData>): Promise<Testimonial> {
  const response = await apiClient.put(`/testimonials/${id}`, data);
  return response.data;
}

export async function deleteTestimonial(id: string): Promise<void> {
  await apiClient.delete(`/testimonials/${id}`);
}

// Slugs API
export interface UserInfo {
  id: string;
  name: string;
  userType: string;
}

export interface OrganizationSub {
  id: string;
  name?: string;
  domain?: string;
}

export interface PropertySub {
  id: string;
  name: string;
  domain: string;
}

export interface SeoOG {
  title: string;
  description: string;
  url?: string;
  image?: string;
}

export interface Seo {
  title: string;
  metaDescription: string;
  keywords?: string[];
  og: SeoOG;
}

export interface Slug {
  _id: string;
  slug: string;
  type: string;
  fullSlug?: string;
  status: string; // ACTIVE, INACTIVE, or DELETED
  seo?: Seo;
  redirectTo?: string;
  redirectCode?: string;
  canonicalUrl?: string;
  organization: OrganizationSub;
  property: PropertySub;
  createdBy: UserInfo;
  updatedBy: UserInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSlugData {
  slug: string;
  type: string;
  fullSlug?: string;
  status?: string;
  seo?: Seo;
  redirectTo?: string;
  redirectCode?: string;
  canonicalUrl?: string;
  propertyId: string;
}

export async function getSlugs(params?: {
  page?: number;
  limit?: number;
  lastId?: string;
  type?: string;
  status?: string;
  slug?: string;
  propertyId?: string;
  sort?: string;
  sortOrder?: string;
}): Promise<{ data: Slug[]; total: number; page: number; lastId?: string; limit: number; pageCount: number }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.lastId) queryParams.append('lastId', params.lastId);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.slug) queryParams.append('slug', `${params.slug}*`);
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const response = await apiClient.get(`/v2/slugs?${queryParams.toString()}`);
  return response;
}

export async function getSlugById(id: string): Promise<Slug> {
  const response = await apiClient.get(`/slugs/${id}`);
  return response.data;
}

export async function createSlug(data: CreateSlugData): Promise<Slug> {
  const response = await apiClient.post('/slugs', data);
  return response.data;
}

export async function updateSlug(id: string, data: Partial<CreateSlugData>): Promise<Slug> {
  const response = await apiClient.put(`/slugs/${id}`, data);
  return response.data;
}

export async function deleteSlug(id: string): Promise<void> {
  await apiClient.delete(`/slugs/${id}`);
}

// Pages API
export interface Page {
  _id: string;
  titleHn: string;
  title: string;
  content?: string;
  parentId?: string;
  slug: string;
  type: string;
  status: string;
  sections: any[];
  header?: string;
  footer?: string;
  rank?: number;
  isPublished?: boolean;
  tags?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
  propertyId?: string;
  seo: {
    title?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePageData {
  title?: string;
  rank?: number;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    og?: {
      title?: string;
      description?: string;
      url?: string;
      image?: string;
    };
  };
  content?: string;
  propertyId?: string;
  status?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  isPublished?: boolean;
  tags?: string[];
  categories?: string[];
}

export async function getPages(params?: {
  page?: number;
  limit?: number;
  type?: string;
  lastId?: string;
  status?: string;
  title?: string;
  search?: string;
  sort?: string;
  sortOrder?: 'asc' | 'desc';
  propertyId?: string;
  lastSortValues?: any[];
}): Promise<{ data: Page[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null; lastSortValues?: any[] }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.lastId) queryParams.append('lastId', params.lastId);
  if (params?.lastSortValues) queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
  if (params?.type) queryParams.append('type', params.type);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.title) queryParams.append('title', `${params.title}*`);
  if (params?.search) queryParams.append('searchTerm', params.search);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);

  const response = await apiClient.get(`v2/static-pages?${queryParams.toString()}`);

  // Handle consistent response mapping as in getArticles
  const data = Array.isArray(response.data)
    ? response.data
    : response.data?.pages || response.data?.data || [];

  return {
    ...response,
    data,
    total: response.total || response.data?.total || 0,
    page: response.page || 1,
    limit: response.limit || params?.limit || 15,
    pageCount: response.pageCount || 1,
    lastId: response.lastId || response.data?.lastId,
    lastSortValues: response.lastSortValues || response.data?.lastSortValues,
  };
}

export async function getPageById(id: string): Promise<Page> {
  const response = await apiClient.get(`/static-pages/${id}`);
  return response.data;
}

export async function createPage(data: CreatePageData): Promise<Page> {
  const response = await apiClient.post('/static-pages', data);
  return response.data;
}

export async function updatePage(id: string, data: Partial<CreatePageData>): Promise<Page> {
  const response = await apiClient.put(`/static-pages/${id}`, data);
  return response.data;
}

export async function deletePage(id: string): Promise<void> {
  await apiClient.delete(`/static-pages/${id}`);
}

// Blogs API
export interface Blog {
  _id: string;
  headline: string;
  creativeHeadline?: string;
  subheadline?: string;
  template: string;
  status: string;
  slug: string;
  synopsis?: string;
  highlights?: string;
  featureImage?: { id: string; fileName: string; path: string };
  primaryCategory: { id: string; name: string };
  categories?: Array<{ id: string; name: string }>;
  tags?: Array<{ id: string; name: string }>;
  author: { id?: string; name: string };
  cards: any[];
  seo: {
    title?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  lastPublishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function getBlogs(params?: {
  page?: number;
  limit?: number;
  status?: string;
  template?: string;
  propertyId?: string;//added the propertyId for the property based filtering 
}): Promise<{ data: Blog[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.template) queryParams.append('template', params.template);
  if (params?.propertyId) queryParams.append('propertyId', params.propertyId);
  const response = await apiClient.get(`/blogs?${queryParams.toString()}`);
  return response;
}

export async function getBlogById(id: string): Promise<Blog> {
  const response = await apiClient.get(`/blogs/${id}`);
  return response.data;
}

// --- Media Files Functions ---
export async function getMediaFiles(params?: Record<string, any>): Promise<{ data: MediaFile[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null }> {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
  }

  const response = await apiClient.get(`/v2/files?${queryParams.toString()}`);
  return response;
}

export async function getMediaFileById(id: string): Promise<MediaFile> {
  const response = await apiClient.get(`/files/${id}`);
  return response.data;
}
// --- Sections & Content Priority Functions ---
export async function getAllSections(params?: {
  propertyId?: string;
  page?: number;
  limit?: number;
  lastId?: string;
  sort?: string;
  sortOrder?: string;
  lastSortValues?: any[];
}): Promise<{ data: any[]; total: number; page: number; limit: number; pageCount: number; lastId?: string | null; lastSortValues?: any[] }> {
  const queryParams = new URLSearchParams();
  if (params?.propertyId) {
    queryParams.append('propertyId', params.propertyId);
  }
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.lastId) queryParams.append('lastId', params.lastId);
  if (params?.sort) queryParams.append('sort', params.sort);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params?.lastSortValues) {
    queryParams.append('lastSortValues', JSON.stringify(params.lastSortValues));
  }

  const query = queryParams.toString();
  return apiClient.get(`/v2/sections${query ? '?' + query : ''}`);
}

export async function getSectionById(params: { sectionId: string }): Promise<any> {
  return apiClient.get(`/sections/${params.sectionId}`);
}

export async function createSection(data: {
  title: string;
  titleHindi?: string;
  slug?: string;
  description?: string;
  status?: string;
  rank?: number;
  link?: string;
  widgetCode?: string;
  displayType?: string;
  startDate?: string;
  endDate?: string;
  category?: string[];
  sectionUrls?: string[];
  periodicUpdate?: boolean;
  fixedArticleIds?: string[];
  propertyId?: string;
  image?: {
    fileName: string;
    path: string;
    id: string;
  };
  seo?: {
    title?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  count?: number;
  author: {
    id: string;
    name: string;
    slug: string;
  };
}): Promise<any> {
  return apiClient.post('/sections', data);
}

export async function updateSection(sectionId: string, data: {
  title?: string;
  titleHindi?: string;
  slug?: string;
  description?: string;
  status?: string;
  rank?: number;
  link?: string;
  widgetCode?: string;
  displayType?: string;
  startDate?: string;
  endDate?: string;
  category?: string[];
  sectionUrls?: string[];
  periodicUpdate?: boolean;
  fixedArticleIds?: string[];
  propertyId?: string;
  image?: {
    fileName: string;
    path: string;
    id: string;
  };
  seo?: {
    title?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  count?: number;
  author?: {
    id: string;
    name: string;
    slug?: string;
  };
}): Promise<any> {
  return apiClient.put(`/sections/${sectionId}`, data);
}

export async function deleteSection(sectionId: string): Promise<any> {
  return apiClient.delete(`/sections/${sectionId}`);
}

export async function createContentPriority(data: {
  ids: string[];
  sectionId: string | null;
  contentType: string;
  propertyId?: string;
}): Promise<any> {
  return apiClient.post('/sections/content-priority', data);
}

// Content type queries - these will need to be implemented based on your backend
export async function getAllDoctors(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/doctors${query ? '?' + query : ''}`);
}

export async function getAllBlogs(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/blogs${query ? '?' + query : ''}`);
}

export async function getAllBanners(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/banners${query ? '?' + query : ''}`);
}

export async function getAllAppointments(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/appointments${query ? '?' + query : ''}`);
}

export async function getAllHospitals(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/hospitals${query ? '?' + query : ''}`);
}

export async function getAllStaticPages(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/static-pages${query ? '?' + query : ''}`);
}

export async function getAllEvents(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/events${query ? '?' + query : ''}`);
}

export async function getAllTreatments(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/treatments${query ? '?' + query : ''}`);
}

export async function getAllProcedures(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/procedures${query ? '?' + query : ''}`);
}

export async function getAllDepartments(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/departments${query ? '?' + query : ''}`);
}

export async function getAllSpecialities(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/specialities${query ? '?' + query : ''}`);
}

export async function getAllTestimonials(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/v2/testimonials${query ? '?' + query : ''}`);
}

export async function getAllAwardRecognition(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/award-recognition${query ? '?' + query : ''}`);
}

export async function getAllAccreditation(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/accreditations${query ? '?' + query : ''}`);
}
export async function getAllArticles(params?: any): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, String(value));
    });
  }
  const query = queryParams.toString();
  return apiClient.get(`/articles${query ? '?' + query : ''}`);
}

export async function getDashboardStats(params: { propertyId: string; days?: number; userId?: string }): Promise<any> {
  const queryParams = new URLSearchParams();
  queryParams.append('propertyId', params.propertyId);
  if (params.days) queryParams.append('days', params.days.toString());
  if (params.userId) queryParams.append('userId', params.userId);

  const response = await apiClient.get(`/article-metrics/dashboard-stats?${queryParams.toString()}`);
  return response.data;
}

//Note: Audit trail

export async function getAuditTrails(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  sortOrder?: "asc" | "desc";
  action?: string;
  collectionName?: string;
  user?: string;
  objectId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ data: AuditEntity[]; total: number }> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append("page", params.page.toString());
  if (params.limit) queryParams.append("limit", params.limit.toString());

  if (params.search) queryParams.append("search", params.search);

  if (params.sort) {
    const sortValue =
      params.sortOrder === "desc" ? `-${params.sort}` : params.sort;
    queryParams.append("sort", sortValue);
  }

  if (params.action) queryParams.append("action", params.action);
  if (params.collectionName)
    queryParams.append("collectionName", params.collectionName);

  if (params.user)
    queryParams.append("createdBy.userName", params.user);

  if (params.objectId) queryParams.append("objectId", params.objectId);

  if (params.startDate)
    queryParams.append("createdAt.gte", params.startDate);

  if (params.endDate)
    queryParams.append("createdAt.lte", params.endDate);

  const response = await apiClient.get(
    `/audit-trail?${queryParams.toString()}`
  );

  return {
    data: response.data ?? [],
    total: response.total ?? 0,
  };
}

// --- SEO Settings (robots.txt / ads.txt / llms.txt) ---

export type SeoFileType = 'robots' | 'ads' | 'llms';

export async function getSeoFileHistory(propertyId: string, fileType: SeoFileType) {
  const response = await apiClient.get(
    `/seo-settings/${fileType}/history?propertyId=${propertyId}`
  );
  return response;
}

export async function updateSeoFile(propertyId: string, fileType: SeoFileType, content: string) {
  const response = await apiClient.put(`/seo-settings/${fileType}/${propertyId}`, {
    content,
    entityType: 'properties',
  });
  return response.data;
}

export async function rollbackSeoFileVersion(propertyId: string, fileType: SeoFileType, version: string) {
  const response = await apiClient.put(`/seo-settings/${fileType}/rollback`, {
    propertyId,
    version,
  });
  return response.data;
}

export async function deleteSeoFileVersion(propertyId: string, fileType: SeoFileType, version: string) {
  const response = await apiClient.put(`/seo-settings/${fileType}/history/delete`, {
    propertyId,
    version,
  });
  return response.data;
}

// --- Integrations ---

export async function fetchIntegrations(propertyId: string): Promise<IntegrationRecord[]> {
  const response = await apiClient.get(`/v1/integrations/property/${propertyId}`);
  return response.data ?? [];
}

export async function initiateIntegrationConnect(
  propertyId: string,
  provider: string,
  redirectUrl: string
): Promise<string> {
  const response = await apiClient.post('/v1/integrations/connect', {
    propertyId,
    provider,
    redirectUrl,
  });
  return response.url;
}

export async function fetchGA4Accounts(propertyId: string): Promise<GA4Account[]> {
  const response = await apiClient.get(`/v1/integrations/accounts/ga4/${propertyId}`);
  return response.data ?? [];
}

export async function fetchGSCAccounts(propertyId: string): Promise<GSCAccount[]> {
  const response = await apiClient.get(`/v1/integrations/accounts/gsc/${propertyId}`);
  return response.data ?? [];
}

export async function selectIntegrationAccount(
  propertyId: string,
  provider: string,
  accountId: string,
  accountLabel: string,
  pageAccessToken?: string
): Promise<void> {
  const payload: any = {
    propertyId,
    provider,
    accountId,
    accountLabel,
  };
  if (pageAccessToken) {
    payload.pageAccessToken = pageAccessToken;
  }
  await apiClient.post('/v1/integrations/select', payload);
}

export async function disconnectIntegration(
  propertyId: string,
  provider: string
): Promise<void> {
  await apiClient.post(`/v1/integrations/disconnect/${propertyId}/${provider}`, {});
}

export async function deleteIntegration(
  propertyId: string,
  provider: string
): Promise<void> {
  await apiClient.delete(`/v1/integrations/delete/${propertyId}/${provider}`);
}

export async function fetchGA4Data(
  propertyId: string,
  startDate = "30daysAgo",
  endDate = "today"
): Promise<GA4Data> {
  const response = await apiClient.get(
    `/v1/integrations/analytics/ga4/${propertyId}?startDate=${startDate}&endDate=${endDate}`
  );
  return response.data;
}

export async function fetchGA4TopPages(
  propertyId: string,
  limit = 10,
  startDate = "30daysAgo",
  endDate = "today"
): Promise<GA4TopPage[]> {
  const response = await apiClient.get(
    `/v1/integrations/analytics/ga4/${propertyId}/top-pages?limit=${limit}&startDate=${startDate}&endDate=${endDate}`
  );
  return response.data ?? [];
}

export async function fetchGSCData(
  propertyId: string,
  startDate?: string,
  endDate?: string
): Promise<GSCData> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(
    `/v1/integrations/analytics/gsc/${propertyId}?${params}`
  );
  return response.data;
}

export async function fetchYouTubeAccounts(propertyId: string): Promise<YouTubeAccount[]> {
  const response = await apiClient.get(`/v1/integrations/accounts/youtube/${propertyId}`);
  return response.data ?? [];
}

export async function fetchYTOverview(
  propertyId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(`/analytics/youtube/overview?${params}`);
  return response.data;
}

export async function fetchYTTrends(
  propertyId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(`/analytics/youtube/trends?${params}`);
  return response.data;
}

export async function fetchYTTopVideos(
  propertyId: string,
  limit = 10,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const params = new URLSearchParams({ propertyId, limit: limit.toString() });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(`/analytics/youtube/top-videos?${params}`);
  return response.data;
}

export async function fetchYTDimension(
  propertyId: string,
  dimension: string,
  startDate?: string,
  endDate?: string,
  limit = 20
): Promise<any> {
  const params = new URLSearchParams({ propertyId, dimension, limit: limit.toString() });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(`/analytics/youtube/dimension?${params}`);
  return response.data;
}

export async function fetchYTTrafficSources(
  propertyId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(`/analytics/youtube/traffic-sources?${params}`);
  return response.data;
}

export async function fetchYTLifetimeStats(
  propertyId: string
): Promise<any> {
  const response = await apiClient.get(`/analytics/youtube/lifetime?propertyId=${propertyId}`);
  return response.data;
}

export async function fetchYTReports(
  propertyId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const params = new URLSearchParams({ propertyId });
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(`/analytics/youtube/reports?${params}`);
  return response.data;
}

export async function fetchYouTubeData(
  propertyId: string,
  startDate?: string,
  endDate?: string
): Promise<YouTubeData> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(
    `/v1/integrations/analytics/youtube/${propertyId}?${params}`
  );
  return response.data;
}

export async function fetchFacebookAccounts(propertyId: string): Promise<FacebookAccount[]> {
  const response = await apiClient.get(`/v1/integrations/accounts/facebook/${propertyId}`);
  return response.data ?? [];
}

export async function fetchInstagramAccounts(propertyId: string): Promise<InstagramAccount[]> {
  const response = await apiClient.get(`/v1/integrations/accounts/instagram/${propertyId}`);
  return response.data ?? [];
}

export async function fetchFacebookData(
  propertyId: string,
  startDate?: string,
  endDate?: string
): Promise<FacebookData> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(
    `/v1/integrations/analytics/facebook/${propertyId}?${params}`
  );
  return response.data;
}

export async function fetchInstagramData(
  propertyId: string,
  startDate?: string,
  endDate?: string
): Promise<InstagramData> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const response = await apiClient.get(
    `/v1/integrations/analytics/instagram/${propertyId}?${params}`
  );
  return response.data;
}
// --- Web Story Templates ---
export async function getWebStoryTemplates(): Promise<WebStoryTemplatesResponse> {
  try {
    const response = await apiClient.get('/webstory-templates');
    return {
      data: Array.isArray(response) ? response : response.data || [],
      success: true,
      message: 'Templates fetched successfully',
      total: Array.isArray(response) ? response.length : (response.total || 0)
    };
  } catch (error) {
    console.error("Failed to fetch web story templates:", error);
    throw error;
  }
}

export async function getWebStoryTemplateById(id: string): Promise<WebStoryTemplate> {
  const response = await apiClient.get(`/webstory-templates/${id}`);
  return Array.isArray(response) ? response[0] : response.data || response;
}

export async function createWebStoryTemplate(data: CreateWebStoryTemplateDTO): Promise<WebStoryTemplate> {
  const response = await apiClient.post('/webstory-templates', data);
  return response.data || response;
}

export async function updateWebStoryTemplate(id: string, data: Partial<CreateWebStoryTemplateDTO>): Promise<WebStoryTemplate> {
  const response = await apiClient.patch(`/webstory-templates/${id}`, data);
  return response.data || response;
}

export async function deleteWebStoryTemplate(id: string): Promise<void> {
  await apiClient.delete(`/webstory-templates/${id}`);
}
export async function generateWebStoryTemplate(description: string, model?: string): Promise<{
  name: string;
  html: string;
  css: string;
  allowedFields: string[];
}> {
  const response = await apiClient.post('/ai/generate-story-template', { description, model });
  return response.data || response;
}

// ─── Content Builder — Content Types ─────────────────────────────────────────

export async function getContentTypes(): Promise<ContentTypeSchema[]> {
  return apiClient.get('/content-builder/content-types');
}

export async function getContentTypeById(id: string): Promise<ContentTypeSchema> {
  return apiClient.get(`/content-builder/content-types/${id}`);
}

export async function createContentType(data: Partial<ContentTypeSchema>): Promise<ContentTypeSchema> {
  return apiClient.post('/content-builder/content-types', data);
}

export async function updateContentType(id: string, data: Partial<ContentTypeSchema>): Promise<ContentTypeSchema> {
  return apiClient.patch(`/content-builder/content-types/${id}`, data);
}

export async function publishContentType(id: string): Promise<ContentTypeSchema> {
  return apiClient.post(`/content-builder/content-types/${id}/publish`, {});
}

export async function deleteContentType(id: string): Promise<any> {
  return apiClient.delete(`/content-builder/content-types/${id}`);
}

// ─── Content Builder — Components ────────────────────────────────────────────

export async function getComponents(): Promise<ComponentSchema[]> {
  return apiClient.get('/content-builder/components');
}

export async function getComponentById(id: string): Promise<ComponentSchema> {
  return apiClient.get(`/content-builder/components/${id}`);
}

export async function createComponent(data: Partial<ComponentSchema>): Promise<ComponentSchema> {
  return apiClient.post('/content-builder/components', data);
}

export async function updateComponent(id: string, data: Partial<ComponentSchema>): Promise<ComponentSchema> {
  return apiClient.patch(`/content-builder/components/${id}`, data);
}

export async function deleteComponent(id: string): Promise<any> {
  return apiClient.delete(`/content-builder/components/${id}`);
}

// ─── Content Manager — Generic Entries ───────────────────────────────────────

export async function listEntries(
  pluralName: string,
  params?: { page?: number; limit?: number; status?: string; [key: string]: any },
): Promise<{ data: Entry[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(params ?? {})) {
    if (val !== undefined && val !== null) q.append(key, String(val));
  }
  return apiClient.get(`/${pluralName}?${q.toString()}`);
}

export async function getEntry(singularName: string, id: string): Promise<Entry> {
  return apiClient.get(`/${singularName}/${id}`);
}

export async function createEntry(singularName: string, data: CreateEntryDTO): Promise<Entry> {
  return apiClient.post(`/${singularName}`, data);
}

export async function updateEntry(singularName: string, id: string, data: Partial<CreateEntryDTO>): Promise<Entry> {
  return apiClient.put(`/${singularName}/${id}`, data);
}

export async function deleteEntry(singularName: string, id: string): Promise<any> {
  return apiClient.delete(`/${singularName}/${id}`);
}

export async function publishEntry(singularName: string, id: string): Promise<Entry> {
  return apiClient.post(`/${singularName}/${id}/actions/publish`, {});
}

export async function unpublishEntry(singularName: string, id: string): Promise<Entry> {
  return apiClient.post(`/${singularName}/${id}/actions/unpublish`, {});
}

export async function setContentTypeListColumns(id: string, columns: string[]): Promise<ContentTypeSchema> {
  return apiClient.patch(`/content-builder/content-types/${id}/list-columns`, { columns });
}
