import { expect } from '@esm-bundle/chai';
import auditPzn, { auditExperimentCollision } from '../../../scripts/utils/analytics/pzn-audit.js';

// pzn.js memoizes `variantsPromise` at module scope, and that promise is a
// singleton shared across every importer — a statically-imported dependency
// is NOT freshened by cache-busting the importer (verified experimentally),
// so cache-busting pzn-audit alone leaks one test's variants into the next.
// pzn-audit's default export takes an optional loader for exactly this reason:
// each test imports a genuinely fresh pzn.js instance (browsers key modules by
// full URL) and injects its loadVariants, exercising the real fetch +
// isValidRow path in isolation. sessionStorage is cleared per test because the
// variants cache key is shared across instances.
const FIXTURE_URL = '/system/personalization/variants.json';

let importCounter = 0;
const freshLoadVariants = async () => {
  importCounter += 1;
  const mod = await import(`../../../scripts/utils/analytics/pzn.js?t=${importCounter}`);
  return mod.loadVariants;
};

const variantRow = (overrides = {}) => ({
  placement: 'hero-cta',
  segment: 'enterprise',
  type: 'cta',
  selector: '.cta-link',
  fragment: '',
  label: 'Enterprise CTA',
  href: '/enterprise',
  weight: '100',
  commit_until: '',
  ...overrides,
});

const mockVariants = (rows) => {
  window.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    if (url.includes(FIXTURE_URL)) return { ok: true, json: async () => ({ data: rows }) };
    return { ok: false, status: 404 };
  };
};

const mockAbsentSheet = () => { window.fetch = async () => ({ ok: false, status: 404 }); };

describe('scripts/utils/analytics/pzn-audit.js', () => {
  let warnCalls;
  let originalWarn;
  let originalFetch;

  beforeEach(() => {
    warnCalls = [];
    originalWarn = console.warn;
    originalFetch = window.fetch;
    sessionStorage.clear();
    // eslint-disable-next-line no-console -- capturing the warning IS the test
    console.warn = (...args) => warnCalls.push(args);
  });

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.warn = originalWarn;
    window.fetch = originalFetch;
    // Symmetric with beforeEach: the variants cache key ('pzn-variants-cache-v1')
    // is process-global, so leave it clean for any later suite that reads it
    // without clearing first (this project has real cross-file state-leak history).
    sessionStorage.clear();
  });

  it('warns once when two rows share a placement+segment but target DIFFERENT selectors', async () => {
    mockVariants([
      variantRow({ selector: '.cta-primary', label: 'Variant A', href: '/a' }),
      variantRow({ selector: '.cta-secondary', label: 'Variant B', href: '/b' }),
    ]);
    await auditPzn(await freshLoadVariants());

    expect(warnCalls).to.have.length(1);
    const [message] = warnCalls[0];
    expect(message).to.include('hero-cta');
    expect(message).to.include('enterprise');
    expect(message).to.include('.cta-primary');
    expect(message).to.include('.cta-secondary');
  });

  it('does NOT warn when rows share placement+segment AND selector (intentional weighted A/B split)', async () => {
    mockVariants([
      variantRow({ selector: '.cta-link', label: 'Variant A', href: '/a', weight: '50' }),
      variantRow({ selector: '.cta-link', label: 'Variant B', href: '/b', weight: '50' }),
    ]);
    await auditPzn(await freshLoadVariants());

    expect(warnCalls).to.have.length(0);
  });

  it('still warns once on a partial collision (two rows one selector, one row another)', async () => {
    mockVariants([
      variantRow({ selector: '.cta-link', label: 'A', href: '/a', weight: '50' }),
      variantRow({ selector: '.cta-link', label: 'B', href: '/b', weight: '50' }),
      variantRow({ selector: '.cta-other', label: 'C', href: '/c' }),
    ]);
    await auditPzn(await freshLoadVariants());

    expect(warnCalls).to.have.length(1);
  });

  it('does NOT warn when rows fall in different placement/segment groups', async () => {
    mockVariants([
      variantRow({ placement: 'hero-cta', segment: 'enterprise', selector: '.a' }),
      variantRow({ placement: 'footer-cta', segment: 'smb', selector: '.b' }),
    ]);
    await auditPzn(await freshLoadVariants());

    expect(warnCalls).to.have.length(0);
  });

  it('warns once per colliding group when several groups collide independently', async () => {
    mockVariants([
      variantRow({ placement: 'hero-cta', segment: 'enterprise', selector: '.a1' }),
      variantRow({ placement: 'hero-cta', segment: 'enterprise', selector: '.a2' }),
      variantRow({ placement: 'footer-cta', segment: 'smb', selector: '.b1' }),
      variantRow({ placement: 'footer-cta', segment: 'smb', selector: '.b2', label: 'B2', href: '/b2' }),
    ]);
    await auditPzn(await freshLoadVariants());

    expect(warnCalls).to.have.length(2);
  });

  it('does NOT warn on a single row', async () => {
    mockVariants([variantRow()]);
    await auditPzn(await freshLoadVariants());

    expect(warnCalls).to.have.length(0);
  });

  it('does NOT warn or throw on an empty variants sheet', async () => {
    mockVariants([]);
    let error = null;
    await auditPzn(await freshLoadVariants()).catch((e) => { error = e; });

    expect(error).to.equal(null);
    expect(warnCalls).to.have.length(0);
  });

  it('does NOT warn or throw on an absent variants sheet (fetch 404 → fails open to [])', async () => {
    mockAbsentSheet();
    let error = null;
    await auditPzn(await freshLoadVariants()).catch((e) => { error = e; });

    expect(error).to.equal(null);
    expect(warnCalls).to.have.length(0);
  });

  it('ignores a malformed row (dropped by isValidRow) so it never counts toward a collision', async () => {
    mockVariants([
      variantRow({ selector: '.cta-link' }),
      variantRow({ selector: '.cta-other', weight: 'not-a-number' }), // invalid → dropped
    ]);
    await auditPzn(await freshLoadVariants());

    // Only one valid row survives → no collision, even though the raw sheet had
    // two differing selectors in the same placement+segment.
    expect(warnCalls).to.have.length(0);
  });
});

