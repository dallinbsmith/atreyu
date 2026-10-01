// Assembles a full DA-importable page from a fetched Sanity `page` document.
// Output shape matches a real authored page exactly (confirmed against
// artifacts/mcp-snapshots/da/pages/features-c2c.html): `<body><header></header>
// <main>{one <div> per section}</main><footer></footer></body>`, no Library
// Metadata table (that's a Library-doc-only convention, not a real page's).
import { transformModule } from './transform/index.js';
import { resolveVariantKeys } from './transform/variant-keys.js';

export const renderPage = (page, { resolvedRefs = new Map() } = {}) => {
  const warnings = [];
  const sectionsHtml = (page.sections ?? []).map((section) => {
    const modulesHtml = (section.modules ?? []).map((module) => {
      const blockHtml = transformModule(module, { warnings, resolvedRefs });
      const { dropped, metadataHtml } = resolveVariantKeys(module);
      if (dropped.length) {
        warnings.push(`Dropped variantKeys [${dropped.join(', ')}] on ${module._type} "${module._key}" (per D2, base content only, no locale-baked segment).`);
      }
      return blockHtml + metadataHtml;
    });
    return `<div>${modulesHtml.join('')}</div>`;
  });
  const html = `<body>\n  <header></header>\n  <main>${sectionsHtml.join('')}</main>\n  <footer></footer>\n</body>`;
  return { html, warnings };
};
