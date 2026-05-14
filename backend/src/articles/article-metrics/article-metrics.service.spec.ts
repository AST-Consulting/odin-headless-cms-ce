import {
  buildArticleMetricMatchKeys,
  normalizeArticleMetricsPath,
} from './article-metrics.utils';

describe('article-metrics helpers', () => {
  describe('normalizeArticleMetricsPath', () => {
    it('normalizes a full GSC URL into a path-only key', () => {
      expect(
        normalizeArticleMetricsPath(
          'https://example.com/entertainment/bhojpuri/story-slug/?utm_source=test',
        ),
      ).toBe('entertainment/bhojpuri/story-slug');
    });

    it('normalizes a CMS fullSlug and strips amp suffix', () => {
      expect(
        normalizeArticleMetricsPath('/entertainment/bhojpuri/story-slug/amp/'),
      ).toBe('entertainment/bhojpuri/story-slug');
    });
  });

  describe('buildArticleMetricMatchKeys', () => {
    it('prefers normalized fullSlug and slug without duplicates', () => {
      expect(
        buildArticleMetricMatchKeys({
          fullSlug: 'entertainment/bhojpuri/story-slug',
          slug: '/story-slug/',
        }),
      ).toEqual(['entertainment/bhojpuri/story-slug', 'story-slug']);
    });
  });
});
