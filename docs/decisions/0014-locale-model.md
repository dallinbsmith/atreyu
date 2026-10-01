# 0014. Locale model: path prefix, one document per locale

**Status:** Accepted.

## Decision

- Ten region-qualified locales, matching the current site: `en-us` (default, no prefix), `de-de`, `es-es`, `fr-fr`, `it-it`, `ja-jp`, `ko-kr`, `pt-br`, `ru-ru`, `zh-cn`. No bare-language codes.
- The locale is the first path segment (`/ja-jp/blog/x`). English has no prefix.
- Each locale page is its own DA document, so content can differ per locale.
- Shared fragments (header, footer, others) resolve per locale, falling back to English through `localeCandidates` in `scripts/utils/fragment.js`.

## Consequences

- The locale list is defined once and checked by a lint rule (`config-drift`); see [architecture/locale.md](../architecture/locale.md).
- A missing locale page is a 404, not English content at a locale URL ([0015](0015-locale-cutover-cells.md)).
