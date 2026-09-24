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
const { loadPage } = await import('../../scripts/scripts.js');

describe('dapreview', () => {
  after(() => {
    window.history.pushState({}, '', originalUrl);
  });

  it('should detect dapreview query parameter', () => {
    const url = new URL(window.location.href);
    expect(url.searchParams.has('dapreview')).to.be.true;
  });

  it('re-running loadPage (dapreview re-decoration) compiles a Personalize table idempotently', async () => {
    // End Date is YYYY-MM-DD only; 30 days out stays within the 180-day cap.
    const soon = ((d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()]
      .map((n) => `${n}`.padStart(2, '0')).join('-'))(new Date(Date.now() + 30 * 864e5));
    const raw = `<div>
      <p id="pzn-control">Control</p>
      <div class="personalize">
        <div><div>Audience: mobile</div><div><a href="/v/p/home/mobile">/v/p/home/mobile</a></div></div>
        <div><div>End Date</div><div>${soon}</div></div>
      </div>
    </div>`;
    const main = document.querySelector('main') ?? document.body.appendChild(document.createElement('main'));
    const snapshot = () => {
      const section = document.querySelector('#pzn-control').closest('main > div');
      return { personalize: document.querySelectorAll('.personalize').length, data: { ...section.dataset } };
    };
    main.innerHTML = raw;
    await loadPage();
    const first = snapshot();
    expect(first.personalize).to.equal(0);
    expect(first.data.audienceMobile).to.equal('/v/p/home/mobile');

    // Re-run over the already-decorated DOM, then over a fresh re-render.
    await loadPage();
    expect(snapshot()).to.deep.equal(first);
    main.innerHTML = raw;
    await loadPage();
    expect(snapshot()).to.deep.equal(first);
  });

  it('should load da.js module', async () => {
    // Wait for dynamic import to complete
    await new Promise((resolve) => { setTimeout(resolve, 100); });

    const resources = performance.getEntriesByType('resource');
    const daLoaded = resources.some((r) => r.name.includes('scripts/da/da.js'));
    expect(daLoaded).to.be.true;
  });
});
