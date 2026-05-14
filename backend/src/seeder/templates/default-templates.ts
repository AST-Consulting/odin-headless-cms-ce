export const defaultTemplates = [
  {
    name: 'Standard Article',
    description: 'Default template for standard news articles',
    structure: {
      blocks: [
        { type: 'headline', required: true },
        { type: 'byline', required: true },
        { type: 'image', required: false },
        { type: 'body', required: true },
      ],
    },
    isSystemTemplate: true,
  },
  {
    name: 'Breaking News',
    description: 'Template for breaking news stories',
    structure: {
      blocks: [
        { type: 'headline', required: true },
        { type: 'breaking_tag', required: true },
        { type: 'byline', required: true },
        { type: 'summary', required: true },
        { type: 'body', required: true },
      ],
    },
    isSystemTemplate: true,
  },
  {
    name: 'Feature Story',
    description: 'Template for long-form feature articles',
    structure: {
      blocks: [
        { type: 'headline', required: true },
        { type: 'subtitle', required: false },
        { type: 'byline', required: true },
        { type: 'hero_image', required: true },
        { type: 'intro', required: true },
        { type: 'body', required: true },
        { type: 'pullquote', required: false },
      ],
    },
    isSystemTemplate: true,
  },
];
