import { sanitizeText, sanitizeUrl } from './sanitize-text';

describe('sanitizeText', () => {
  it('returns empty string for nullish or non-string-like input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText('')).toBe('');
  });

  it('passes plain text through unchanged (after trim)', () => {
    expect(sanitizeText('Breaking news today')).toBe('Breaking news today');
    expect(sanitizeText('  spaced  ')).toBe('spaced');
  });

  it('strips script tags and their contents', () => {
    expect(sanitizeText('hi <script>alert(1)</script> there')).toBe('hi  there');
  });

  it('strips img tags including event handlers', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('strips anchor tags but preserves visible text', () => {
    expect(sanitizeText('click <a href="javascript:alert(1)">here</a>')).toBe(
      'click here',
    );
  });

  it('strips iframe and object tags entirely', () => {
    expect(sanitizeText('<iframe src="evil"></iframe>safe')).toBe('safe');
    expect(sanitizeText('<object data="evil"></object>safe')).toBe('safe');
  });

  it('coerces non-string inputs via String()', () => {
    expect(sanitizeText(42)).toBe('42');
    expect(sanitizeText(true)).toBe('true');
  });

  it('preserves emoji and unicode', () => {
    expect(sanitizeText('Hello 👋 भारत')).toBe('Hello 👋 भारत');
  });
});

describe('sanitizeUrl', () => {
  it('returns empty string for nullish, empty, or non-string input', () => {
    expect(sanitizeUrl(null)).toBe('');
    expect(sanitizeUrl(undefined)).toBe('');
    expect(sanitizeUrl('')).toBe('');
    expect(sanitizeUrl(123)).toBe('');
  });

  it('accepts http and https URLs', () => {
    expect(sanitizeUrl('http://example.com/x')).toBe('http://example.com/x');
    expect(sanitizeUrl('https://example.com/y?z=1')).toBe(
      'https://example.com/y?z=1',
    );
  });

  it('rejects javascript: and data: schemes', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('rejects malformed URLs', () => {
    expect(sanitizeUrl('not-a-url')).toBe('');
    expect(sanitizeUrl('//example.com')).toBe('');
  });

  it('trims whitespace before validation', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com/');
  });
});
