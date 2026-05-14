import { useAuthStore } from "./auth";
import { useOrganizationStore, usePropertyStore } from "./store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface SlotImage {
  imageUrl: string;
  imageId: string;
  generatedAt: string;
}

export interface WebStorySlide {
  title: string;
  body: string;
  imagePrompt: string;
  image?: SlotImage;
}

export interface InstagramCard {
  title: string;
  body: string;
  visualSuggestion: string;
  image?: SlotImage;
}

export interface WhatsappCard {
  text: string;
  imagePrompt?: string;
  previewLink?: string;
  previewTitle?: string;
  previewDescription?: string;
  image?: SlotImage;
}

export interface PushNotificationVariant {
  label: string;
  headline: string;
  body: string;
}

export interface TwitterTweet {
  index: number;
  text: string;
  imagePrompt?: string;
  image?: SlotImage;
}

export interface RepurposedArticle {
  webStory: WebStorySlide[];
  instagramCarousel: InstagramCard[];
  whatsappCard: WhatsappCard;
  pushNotifications: PushNotificationVariant[];
  newsletter: {
    subject: string;
    preview: string;
    body: string;
  };
  twitterThread: TwitterTweet[];
}

export type RepurposeFormat =
  | "webStory"
  | "instagramCarousel"
  | "whatsappCard"
  | "pushNotifications"
  | "newsletter"
  | "twitterThread";

export type ImageBearingFormat =
  | "webStory"
  | "instagramCarousel"
  | "whatsapp"
  | "twitterHero";

export type ImageSource = "generated" | "featured";

export interface RepurposeMeta {
  featuredImageUrl?: string;
  previewUrl?: string;
}

export interface RepurposeJobSummary {
  jobId: string;
  articleId: string;
  articleTitle?: string;
  language?: string;
  generatedAt: string;
  formatsCount: number;
}

export interface RepurposeJobsResponse {
  data: RepurposeJobSummary[];
  total: number;
  page: number;
  limit: number;
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  if (typeof window === "undefined") return { ...extra };
  const { token } = useAuthStore.getState();
  const { selectedOrganization } = useOrganizationStore.getState();
  const { selectedProperty } = usePropertyStore.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (selectedOrganization?._id)
    headers["x-organization-id"] = selectedOrganization._id;
  if (selectedProperty?._id) headers["x-property-id"] = selectedProperty._id;
  return headers;
}

async function request<T>(input: RequestInfo, init: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Request failed: ${response.status}`
    );
  }
  return response.json();
}

export async function repurposeArticle(
  articleId: string,
  options: {
    forceRegenerate?: boolean;
    formats?: RepurposeFormat[];
    config?: {
      instaSlideCount?: number;
      webStorySlideCount?: number;
      mirrorInstaToWebstory?: boolean;
    };
  } = {}
): Promise<{
  jobId: string;
  articleId: string;
  outputs: RepurposedArticle;
  meta: RepurposeMeta;
  config?: any;
  cached: boolean;
}> {
  return request(`${API_BASE}/repurpose/article/${articleId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      forceRegenerate: options.forceRegenerate,
      formats: options.formats,
      config: options.config,
    }),
  });
}

export async function regenerateRepurposeFormat(
  articleId: string,
  format: RepurposeFormat,
  config?: any
): Promise<{
  jobId: string;
  articleId: string;
  outputs: RepurposedArticle;
  meta: RepurposeMeta;
  config?: any;
}> {
  return request(`${API_BASE}/repurpose/article/${articleId}/regenerate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ format, config }),
  });
}

export async function getLatestRepurpose(
  articleId: string
): Promise<{
  jobId: string;
  articleId: string;
  outputs: RepurposedArticle;
  meta: RepurposeMeta;
  config?: any;
  generatedAt: string;
  isStale: boolean;
} | null> {
  const response = await fetch(
    `${API_BASE}/repurpose/article/${articleId}/latest`,
    {
      headers: authHeaders(),
      cache: "no-store",
    }
  );
  if (!response.ok) {
    if (response.status === 404) return null;
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Request failed: ${response.status}`
    );
  }
  const text = await response.text();
  if (!text || text === "null") return null;
  return JSON.parse(text);
}

export async function generateSlotImage(
  jobId: string,
  format: ImageBearingFormat,
  index: number,
  source: ImageSource = "generated"
): Promise<{
  jobId: string;
  image: SlotImage;
  outputs: RepurposedArticle;
  meta: RepurposeMeta;
}> {
  return request(`${API_BASE}/repurpose/jobs/${jobId}/image`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ format, index, source }),
    cache: "no-store",
  });
}

export async function updateRepurposeOutputs(
  jobId: string,
  outputs: RepurposedArticle
): Promise<{ jobId: string; outputs: RepurposedArticle }> {
  return request(`${API_BASE}/repurpose/jobs/${jobId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ outputs }),
  });
}

export async function listRepurposeJobs(
  page = 1,
  limit = 20
): Promise<RepurposeJobsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return request(`${API_BASE}/repurpose/jobs?${params.toString()}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
}

export async function shareToTwitter(
  jobId: string
): Promise<{ success: boolean; tweetUrl: string }> {
  return request(`${API_BASE}/repurpose/jobs/${jobId}/share/twitter`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function shareSingleTweetToTwitter(
  jobId: string,
  index: number
): Promise<{ success: boolean; tweetUrl: string }> {
  return request(`${API_BASE}/repurpose/jobs/${jobId}/share/twitter/${index}`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function shareRawTwitter(
  text: string,
  propertyId: string
): Promise<{ success: boolean; tweetUrl: string }> {
  return request(`${API_BASE}/repurpose/share/twitter/raw`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ text, propertyId }),
  });
}

export async function shareCarouselToInstagram(
  jobId: string
): Promise<{ success: boolean; postId: string }> {
  return request(`${API_BASE}/repurpose/jobs/${jobId}/share/instagram/carousel`, {
    method: "POST",
    headers: authHeaders(),
  });
}
