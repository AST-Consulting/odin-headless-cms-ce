interface ArticleSummary {
  title: string;
  excerpt?: string;
  body: string;
  language?: string;
  tags?: string[];
  categories?: string[];
}

const LANGUAGE_NAME_BY_CODE: Record<string, string> = {
  en: 'English',
  english: 'English',
  hi: 'Hindi',
  hindi: 'Hindi',
  bn: 'Bengali',
  bengali: 'Bengali',
  ta: 'Tamil',
  tamil: 'Tamil',
  te: 'Telugu',
  telugu: 'Telugu',
  mr: 'Marathi',
  marathi: 'Marathi',
  gu: 'Gujarati',
  gujarati: 'Gujarati',
  kn: 'Kannada',
  kannada: 'Kannada',
  ml: 'Malayalam',
  malayalam: 'Malayalam',
  pa: 'Punjabi',
  punjabi: 'Punjabi',
  ur: 'Urdu',
  urdu: 'Urdu',
};

function resolveOutputLanguage(language?: string): string {
  if (!language) return 'English';
  const key = language.trim().toLowerCase();
  return LANGUAGE_NAME_BY_CODE[key] || 'English';
}

const FORMAT_CONFIGS: Record<string, { schema: string; rules: string }> = {
  webStory: {
    schema: '"webStory": [ { "title": "<= 8 words, ALL CAPS hook", "body": "1-2 short sentences", "imagePrompt": "concise visual prompt" } ]',
    rules: "- webStory: Generate [COUNT] slides total, first slide must be a punchy hook, last slide must invite the reader to learn more."
  },
  instagramCarousel: {
    schema: '"instagramCarousel": [ { "title": "<= 6 words", "body": "<= 25 words", "visualSuggestion": "concrete imagery + composition" } ]',
    rules: "- instagramCarousel: exactly [COUNT] cards, first card is the hook, last card has the takeaway / call to action."
  },
  whatsappCard: {
    schema: '"whatsappCard": { "text": "WhatsApp channel post under 350 chars with 1-2 emojis, written like a newsroom update ending with a Read more line.", "imagePrompt": "16:9 news image prompt, no text overlay", "previewTitle": "<= 80 chars", "previewDescription": "<= 120 chars" }',
    rules: "- whatsappCard: imagePrompt describes a single strong news photo (no text in the image). previewTitle and previewDescription mirror a link preview."
  },
  pushNotifications: {
    schema: '"pushNotifications": [ { "label": "Neutral", "headline": "<= 60 chars", "body": "<= 90 chars" }, { "label": "Curiosity", "headline": "<= 60 chars", "body": "<= 90 chars" }, { "label": "Urgency", "headline": "<= 60 chars", "body": "<= 90 chars" } ]',
    rules: "- pushNotifications: exactly 3 variants labeled Neutral, Curiosity, and Urgency."
  },
  newsletter: {
    schema: '"newsletter": { "subject": "<= 60 chars", "preview": "<= 90 chars", "body": "90-120 words newsletter blurb" }',
    rules: "- newsletter: body ends with a call to read the full article."
  },
  twitterThread: {
    schema: '"twitterThread": [ { "index": 1, "text": "<= 270 chars hook tweet", "imagePrompt": "16:9 news image prompt, no text overlay" }, { "index": 2, "text": "<= 270 chars" } ]',
    rules: "- twitterThread: 4-6 tweets total. Only tweet 1 includes imagePrompt. Last tweet must end with a question or share invite."
  }
};

export function buildFullRepurposePrompt(
  article: ArticleSummary,
  formats?: string[],
  config?: { instaSlideCount?: number; webStorySlideCount?: number; mirrorInstaToWebstory?: boolean }
): string {
  const outputLanguage = resolveOutputLanguage(article.language);
  const selected = formats?.length ? formats : Object.keys(FORMAT_CONFIGS);

  const lines: string[] = [
    'You are a senior multi-platform editor at an Indian newsroom. Given an existing news article, repurpose it into the requested distribution formats.',
    '',
    'Output strict JSON, no commentary, matching exactly this shape:',
    '{',
  ];

  selected.forEach((fmt, i) => {
    const formatConfig = FORMAT_CONFIGS[fmt];
    if (formatConfig) {
      lines.push(`  ${formatConfig.schema}${i < selected.length - 1 ? ',' : ''}`);
    }
  });

  lines.push('}', '', 'Format rules:');
  selected.forEach((fmt) => {
    const formatConfig = FORMAT_CONFIGS[fmt];
    if (formatConfig) {
      let count = 5;
      if (fmt === 'instagramCarousel') count = config?.instaSlideCount || 5;
      if (fmt === 'webStory') count = config?.webStorySlideCount || 5;
      
      const rules = formatConfig.rules.replace('[COUNT]', String(count));
      lines.push(rules);
    }
  });

  lines.push(
    '- All copy must stay strictly faithful to facts present in the source article.',
    '- Image prompt fields (imagePrompt and visualSuggestion) must always be in English.',
    '- Keep tone publication-grade — no emoji spam.',
    '',
    `OUTPUT LANGUAGE: ${outputLanguage}. Every text field in the JSON MUST be written in ${outputLanguage}, except imagePrompt and visualSuggestion, which must be in English.`,
    '',
    `Title: ${article.title}`,
  );

  if (article.excerpt) lines.push(`Excerpt: ${article.excerpt}`);
  if (article.categories?.length) lines.push(`Categories: ${article.categories.join(', ')}`);
  if (article.tags?.length) lines.push(`Tags: ${article.tags.join(', ')}`);
  
  lines.push('', 'Body:', article.body);
  lines.push('', 'Return only the JSON object described above.');

  return lines.join('\n');
}

export function buildSingleFormatPrompt(
  format: string,
  article: ArticleSummary,
  config?: { instaSlideCount?: number; webStorySlideCount?: number; mirrorInstaToWebstory?: boolean }
): string {
  const formatConfig = FORMAT_CONFIGS[format];
  if (!formatConfig) {
    throw new Error(`Unknown repurpose format: ${format}`);
  }
  const outputLanguage = resolveOutputLanguage(article.language);
  
  let count = 5;
  if (format === 'instagramCarousel') count = config?.instaSlideCount || 5;
  if (format === 'webStory') count = config?.webStorySlideCount || 5;

  const lines: string[] = [
    'You are a senior multi-platform editor at an Indian newsroom. Repurpose the article below into the requested format only.',
    '',
    `Return JSON: { ${formatConfig.schema} }`,
    '',
    formatConfig.rules.replace('[COUNT]', String(count)),
    '',
    `OUTPUT LANGUAGE: ${outputLanguage}. Every text field MUST be written in ${outputLanguage}. Image prompts stay in English. Stay strictly faithful to facts in the source.`,
    '',
    `Title: ${article.title}`,
  ];
  if (article.excerpt) lines.push(`Excerpt: ${article.excerpt}`);
  lines.push('', 'Body:', article.body);
  lines.push('', 'Return only the JSON object described above.');
  return lines.join('\n');
}