describe('scripts/utils/analytics/pzn-audit.js — auditExperimentCollision (ADR-003)', () => {
  let warnCalls;
  let originalWarn;

  beforeEach(() => {
    warnCalls = [];
    originalWarn = console.warn;
    // eslint-disable-next-line no-console -- capturing the warning IS the test
    console.warn = (...args) => warnCalls.push(args);
  });

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.warn = originalWarn;
  });

  const buildRoot = (html) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  };
  const loadRows = (rows) => async () => rows;

  it('warns when experiment-selector CONTAINS a pzn slot target (late chrome swap over a pzn slot)', async () => {
    const root = buildRoot(`
      <div class="main-nav-section">
        <div data-pzn="nav-cta"><a class="cta-link">Default</a></div>
      </div>`);
    await auditExperimentCollision({
      experimentSelector: '.main-nav-section',
      root,
      load: loadRows([variantRow({ placement: 'nav-cta', selector: '.cta-link' })]),
    });

    expect(warnCalls).to.have.length(1);
    expect(warnCalls[0][0]).to.include('ADR-003');
    expect(warnCalls[0][0]).to.include('nav-cta');
    expect(warnCalls[0][0]).to.include('.main-nav-section');
  });

  it('warns when experiment-selector and a pzn selector resolve to the SAME element', async () => {
    const root = buildRoot(`
      <div class="chrome" data-pzn="hero">
        <a class="shared cta-link">Default</a>
      </div>`);
    await auditExperimentCollision({
      experimentSelector: '.shared',
      root,
      load: loadRows([variantRow({ placement: 'hero', selector: '.cta-link' })]),
    });

    expect(warnCalls).to.have.length(1);
  });

  it('does NOT warn when the experiment target and pzn target are disjoint', async () => {
    const root = buildRoot(`
      <div class="wrap">
        <div class="main-nav-section"><a class="nav-link">nav</a></div>
        <div data-pzn="body-cta"><a class="cta-link">cta</a></div>
      </div>`);
    await auditExperimentCollision({
      experimentSelector: '.main-nav-section',
      root,
      load: loadRows([variantRow({ placement: 'body-cta', selector: '.cta-link' })]),
    });

    expect(warnCalls).to.have.length(0);
  });

  it('does NOT warn when the page has no experiment-selector (not a late-phase experiment)', async () => {
    const root = buildRoot('<div data-pzn="hero"><a class="cta-link">x</a></div>');
    await auditExperimentCollision({
      experimentSelector: '',
      root,
      load: loadRows([variantRow({ placement: 'hero', selector: '.cta-link' })]),
    });

    expect(warnCalls).to.have.length(0);
  });

  it('does NOT warn when the experiment target is not present on this page', async () => {
    const root = buildRoot('<div data-pzn="hero"><a class="cta-link">x</a></div>');
    await auditExperimentCollision({
      experimentSelector: '.not-on-this-page',
      root,
      load: loadRows([variantRow({ placement: 'hero', selector: '.cta-link' })]),
    });

    expect(warnCalls).to.have.length(0);
  });

  it('does NOT warn or throw on a malformed experiment-selector', async () => {
    const root = buildRoot('<div data-pzn="hero"><a class="cta-link">x</a></div>');
    let error = null;
    await auditExperimentCollision({
      experimentSelector: '::::',
      root,
      load: loadRows([variantRow({ placement: 'hero', selector: '.cta-link' })]),
    }).catch((e) => { error = e; });

    expect(error).to.equal(null);
    expect(warnCalls).to.have.length(0);
  });

  it('does NOT warn when the [data-pzn] placement has no authored variant row', async () => {
    const root = buildRoot(`
      <div class="main-nav-section">
        <div data-pzn="ghost"><a class="cta-link">x</a></div>
      </div>`);
    await auditExperimentCollision({
      experimentSelector: '.main-nav-section',
      root,
      load: loadRows([variantRow({ placement: 'other-placement', selector: '.cta-link' })]),
    });

    expect(warnCalls).to.have.length(0);
  });

  it('ignores a malformed pzn selector without warning or throwing', async () => {
    const root = buildRoot(`
      <div class="main-nav-section">
        <div data-pzn="nav-cta"><a class="cta-link">x</a></div>
      </div>`);
    let error = null;
    await auditExperimentCollision({
      experimentSelector: '.main-nav-section',
      root,
      load: loadRows([variantRow({ placement: 'nav-cta', selector: '::bad' })]),
    }).catch((e) => { error = e; });

    expect(error).to.equal(null);
    expect(warnCalls).to.have.length(0);
  });
});
