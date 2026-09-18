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

// experimentation.js reads window.location.search at module scope (the
// `experimentPreview` override) — same real constraint as pzn.js's `?segment=`
// override, tested there with the identical pattern (see pzn.test.js's
// `freshPzn`). history.replaceState changes the URL without a real
// navigation; a cache-busting query string on the import specifier gets a
// genuinely fresh module instance instead of the one statically imported above.
let importCounter = 0;
const freshExperimentation = async (search = '') => {
  history.replaceState(null, '', `${window.location.pathname}${search}`);
  importCounter += 1;
  return import(`../../../scripts/utils/analytics/experimentation.js?t=${importCounter}`);
};

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
    clearMeta('experiment-split');
    clearMeta('experiment-selector');
    setAnalyticsProvider(null);
    history.replaceState(null, '', window.location.pathname);
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

  describe('preview override (?experimentPreview=)', () => {
    it('forces the named variant, bypassing consent and skipping tracking', async () => {
      setMeta('experiment', 'hero-test');
      setMeta('experiment-variants', '/variant-a,/variant-b');
      window.fetch = async () => ({ ok: true, text: async () => '<p>Variant B content</p>' });

      const { runExperiment: freshRun } = await freshExperimentation('?experimentPreview=/variant-b');
      const result = await freshRun();

      expect(result.variant).to.equal('/variant-b');
      expect(document.querySelector('main p').textContent).to.equal('Variant B content');
      expect(tracked).to.have.length(0);
    });

    it('forces control when previewed explicitly, with no fetch', async () => {
      setMeta('experiment', 'hero-test');
      setMeta('experiment-variants', '/variant-a');
      let fetchCalled = false;
      window.fetch = async () => {
        fetchCalled = true;
        return { ok: true, text: async () => '<p>x</p>' };
      };

      const { runExperiment: freshRun } = await freshExperimentation('?experimentPreview=control');
      const result = await freshRun();

      expect(result.variant).to.equal('control');
      expect(fetchCalled).to.be.false;
    });

    it('falls back to normal bucketing when the previewed name matches no configured variant', async () => {
      setConsent({ personalization: true });
      setMeta('experiment', 'hero-test');
      setMeta('experiment-variants', '/variant-a');
      window.fetch = async () => ({ ok: false });

      const { runExperiment: freshRun } = await freshExperimentation('?experimentPreview=/not-a-real-variant');
      const result = await freshRun();

      expect(result).to.not.equal(null);
    });
  });

  describe('uneven split (experiment-split metadata)', () => {
    it('a 0% challenger weight always resolves to control, regardless of visitor hash', async () => {
      setConsent({ personalization: true });
      setMeta('experiment', 'hero-test');
      setMeta('experiment-variants', '/variant-a');
      setMeta('experiment-split', '0');
      let fetchCalled = false;
      window.fetch = async () => {
        fetchCalled = true;
        return { ok: true, text: async () => '<p>x</p>' };
      };

      const { runExperiment: freshRun } = await freshExperimentation();
      const result = await freshRun();

      expect(result.variant).to.equal('control');
      expect(fetchCalled).to.be.false;
    });

    it('ignores a malformed split (wrong item count) without throwing — falls back to an even split', async () => {
      setConsent({ personalization: true });
      setMeta('experiment', 'hero-test');
      setMeta('experiment-variants', '/variant-a,/variant-b');
      setMeta('experiment-split', '10'); // only one value for two challengers
      window.fetch = async () => ({ ok: false });

      const { runExperiment: freshRun } = await freshExperimentation();
      const result = await freshRun();

      expect(result).to.not.equal(null);
    });
  });

  describe('chrome-scoped experiments (experiment-selector + late phase, UC-02)', () => {
    it('no-ops in the early phase when experiment-selector is set — belongs to the late phase instead', async () => {
      setConsent({ personalization: true });
      setMeta('experiment', 'nav-test');
      setMeta('experiment-variants', '/variant-a');
      setMeta('experiment-selector', '.nav-target');
      document.body.insertAdjacentHTML('beforeend', '<nav class="nav-target"><p>Default nav</p></nav>');

      const result = await runExperiment(); // default phase = 'early'

      expect(result).to.equal(null);
    });

    it('no-ops in the late phase when experiment-selector is absent — belongs to the early phase instead', async () => {
      setConsent({ personalization: true });
      setMeta('experiment', 'hero-test');
      setMeta('experiment-variants', '/variant-a');

      const result = await runExperiment('late');

      expect(result).to.equal(null);
    });

    it('applies the variant to the selector target in the late phase, leaving <main> untouched', async () => {
      setMeta('experiment', 'nav-test');
      setMeta('experiment-variants', '/variant-a');
      setMeta('experiment-selector', '.nav-target');
      document.body.insertAdjacentHTML('beforeend', '<nav class="nav-target"><p>Default nav</p></nav>');
      window.fetch = async () => ({ ok: true, text: async () => '<p>Variant nav</p>' });

      const { runExperiment: freshRun } = await freshExperimentation('?experimentPreview=/variant-a');
      const result = await freshRun('late');

      expect(result.variant).to.equal('/variant-a');
      expect(document.querySelector('.nav-target p').textContent).to.equal('Variant nav');
      expect(document.querySelector('main p').textContent).to.equal('Control content');
    });

    it('waits for a late-appearing selector target before applying (bounded poll)', async () => {
      setMeta('experiment', 'nav-test');
      setMeta('experiment-variants', '/variant-a');
      setMeta('experiment-selector', '.nav-target');
      window.fetch = async () => ({ ok: true, text: async () => '<p>Variant nav</p>' });

      setTimeout(() => {
        document.body.insertAdjacentHTML('beforeend', '<nav class="nav-target"><p>Default nav</p></nav>');
      }, 150);

      const { runExperiment: freshRun } = await freshExperimentation('?experimentPreview=/variant-a');
      const result = await freshRun('late');

      expect(result.variant).to.equal('/variant-a');
      expect(document.querySelector('.nav-target p').textContent).to.equal('Variant nav');
    });

    it('fails open — no swap, no tracking — when the selector never resolves', async () => {
      setConsent({ personalization: true, analytics: true });
      setMeta('experiment', 'nav-test');
      setMeta('experiment-variants', '/variant-a');
      setMeta('experiment-selector', '.nav-target-that-never-appears');
      let fetchCalled = false;
      window.fetch = async () => {
        fetchCalled = true;
        return { ok: true, text: async () => '<p>x</p>' };
      };

      const result = await runExperiment('late');

      expect(result).to.equal(null);
      expect(fetchCalled).to.be.false;
      expect(tracked).to.have.length(0);
    });

    it('tags the tracked event renderType as element-swap, not full-page-swap', async () => {
      setConsent({ personalization: true, analytics: true });
      setMeta('experiment', 'nav-test');
      setMeta('experiment-variants', '/variant-a');
      setMeta('experiment-selector', '.nav-target');
      document.body.insertAdjacentHTML('beforeend', '<nav class="nav-target"><p>Default nav</p></nav>');
      window.fetch = async () => ({ ok: true, text: async () => '<p>Variant nav</p>' });

      await runExperiment('late');

      expect(tracked).to.have.length(1);
      expect(tracked[0].renderType).to.equal('element-swap');
    });
  });
});
