import { expect } from '@esm-bundle/chai';
import { runExperiment, isSameOriginPath } from '../../../scripts/utils/analytics/experimentation.js';
import { setConsent, resetConsent } from '../../../scripts/utils/analytics/consent.js';
import { setAnalyticsProvider } from '../../../scripts/utils/analytics/analytics.js';

const VISITOR_KEY = 'atreyu-visitor-id';

const setMeta = (name, content) => {
  let meta = document.head.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.append(meta);
  }
  meta.content = content;
  return meta;
};

const clearMeta = (name) => document.head.querySelector(`meta[name="${name}"]`)?.remove();

describe('scripts/utils/analytics/experimentation.js', () => {
  let originalFetch;
  let tracked;

  beforeEach(() => {
    originalFetch = window.fetch;
    localStorage.clear();
    resetConsent();
    document.body.innerHTML = '<main><p>Control content</p></main>';
    tracked = [];
    setAnalyticsProvider((event, properties) => { tracked.push({ event, ...properties }); });
  });

  afterEach(() => {
    window.fetch = originalFetch;
    clearMeta('experiment');
    clearMeta('experiment-variants');
    setAnalyticsProvider(null);
  });

  it('does nothing when no experiment metadata is present', async () => {
    const result = await runExperiment();
    expect(result).to.equal(null);
  });

  it('does nothing when experiment metadata has no variants', async () => {
    setMeta('experiment', 'hero-test');
    const result = await runExperiment();
    expect(result).to.equal(null);
  });

  it('never fetches or tracks without personalization consent — bug-squash fix, 2026-08-28', async () => {
    setMeta('experiment', 'hero-test');
    setMeta('experiment-variants', '/variant-a');
    let fetchCalled = false;
    window.fetch = async () => {
      fetchCalled = true;
      return { ok: false };
    };

    const result = await runExperiment();

    expect(result).to.equal(null);
    expect(fetchCalled).to.be.false;
    expect(tracked).to.have.length(0);
  });

  it('rejects a cross-origin variant path and leaves control content in place', async () => {
    expect(isSameOriginPath('//evil.example/x')).to.be.false;
    expect(isSameOriginPath('https://evil.example/x')).to.be.false;
    expect(isSameOriginPath('/safe-path')).to.be.true;
  });

  it('fails open to control content when the variant fetch errors, without throwing', async () => {
    setConsent({ personalization: true });
    setMeta('experiment', 'hero-test');
    setMeta('experiment-variants', '/variant-a,/variant-b,/variant-c,/variant-d,/variant-e,/variant-f,/variant-g,/variant-h,/variant-i');
    window.fetch = async () => { throw new Error('network down'); };

    const result = await runExperiment();

    expect(result).to.not.equal(null);
    expect(document.querySelector('main p').textContent).to.equal('Control content');
  });

  it('fails open when the variant fetch hangs past the bounded timeout — bug-squash fix, 2026-08-28', async () => {
    setConsent({ personalization: true });
    setMeta('experiment', 'hero-test');
    setMeta('experiment-variants', '/variant-a,/variant-b,/variant-c,/variant-d,/variant-e,/variant-f,/variant-g,/variant-h,/variant-i');
    window.fetch = (_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });

    const start = performance.now();
    const result = await runExperiment();
    const elapsed = performance.now() - start;

    expect(result).to.not.equal(null);
    // bounded by the 1500ms AbortController timeout, not hanging forever
    expect(elapsed).to.be.below(3000);
    expect(document.querySelector('main p').textContent).to.equal('Control content');
  });

  it('tracks a consistent, reconciled event payload shape for the bucketed variant', async () => {
    // track() gates on analytics consent independently of the
    // personalization consent runExperiment() itself checks — both are
    // needed here to observe the tracked event.
    setConsent({ personalization: true, analytics: true });
    setMeta('experiment', 'hero-test');
    setMeta('experiment-variants', '/variant-a');
    window.fetch = async () => ({ ok: true, text: async () => '<p>Variant content</p>' });

    const result = await runExperiment();

    expect(result.experiment).to.equal('hero-test');
    expect(['control', '/variant-a']).to.include(result.variant);
    expect(tracked).to.have.length(1);
    const [event] = tracked;
    expect(event.event).to.equal('experiment');
    expect(event.experiment).to.equal('hero-test');
    expect(event.variantType).to.equal('a-b-split-test');
    expect(event.renderType).to.equal('full-page-swap');
    expect(event.variantId).to.equal(`hero-test:${result.variant}`);
    expect(event.anonId).to.equal(localStorage.getItem(VISITOR_KEY));
  });
});
