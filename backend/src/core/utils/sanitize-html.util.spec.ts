import { sanitizeMinimalHtml } from './sanitize-html.util';

describe('sanitizeMinimalHtml', () => {
  describe('nullish & non-string inputs', () => {
    it('returns undefined for undefined', () => {
      expect(sanitizeMinimalHtml(undefined)).toBeUndefined();
    });

    it('returns undefined for null', () => {
      expect(sanitizeMinimalHtml(null)).toBeUndefined();
    });

    it('returns undefined for non-string values', () => {
      expect(sanitizeMinimalHtml(42 as unknown as string)).toBeUndefined();
      expect(sanitizeMinimalHtml({} as unknown as string)).toBeUndefined();
    });

    it('returns empty string for whitespace-only input', () => {
      expect(sanitizeMinimalHtml('   ')).toBe('');
      expect(sanitizeMinimalHtml('\n\t')).toBe('');
    });

    it('returns empty string for empty input', () => {
      expect(sanitizeMinimalHtml('')).toBe('');
    });
  });

  describe('safe formatting tags', () => {
    it('allows paragraphs, headings, lists, and inline formatting', () => {
      const html =
        '<p>Hello <strong>world</strong> and <em>friends</em></p>' +
        '<h1>H1</h1><h2>H2</h2><h3>H3</h3>' +
        '<ul><li>one</li><li>two</li></ul>' +
        '<ol><li>three</li></ol>' +
        '<blockquote>quoted</blockquote>' +
        '<code>inline-code</code>' +
        '<pre>block code</pre>' +
        '<u>underline</u><s>strike</s>';
      const out = sanitizeMinimalHtml(html);
      expect(out).toContain('<p>Hello <strong>world</strong> and <em>friends</em></p>');
      expect(out).toContain('<h1>H1</h1>');
      expect(out).toContain('<h2>H2</h2>');
      expect(out).toContain('<h3>H3</h3>');
      expect(out).toContain('<ul><li>one</li><li>two</li></ul>');
      expect(out).toContain('<ol><li>three</li></ol>');
      expect(out).toContain('<blockquote>quoted</blockquote>');
      expect(out).toContain('<code>inline-code</code>');
      expect(out).toContain('<pre>block code</pre>');
      expect(out).toContain('<u>underline</u>');
      expect(out).toContain('<s>strike</s>');
    });

    it('preserves the class attribute via the wildcard rule', () => {
      const out = sanitizeMinimalHtml('<p class="lead">hello</p>');
      expect(out).toBe('<p class="lead">hello</p>');
    });
  });

  describe('XSS protection', () => {
    it('strips <script> tags entirely', () => {
      const out = sanitizeMinimalHtml('<p>safe</p><script>alert(1)</script>');
      expect(out).toBe('<p>safe</p>');
      expect(out).not.toContain('<script');
      expect(out).not.toContain('alert');
    });

    it('strips <iframe> and <object>', () => {
      const out = sanitizeMinimalHtml(
        '<iframe src="https://evil.example"></iframe><object></object>',
      );
      expect(out).not.toContain('<iframe');
      expect(out).not.toContain('<object');
    });

    it('strips <style> blocks', () => {
      const out = sanitizeMinimalHtml('<style>body{display:none}</style><p>hi</p>');
      expect(out).not.toContain('<style');
      expect(out).toContain('<p>hi</p>');
    });

    it('strips inline event handlers', () => {
      const out = sanitizeMinimalHtml('<p onclick="alert(1)">hi</p>');
      expect(out).toBe('<p>hi</p>');
      expect(out).not.toContain('onclick');
    });

    it('strips inline style attributes', () => {
      const out = sanitizeMinimalHtml('<p style="color:red">hi</p>');
      expect(out).toBe('<p>hi</p>');
      expect(out).not.toContain('style');
    });
  });

  describe('anchors', () => {
    it('allows http/https/mailto/tel and adds rel="noopener noreferrer"', () => {
      const cases = [
        '<a href="https://example.com">x</a>',
        '<a href="http://example.com">x</a>',
        '<a href="mailto:u@example.com">x</a>',
        '<a href="tel:+15555550100">x</a>',
      ];
      for (const html of cases) {
        const out = sanitizeMinimalHtml(html);
        expect(out).toContain('href=');
        expect(out).toContain('rel="noopener noreferrer"');
      }
    });

    it('strips javascript: hrefs', () => {
      const out = sanitizeMinimalHtml('<a href="javascript:alert(1)">click</a>');
      expect(out).not.toContain('javascript:');
      expect(out).not.toContain('alert');
    });

    it('strips data: hrefs on anchors (data scheme is only allowed on img)', () => {
      const out = sanitizeMinimalHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
      expect(out).not.toContain('data:');
    });
  });

  describe('images', () => {
    it('allows http/https/data on <img src> and keeps safe attributes', () => {
      const html =
        '<img src="https://cdn.example/x.jpg" alt="alt" title="t" width="300" height="200" class="wp-image-1" />';
      const out = sanitizeMinimalHtml(html);
      expect(out).toContain('src="https://cdn.example/x.jpg"');
      expect(out).toContain('alt="alt"');
      expect(out).toContain('title="t"');
      expect(out).toContain('width="300"');
      expect(out).toContain('height="200"');
      expect(out).toContain('class="wp-image-1"');
    });

    it('strips javascript: src on <img>', () => {
      const out = sanitizeMinimalHtml('<img src="javascript:alert(1)" />');
      expect(out).not.toContain('javascript:');
      expect(out).not.toContain('alert');
    });

    it('strips dangerous attributes on <img> (onerror)', () => {
      const out = sanitizeMinimalHtml(
        '<img src="https://cdn.example/x.jpg" onerror="alert(1)" />',
      );
      expect(out).toContain('src="https://cdn.example/x.jpg"');
      expect(out).not.toContain('onerror');
      expect(out).not.toContain('alert');
    });

    it('round-trips real WordPress-imported markup unchanged in meaning', () => {
      const wp =
        '<img class="alignnone wp-image-3469714 size-medium" ' +
        'src="https://www.example.com/wp-content/uploads/2025/05/170.-Hisua-300x200.jpg" ' +
        'alt="हिसुआ विधानसभा चुनाव" width="300" height="200" />';
      const out = sanitizeMinimalHtml(wp) ?? '';
      expect(out).toContain('src="https://www.example.com/wp-content/uploads/2025/05/170.-Hisua-300x200.jpg"');
      expect(out).toContain('class="alignnone wp-image-3469714 size-medium"');
      expect(out).toContain('width="300"');
      expect(out).toContain('height="200"');
      expect(out).toContain('alt="हिसुआ विधानसभा चुनाव"');
    });
  });

  describe('span', () => {
    it('preserves <span> with class', () => {
      const out = sanitizeMinimalHtml('<p>hello <span class="hl">world</span></p>');
      expect(out).toBe('<p>hello <span class="hl">world</span></p>');
    });

    it('strips disallowed attrs on span (keeps class)', () => {
      const out = sanitizeMinimalHtml(
        '<span class="hl" onclick="alert(1)" style="color:red">x</span>',
      );
      expect(out).toContain('<span class="hl">x</span>');
      expect(out).not.toContain('onclick');
      expect(out).not.toContain('style');
    });
  });

  describe('list & figure structures', () => {
    it('preserves figure/figcaption around an image', () => {
      const html =
        '<figure class="wp-caption">' +
        '<img src="https://cdn.example/x.jpg" alt="x" />' +
        '<figcaption>caption</figcaption>' +
        '</figure>';
      const out = sanitizeMinimalHtml(html);
      expect(out).toContain('<figure class="wp-caption">');
      expect(out).toContain('<figcaption>caption</figcaption>');
      expect(out).toContain('src="https://cdn.example/x.jpg"');
    });
  });

  describe('plain text inputs (legacy data)', () => {
    it('passes plain text through unchanged', () => {
      expect(sanitizeMinimalHtml('Hello world')).toBe('Hello world');
    });

    it('escapes raw angle-brackets in non-tag text', () => {
      // sanitize-html drops malformed unknown tags like <foo>
      const out = sanitizeMinimalHtml('a < b and c > d');
      expect(out).not.toContain('<b'); // no fake tags
    });
  });
});
