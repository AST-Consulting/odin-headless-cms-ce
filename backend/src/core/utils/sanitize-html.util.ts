import sanitizeHtml = require('sanitize-html');

const MINIMAL_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'code',
  'pre',
  'img',
  'figure',
  'figcaption',
  'span',
];

const MINIMAL_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'class'],
  figure: ['class'],
  '*': ['class'],
};

const baseOptions: sanitizeHtml.IOptions = {
  allowedTags: MINIMAL_ALLOWED_TAGS,
  allowedAttributes: MINIMAL_ALLOWED_ATTRIBUTES,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

export function sanitizeMinimalHtml(input: string | undefined | null): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return '';
  return sanitizeHtml(trimmed, baseOptions);
}
