import { BadRequestException } from '@nestjs/common';
import {
  ImageBearingFormat,
  RepurposedArticle,
  SlotImage,
} from '../interfaces/repurpose-output.types';

export interface ResolvedSlot {
  title: string;
  promptSeed: string;
  aspectRatio: '9:16' | '4:5' | '16:9';
}

export function resolveImageSlot(
  outputs: RepurposedArticle,
  format: ImageBearingFormat,
  index: number,
): ResolvedSlot {
  if (format === 'webStory') {
    const slots = outputs.webStory;
    if (!Array.isArray(slots) || index < 0 || index >= slots.length) {
      throw new BadRequestException(
        `Invalid index ${index} for webStory (length=${slots?.length ?? 0})`,
      );
    }
    const slot = slots[index];
    if (!slot.imagePrompt || slot.imagePrompt.trim().length < 5) {
      throw new BadRequestException(
        `webStory slide ${index + 1} has no usable image prompt.`,
      );
    }
    return {
      title: slot.title || `Web story slide ${index + 1}`,
      promptSeed: slot.imagePrompt,
      aspectRatio: '9:16',
    };
  }

  if (format === 'instagramCarousel') {
    const slots = outputs.instagramCarousel;
    if (!Array.isArray(slots) || index < 0 || index >= slots.length) {
      throw new BadRequestException(
        `Invalid index ${index} for instagramCarousel (length=${slots?.length ?? 0})`,
      );
    }
    const slot = slots[index];
    if (!slot.visualSuggestion || slot.visualSuggestion.trim().length < 5) {
      throw new BadRequestException(
        `instagramCarousel card ${index + 1} has no usable visual suggestion.`,
      );
    }
    return {
      title: slot.title || `Instagram card ${index + 1}`,
      promptSeed: slot.visualSuggestion,
      aspectRatio: '4:5',
    };
  }

  if (format === 'whatsapp') {
    if (index !== 0) {
      throw new BadRequestException('whatsapp only supports index 0');
    }
    const card = outputs.whatsappCard;
    if (!card || !card.imagePrompt || card.imagePrompt.trim().length < 5) {
      throw new BadRequestException(
        'WhatsApp card has no usable image prompt.',
      );
    }
    return {
      title: card.previewTitle || 'WhatsApp channel preview',
      promptSeed: card.imagePrompt,
      aspectRatio: '16:9',
    };
  }

  if (format === 'twitterHero') {
    if (index !== 0) {
      throw new BadRequestException('twitterHero only supports index 0');
    }
    const tweets = outputs.twitterThread;
    if (!Array.isArray(tweets) || tweets.length === 0) {
      throw new BadRequestException('Twitter thread has no tweets.');
    }
    const lead = tweets[0];
    if (!lead.imagePrompt || lead.imagePrompt.trim().length < 5) {
      throw new BadRequestException('Lead tweet has no usable image prompt.');
    }
    return {
      title: 'Lead tweet hero',
      promptSeed: lead.imagePrompt,
      aspectRatio: '16:9',
    };
  }

  throw new BadRequestException(`Unsupported image-bearing format: ${format}`);
}

export function attachImageToSlot(
  outputs: RepurposedArticle,
  format: ImageBearingFormat,
  index: number,
  image: SlotImage,
  config?: { mirrorInstaToWebstory?: boolean },
): RepurposedArticle {
  if (format === 'webStory') {
    const slots = [...(outputs.webStory || [])];
    if (slots[index]) {
      slots[index] = { ...slots[index], image };
      outputs.webStory = slots;
    }

    if (
      config?.mirrorInstaToWebstory &&
      Array.isArray(outputs.instagramCarousel) &&
      outputs.instagramCarousel[index]
    ) {
      const instaSlots = [...outputs.instagramCarousel];
      instaSlots[index] = { ...instaSlots[index], image };
      outputs.instagramCarousel = instaSlots;
    }
    return outputs;
  }

  if (format === 'instagramCarousel') {
    const slots = [...(outputs.instagramCarousel || [])];
    if (slots[index]) {
      slots[index] = { ...slots[index], image };
      outputs.instagramCarousel = slots;
    }

    if (
      config?.mirrorInstaToWebstory &&
      Array.isArray(outputs.webStory) &&
      outputs.webStory[index]
    ) {
      const webSlots = [...outputs.webStory];
      webSlots[index] = { ...webSlots[index], image };
      outputs.webStory = webSlots;
    }
    return outputs;
  }

  if (format === 'whatsapp') {
    outputs.whatsappCard = { ...outputs.whatsappCard, image };
    return outputs;
  }
  if (format === 'twitterHero') {
    const tweets = [...(outputs.twitterThread || [])];
    if (tweets[0]) {
      tweets[0] = { ...tweets[0], image };
      outputs.twitterThread = tweets;
    }
    return outputs;
  }
  return outputs;
}
