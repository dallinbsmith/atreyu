import { expect } from '@esm-bundle/chai';

// Set query param before importing scripts module. A bare flag (no value) is
// enough to trigger scripts.js's hasPreview check via searchParams.has(); a
// truthy-but-unreal value like "true" would instead pass da.js's own ref
// check and chain into a real dynamic import against a made-up preview
// origin (https://true--da-live--adobe.aem.live/...), which fails as an
// unhandled rejection outside any test. An empty value keeps hasPreview true
// while da.js's `if (!ref) return;` guard skips that fetch entirely.
const originalUrl = window.location.href;
window.history.pushState({}, '', '?dapreview');

// Now import - module will see the dapreview param
await import('../../scripts/scripts.js');

describe('dapreview', () => {
  after(() => {
    window.history.pushState({}, '', originalUrl);
  });

  it('should detect dapreview query parameter', () => {
    const url = new URL(window.location.href);
    expect(url.searchParams.has('dapreview')).to.be.true;
  });

  it('should load da.js module', async () => {
    // Wait for dynamic import to complete
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const resources = performance.getEntriesByType('resource');
    const daLoaded = resources.some((r) => r.name.includes('scripts/da/da.js'));
    expect(daLoaded).to.be.true;
  });
});
