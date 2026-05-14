export function normalizeArticleMetricsPath(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  let raw = value.trim();
  if (!raw) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(raw)) {
      raw = new URL(raw).pathname;
    }
  } catch {
    // Fall back to the raw value when the input is already a path-like string.
  }

  raw = raw.split('?')[0].split('#')[0];
  raw = raw.replace(/^\/+|\/+$/g, '');
  raw = raw.replace(/\/amp$/i, '');

  return raw || null;
}

export function buildArticleMetricMatchKeys(article: {
  fullSlug?: string | null;
  slug?: string | null;
}): string[] {
  return Array.from(
    new Set(
      [article.fullSlug, article.slug]
        .map((value) => normalizeArticleMetricsPath(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}
