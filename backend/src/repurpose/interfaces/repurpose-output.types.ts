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

export type RepurposeOutputKey = keyof RepurposedArticle;

export type ImageBearingFormat =
  | 'webStory'
  | 'instagramCarousel'
  | 'whatsapp'
  | 'twitterHero';

export type ImageSource = 'generated' | 'featured';

export interface RepurposeMeta {
  featuredImageUrl?: string;
  previewUrl?: string;
}
