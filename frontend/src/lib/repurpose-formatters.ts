import type {
  InstagramCard,
  PushNotificationVariant,
  TwitterTweet,
  WebStorySlide,
  WhatsappCard,
} from "./repurpose-api";

export function formatWebStory(slides: WebStorySlide[]): string {
  return slides
    .map(
      (s, i) =>
        `Slide ${i + 1}: ${s.title}\n${s.body}\n[Image: ${s.imagePrompt}]${s.image ? `\nImage URL: ${s.image.imageUrl}` : ""}`
    )
    .join("\n\n");
}

export function formatInstagram(cards: InstagramCard[]): string {
  return cards
    .map(
      (c, i) =>
        `Card ${i + 1}: ${c.title}\n${c.body}\n[Visual: ${c.visualSuggestion}]${c.image ? `\nImage URL: ${c.image.imageUrl}` : ""}`
    )
    .join("\n\n");
}

export function formatPush(variants: PushNotificationVariant[]): string {
  return variants
    .map((v) => `[${v.label}]\n${v.headline}\n${v.body}`)
    .join("\n\n");
}

export function formatWhatsapp(card: WhatsappCard | undefined): string {
  if (!card) return "";

  const lines: string[] = [];

  // 1. Title (Bold)
  if (card.previewTitle) {
    lines.push(`*${card.previewTitle.trim()}*`);
    lines.push("");
  }

  // 2. Main Content (Cleaned)
  let cleanText = card.text || "";
  cleanText = cleanText
    .replace(/Read more\s*$/i, "")
    .replace(/अधिक जानकारी के लिए पढ़ें!?\s*$/i, "")
    .trim();

  if (cleanText) {
    lines.push(cleanText);
  }

  // 3. Preview Description (Italic)
  if (card.previewDescription) {
    lines.push("");
    lines.push(`_${card.previewDescription.trim()}_`);
  }

  // 4. Article Link
  if (card.previewLink) {
    lines.push("");
    lines.push(`पूरा लेख यहाँ पढ़ें: ${card.previewLink}`);
  }

  // 5. Image URL
  if (card.image?.imageUrl) {
    lines.push("");
    lines.push(`फोटो: ${card.image.imageUrl}`);
  }

  return lines.join("\n");
}

export function formatNewsletter(n: {
  subject: string;
  preview: string;
  body: string;
}): string {
  return `Subject: ${n.subject}\nPreview: ${n.preview}\n\n${n.body}`;
}

export function formatTwitterThread(tweets: TwitterTweet[]): string {
  return tweets
    .map((t) => {
      const lines = [`${t.index}/ ${t.text}`];
      if (t.image) lines.push(`[Image: ${t.image.imageUrl}]`);
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Plain-text variants for the AI Assistant quick-copy flow
 */
export function formatWhatsappForCopy(card: WhatsappCard | undefined): string {
  return formatWhatsapp(card);
}

export function formatTwitterThreadForCopy(tweets: TwitterTweet[]): string {
  return tweets.map((t) => t.text).join("\n\n");
}

export function formatInstagramCardForCopy(card: InstagramCard): string {
  return `${card.title}\n\n${card.body}`;
}
