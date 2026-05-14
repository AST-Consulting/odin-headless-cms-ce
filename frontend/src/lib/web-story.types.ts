import { AuthorStub, FeaturedMedia } from "./types";

export type ElementType = "text" | "image" | "video" | "shape";

export interface ElementAnimation {
  type: "none" | "fade-in" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "zoom-in" | "zoom-out" | "rotate-in" | "bounce-in" | "bounce" | "rotate" | "flip-3d" | "flip-x" | "flip-y";
  duration: number; // in seconds
  delay: number; // in seconds
  previewTrigger?: number;
}

export interface StoryElement {
  id: string;
  type: ElementType;
  content: string; // Text string or Media URL
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage 0-100
  height: number; // Percentage 0-100
  rotation: number; // degrees 0-360
  opacity: number; // 0-1
  zIndex: number;
  style: {
    color?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: "left" | "center" | "right";
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
    fontFamily?: string;
    fontStyle?: string;
    textDecoration?: string;
    lineHeight?: number;
    letterSpacing?: number;
    boxShadow?: string;
    flipX?: boolean;
    flipY?: boolean;
  };
  animation: ElementAnimation;
}

export interface StorySlide {
  id: string;
  background: {
    type: "image" | "video" | "color" | "gradient";
    content: string; // URL, static color, or gradient string
  };
  duration: number; // Auto-advance duration in seconds (default 7)
  elements: StoryElement[];
  cta?: {
    enabled: boolean;
    label: string;
    url: string;
    openInNewTab: boolean;
  };
  templateId?: string;
  templateData?: Record<string, string>;
}

export interface WebStoryData {
  slides: StorySlide[];
}

export interface WebStory {
  _id?: string;
  title: string;
  englishHeadline?: string;
  slug?: string;
  status: "draft" | "published" | "scheduled";
  lang: string;
  organizationId: string;
  propertyId: string;
  authors: AuthorStub[];
  featuredMedia?: FeaturedMedia;
  metaTitle?: string;
  metaDescription?: string;
  categories?: string[];
  tags?: string[];
  primaryCategory?: string;
  scheduledAt?: string;
  
  // The core content of the web story
  storyData: WebStoryData;
  
  createdAt?: string;
  updatedAt?: string;
}
