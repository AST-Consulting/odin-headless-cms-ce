import sanitizeHtml = require('sanitize-html');

const STRIP_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

export function sanitizeText(input: unknown): string {
  if (input == null) return '';
  const str = typeof input === 'string' ? input : String(input);
  if (!str) return '';
  return sanitizeHtml(str, STRIP_OPTIONS).trim();
}

const SAFE_URL_SCHEMES = new Set(['http:', 'https:']);

export function sanitizeUrl(input: unknown): string {
  if (input == null) return '';
  const str = typeof input === 'string' ? input.trim() : '';
  if (!str) return '';
  try {
    const url = new URL(str);
    return SAFE_URL_SCHEMES.has(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}
